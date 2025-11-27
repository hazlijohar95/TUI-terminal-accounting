/**
 * OpenAccounting API Server
 *
 * Fastify-based REST API with:
 * - Authentication (API keys + JWT)
 * - Rate limiting
 * - OpenAPI documentation
 * - RFC 7807 error responses
 */

import Fastify, { FastifyInstance, FastifyError } from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { env, getAllowedOrigins } from "../config/env.js";
import authPlugin from "./plugins/auth.js";
import { APIError, isAPIError, toAPIError, ProblemDetails } from "./utils/errors.js";

/**
 * Build and configure the Fastify server
 */
export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      transport:
        env.NODE_ENV === "development"
          ? { target: "pino-pretty", options: { colorize: true } }
          : undefined,
    },
    // Trust proxy headers (X-Forwarded-*) when behind reverse proxy
    trustProxy: env.TRUST_PROXY,
    // Ajv options for JSON Schema validation
    ajv: {
      customOptions: {
        removeAdditional: "all",
        useDefaults: true,
        coerceTypes: true,
        allErrors: true,
      },
    },
  });

  // ============================================
  // HTTPS ENFORCEMENT (when behind proxy)
  // ============================================
  if (env.REQUIRE_HTTPS) {
    app.addHook("onRequest", async (request, reply) => {
      // Check if request came over HTTPS
      // X-Forwarded-Proto is set by reverse proxies (nginx, Cloudflare, etc.)
      const proto = request.headers["x-forwarded-proto"] || request.protocol;

      // Skip for health checks and localhost development
      if (
        request.url === "/health" ||
        request.url === "/ready" ||
        request.hostname === "localhost"
      ) {
        return;
      }

      if (proto !== "https") {
        const httpsUrl = `https://${request.hostname}${request.url}`;
        return reply
          .status(301)
          .header("Location", httpsUrl)
          .header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
          .send({ redirectTo: httpsUrl });
      }

      // Add HSTS header for all HTTPS responses
      reply.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    });
  }

  // ============================================
  // CORS
  // ============================================
  await app.register(cors, {
    origin: getAllowedOrigins(),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"],
    exposedHeaders: ["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
    credentials: true,
  });

  // ============================================
  // RATE LIMITING
  // ============================================
  await app.register(rateLimit, {
    max: env.API_RATE_LIMIT,
    timeWindow: "1 minute",
    keyGenerator: (request) => {
      // Use API key or IP for rate limiting
      return (request.headers["x-api-key"] as string) || request.ip;
    },
    errorResponseBuilder: (request, context) => {
      return {
        type: "https://api.openaccounting.dev/errors/rate-limit-exceeded",
        title: "Too Many Requests",
        status: 429,
        detail: `Rate limit exceeded. Retry after ${Math.ceil(context.ttl / 1000)} seconds.`,
      };
    },
  });

  // ============================================
  // OPENAPI DOCUMENTATION
  // ============================================
  await app.register(swagger, {
    openapi: {
      info: {
        title: "OpenAccounting API",
        description: `
## Overview

OpenAccounting API provides programmatic access to your accounting data.

## Authentication

All API requests require authentication using one of these methods:

### API Key
Include your API key in the \`X-API-Key\` header:
\`\`\`
X-API-Key: oa_your_api_key_here
\`\`\`

### JWT Bearer Token
Include a JWT token in the \`Authorization\` header:
\`\`\`
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
\`\`\`

## Rate Limiting

- **Limit**: ${env.API_RATE_LIMIT} requests per minute
- Rate limit headers are included in all responses
- Exceeding the limit returns HTTP 429

## Error Handling

All errors follow [RFC 7807 Problem Details](https://tools.ietf.org/html/rfc7807) format:

\`\`\`json
{
  "type": "https://api.openaccounting.dev/errors/not-found",
  "title": "Resource Not Found",
  "status": 404,
  "detail": "Invoice with ID 'xyz' was not found"
}
\`\`\`
        `,
        version: "1.0.0",
        contact: {
          name: "OpenAccounting Support",
          url: "https://openaccounting.dev",
        },
      },
      servers: [
        {
          url: env.NODE_ENV === "production"
            ? "https://api.openaccounting.dev"
            : `http://localhost:${env.API_PORT}`,
          description: env.NODE_ENV === "production" ? "Production" : "Development",
        },
      ],
      tags: [
        { name: "Invoices", description: "Invoice management" },
        { name: "Customers", description: "Customer management" },
        { name: "Expenses", description: "Expense tracking" },
        { name: "Payments", description: "Payment recording" },
        { name: "Accounts", description: "Chart of accounts" },
        { name: "Reports", description: "Financial reports" },
        { name: "AI", description: "AI-powered features" },
      ],
      components: {
        securitySchemes: {
          apiKey: {
            type: "apiKey",
            name: "X-API-Key",
            in: "header",
            description: "API key for authentication",
          },
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
            description: "JWT token for user authentication",
          },
        },
        schemas: {
          ProblemDetails: {
            type: "object",
            required: ["type", "title", "status"],
            properties: {
              type: {
                type: "string",
                format: "uri",
                description: "URI reference identifying the problem type",
              },
              title: {
                type: "string",
                description: "Short human-readable summary of the problem",
              },
              status: {
                type: "integer",
                description: "HTTP status code",
              },
              detail: {
                type: "string",
                description: "Human-readable explanation specific to this occurrence",
              },
              instance: {
                type: "string",
                format: "uri",
                description: "URI reference to the specific occurrence",
              },
            },
          },
        },
      },
      security: [{ apiKey: [] }, { bearerAuth: [] }],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
    },
    staticCSP: true,
  });

  // ============================================
  // AUTHENTICATION
  // ============================================
  await app.register(authPlugin);

  // ============================================
  // ERROR HANDLER (RFC 7807)
  // ============================================
  app.setErrorHandler((error: FastifyError | APIError, request, reply) => {
    const apiError = isAPIError(error) ? error : toAPIError(error);

    // Log server errors
    if (apiError.status >= 500) {
      request.log.error({ err: error }, "Server error");
    } else if (apiError.status >= 400) {
      request.log.warn({ err: error }, "Client error");
    }

    const problemDetails: ProblemDetails = apiError.toJSON();

    // Add instance (request URL) for traceability
    problemDetails.instance = request.url;

    return reply
      .status(apiError.status)
      .header("Content-Type", "application/problem+json")
      .send(problemDetails);
  });

  // ============================================
  // NOT FOUND HANDLER
  // ============================================
  app.setNotFoundHandler((request, reply) => {
    return reply
      .status(404)
      .header("Content-Type", "application/problem+json")
      .send({
        type: "https://api.openaccounting.dev/errors/not-found",
        title: "Endpoint Not Found",
        status: 404,
        detail: `The endpoint ${request.method} ${request.url} does not exist`,
        instance: request.url,
      });
  });

  // ============================================
  // HEALTH ROUTES
  // ============================================
  const { performHealthCheck, livenessCheck, readinessCheck, getPrometheusMetrics, recordRequest } = await import("./health.js");

  // Hook to record request metrics
  app.addHook("onResponse", async (request, reply) => {
    const duration = reply.elapsedTime;
    const path = request.routeOptions?.url || request.url.split("?")[0];
    recordRequest(request.method, path, reply.statusCode, duration);
  });

  // Liveness probe - simple check that server is running
  app.get("/health", {
    schema: {
      description: "Liveness check - is the server running?",
      tags: ["System"],
      response: {
        200: {
          type: "object",
          properties: {
            status: { type: "string" },
            timestamp: { type: "string" },
          },
        },
      },
    },
  }, async () => {
    return livenessCheck();
  });

  // Readiness probe - is the server ready to accept traffic?
  app.get("/ready", {
    schema: {
      description: "Readiness check - is the server ready to accept traffic?",
      tags: ["System"],
      response: {
        200: {
          type: "object",
          properties: {
            ready: { type: "boolean" },
            status: { type: "string" },
            reason: { type: "string" },
          },
        },
        503: {
          type: "object",
          properties: {
            ready: { type: "boolean" },
            status: { type: "string" },
            reason: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    const check = readinessCheck();
    if (!check.ready) {
      return reply.status(503).send(check);
    }
    return check;
  });

  // Detailed health status - comprehensive service checks
  app.get("/health/detailed", {
    schema: {
      description: "Detailed health check with all service statuses",
      tags: ["System"],
      response: {
        200: {
          type: "object",
          properties: {
            status: { type: "string" },
            timestamp: { type: "string" },
            version: { type: "string" },
            uptime_seconds: { type: "number" },
            checks: { type: "object" },
            memory: { type: "object" },
          },
        },
      },
    },
  }, async () => {
    return performHealthCheck();
  });

  // Prometheus metrics endpoint
  app.get("/metrics", {
    schema: {
      description: "Prometheus metrics in text exposition format",
      tags: ["System"],
      produces: ["text/plain"],
      response: {
        200: {
          type: "string",
          description: "Prometheus metrics in text format",
        },
      },
    },
  }, async (request, reply) => {
    const metrics = getPrometheusMetrics();
    return reply
      .header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
      .send(metrics);
  });

  // ============================================
  // API ROUTES
  // ============================================
  await app.register(import("./routes/v1/invoices.js"), { prefix: "/api/v1" });
  // Future routes:
  // await app.register(import("./routes/v1/customers.js"), { prefix: "/api/v1" });
  // await app.register(import("./routes/v1/expenses.js"), { prefix: "/api/v1" });
  // await app.register(import("./routes/v1/accounts.js"), { prefix: "/api/v1" });
  // await app.register(import("./routes/v1/ai.js"), { prefix: "/api/v1" });

  return app;
}

/**
 * Start the API server
 */
export async function startServer(): Promise<FastifyInstance> {
  const app = await buildServer();

  // ============================================
  // GLOBAL ERROR HANDLERS
  // ============================================
  process.on("uncaughtException", (error: Error) => {
    app.log.fatal({ err: error }, "Uncaught exception - shutting down");
    gracefulShutdown(app, 1);
  });

  process.on("unhandledRejection", (reason: unknown) => {
    app.log.error({ reason }, "Unhandled promise rejection");
    // Don't exit on unhandled rejection, but log it
    // In production, you may want to exit
    if (env.NODE_ENV === "production") {
      gracefulShutdown(app, 1);
    }
  });

  // ============================================
  // GRACEFUL SHUTDOWN HANDLERS
  // ============================================
  process.on("SIGTERM", () => {
    app.log.info("SIGTERM received - initiating graceful shutdown");
    gracefulShutdown(app, 0);
  });

  process.on("SIGINT", () => {
    app.log.info("SIGINT received - initiating graceful shutdown");
    gracefulShutdown(app, 0);
  });

  try {
    await app.listen({
      port: env.API_PORT,
      host: env.API_HOST,
    });

    console.log(`
╔═══════════════════════════════════════════════════╗
║         OpenAccounting API Server                 ║
╠═══════════════════════════════════════════════════╣
║  Server:     http://${env.API_HOST}:${env.API_PORT.toString().padEnd(25)}║
║  Docs:       http://${env.API_HOST}:${env.API_PORT}/docs${" ".repeat(17)}║
║  Health:     http://${env.API_HOST}:${env.API_PORT}/health${" ".repeat(15)}║
║  Metrics:    http://${env.API_HOST}:${env.API_PORT}/metrics${" ".repeat(14)}║
║  Environment: ${env.NODE_ENV.padEnd(36)}║
╚═══════════════════════════════════════════════════╝
    `);

    return app;
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler
 * Closes server and database connections cleanly
 */
async function gracefulShutdown(app: FastifyInstance, code: number): Promise<void> {
  const { closeDb } = await import("../db/index.js");

  try {
    app.log.info("Closing HTTP server...");
    await app.close();

    app.log.info("Closing database connections...");
    closeDb();

    app.log.info("Graceful shutdown complete");
    process.exit(code);
  } catch (error) {
    app.log.error({ err: error }, "Error during shutdown");
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}
