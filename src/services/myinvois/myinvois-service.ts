/**
 * MyInvois Service
 *
 * Main service for LHDN e-Invoice integration.
 * Orchestrates token management, document signing, UBL conversion, and API calls.
 */

import {
  LHDN_ENDPOINTS,
  API_TIMEOUTS,
  RETRY_CONFIG,
  DOCUMENT_TYPE_LABELS,
} from "./constants.js";
import { TokenManager, TokenError, initializeTokenManager } from "./token-manager.js";
import { DigitalSigner, SigningError, initializeSigner } from "./digital-signer.js";
import { convertToUBL, ublToJsonString, validateUBL } from "./ubl-converter.js";
import type {
  EInvoiceDocument,
  EInvoiceStatus,
  SubmitDocumentResponse,
  DocumentStatusResponse,
  LHDNSettings,
  EInvoiceSubmission,
} from "./types.js";

interface MyInvoisConfig {
  settings: LHDNSettings;
  onStatusChange?: (invoiceId: string, status: EInvoiceStatus) => void;
}

interface SubmissionResult {
  success: boolean;
  uuid?: string;
  longId?: string;
  submissionUid?: string;
  error?: {
    code: string;
    message: string;
    details?: string[];
  };
}

/**
 * Main MyInvois Service
 */
export class MyInvoisService {
  private tokenManager: TokenManager | null = null;
  private signer: DigitalSigner | null = null;
  private config: MyInvoisConfig;
  private isInitialized = false;

  constructor(config: MyInvoisConfig) {
    this.config = config;
  }

  /**
   * Initialize the service with credentials and certificate
   */
  async initialize(): Promise<void> {
    const { settings } = this.config;

    // Initialize token manager
    if (settings.clientId && settings.clientSecret) {
      this.tokenManager = initializeTokenManager({
        clientId: settings.clientId,
        clientSecret: settings.clientSecret,
        environment: settings.environment,
      });
    }

    // Initialize digital signer if certificate is available
    if (settings.certificatePath && settings.certificatePassword) {
      this.signer = await initializeSigner({
        certificatePath: settings.certificatePath,
        password: settings.certificatePassword,
      });
    }

    this.isInitialized = true;
  }

  /**
   * Get the base API URL based on environment
   */
  private getBaseUrl(): string {
    return this.config.settings.environment === "production"
      ? LHDN_ENDPOINTS.production.base
      : LHDN_ENDPOINTS.sandbox.base;
  }

  /**
   * Make authenticated API request
   */
  private async apiRequest<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    if (!this.tokenManager) {
      throw new MyInvoisError("Token manager not initialized", "NOT_CONFIGURED");
    }

    const token = await this.tokenManager.getAccessToken();
    const url = `${this.getBaseUrl()}${path}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      API_TIMEOUTS.DOCUMENT_SUBMIT
    );

    try {
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new MyInvoisError(
          `API request failed: ${response.status}`,
          "API_ERROR",
          response.status,
          errorText
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof MyInvoisError) {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new MyInvoisError("Request timed out", "TIMEOUT", 408);
      }
      throw new MyInvoisError(
        `API request failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        "NETWORK_ERROR"
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Submit an e-invoice document to LHDN
   */
  async submitDocument(doc: EInvoiceDocument): Promise<SubmissionResult> {
    this.ensureInitialized();

    // Convert to UBL format
    const ublDoc = convertToUBL(doc);

    // Validate UBL
    const validation = validateUBL(ublDoc);
    if (!validation.valid) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Document validation failed",
          details: validation.errors,
        },
      };
    }

    // Convert to JSON string
    const ublJson = ublToJsonString(ublDoc);

    // Sign the document if signer is available
    let documentHash: string | undefined;
    let digitalSignature: string | undefined;

    if (this.signer) {
      const signingResult = this.signer.signDocument(ublJson);
      documentHash = signingResult.hash;
      digitalSignature = signingResult.signature;
    } else {
      // Create hash without signature (for testing/sandbox)
      const crypto = await import("crypto");
      documentHash = crypto.createHash("sha256").update(ublJson).digest("base64");
    }

    // Encode document as base64
    const documentBase64 = Buffer.from(ublJson).toString("base64");

    // Prepare submission request
    const submissionRequest = {
      documents: [
        {
          format: "JSON" as const,
          documentHash,
          codeNumber: doc.id,
          document: documentBase64,
        },
      ],
    };

    try {
      const response = await this.apiRequest<SubmitDocumentResponse>(
        "POST",
        LHDN_ENDPOINTS.paths.submitDocuments,
        submissionRequest
      );

      // Check for accepted documents
      if (response.acceptedDocuments && response.acceptedDocuments.length > 0) {
        const accepted = response.acceptedDocuments[0];
        return {
          success: true,
          uuid: accepted.uuid,
          submissionUid: response.submissionUid,
        };
      }

      // Check for rejected documents
      if (response.rejectedDocuments && response.rejectedDocuments.length > 0) {
        const rejected = response.rejectedDocuments[0];
        return {
          success: false,
          error: {
            code: rejected.error.code,
            message: rejected.error.message,
            details: rejected.error.details?.map((d) => d.message),
          },
        };
      }

      return {
        success: false,
        error: {
          code: "UNKNOWN",
          message: "Unexpected response from LHDN",
        },
      };
    } catch (error) {
      if (error instanceof MyInvoisError) {
        return {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details ? [error.details] : undefined,
          },
        };
      }
      throw error;
    }
  }

  /**
   * Get document status from LHDN
   */
  async getDocumentStatus(uuid: string): Promise<DocumentStatusResponse> {
    this.ensureInitialized();

    const path = LHDN_ENDPOINTS.paths.getDocumentDetails.replace("{uuid}", uuid);
    return this.apiRequest<DocumentStatusResponse>("GET", path);
  }

  /**
   * Get submission status
   */
  async getSubmissionStatus(submissionUid: string): Promise<{
    overallStatus: string;
    acceptedDocuments: number;
    rejectedDocuments: number;
    documentSummary: Array<{
      uuid: string;
      status: string;
    }>;
  }> {
    this.ensureInitialized();

    const path = LHDN_ENDPOINTS.paths.getSubmission.replace(
      "{submissionUid}",
      submissionUid
    );
    return this.apiRequest("GET", path);
  }

  /**
   * Cancel a validated document
   */
  async cancelDocument(uuid: string, reason: string): Promise<boolean> {
    this.ensureInitialized();

    const path = LHDN_ENDPOINTS.paths.cancelDocument.replace("{uuid}", uuid);

    try {
      await this.apiRequest("PUT", path, {
        status: "cancelled",
        reason,
      });
      return true;
    } catch (error) {
      if (error instanceof MyInvoisError) {
        console.error("Cancel failed:", error.message);
      }
      return false;
    }
  }

  /**
   * Reject a document (buyer rejection)
   */
  async rejectDocument(uuid: string, reason: string): Promise<boolean> {
    this.ensureInitialized();

    const path = LHDN_ENDPOINTS.paths.rejectDocument.replace("{uuid}", uuid);

    try {
      await this.apiRequest("PUT", path, {
        status: "rejected",
        reason,
      });
      return true;
    } catch (error) {
      if (error instanceof MyInvoisError) {
        console.error("Reject failed:", error.message);
      }
      return false;
    }
  }

  /**
   * Get recent documents from LHDN
   */
  async getRecentDocuments(options?: {
    pageNo?: number;
    pageSize?: number;
    submissionDateFrom?: string;
    submissionDateTo?: string;
  }): Promise<{
    result: DocumentStatusResponse[];
    metadata: {
      totalPages: number;
      totalCount: number;
    };
  }> {
    this.ensureInitialized();

    const params = new URLSearchParams();
    if (options?.pageNo) params.set("pageNo", String(options.pageNo));
    if (options?.pageSize) params.set("pageSize", String(options.pageSize));
    if (options?.submissionDateFrom)
      params.set("submissionDateFrom", options.submissionDateFrom);
    if (options?.submissionDateTo)
      params.set("submissionDateTo", options.submissionDateTo);

    const queryString = params.toString();
    const path = `${LHDN_ENDPOINTS.paths.getRecentDocuments}${queryString ? `?${queryString}` : ""}`;

    return this.apiRequest("GET", path);
  }

  /**
   * Search documents
   */
  async searchDocuments(options: {
    uuid?: string;
    submissionDateFrom?: string;
    submissionDateTo?: string;
    issueDateFrom?: string;
    issueDateTo?: string;
    direction?: "Sent" | "Received";
    status?: "Valid" | "Invalid" | "Cancelled" | "Submitted";
    documentType?: string;
    receiverId?: string;
    receiverIdType?: string;
    issuerIdType?: string;
    issuerId?: string;
    pageNo?: number;
    pageSize?: number;
  }): Promise<{
    result: DocumentStatusResponse[];
    metadata: {
      totalPages: number;
      totalCount: number;
    };
  }> {
    this.ensureInitialized();

    const params = new URLSearchParams();
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        params.set(key, String(value));
      }
    });

    const queryString = params.toString();
    const path = `${LHDN_ENDPOINTS.paths.searchDocuments}${queryString ? `?${queryString}` : ""}`;

    return this.apiRequest("GET", path);
  }

  /**
   * Submit with retry logic
   */
  async submitWithRetry(
    doc: EInvoiceDocument,
    maxRetries: number = RETRY_CONFIG.MAX_RETRIES
  ): Promise<SubmissionResult> {
    let lastError: SubmissionResult | null = null;
    let delay: number = RETRY_CONFIG.INITIAL_DELAY_MS;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const result = await this.submitDocument(doc);

      if (result.success) {
        return result;
      }

      // Check if error is retryable
      if (result.error?.code === "TIMEOUT" || result.error?.code === "NETWORK_ERROR") {
        lastError = result;

        if (attempt < maxRetries) {
          await this.sleep(delay);
          delay = Math.min(
            delay * (RETRY_CONFIG.BACKOFF_MULTIPLIER as number),
            RETRY_CONFIG.MAX_DELAY_MS as number
          );
        }
      } else {
        // Non-retryable error
        return result;
      }
    }

    return lastError || {
      success: false,
      error: {
        code: "MAX_RETRIES",
        message: "Maximum retries exceeded",
      },
    };
  }

  /**
   * Verify connection to LHDN (test authentication)
   */
  async verifyConnection(): Promise<{
    connected: boolean;
    environment: string;
    error?: string;
  }> {
    try {
      if (!this.tokenManager) {
        return {
          connected: false,
          environment: this.config.settings.environment,
          error: "Not configured - missing client credentials",
        };
      }

      await this.tokenManager.getAccessToken();
      return {
        connected: true,
        environment: this.config.settings.environment,
      };
    } catch (error) {
      return {
        connected: false,
        environment: this.config.settings.environment,
        error: error instanceof Error ? error.message : "Connection failed",
      };
    }
  }

  /**
   * Verify certificate validity
   */
  verifyCertificate(): {
    valid: boolean;
    daysUntilExpiry?: number;
    subject?: string;
    error?: string;
  } {
    if (!this.signer) {
      return {
        valid: false,
        error: "No certificate configured",
      };
    }

    try {
      const isValid = this.signer.isCertificateValid();
      const daysUntilExpiry = this.signer.getDaysUntilExpiry();
      const certInfo = this.signer.getCertificateInfo();

      return {
        valid: isValid,
        daysUntilExpiry,
        subject: certInfo.subject,
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : "Certificate error",
      };
    }
  }

  /**
   * Get document type label
   */
  getDocumentTypeLabel(code: string): string {
    return DOCUMENT_TYPE_LABELS[code] || code;
  }

  /**
   * Check if service is configured
   */
  isConfigured(): boolean {
    return !!(
      this.config.settings.clientId &&
      this.config.settings.clientSecret &&
      this.config.settings.tin &&
      this.config.settings.msicCode
    );
  }

  /**
   * Get current environment
   */
  getEnvironment(): "sandbox" | "production" {
    return this.config.settings.environment;
  }

  /**
   * Update settings
   */
  async updateSettings(newSettings: Partial<LHDNSettings>): Promise<void> {
    this.config.settings = { ...this.config.settings, ...newSettings };
    this.isInitialized = false;
    await this.initialize();
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new MyInvoisError(
        "Service not initialized. Call initialize() first.",
        "NOT_INITIALIZED"
      );
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.signer) {
      this.signer.dispose();
    }
    this.tokenManager = null;
    this.signer = null;
    this.isInitialized = false;
  }
}

/**
 * Custom error class for MyInvois errors
 */
export class MyInvoisError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;
  public readonly details?: string;

  constructor(
    message: string,
    code: string,
    statusCode?: number,
    details?: string
  ) {
    super(message);
    this.name = "MyInvoisError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
    };
  }
}

/**
 * Create and initialize a MyInvois service instance
 */
export async function createMyInvoisService(
  config: MyInvoisConfig
): Promise<MyInvoisService> {
  const service = new MyInvoisService(config);
  await service.initialize();
  return service;
}

// Re-export types and utilities
export { TokenError, SigningError };
export type { SubmissionResult, MyInvoisConfig };
