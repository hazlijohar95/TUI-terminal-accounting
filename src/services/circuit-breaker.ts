/**
 * Circuit Breaker Pattern Implementation
 *
 * Prevents cascading failures when external services are unavailable.
 * Three states:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service is failing, requests are rejected immediately
 * - HALF_OPEN: Testing if service has recovered
 */

export type CircuitState = "closed" | "open" | "half_open";

export interface CircuitBreakerOptions {
  /** Number of failures before opening circuit (default: 5) */
  failureThreshold?: number;
  /** Time in ms before attempting to close circuit (default: 30000) */
  resetTimeout?: number;
  /** Number of successful calls in half-open to close circuit (default: 2) */
  successThreshold?: number;
  /** Optional name for logging */
  name?: string;
  /** Callback when circuit opens */
  onOpen?: () => void;
  /** Callback when circuit closes */
  onClose?: () => void;
  /** Callback when circuit enters half-open state */
  onHalfOpen?: () => void;
}

export class CircuitBreakerError extends Error {
  constructor(
    message: string,
    public readonly circuitName: string,
    public readonly state: CircuitState
  ) {
    super(message);
    this.name = "CircuitBreakerError";
  }
}

export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failures: number = 0;
  private successes: number = 0;
  private lastFailureTime: number = 0;
  private readonly options: Required<CircuitBreakerOptions>;

  constructor(options: CircuitBreakerOptions = {}) {
    this.options = {
      failureThreshold: options.failureThreshold ?? 5,
      resetTimeout: options.resetTimeout ?? 30000,
      successThreshold: options.successThreshold ?? 2,
      name: options.name ?? "default",
      onOpen: options.onOpen ?? (() => {}),
      onClose: options.onClose ?? (() => {}),
      onHalfOpen: options.onHalfOpen ?? (() => {}),
    };
  }

  /**
   * Execute a function through the circuit breaker
   * @throws CircuitBreakerError if circuit is open
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if we should transition from open to half-open
    if (this.state === "open") {
      if (Date.now() - this.lastFailureTime >= this.options.resetTimeout) {
        this.transitionTo("half_open");
      } else {
        throw new CircuitBreakerError(
          `Circuit breaker is open for service: ${this.options.name}`,
          this.options.name,
          this.state
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Execute a sync function through the circuit breaker
   */
  executeSync<T>(fn: () => T): T {
    if (this.state === "open") {
      if (Date.now() - this.lastFailureTime >= this.options.resetTimeout) {
        this.transitionTo("half_open");
      } else {
        throw new CircuitBreakerError(
          `Circuit breaker is open for service: ${this.options.name}`,
          this.options.name,
          this.state
        );
      }
    }

    try {
      const result = fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    if (this.state === "half_open") {
      this.successes++;
      if (this.successes >= this.options.successThreshold) {
        this.transitionTo("closed");
      }
    } else if (this.state === "closed") {
      // Reset failure count on success in closed state
      this.failures = 0;
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === "half_open") {
      // Any failure in half-open state reopens the circuit
      this.transitionTo("open");
    } else if (this.state === "closed" && this.failures >= this.options.failureThreshold) {
      this.transitionTo("open");
    }
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;

    // Reset counters on state change
    if (newState === "closed") {
      this.failures = 0;
      this.successes = 0;
      console.log(`[CIRCUIT BREAKER] ${this.options.name}: ${oldState} → ${newState}`);
      this.options.onClose();
    } else if (newState === "half_open") {
      this.successes = 0;
      console.log(`[CIRCUIT BREAKER] ${this.options.name}: ${oldState} → ${newState}`);
      this.options.onHalfOpen();
    } else if (newState === "open") {
      console.log(`[CIRCUIT BREAKER] ${this.options.name}: ${oldState} → ${newState}`);
      this.options.onOpen();
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    // Check if we should auto-transition from open to half-open
    if (this.state === "open" && Date.now() - this.lastFailureTime >= this.options.resetTimeout) {
      return "half_open";
    }
    return this.state;
  }

  /**
   * Get statistics
   */
  getStats(): {
    state: CircuitState;
    failures: number;
    successes: number;
    lastFailure: Date | null;
  } {
    return {
      state: this.getState(),
      failures: this.failures,
      successes: this.successes,
      lastFailure: this.lastFailureTime ? new Date(this.lastFailureTime) : null,
    };
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.state = "closed";
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = 0;
    console.log(`[CIRCUIT BREAKER] ${this.options.name}: manually reset`);
  }

  /**
   * Manually open the circuit breaker
   * Useful for maintenance windows
   */
  trip(): void {
    this.transitionTo("open");
    this.lastFailureTime = Date.now();
  }
}

// Pre-configured circuit breakers for common services
export const circuitBreakers = {
  lhdn: new CircuitBreaker({
    name: "LHDN MyInvois",
    failureThreshold: 3,
    resetTimeout: 60000, // 1 minute
    successThreshold: 2,
  }),

  openai: new CircuitBreaker({
    name: "OpenAI",
    failureThreshold: 3,
    resetTimeout: 30000, // 30 seconds
    successThreshold: 1,
  }),

  email: new CircuitBreaker({
    name: "Email (Resend)",
    failureThreshold: 5,
    resetTimeout: 120000, // 2 minutes
    successThreshold: 2,
  }),
};

/**
 * Decorator-style wrapper for async functions
 */
export function withCircuitBreaker<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  breaker: CircuitBreaker
): T {
  return (async (...args: Parameters<T>) => {
    return breaker.execute(() => fn(...args));
  }) as T;
}
