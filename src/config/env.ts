/**
 * Environment Configuration
 *
 * Centralized, validated environment configuration using Zod.
 * All environment variables are validated at startup to fail fast
 * if configuration is missing or invalid.
 */

import { z } from "zod";
import "dotenv/config";

const envSchema = z.object({
  // Application
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // OpenAI (optional - AI features disabled without it)
  OPENAI_API_KEY: z
    .string()
    .startsWith("sk-", "OpenAI API key must start with 'sk-'")
    .optional(),

  // Convex
  CONVEX_URL: z.string().url().optional(),

  // Logging
  LOG_LEVEL: z
    .enum(["error", "warn", "info", "debug"])
    .default("info"),

  // API Server
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  API_HOST: z.string().default("0.0.0.0"),

  // Authentication
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters")
    .optional(),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, "JWT_REFRESH_SECRET must be at least 32 characters")
    .optional(),

  // Rate Limiting
  API_RATE_LIMIT: z.coerce.number().int().min(1).default(100),

  // CORS
  ALLOWED_ORIGINS: z.string().optional(),

  // Security
  REQUIRE_HTTPS: z.coerce.boolean().default(false),
  TRUST_PROXY: z.coerce.boolean().default(false),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.format();
    const errors = Object.entries(formatted)
      .filter(([key]) => key !== "_errors")
      .map(([key, value]) => {
        const errorMessages = (value as { _errors?: string[] })?._errors || [];
        return `  ${key}: ${errorMessages.join(", ")}`;
      })
      .join("\n");

    console.error("Environment validation failed:");
    console.error(errors);
    console.error("\nSee .env.example for required variables.");

    // In production, fail fast. In development, allow partial config.
    if (process.env.NODE_ENV === "production") {
      process.exit(1);
    }
  }

  return result.data as Env;
}

export const env = validateEnv();

/**
 * Check if a feature requiring specific env vars is available
 */
export const features = {
  get api(): boolean {
    return Boolean(env.JWT_SECRET && env.JWT_REFRESH_SECRET);
  },
  get convex(): boolean {
    return Boolean(env.CONVEX_URL);
  },
  get ai(): boolean {
    return Boolean(env.OPENAI_API_KEY);
  },
} as const;

/**
 * Get allowed CORS origins as array
 */
export function getAllowedOrigins(): string[] {
  if (!env.ALLOWED_ORIGINS) {
    return env.NODE_ENV === "development"
      ? ["http://localhost:3000", "http://localhost:5173"]
      : [];
  }
  return env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim());
}
