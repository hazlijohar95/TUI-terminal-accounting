/**
 * Convex Client Wrapper
 *
 * Provides a configured Convex HTTP client for API use.
 */

import { ConvexHttpClient } from "convex/browser";
import { env, features } from "../../config/env.js";

let _client: ConvexHttpClient | null = null;

/**
 * Get the singleton Convex HTTP client
 */
export function getConvexClient(): ConvexHttpClient {
  if (!features.convex) {
    throw new Error("Convex is not configured. Set CONVEX_URL in environment.");
  }

  if (!_client) {
    _client = new ConvexHttpClient(env.CONVEX_URL!);
  }

  return _client;
}

/**
 * Check if Convex is available
 */
export function isConvexAvailable(): boolean {
  return features.convex;
}
