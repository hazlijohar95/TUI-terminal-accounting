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
 * Common MSIC codes (Malaysia Standard Industrial Classification 2008 v1.3)
 * Comprehensive list covering major business categories
 */
export const COMMON_MSIC_CODES: Record<string, string> = {
  // Agriculture, Forestry, Fishing (Section A)
  "01111": "Growing of maize",
  "01112": "Growing of leguminous crops",
  "01131": "Growing of oil palm",
  "01132": "Growing of coconut",
  "01140": "Growing of sugar cane",
  "01191": "Growing of rubber",
  "01500": "Mixed farming",
  "03110": "Marine fishing",
  "03210": "Marine aquaculture",

  // Manufacturing (Section C)
  "10101": "Processing and preserving of meat",
  "10200": "Processing and preserving of fish",
  "10611": "Rice milling",
  "10710": "Manufacture of bakery products",
  "10791": "Manufacture of coffee",
  "11010": "Distilling and blending of spirits",
  "14100": "Manufacture of wearing apparel",
  "18110": "Printing",
  "18120": "Service activities related to printing",
  "25110": "Manufacture of structural metal products",
  "25120": "Manufacture of tanks and reservoirs",
  "27200": "Manufacture of batteries and accumulators",

  // Construction (Section F)
  "41001": "Residential buildings construction",
  "41002": "Non-residential buildings construction",
  "42100": "Construction of roads and railways",
  "42200": "Construction of utility projects",
  "43110": "Demolition",
  "43120": "Site preparation",
  "43210": "Electrical installation",
  "43220": "Plumbing, heating and air-conditioning",
  "43290": "Other construction installation",
  "43300": "Building completion and finishing",

  // Wholesale & Retail Trade (Section G)
  "45101": "Sale of motor vehicles",
  "45200": "Maintenance and repair of motor vehicles",
  "46100": "Wholesale on a fee or contract basis",
  "46410": "Wholesale of textiles",
  "46491": "Wholesale of furniture",
  "46510": "Wholesale of computers and software",
  "46520": "Wholesale of electronic equipment",
  "46690": "Wholesale of other machinery",
  "47111": "Retail sale in non-specialized stores",
  "47191": "Retail sale of various goods in department stores",
  "47220": "Retail sale of meat",
  "47300": "Retail sale of automotive fuel",
  "47411": "Retail sale of computers and software",
  "47420": "Retail sale of telecommunications equipment",
  "47510": "Retail sale of textiles",
  "47610": "Retail sale of books and stationery",
  "47710": "Retail sale of clothing",
  "47810": "Retail sale via stalls and markets",
  "47910": "Retail sale via mail order or internet",

  // Transportation (Section H)
  "49100": "Passenger rail transport",
  "49211": "Scheduled passenger land transport",
  "49221": "Taxi operation",
  "49230": "Freight transport by road",
  "50111": "Sea and coastal passenger water transport",
  "50120": "Inland passenger water transport",
  "51100": "Passenger air transport",
  "52101": "Operation of warehousing facilities",
  "52210": "Service activities incidental to land transportation",
  "53100": "Postal activities",
  "53200": "Courier activities",

  // Accommodation & Food Service (Section I)
  "55101": "Hotels",
  "55102": "Motels",
  "55103": "Resort hotels",
  "55104": "Apartment hotels",
  "55900": "Other accommodation",
  "56101": "Restaurants",
  "56102": "Cafes",
  "56103": "Fast food restaurants",
  "56210": "Event catering",
  "56290": "Other food service activities",
  "56301": "Bars and pubs",
  "56302": "Night clubs",

  // Information & Communication (Section J)
  "58110": "Book publishing",
  "58130": "Publishing of newspapers",
  "58190": "Other publishing activities",
  "58200": "Software publishing",
  "59110": "Motion picture and video production",
  "59120": "Post-production activities",
  "59200": "Sound recording and music publishing",
  "60100": "Radio broadcasting",
  "60200": "Television programming and broadcasting",
  "61100": "Wired telecommunications",
  "61200": "Wireless telecommunications",
  "61300": "Satellite telecommunications",
  "62010": "Computer programming activities",
  "62020": "Computer consultancy and management",
  "62090": "Other IT and computer service activities",
  "63110": "Data processing and hosting",
  "63120": "Web portals",
  "63910": "News agency activities",

  // Financial & Insurance (Section K)
  "64110": "Central banking",
  "64191": "Commercial banks",
  "64192": "Islamic banks",
  "64200": "Activities of holding companies",
  "64910": "Financial leasing",
  "64990": "Other financial service activities",
  "65110": "Life insurance",
  "65120": "General insurance",
  "65200": "Reinsurance",
  "66110": "Administration of financial markets",
  "66120": "Security and commodity contracts brokerage",
  "66190": "Other activities auxiliary to financial service",
  "66210": "Risk and damage evaluation",
  "66220": "Activities of insurance agents and brokers",

  // Real Estate (Section L)
  "68100": "Real estate activities with own or leased property",
  "68200": "Real estate activities on a fee or contract basis",

  // Professional, Scientific & Technical (Section M)
  "69101": "Legal activities",
  "69102": "Shariah law practice",
  "69201": "Accounting and auditing activities",
  "69202": "Tax consultancy",
  "70100": "Activities of head offices",
  "70201": "Management consultancy activities",
  "70209": "Other business consultancy",
  "71100": "Architectural activities",
  "71200": "Engineering activities and related technical consultancy",
  "71201": "Technical testing and analysis",
  "72100": "R&D on natural sciences and engineering",
  "72200": "R&D on social sciences and humanities",
  "73100": "Advertising",
  "73200": "Market research and public opinion polling",
  "74100": "Specialised design activities",
  "74200": "Photographic activities",
  "74900": "Other professional, scientific and technical activities",
  "75000": "Veterinary activities",

  // Administrative & Support Services (Section N)
  "77100": "Renting and leasing of motor vehicles",
  "77210": "Renting and leasing of recreational goods",
  "77300": "Renting and leasing of machinery and equipment",
  "78100": "Activities of employment placement agencies",
  "78200": "Temporary employment agency activities",
  "79110": "Travel agency activities",
  "79120": "Tour operator activities",
  "80100": "Private security activities",
  "81100": "Combined facilities support activities",
  "81210": "General cleaning of buildings",
  "81290": "Other building and industrial cleaning",
  "82110": "Combined office administrative service",
  "82190": "Other business support service activities",
  "82200": "Activities of call centres",
  "82910": "Activities of collection agencies and credit bureaus",
  "82920": "Packaging activities",

  // Education (Section P)
  "85100": "Pre-primary and primary education",
  "85211": "General secondary education",
  "85212": "Technical and vocational secondary education",
  "85301": "Post-secondary non-tertiary general education",
  "85302": "Post-secondary non-tertiary technical education",
  "85410": "Higher education",
  "85510": "Sports and recreation education",
  "85520": "Cultural education",
  "85530": "Driving school activities",
  "85590": "Other education n.e.c.",
  "85600": "Educational support activities",

  // Human Health & Social Work (Section Q)
  "86101": "Hospital activities",
  "86102": "Medical, surgical and dental practice activities",
  "86201": "Medical clinic activities",
  "86202": "Dental clinic activities",
  "86900": "Other human health activities",
  "87100": "Residential nursing care facilities",
  "87900": "Other residential care activities",
  "88100": "Social work activities without accommodation for elderly",
  "88900": "Other social work activities without accommodation",

  // Arts, Entertainment & Recreation (Section R)
  "90001": "Performing arts activities",
  "90002": "Support activities to performing arts",
  "91011": "Library activities",
  "91012": "Archives activities",
  "91020": "Museums activities",
  "92000": "Gambling and betting activities",
  "93110": "Operation of sports facilities",
  "93120": "Activities of sports clubs",
  "93130": "Fitness facilities",
  "93210": "Activities of amusement parks and theme parks",
  "93290": "Other amusement and recreation activities",

  // Other Service Activities (Section S)
  "94110": "Activities of business and employers membership organizations",
  "94120": "Activities of professional membership organizations",
  "94200": "Activities of trade unions",
  "94910": "Activities of religious organizations",
  "94920": "Activities of political organizations",
  "94990": "Activities of other membership organizations n.e.c.",
  "95110": "Repair of computers and peripheral equipment",
  "95120": "Repair of communication equipment",
  "95210": "Repair of consumer electronics",
  "95220": "Repair of household appliances",
  "95290": "Repair of other personal and household goods",
  "96010": "Washing and dry-cleaning of textile and fur products",
  "96020": "Hairdressing and other beauty treatment",
  "96030": "Funeral and related activities",
  "96090": "Other personal service activities n.e.c.",
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
