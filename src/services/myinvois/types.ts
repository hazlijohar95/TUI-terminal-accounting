/**
 * MyInvois/LHDN Type Definitions
 *
 * Types for Malaysia e-invoicing integration with LHDN MyInvois system.
 * Based on LHDN e-Invoice Guidelines v4.0
 */

/**
 * Document types supported by LHDN
 * 01=Invoice, 02=Credit Note, 03=Debit Note
 * 11=Self-billed Invoice, 12=Self-billed Credit, 13=Self-billed Debit
 */
export type DocumentType = "01" | "02" | "03" | "11" | "12" | "13";

/**
 * Tax types recognized by LHDN
 */
export type TaxType =
  | "01"  // Sales Tax
  | "02"  // Service Tax
  | "03"  // Tourism Tax
  | "04"  // High-Value Goods Tax
  | "05"  // Sales Tax (Low Value Goods)
  | "06"  // Not Applicable
  | "E";  // Tax Exemption

/**
 * e-Invoice submission status
 */
export type EInvoiceStatus =
  | "none"       // Not submitted
  | "pending"    // Queued for submission
  | "submitted"  // Sent to LHDN, awaiting validation
  | "valid"      // Validated by LHDN
  | "invalid"    // Rejected by LHDN
  | "cancelled"  // Cancelled after validation
  | "rejected";  // Permanently rejected

/**
 * Malaysia state codes
 */
export type MalaysiaState =
  | "JHR"  // Johor
  | "KDH"  // Kedah
  | "KTN"  // Kelantan
  | "MLK"  // Melaka
  | "NSN"  // Negeri Sembilan
  | "PHG"  // Pahang
  | "PNG"  // Pulau Pinang
  | "PRK"  // Perak
  | "PLS"  // Perlis
  | "SBH"  // Sabah
  | "SWK"  // Sarawak
  | "SGR"  // Selangor
  | "TRG"  // Terengganu
  | "KUL"  // W.P. Kuala Lumpur
  | "LBN"  // W.P. Labuan
  | "PJY"; // W.P. Putrajaya

/**
 * ID types for buyer/seller identification
 */
export type IdType =
  | "NRIC"     // Malaysian IC
  | "PASSPORT" // Passport
  | "BRN"      // Business Registration Number
  | "ARMY";    // Army ID

/**
 * Payment modes
 */
export type PaymentMode =
  | "01"  // Cash
  | "02"  // Cheque
  | "03"  // Bank Transfer
  | "04"  // Credit Card
  | "05"  // Debit Card
  | "06"  // e-Wallet
  | "07"  // Digital Bank
  | "08"  // Others;

/**
 * LHDN Address structure
 */
export interface LHDNAddress {
  addressLine1: string;
  addressLine2?: string;
  addressLine3?: string;
  postalCode: string;
  city: string;
  state: MalaysiaState | string;
  country: string; // ISO 3166-1 alpha-3 (MYS)
}

/**
 * Supplier information (10 mandatory fields)
 */
export interface LHDNSupplier {
  name: string;
  tin: string;                          // Tax Identification Number
  brn?: string;                         // Business Registration Number (SSM)
  sstRegistration?: string;             // SST Registration Number
  tourismTaxRegistration?: string;      // Tourism Tax Registration
  msicCode: string;                     // 5-digit MSIC code
  businessActivityDescription: string;
  email?: string;
  phone?: string;
  address: LHDNAddress;
}

/**
 * Buyer information (7 mandatory fields)
 */
export interface LHDNBuyer {
  name: string;
  tin?: string;                    // TIN (required for B2B)
  brn?: string;                    // Business Registration
  sstRegistration?: string;        // SST Registration
  idType?: IdType;                 // For individuals
  idValue?: string;                // ID number
  email?: string;
  phone?: string;
  address: LHDNAddress;
}

/**
 * Line item with LHDN-required fields
 */
export interface LHDNLineItem {
  id: string | number;
  classificationCode: string;      // LHDN classification code
  description: string;
  quantity: number;
  unitCode?: string;               // UN/ECE Recommendation 20
  unitPrice: number;               // Per unit (in smallest currency unit)
  taxType: TaxType;
  taxRate: number;                 // Percentage
  taxAmount: number;
  discountRate?: number;
  discountAmount?: number;
  subtotal: number;
  totalExclTax: number;
  totalInclTax: number;
  productTariffCode?: string;      // Customs tariff code
  countryOfOrigin?: string;        // ISO country code
}

/**
 * Complete e-Invoice document structure
 */
export interface EInvoiceDocument {
  // Invoice identifiers
  id: string;                      // Invoice number
  uuid?: string;                   // UUID assigned by LHDN
  issueDate: string;               // YYYY-MM-DD
  issueTime: string;               // HH:mm:ssZ
  documentType: DocumentType;
  documentCurrencyCode: string;    // MYR, USD, etc.

  // Exchange rate (if not MYR)
  exchangeRate?: number;

  // Reference to original invoice (for credit/debit notes)
  originalInvoiceRef?: string;

  // Billing period (for recurring invoices)
  billingPeriodStart?: string;
  billingPeriodEnd?: string;
  billingFrequency?: string;

  // Parties
  supplier: LHDNSupplier;
  buyer: LHDNBuyer;

  // Line items
  items: LHDNLineItem[];

  // Totals
  subtotal: number;
  totalDiscount: number;
  totalTaxAmount: number;
  totalExclTax: number;
  totalInclTax: number;
  totalPayableAmount: number;
  roundingAmount?: number;

  // Payment info
  paymentMode?: PaymentMode;
  paymentTerms?: string;
  paymentDueDate?: string;

  // Notes
  notes?: string;
}

/**
 * Document submission request
 */
export interface SubmitDocumentRequest {
  documents: Array<{
    format: "JSON" | "XML";
    documentHash: string;
    codeNumber: string;
    document: string;  // Base64 encoded
  }>;
}

/**
 * Document submission response
 */
export interface SubmitDocumentResponse {
  submissionUid: string;
  acceptedDocuments: Array<{
    uuid: string;
    invoiceCodeNumber: string;
  }>;
  rejectedDocuments: Array<{
    invoiceCodeNumber: string;
    error: {
      code: string;
      message: string;
      target?: string;
      details?: Array<{
        code: string;
        message: string;
        target?: string;
      }>;
    };
  }>;
}

/**
 * Document status response
 */
export interface DocumentStatusResponse {
  uuid: string;
  submissionUid: string;
  longId: string;
  internalId: string;
  typeName: string;
  typeVersionName: string;
  issuerTin: string;
  issuerName: string;
  receiverId?: string;
  receiverName?: string;
  dateTimeIssued: string;
  dateTimeReceived: string;
  dateTimeValidated?: string;
  totalSales: number;
  totalDiscount: number;
  netAmount: number;
  total: number;
  status: "Valid" | "Invalid" | "Cancelled" | "Submitted";
  cancelDateTime?: string;
  rejectRequestDateTime?: string;
  documentStatusReason?: string;
  createdByUserId?: string;
}

/**
 * OAuth2 token response
 */
export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

/**
 * LHDN Settings stored in database
 */
export interface LHDNSettings {
  id?: number;
  // Supplier info
  tin: string;
  brn?: string;
  sstRegistration?: string;
  tourismTaxRegistration?: string;
  msicCode: string;
  businessActivityDescription: string;
  supplierEmail?: string;
  supplierPhone?: string;
  // Address
  addressLine1: string;
  addressLine2?: string;
  addressLine3?: string;
  postalCode: string;
  city: string;
  state: string;
  country: string;
  // Credentials
  clientId?: string;
  clientSecret?: string;  // Encrypted
  certificatePath?: string;
  certificatePassword?: string;  // Encrypted
  // Settings
  environment: "sandbox" | "production";
  autoSubmit: boolean;
}

/**
 * e-Invoice submission record
 */
export interface EInvoiceSubmission {
  id?: number;
  invoiceId: number;
  uin?: string;
  longId?: string;
  submissionUid?: string;
  status: EInvoiceStatus;
  documentType: DocumentType;
  documentVersion: string;
  documentHash?: string;
  digitalSignature?: string;
  ublJson?: string;
  submissionResponse?: string;
  submittedAt?: string;
  validatedAt?: string;
  cancelledAt?: string;
  createdAt?: string;
  errorCode?: string;
  errorMessage?: string;
  retryCount: number;
}

/**
 * Signing result from digital signer
 */
export interface SigningResult {
  hash: string;
  signature: string;
  certificate: string;
}
