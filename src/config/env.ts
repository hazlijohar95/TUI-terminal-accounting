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

  // Logging
  LOG_LEVEL: z
    .enum(["error", "warn", "info", "debug"])
    .default("info"),
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
  get ai(): boolean {
    return Boolean(env.OPENAI_API_KEY);
  },
} as const;
