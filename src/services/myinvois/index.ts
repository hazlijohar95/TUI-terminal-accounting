/**
 * MyInvois Service Module
 *
 * LHDN e-Invoice integration for Malaysian businesses.
 * Provides complete e-invoice submission, validation, and management.
 */

// Main service
export {
  MyInvoisService,
  MyInvoisError,
  createMyInvoisService,
  type SubmissionResult,
  type MyInvoisConfig,
} from "./myinvois-service.js";

// Token management
export {
  TokenManager,
  TokenError,
  initializeTokenManager,
  getTokenManager,
  getAuthHeader,
} from "./token-manager.js";

// Digital signing
export {
  DigitalSigner,
  SigningError,
  createSigner,
  initializeSigner,
  getSigner,
} from "./digital-signer.js";

// UBL conversion
export {
  convertToUBL,
  ublToJsonString,
  validateUBL,
  createTestInvoice,
} from "./ubl-converter.js";

// Types
export type {
  DocumentType,
  TaxType,
  EInvoiceStatus,
  MalaysiaState,
  IdType,
  PaymentMode,
  LHDNAddress,
  LHDNSupplier,
  LHDNBuyer,
  LHDNLineItem,
  EInvoiceDocument,
  SubmitDocumentRequest,
  SubmitDocumentResponse,
  DocumentStatusResponse,
  TokenResponse,
  LHDNSettings,
  EInvoiceSubmission,
  SigningResult,
} from "./types.js";

// Constants
export {
  LHDN_ENDPOINTS,
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  TAX_TYPES,
  TAX_TYPE_LABELS,
  MALAYSIA_STATES,
  PAYMENT_MODES,
  PAYMENT_MODE_LABELS,
  COMMON_MSIC_CODES,
  CLASSIFICATION_CODES,
  CURRENCY_CODES,
  UNIT_CODES,
  EINVOICE_STATUS_LABELS,
  EINVOICE_STATUS_COLORS,
  UBL_NAMESPACES,
  DEFAULTS,
  API_TIMEOUTS,
  RETRY_CONFIG,
} from "./constants.js";
