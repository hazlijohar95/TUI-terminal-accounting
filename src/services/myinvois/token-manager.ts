/**
 * LHDN Token Manager
 *
 * Handles OAuth2 authentication with LHDN MyInvois identity server.
 * Uses client_credentials grant type for machine-to-machine auth.
 */

import { LHDN_ENDPOINTS, API_TIMEOUTS } from "./constants.js";
import type { TokenResponse } from "./types.js";

interface TokenCache {
  accessToken: string;
  expiresAt: number;
  scope: string;
}

interface TokenManagerConfig {
  clientId: string;
  clientSecret: string;
  environment: "sandbox" | "production";
  onTokenRefresh?: (token: TokenCache) => void;
}

/**
 * Manages OAuth2 tokens for LHDN API access
 */
export class TokenManager {
  private config: TokenManagerConfig;
  private tokenCache: TokenCache | null = null;
  private refreshPromise: Promise<string> | null = null;

  constructor(config: TokenManagerConfig) {
    this.config = config;
  }

  /**
   * Get base URL based on environment
   */
  private getBaseUrl(): string {
    return this.config.environment === "production"
      ? LHDN_ENDPOINTS.production.identity
      : LHDN_ENDPOINTS.sandbox.identity;
  }

  /**
   * Check if current token is valid (with 60s buffer)
   */
  private isTokenValid(): boolean {
    if (!this.tokenCache) return false;
    const bufferMs = 60 * 1000; // 60 second buffer
    return Date.now() < this.tokenCache.expiresAt - bufferMs;
  }

  /**
   * Get valid access token, refreshing if necessary
   */
  async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.isTokenValid() && this.tokenCache) {
      return this.tokenCache.accessToken;
    }

    // If already refreshing, wait for that to complete
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    // Start new token refresh
    this.refreshPromise = this.refreshToken();

    try {
      const token = await this.refreshPromise;
      return token;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Refresh the access token from LHDN
   */
  private async refreshToken(): Promise<string> {
    const url = `${this.getBaseUrl()}${LHDN_ENDPOINTS.paths.token}`;

    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      scope: "InvoicingAPI",
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      API_TIMEOUTS.TOKEN_REQUEST
    );

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new TokenError(
          `Token request failed: ${response.status} ${response.statusText}`,
          response.status,
          errorText
        );
      }

      const data: TokenResponse = await response.json();

      // Cache the token
      this.tokenCache = {
        accessToken: data.access_token,
        expiresAt: Date.now() + data.expires_in * 1000,
        scope: data.scope,
      };

      // Notify callback if provided
      if (this.config.onTokenRefresh) {
        this.config.onTokenRefresh(this.tokenCache);
      }

      return data.access_token;
    } catch (error) {
      if (error instanceof TokenError) {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new TokenError("Token request timed out", 408);
      }
      throw new TokenError(
        `Token request failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        500
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Force refresh the token (for retry scenarios)
   */
  async forceRefresh(): Promise<string> {
    this.tokenCache = null;
    return this.getAccessToken();
  }

  /**
   * Clear the token cache
   */
  clearCache(): void {
    this.tokenCache = null;
  }

  /**
   * Get token expiry time (for UI display)
   */
  getTokenExpiry(): Date | null {
    if (!this.tokenCache) return null;
    return new Date(this.tokenCache.expiresAt);
  }

  /**
   * Check if token manager is configured
   */
  isConfigured(): boolean {
    return !!(this.config.clientId && this.config.clientSecret);
  }

  /**
   * Get current environment
   */
  getEnvironment(): "sandbox" | "production" {
    return this.config.environment;
  }

  /**
   * Update configuration (for settings changes)
   */
  updateConfig(newConfig: Partial<TokenManagerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.clearCache();
  }
}

/**
 * Custom error class for token-related errors
 */
export class TokenError extends Error {
  public readonly statusCode: number;
  public readonly details?: string;

  constructor(message: string, statusCode: number, details?: string) {
    super(message);
    this.name = "TokenError";
    this.statusCode = statusCode;
    this.details = details;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
    };
  }
}

/**
 * Create a singleton token manager instance
 * Call initialize() before using getToken()
 */
let tokenManagerInstance: TokenManager | null = null;

export function initializeTokenManager(config: TokenManagerConfig): TokenManager {
  tokenManagerInstance = new TokenManager(config);
  return tokenManagerInstance;
}

export function getTokenManager(): TokenManager {
  if (!tokenManagerInstance) {
    throw new Error(
      "TokenManager not initialized. Call initializeTokenManager() first."
    );
  }
  return tokenManagerInstance;
}

/**
 * Helper to create authorization header
 */
export async function getAuthHeader(): Promise<{ Authorization: string }> {
  const token = await getTokenManager().getAccessToken();
  return { Authorization: `Bearer ${token}` };
}
