/**
 * API Error Utilities
 *
 * Standardized error handling following RFC 7807 (Problem Details).
 * https://tools.ietf.org/html/rfc7807
 */

/**
 * Base API Error class following RFC 7807 Problem Details
 */
export class APIError extends Error {
  public readonly status: number;
  public readonly type: string;
  public readonly title: string;
  public readonly detail?: string;
  public readonly instance?: string;

  constructor(
    status: number,
    type: string,
    title: string,
    detail?: string,
    instance?: string
  ) {
    super(detail || title);
    this.name = "APIError";
    this.status = status;
    this.type = type;
    this.title = title;
    this.detail = detail;
    this.instance = instance;
  }

  /**
   * Convert to RFC 7807 Problem Details JSON
   */
  toJSON(): ProblemDetails {
    return {
      type: `https://api.openaccounting.dev/errors/${this.type}`,
      title: this.title,
      status: this.status,
      ...(this.detail && { detail: this.detail }),
      ...(this.instance && { instance: this.instance }),
    };
  }
}

/**
 * RFC 7807 Problem Details interface
 */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  [key: string]: unknown;
}

/**
 * Pre-defined error factories for common scenarios
 */
export const Errors = {
  // 400 Bad Request
  badRequest: (detail?: string) =>
    new APIError(400, "bad-request", "Bad Request", detail),

  validation: (detail: string) =>
    new APIError(400, "validation-error", "Validation Failed", detail),

  invalidJson: () =>
    new APIError(400, "invalid-json", "Invalid JSON", "Request body is not valid JSON"),

  // 401 Unauthorized
  unauthorized: (detail?: string) =>
    new APIError(401, "unauthorized", "Authentication Required", detail || "Valid authentication credentials are required"),

  invalidApiKey: () =>
    new APIError(401, "invalid-api-key", "Invalid API Key", "The provided API key is invalid or expired"),

  invalidToken: () =>
    new APIError(401, "invalid-token", "Invalid Token", "The provided authentication token is invalid or expired"),

  // 403 Forbidden
  forbidden: (detail?: string) =>
    new APIError(403, "forbidden", "Access Denied", detail || "You do not have permission to access this resource"),

  insufficientScope: (required: string) =>
    new APIError(403, "insufficient-scope", "Insufficient Scope", `This action requires the '${required}' scope`),

  // 404 Not Found
  notFound: (resource: string, id?: string) =>
    new APIError(
      404,
      "not-found",
      "Resource Not Found",
      id ? `${resource} with ID '${id}' was not found` : `${resource} not found`
    ),

  // 409 Conflict
  conflict: (detail: string) =>
    new APIError(409, "conflict", "Resource Conflict", detail),

  duplicateEntry: (field: string, value: string) =>
    new APIError(409, "duplicate-entry", "Duplicate Entry", `A record with ${field} '${value}' already exists`),

  // 422 Unprocessable Entity
  unprocessable: (detail: string) =>
    new APIError(422, "unprocessable-entity", "Unprocessable Entity", detail),

  businessRuleViolation: (detail: string) =>
    new APIError(422, "business-rule-violation", "Business Rule Violation", detail),

  // 429 Too Many Requests
  rateLimit: (retryAfter?: number) => {
    const error = new APIError(
      429,
      "rate-limit-exceeded",
      "Too Many Requests",
      "Rate limit exceeded. Please slow down your requests."
    );
    // Add retry-after as extension member
    return Object.assign(error, { retryAfter });
  },

  // 500 Internal Server Error
  internal: (detail?: string) =>
    new APIError(500, "internal-error", "Internal Server Error", detail || "An unexpected error occurred"),

  // 503 Service Unavailable
  serviceUnavailable: (service: string) =>
    new APIError(503, "service-unavailable", "Service Unavailable", `The ${service} service is temporarily unavailable`),
} as const;

/**
 * Check if an error is an APIError
 */
export function isAPIError(error: unknown): error is APIError {
  return error instanceof APIError;
}

/**
 * Convert any error to APIError
 */
export function toAPIError(error: unknown): APIError {
  if (isAPIError(error)) {
    return error;
  }

  if (error instanceof Error) {
    // Check for Zod validation errors
    if (error.name === "ZodError") {
      const zodError = error as { errors?: Array<{ path: string[]; message: string }> };
      const details = zodError.errors
        ?.map((e) => `${e.path.join(".")}: ${e.message}`)
        .join("; ");
      return Errors.validation(details || error.message);
    }

    // Generic error
    return Errors.internal(
      process.env.NODE_ENV === "development" ? error.message : undefined
    );
  }

  return Errors.internal();
}
