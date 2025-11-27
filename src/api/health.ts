/**
 * Health Check Module
 *
 * Provides comprehensive health and readiness checks for the API.
 * Follows Kubernetes health check patterns:
 * - /health (liveness): Is the server running?
 * - /ready (readiness): Is the server ready to accept traffic?
 */

import { getDb } from "../db/index.js";
import { circuitBreakers } from "../services/circuit-breaker.js";
import { getCertificateInfo } from "../services/myinvois/certificate.js";

export type HealthStatus = "healthy" | "degraded" | "unhealthy";
export type ServiceStatus = "up" | "down" | "degraded";

export interface ServiceCheck {
  status: ServiceStatus;
  latency_ms?: number;
  message?: string;
  details?: Record<string, unknown>;
}

export interface HealthCheckResponse {
  status: HealthStatus;
  timestamp: string;
  version: string;
  uptime_seconds: number;
  checks: {
    database: ServiceCheck;
    certificate?: ServiceCheck;
    circuit_breakers: {
      lhdn: ServiceCheck;
      openai: ServiceCheck;
      email: ServiceCheck;
    };
  };
  memory?: {
    used_mb: number;
    total_mb: number;
    percentage: number;
  };
}

const startTime = Date.now();
const VERSION = process.env.npm_package_version || "1.0.0";

/**
 * Check database connectivity and latency
 */
function checkDatabase(): ServiceCheck {
  try {
    const start = Date.now();
    const db = getDb();

    // Simple query to check connectivity
    const result = db.prepare("SELECT 1 as ok").get() as { ok: number } | undefined;
    const latency = Date.now() - start;

    if (result?.ok === 1) {
      return {
        status: latency > 100 ? "degraded" : "up",
        latency_ms: latency,
        message: latency > 100 ? "High latency detected" : undefined,
      };
    }

    return {
      status: "down",
      message: "Query returned unexpected result",
    };
  } catch (error) {
    return {
      status: "down",
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check LHDN certificate status
 */
function checkCertificate(): ServiceCheck {
  try {
    const certInfo = getCertificateInfo();

    if (!certInfo.valid) {
      return {
        status: "down",
        message: certInfo.error || "Certificate not valid",
      };
    }

    if (certInfo.isExpired) {
      return {
        status: "down",
        message: "Certificate has expired",
        details: {
          validTo: certInfo.validTo?.toISOString(),
          daysUntilExpiry: certInfo.daysUntilExpiry,
        },
      };
    }

    if (certInfo.isExpiringSoon) {
      return {
        status: "degraded",
        message: `Certificate expires in ${certInfo.daysUntilExpiry} days`,
        details: {
          validTo: certInfo.validTo?.toISOString(),
          daysUntilExpiry: certInfo.daysUntilExpiry,
          subject: certInfo.subject,
        },
      };
    }

    return {
      status: "up",
      message: `Valid for ${certInfo.daysUntilExpiry} days`,
      details: {
        subject: certInfo.subject,
        validTo: certInfo.validTo?.toISOString(),
        daysUntilExpiry: certInfo.daysUntilExpiry,
      },
    };
  } catch (error) {
    // Certificate might not be configured
    return {
      status: "up",
      message: "Certificate not configured",
    };
  }
}

/**
 * Check circuit breaker states
 */
function checkCircuitBreakers(): {
  lhdn: ServiceCheck;
  openai: ServiceCheck;
  email: ServiceCheck;
} {
  const mapState = (breaker: typeof circuitBreakers.lhdn): ServiceCheck => {
    const stats = breaker.getStats();
    const state = stats.state;

    if (state === "open") {
      return {
        status: "down",
        message: "Circuit open - service unavailable",
        details: {
          failures: stats.failures,
          lastFailure: stats.lastFailure?.toISOString(),
        },
      };
    }

    if (state === "half_open") {
      return {
        status: "degraded",
        message: "Circuit half-open - testing recovery",
        details: {
          successes: stats.successes,
          failures: stats.failures,
        },
      };
    }

    return {
      status: "up",
      details: {
        failures: stats.failures,
      },
    };
  };

  return {
    lhdn: mapState(circuitBreakers.lhdn),
    openai: mapState(circuitBreakers.openai),
    email: mapState(circuitBreakers.email),
  };
}

/**
 * Get memory usage stats
 */
function getMemoryStats(): { used_mb: number; total_mb: number; percentage: number } {
  const used = process.memoryUsage();
  const heapUsed = Math.round(used.heapUsed / 1024 / 1024);
  const heapTotal = Math.round(used.heapTotal / 1024 / 1024);

  return {
    used_mb: heapUsed,
    total_mb: heapTotal,
    percentage: Math.round((heapUsed / heapTotal) * 100),
  };
}

/**
 * Determine overall health status from individual checks
 */
function determineOverallStatus(checks: HealthCheckResponse["checks"]): HealthStatus {
  // Database down = unhealthy
  if (checks.database.status === "down") {
    return "unhealthy";
  }

  // Certificate expired = unhealthy
  if (checks.certificate?.status === "down") {
    return "unhealthy";
  }

  // Any circuit open = degraded
  const circuitStatuses = Object.values(checks.circuit_breakers);
  if (circuitStatuses.some((c) => c.status === "down")) {
    return "degraded";
  }

  // Any degraded = degraded
  if (
    checks.database.status === "degraded" ||
    checks.certificate?.status === "degraded" ||
    circuitStatuses.some((c) => c.status === "degraded")
  ) {
    return "degraded";
  }

  return "healthy";
}

/**
 * Perform full health check
 */
export function performHealthCheck(): HealthCheckResponse {
  const checks = {
    database: checkDatabase(),
    certificate: checkCertificate(),
    circuit_breakers: checkCircuitBreakers(),
  };

  return {
    status: determineOverallStatus(checks),
    timestamp: new Date().toISOString(),
    version: VERSION,
    uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
    checks,
    memory: getMemoryStats(),
  };
}

/**
 * Simple liveness check (is the server running?)
 */
export function livenessCheck(): { status: "healthy"; timestamp: string } {
  return {
    status: "healthy",
    timestamp: new Date().toISOString(),
  };
}

/**
 * Readiness check (is the server ready to accept traffic?)
 */
export function readinessCheck(): { ready: boolean; status: HealthStatus; reason?: string } {
  const health = performHealthCheck();

  if (health.status === "unhealthy") {
    return {
      ready: false,
      status: health.status,
      reason: health.checks.database.status === "down"
        ? "Database unavailable"
        : health.checks.certificate?.status === "down"
          ? "Certificate invalid"
          : "Service unhealthy",
    };
  }

  return {
    ready: true,
    status: health.status,
  };
}

// ==========================================
// Prometheus Metrics
// ==========================================

interface MetricValue {
  labels?: Record<string, string>;
  value: number;
}

interface Metric {
  name: string;
  help: string;
  type: "counter" | "gauge" | "histogram";
  values: MetricValue[];
}

// Request counters (in-memory for simplicity)
const requestCounts: Record<string, number> = {};
const requestDurations: Record<string, number[]> = {};

/**
 * Record an HTTP request for metrics
 */
export function recordRequest(
  method: string,
  path: string,
  statusCode: number,
  durationMs: number
): void {
  const key = `${method}_${path}_${statusCode}`;
  requestCounts[key] = (requestCounts[key] || 0) + 1;

  const durationKey = `${method}_${path}`;
  if (!requestDurations[durationKey]) {
    requestDurations[durationKey] = [];
  }
  // Keep last 1000 samples for histogram
  requestDurations[durationKey].push(durationMs);
  if (requestDurations[durationKey].length > 1000) {
    requestDurations[durationKey].shift();
  }
}

/**
 * Generate Prometheus metrics in text format
 */
export function getPrometheusMetrics(): string {
  const health = performHealthCheck();
  const metrics: Metric[] = [];

  // Application info
  metrics.push({
    name: "openaccounting_info",
    help: "Application information",
    type: "gauge",
    values: [
      {
        labels: { version: VERSION },
        value: 1,
      },
    ],
  });

  // Uptime
  metrics.push({
    name: "openaccounting_uptime_seconds",
    help: "Time since server started in seconds",
    type: "counter",
    values: [{ value: Math.floor((Date.now() - startTime) / 1000) }],
  });

  // Health status (1 = healthy, 0.5 = degraded, 0 = unhealthy)
  metrics.push({
    name: "openaccounting_health_status",
    help: "Overall health status (1=healthy, 0.5=degraded, 0=unhealthy)",
    type: "gauge",
    values: [
      {
        value: health.status === "healthy" ? 1 : health.status === "degraded" ? 0.5 : 0,
      },
    ],
  });

  // Database status
  metrics.push({
    name: "openaccounting_database_up",
    help: "Database availability (1=up, 0=down)",
    type: "gauge",
    values: [
      {
        value: health.checks.database.status === "up" ? 1 : 0,
      },
    ],
  });

  // Database latency
  if (health.checks.database.latency_ms !== undefined) {
    metrics.push({
      name: "openaccounting_database_latency_ms",
      help: "Database query latency in milliseconds",
      type: "gauge",
      values: [{ value: health.checks.database.latency_ms }],
    });
  }

  // Circuit breaker states
  const circuitBreakerNames = ["lhdn", "openai", "email"] as const;
  for (const name of circuitBreakerNames) {
    const cb = health.checks.circuit_breakers[name];
    metrics.push({
      name: "openaccounting_circuit_breaker_state",
      help: "Circuit breaker state (1=closed, 0.5=half_open, 0=open)",
      type: "gauge",
      values: [
        {
          labels: { service: name },
          value: cb.status === "up" ? 1 : cb.status === "degraded" ? 0.5 : 0,
        },
      ],
    });
  }

  // Memory usage
  if (health.memory) {
    metrics.push({
      name: "openaccounting_memory_used_bytes",
      help: "Heap memory used in bytes",
      type: "gauge",
      values: [{ value: health.memory.used_mb * 1024 * 1024 }],
    });

    metrics.push({
      name: "openaccounting_memory_total_bytes",
      help: "Total heap memory in bytes",
      type: "gauge",
      values: [{ value: health.memory.total_mb * 1024 * 1024 }],
    });
  }

  // HTTP request counts
  const requestLabels = Object.keys(requestCounts);
  if (requestLabels.length > 0) {
    metrics.push({
      name: "openaccounting_http_requests_total",
      help: "Total number of HTTP requests",
      type: "counter",
      values: requestLabels.map((key) => {
        const [method, path, status] = key.split("_");
        return {
          labels: { method, path, status },
          value: requestCounts[key],
        };
      }),
    });
  }

  // Process info
  const memUsage = process.memoryUsage();
  metrics.push({
    name: "process_resident_memory_bytes",
    help: "Resident memory size in bytes",
    type: "gauge",
    values: [{ value: memUsage.rss }],
  });

  metrics.push({
    name: "process_heap_bytes",
    help: "Process heap size in bytes",
    type: "gauge",
    values: [{ value: memUsage.heapUsed }],
  });

  // Node.js version
  metrics.push({
    name: "nodejs_version_info",
    help: "Node.js version info",
    type: "gauge",
    values: [
      {
        labels: { version: process.version },
        value: 1,
      },
    ],
  });

  // Format metrics in Prometheus text format
  return formatPrometheusMetrics(metrics);
}

/**
 * Format metrics array to Prometheus text exposition format
 */
function formatPrometheusMetrics(metrics: Metric[]): string {
  const lines: string[] = [];

  for (const metric of metrics) {
    lines.push(`# HELP ${metric.name} ${metric.help}`);
    lines.push(`# TYPE ${metric.name} ${metric.type}`);

    for (const v of metric.values) {
      if (v.labels && Object.keys(v.labels).length > 0) {
        const labelStr = Object.entries(v.labels)
          .map(([k, val]) => `${k}="${escapeLabel(val)}"`)
          .join(",");
        lines.push(`${metric.name}{${labelStr}} ${v.value}`);
      } else {
        lines.push(`${metric.name} ${v.value}`);
      }
    }
  }

  return lines.join("\n") + "\n";
}

/**
 * Escape label values for Prometheus format
 */
function escapeLabel(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n");
}
