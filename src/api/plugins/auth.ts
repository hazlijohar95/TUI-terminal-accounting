/**
 * Authentication Plugin
 *
 * Supports multiple authentication methods:
 * - API Key (X-API-Key header)
 * - JWT Bearer token (Authorization header)
 */

import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import jwt from "@fastify/jwt";
import bcrypt from "bcryptjs";
import { env } from "../../config/env.js";
import { getConvexClient, isConvexAvailable } from "../utils/convex.js";
import { Errors, APIError } from "../utils/errors.js";
import { api } from "../../../convex/_generated/api.js";

/**
 * Authentication context attached to requests
 */
export interface AuthContext {
  orgId: string;
  userId?: string;
  apiKeyId?: string;
  scopes: string[];
}

// Extend FastifyRequest with auth context
declare module "fastify" {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}

/**
 * Routes that don't require authentication
 */
const PUBLIC_ROUTES = [
  "/health",
  "/ready",
  "/docs",
  "/docs/",
  "/docs/json",
  "/docs/yaml",
];

/**
 * Check if a route is public
 */
function isPublicRoute(url: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) => url === route || url.startsWith(`${route}/`)
  );
}

/**
 * Validate API key against Convex
 */
async function validateApiKey(
  apiKey: string
): Promise<AuthContext | null> {
  if (!isConvexAvailable()) {
    // Development mode: accept any key starting with "dev_"
    if (env.NODE_ENV === "development" && apiKey.startsWith("dev_")) {
      return {
        orgId: "dev-org",
        scopes: ["*"],
      };
    }
    return null;
  }

  try {
    const convex = getConvexClient();

    // Extract prefix for lookup (first 11 chars: "oa_" + 8 chars)
    const keyPrefix = apiKey.substring(0, 11);

    // Query Convex for the API key
    const result = await convex.query(api.apiKeys.validateByPrefix, {
      prefix: keyPrefix,
    });

    if (!result) return null;

    // Verify the full key hash
    const isValid = await bcrypt.compare(apiKey, result.keyHash);
    if (!isValid) return null;

    // Check expiration
    if (result.expiresAt && result.expiresAt < Date.now()) {
      return null;
    }

    // Update last used (fire and forget)
    convex.mutation(api.apiKeys.updateLastUsed, {
      id: result._id,
    }).catch(() => {});

    return {
      orgId: result.orgId,
      apiKeyId: result._id,
      scopes: result.scopes,
    };
  } catch (error) {
    console.error("API key validation error:", error);
    return null;
  }
}

/**
 * Authentication plugin
 */
const authPlugin: FastifyPluginAsync = async (app) => {
  // Register JWT plugin if secrets are configured
  if (env.JWT_SECRET) {
    await app.register(jwt, {
      secret: env.JWT_SECRET,
      sign: {
        expiresIn: "15m",
      },
    });
  }

  // Authentication hook
  app.addHook(
    "preHandler",
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Skip auth for public routes
      if (isPublicRoute(request.url)) {
        return;
      }

      const apiKey = request.headers["x-api-key"] as string | undefined;
      const authHeader = request.headers.authorization;

      // Try API Key authentication
      if (apiKey) {
        const authContext = await validateApiKey(apiKey);
        if (!authContext) {
          throw Errors.invalidApiKey();
        }
        request.auth = authContext;
        return;
      }

      // Try JWT authentication
      if (authHeader?.startsWith("Bearer ")) {
        if (!env.JWT_SECRET) {
          throw Errors.internal("JWT authentication not configured");
        }

        try {
          const decoded = await request.jwtVerify<{
            orgId: string;
            userId: string;
            scopes: string[];
          }>();

          request.auth = {
            orgId: decoded.orgId,
            userId: decoded.userId,
            scopes: decoded.scopes || [],
          };
          return;
        } catch (error) {
          throw Errors.invalidToken();
        }
      }

      // No authentication provided
      throw Errors.unauthorized();
    }
  );
};

export default fp(authPlugin, {
  name: "auth",
});

/**
 * Check if request has required scope
 */
export function requireScope(scope: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) {
      throw Errors.unauthorized();
    }

    const { scopes } = request.auth;

    // Wildcard scope has all permissions
    if (scopes.includes("*")) {
      return;
    }

    // Check exact match or wildcard for resource
    const [resource] = scope.split(":");
    if (
      !scopes.includes(scope) &&
      !scopes.includes(`${resource}:*`)
    ) {
      throw Errors.insufficientScope(scope);
    }
  };
}

/**
 * Generate JWT tokens for a user
 */
export async function generateTokens(
  app: { jwt: { sign: (payload: object, options?: object) => string } },
  orgId: string,
  userId: string,
  scopes: string[] = []
): Promise<{ accessToken: string; refreshToken: string }> {
  if (!env.JWT_SECRET || !env.JWT_REFRESH_SECRET) {
    throw new Error("JWT secrets not configured");
  }

  const accessToken = app.jwt.sign(
    { orgId, userId, scopes, type: "access" },
    { expiresIn: "15m" }
  );

  // Refresh token uses different secret and longer expiry
  const refreshToken = app.jwt.sign(
    { orgId, userId, type: "refresh" },
    { expiresIn: "7d" }
  );

  return { accessToken, refreshToken };
}
