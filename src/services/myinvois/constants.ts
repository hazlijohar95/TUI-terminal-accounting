/**
 * MyInvois/LHDN Constants
 *
 * API endpoints, codes, and reference data for LHDN e-invoicing.
 */

/**
 * LHDN API endpoints
 */
export const LHDN_ENDPOINTS = {
  sandbox: {
    base: "https://preprod-api.myinvois.hasil.gov.my",
    identity: "https://preprod-api.myinvois.hasil.gov.my",
  },
  production: {
    base: "https://api.myinvois.hasil.gov.my",
    identity: "https://api.myinvois.hasil.gov.my",
  },
  paths: {
    token: "/connect/token",
    submitDocuments: "/api/v1.0/documentsubmissions",
    getDocument: "/api/v1.0/documents/{uuid}/raw",
    getDocumentDetails: "/api/v1.0/documents/{uuid}/details",
    cancelDocument: "/api/v1.0/documents/state/{uuid}/state",
    rejectDocument: "/api/v1.0/documents/state/{uuid}/state",
    getRecentDocuments: "/api/v1.0/documents/recent",
    searchDocuments: "/api/v1.0/documents/search",
    getSubmission: "/api/v1.0/documentsubmissions/{submissionUid}",
  },
} as const;

/**
 * Document type codes
 */
export const DOCUMENT_TYPES = {
  INVOICE: "01",
  CREDIT_NOTE: "02",
  DEBIT_NOTE: "03",
  REFUND_NOTE: "04",
  SELF_BILLED_INVOICE: "11",
  SELF_BILLED_CREDIT_NOTE: "12",
  SELF_BILLED_DEBIT_NOTE: "13",
  SELF_BILLED_REFUND_NOTE: "14",
} as const;

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  "01": "Invoice",
  "02": "Credit Note",
  "03": "Debit Note",
  "04": "Refund Note",
  "11": "Self-billed Invoice",
  "12": "Self-billed Credit Note",
  "13": "Self-billed Debit Note",
  "14": "Self-billed Refund Note",
};

/**
 * Tax type codes
 */
export const TAX_TYPES = {
  SALES_TAX: "01",
  SERVICE_TAX: "02",
  TOURISM_TAX: "03",
  HIGH_VALUE_GOODS_TAX: "04",
  SALES_TAX_LOW_VALUE: "05",
  NOT_APPLICABLE: "06",
  EXEMPT: "E",
} as const;

export const TAX_TYPE_LABELS: Record<string, string> = {
  "01": "Sales Tax",
  "02": "Service Tax",
  "03": "Tourism Tax",
  "04": "High-Value Goods Tax",
  "05": "Sales Tax (Low Value Goods)",
  "06": "Not Applicable",
  "E": "Tax Exemption",
};

/**
 * Buyer/Customer ID types
 */
export const ID_TYPES: Record<string, string> = {
  NRIC: "National ID (MyKad)",
  PASSPORT: "Passport",
  BRN: "Business Registration",
  ARMY: "Army ID",
};

/**
 * Malaysia state codes with labels
 */
export const MALAYSIA_STATES: Record<string, string> = {
  JHR: "Johor",
  KDH: "Kedah",
  KTN: "Kelantan",
  MLK: "Melaka",
  NSN: "Negeri Sembilan",
  PHG: "Pahang",
  PNG: "Pulau Pinang",
  PRK: "Perak",
  PLS: "Perlis",
  SBH: "Sabah",
  SWK: "Sarawak",
  SGR: "Selangor",
  TRG: "Terengganu",
  KUL: "W.P. Kuala Lumpur",
  LBN: "W.P. Labuan",
  PJY: "W.P. Putrajaya",
};

/**
 * Payment mode codes
 */
export const PAYMENT_MODES = {
  CASH: "01",
  CHEQUE: "02",
  BANK_TRANSFER: "03",
  CREDIT_CARD: "04",
  DEBIT_CARD: "05",
  E_WALLET: "06",
  DIGITAL_BANK: "07",
  OTHERS: "08",
} as const;

export const PAYMENT_MODE_LABELS: Record<string, string> = {
  "01": "Cash",
  "02": "Cheque",
  "03": "Bank Transfer",
  "04": "Credit Card",
  "05": "Debit Card",
  "06": "e-Wallet",
  "07": "Digital Bank",
  "08": "Others",
};

/**
 * Common MSIC codes (Malaysia Standard Industrial Classification)
 */
export const COMMON_MSIC_CODES: Record<string, string> = {
  "46510": "Wholesale of computers and software",
  "47411": "Retail sale of computers and software",
  "62010": "Computer programming activities",
  "62020": "Computer consultancy and management",
  "62090": "Other IT and computer service activities",
  "63110": "Data processing and hosting",
  "63120": "Web portals",
  "69201": "Accounting and auditing activities",
  "69202": "Tax consultancy",
  "70201": "Management consultancy activities",
  "70209": "Other business consultancy",
  "73100": "Advertising",
  "74100": "Specialised design activities",
  "82110": "Combined office administrative service",
  "82190": "Other business support service activities",
};

/**
 * LHDN Classification codes (simplified list - common ones)
 */
export const CLASSIFICATION_CODES: Record<string, string> = {
  "001": "Goods",
  "002": "Services",
  "003": "Freight Charges",
  "004": "Rental",
  "005": "e-Commerce",
  "006": "Telecommunication Services",
  "007": "Financial Services",
  "008": "Construction",
  "009": "Transportation",
  "010": "Education",
  "011": "Healthcare",
  "012": "Food and Beverages",
  "013": "Accommodation",
  "014": "Professional Services",
  "015": "Others",
};

/**
 * Currency codes (ISO 4217)
 */
export const CURRENCY_CODES = {
  MYR: "Malaysian Ringgit",
  USD: "US Dollar",
  EUR: "Euro",
  GBP: "British Pound",
  SGD: "Singapore Dollar",
  AUD: "Australian Dollar",
  JPY: "Japanese Yen",
  CNY: "Chinese Yuan",
  HKD: "Hong Kong Dollar",
  THB: "Thai Baht",
  IDR: "Indonesian Rupiah",
  PHP: "Philippine Peso",
  INR: "Indian Rupee",
} as const;

/**
 * Unit codes (UN/ECE Recommendation 20)
 */
export const UNIT_CODES: Record<string, string> = {
  EA: "Each",
  H87: "Piece",
  KGM: "Kilogram",
  MTR: "Metre",
  LTR: "Litre",
  MTK: "Square Metre",
  MTQ: "Cubic Metre",
  MON: "Month",
  DAY: "Day",
  HUR: "Hour",
  MIN: "Minute",
  SEC: "Second",
  SET: "Set",
  PR: "Pair",
  BX: "Box",
  CT: "Carton",
  PK: "Package",
};

/**
 * e-Invoice status labels
 */
export const EINVOICE_STATUS_LABELS: Record<string, string> = {
  none: "Not Submitted",
  pending: "Pending",
  submitted: "Submitted",
  valid: "Validated",
  invalid: "Invalid",
  cancelled: "Cancelled",
  rejected: "Rejected",
};

/**
 * e-Invoice status colors for UI
 */
export const EINVOICE_STATUS_COLORS: Record<string, string> = {
  none: "gray",
  pending: "yellow",
  submitted: "blue",
  valid: "green",
  invalid: "red",
  cancelled: "orange",
  rejected: "red",
};

/**
 * UBL 2.1 Namespaces for JSON output
 */
export const UBL_NAMESPACES = {
  _D: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
  _A: "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
  _B: "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
} as const;

/**
 * Credit Note specific namespace
 */
export const UBL_CREDIT_NOTE_NAMESPACE = {
  _D: "urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2",
} as const;

/**
 * Debit Note specific namespace
 */
export const UBL_DEBIT_NOTE_NAMESPACE = {
  _D: "urn:oasis:names:specification:ubl:schema:xsd:DebitNote-2",
} as const;

/**
 * Default values
 */
export const DEFAULTS = {
  COUNTRY_CODE: "MYS",
  CURRENCY_CODE: "MYR",
  TAX_TYPE: "E" as const,
  TAX_RATE: 0,
  UNIT_CODE: "EA",
  DOCUMENT_VERSION: "1.0",
  EXCHANGE_RATE: 1.0,
} as const;

/**
 * API timeouts
 */
export const API_TIMEOUTS = {
  TOKEN_REQUEST: 10000,      // 10 seconds
  DOCUMENT_SUBMIT: 30000,    // 30 seconds
  STATUS_CHECK: 10000,       // 10 seconds
} as const;

/**
 * Retry configuration
 */
export const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  INITIAL_DELAY_MS: 1000,
  MAX_DELAY_MS: 30000,
  BACKOFF_MULTIPLIER: 2,
} as const;
