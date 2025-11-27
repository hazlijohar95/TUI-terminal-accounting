/**
 * Convex Database Schema
 *
 * Comprehensive schema for OpenAccounting with multi-tenant support.
 * All tables are organization-scoped for data isolation.
 */

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ============================================
  // MULTI-TENANT & AUTHENTICATION
  // ============================================

  /**
   * Organizations - top-level tenant
   */
  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
    settings: v.optional(
      v.object({
        currency: v.optional(v.string()),
        fiscalYearStart: v.optional(v.string()),
        timezone: v.optional(v.string()),
        invoicePrefix: v.optional(v.string()),
        nextInvoiceNumber: v.optional(v.number()),
      })
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"]),

  /**
   * API Keys - for programmatic access
   */
  apiKeys: defineTable({
    orgId: v.id("organizations"),
    keyHash: v.string(), // bcrypt hash, never store plain text
    keyPrefix: v.string(), // First 8 chars for identification (e.g., "oa_abc123")
    name: v.string(),
    scopes: v.array(v.string()), // e.g., ["invoices:read", "invoices:write"]
    lastUsedAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    isActive: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_prefix", ["keyPrefix"]),

  /**
   * Users - organization members
   */
  users: defineTable({
    orgId: v.id("organizations"),
    email: v.string(),
    name: v.string(),
    role: v.union(
      v.literal("owner"),
      v.literal("admin"),
      v.literal("member"),
      v.literal("readonly")
    ),
    passwordHash: v.optional(v.string()),
    lastLoginAt: v.optional(v.number()),
    isActive: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_email", ["email"]),

  // ============================================
  // CHART OF ACCOUNTS
  // ============================================

  /**
   * Accounts - chart of accounts
   */
  accounts: defineTable({
    orgId: v.id("organizations"),
    code: v.string(), // e.g., "1000", "1100"
    name: v.string(), // e.g., "Cash", "Accounts Receivable"
    type: v.union(
      v.literal("asset"),
      v.literal("liability"),
      v.literal("equity"),
      v.literal("income"),
      v.literal("expense")
    ),
    parentId: v.optional(v.id("accounts")),
    description: v.optional(v.string()),
    isSystem: v.boolean(), // System accounts cannot be deleted
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_code", ["orgId", "code"])
    .index("by_type", ["orgId", "type"])
    .index("by_parent", ["parentId"]),

  // ============================================
  // CONTACTS
  // ============================================

  /**
   * Customers - people/companies you sell to
   */
  customers: defineTable({
    orgId: v.id("organizations"),
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    taxId: v.optional(v.string()),
    address: v.optional(
      v.object({
        street: v.optional(v.string()),
        city: v.optional(v.string()),
        state: v.optional(v.string()),
        postalCode: v.optional(v.string()),
        country: v.optional(v.string()),
      })
    ),
    paymentTerms: v.optional(v.number()), // Days, e.g., 30
    notes: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    // LHDN e-Invoice fields (buyer information)
    tin: v.optional(v.string()),           // Tax Identification Number
    brn: v.optional(v.string()),           // Business Registration Number
    sstRegistration: v.optional(v.string()), // SST Registration Number
    idType: v.optional(v.string()),        // NRIC, PASSPORT, BRN, ARMY
    idValue: v.optional(v.string()),       // ID number
    countryCode: v.optional(v.string()),   // ISO 3166-1 alpha-3 (MYS)
    // Structured LHDN address
    lhdnAddress: v.optional(
      v.object({
        addressLine1: v.optional(v.string()),
        addressLine2: v.optional(v.string()),
        addressLine3: v.optional(v.string()),
        postalCode: v.optional(v.string()),
        city: v.optional(v.string()),
        state: v.optional(v.string()),
        country: v.optional(v.string()),
      })
    ),
  })
    .index("by_org", ["orgId"])
    .index("by_email", ["orgId", "email"])
    .index("by_name", ["orgId", "name"])
    .index("by_tin", ["orgId", "tin"]),

  /**
   * Vendors - people/companies you buy from
   */
  vendors: defineTable({
    orgId: v.id("organizations"),
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    taxId: v.optional(v.string()),
    address: v.optional(
      v.object({
        street: v.optional(v.string()),
        city: v.optional(v.string()),
        state: v.optional(v.string()),
        postalCode: v.optional(v.string()),
        country: v.optional(v.string()),
      })
    ),
    defaultExpenseAccountId: v.optional(v.id("accounts")),
    notes: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_name", ["orgId", "name"]),

  // ============================================
  // INVOICING
  // ============================================

  /**
   * Invoices - sales invoices to customers
   */
  invoices: defineTable({
    orgId: v.id("organizations"),
    number: v.string(), // e.g., "INV-001"
    customerId: v.id("customers"),
    date: v.string(), // ISO date: "2024-01-15"
    dueDate: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("sent"),
      v.literal("viewed"),
      v.literal("partial"),
      v.literal("paid"),
      v.literal("overdue"),
      v.literal("cancelled"),
      v.literal("void")
    ),
    // Amounts (stored in cents to avoid floating point issues)
    subtotal: v.number(),
    taxRate: v.optional(v.number()), // Percentage, e.g., 8.25
    taxAmount: v.number(),
    total: v.number(),
    amountPaid: v.number(),
    balanceDue: v.number(),
    // Linked journal entry for double-entry
    journalEntryId: v.optional(v.id("journalEntries")),
    // Metadata
    notes: v.optional(v.string()),
    terms: v.optional(v.string()),
    sentAt: v.optional(v.number()),
    paidAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    // LHDN e-Invoice fields
    einvoiceStatus: v.optional(
      v.union(
        v.literal("none"),
        v.literal("pending"),
        v.literal("submitted"),
        v.literal("valid"),
        v.literal("invalid"),
        v.literal("cancelled"),
        v.literal("rejected")
      )
    ),
    einvoiceUuid: v.optional(v.string()),     // UUID assigned by LHDN
    einvoiceLongId: v.optional(v.string()),   // Long ID for public access
    currencyCode: v.optional(v.string()),     // ISO 4217 (MYR, USD, etc.)
    exchangeRate: v.optional(v.number()),     // Exchange rate if not MYR
    invoiceType: v.optional(v.string()),      // 01=Invoice, 02=Credit Note, etc.
    originalInvoiceRef: v.optional(v.string()), // For credit/debit notes
    billingPeriodStart: v.optional(v.string()), // For recurring invoices
    billingPeriodEnd: v.optional(v.string()),
    paymentMode: v.optional(v.string()),      // LHDN payment mode code
    einvoiceSubmittedAt: v.optional(v.number()),
    einvoiceValidatedAt: v.optional(v.number()),
  })
    .index("by_org", ["orgId"])
    .index("by_customer", ["customerId"])
    .index("by_status", ["orgId", "status"])
    .index("by_date", ["orgId", "date"])
    .index("by_number", ["orgId", "number"])
    .index("by_einvoice_status", ["orgId", "einvoiceStatus"]),

  /**
   * Invoice Items - line items on invoices
   */
  invoiceItems: defineTable({
    invoiceId: v.id("invoices"),
    description: v.string(),
    quantity: v.number(),
    unitPrice: v.number(), // Cents
    amount: v.number(), // Cents (quantity * unitPrice)
    incomeAccountId: v.optional(v.id("accounts")),
    sortOrder: v.number(),
    // LHDN e-Invoice fields
    classificationCode: v.optional(v.string()), // LHDN classification code (001-015)
    unitCode: v.optional(v.string()),           // UN/ECE unit code (EA, H87, KGM, etc.)
    taxType: v.optional(v.string()),            // 01-06, E for exempt
    taxRate: v.optional(v.number()),            // Percentage
    taxAmount: v.optional(v.number()),          // Cents
    discountRate: v.optional(v.number()),       // Percentage
    discountAmount: v.optional(v.number()),     // Cents
    productTariffCode: v.optional(v.string()),  // Customs tariff code
    countryOfOrigin: v.optional(v.string()),    // ISO country code
  })
    .index("by_invoice", ["invoiceId"]),

  // ============================================
  // EXPENSES
  // ============================================

  /**
   * Expenses - outgoing money
   */
  expenses: defineTable({
    orgId: v.id("organizations"),
    date: v.string(), // ISO date
    vendorId: v.optional(v.id("vendors")),
    description: v.string(),
    amount: v.number(), // Cents
    expenseAccountId: v.id("accounts"),
    paymentAccountId: v.optional(v.id("accounts")), // Cash/bank account used
    paymentMethod: v.optional(
      v.union(
        v.literal("cash"),
        v.literal("check"),
        v.literal("credit_card"),
        v.literal("bank_transfer"),
        v.literal("other")
      )
    ),
    reference: v.optional(v.string()), // Check number, reference
    receiptUrl: v.optional(v.string()),
    isReimbursable: v.boolean(),
    isBillable: v.boolean(),
    journalEntryId: v.optional(v.id("journalEntries")),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_vendor", ["vendorId"])
    .index("by_date", ["orgId", "date"])
    .index("by_account", ["expenseAccountId"]),

  // ============================================
  // PAYMENTS
  // ============================================

  /**
   * Payments - money received or sent
   */
  payments: defineTable({
    orgId: v.id("organizations"),
    type: v.union(v.literal("received"), v.literal("sent")),
    date: v.string(),
    amount: v.number(), // Cents
    method: v.union(
      v.literal("cash"),
      v.literal("check"),
      v.literal("credit_card"),
      v.literal("bank_transfer"),
      v.literal("online"),
      v.literal("other")
    ),
    // Linked entities
    invoiceId: v.optional(v.id("invoices")),
    customerId: v.optional(v.id("customers")),
    vendorId: v.optional(v.id("vendors")),
    depositAccountId: v.id("accounts"), // Where money goes/comes from
    reference: v.optional(v.string()),
    journalEntryId: v.optional(v.id("journalEntries")),
    notes: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_invoice", ["invoiceId"])
    .index("by_date", ["orgId", "date"]),

  // ============================================
  // JOURNAL ENTRIES (DOUBLE-ENTRY BOOKKEEPING)
  // ============================================

  /**
   * Journal Entries - the heart of double-entry accounting
   */
  journalEntries: defineTable({
    orgId: v.id("organizations"),
    date: v.string(),
    number: v.optional(v.string()), // JE-001
    description: v.string(),
    entryType: v.union(
      v.literal("manual"),
      v.literal("invoice"),
      v.literal("payment"),
      v.literal("expense"),
      v.literal("adjustment"),
      v.literal("closing")
    ),
    // Source reference
    sourceType: v.optional(v.string()), // "invoice", "expense", etc.
    sourceId: v.optional(v.string()),
    isLocked: v.boolean(), // Locked entries cannot be edited
    isPosted: v.boolean(), // Posted = finalized
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_date", ["orgId", "date"])
    .index("by_type", ["orgId", "entryType"]),

  /**
   * Journal Lines - debit/credit lines within journal entries
   */
  journalLines: defineTable({
    journalEntryId: v.id("journalEntries"),
    accountId: v.id("accounts"),
    debit: v.number(), // Cents (0 if credit)
    credit: v.number(), // Cents (0 if debit)
    description: v.optional(v.string()),
    sortOrder: v.number(),
  })
    .index("by_entry", ["journalEntryId"])
    .index("by_account", ["accountId"]),

  // ============================================
  // DOCUMENTS & ATTACHMENTS
  // ============================================

  /**
   * Documents - uploaded files (receipts, contracts, etc.)
   */
  documents: defineTable({
    orgId: v.id("organizations"),
    name: v.string(),
    type: v.union(
      v.literal("receipt"),
      v.literal("invoice"),
      v.literal("contract"),
      v.literal("statement"),
      v.literal("other")
    ),
    mimeType: v.string(),
    size: v.number(), // Bytes
    storageId: v.string(), // Convex file storage ID
    // Linked entities
    linkedType: v.optional(v.string()), // "expense", "invoice"
    linkedId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_linked", ["linkedType", "linkedId"]),

  // ============================================
  // LHDN E-INVOICING
  // ============================================

  /**
   * LHDN Settings - organization's e-invoice configuration
   */
  lhdnSettings: defineTable({
    orgId: v.id("organizations"),
    // Supplier information (mandatory for LHDN)
    tin: v.string(),                           // Tax Identification Number
    brn: v.optional(v.string()),               // Business Registration Number (SSM)
    sstRegistration: v.optional(v.string()),   // SST Registration Number
    tourismTaxRegistration: v.optional(v.string()), // Tourism Tax Registration
    msicCode: v.string(),                      // 5-digit MSIC code
    businessActivityDescription: v.string(),
    supplierEmail: v.optional(v.string()),
    supplierPhone: v.optional(v.string()),
    // Supplier address
    addressLine1: v.string(),
    addressLine2: v.optional(v.string()),
    addressLine3: v.optional(v.string()),
    postalCode: v.string(),
    city: v.string(),
    state: v.string(),                         // Malaysia state code (JHR, KDH, etc.)
    country: v.string(),                       // ISO 3166-1 alpha-3 (MYS)
    // API credentials (encrypted)
    clientId: v.optional(v.string()),
    clientSecretEncrypted: v.optional(v.string()),
    // Certificate (encrypted paths/data)
    certificatePath: v.optional(v.string()),
    certificatePasswordEncrypted: v.optional(v.string()),
    // Settings
    environment: v.union(v.literal("sandbox"), v.literal("production")),
    autoSubmit: v.boolean(),                   // Auto-submit on invoice finalization
    defaultClassificationCode: v.optional(v.string()),
    defaultTaxType: v.optional(v.string()),
    // Status
    isActive: v.boolean(),
    lastTokenRefresh: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["orgId"]),

  /**
   * E-Invoice Submissions - track submission history
   */
  einvoiceSubmissions: defineTable({
    orgId: v.id("organizations"),
    invoiceId: v.id("invoices"),
    // LHDN identifiers
    uuid: v.optional(v.string()),              // UUID assigned by LHDN
    longId: v.optional(v.string()),            // Long ID for public access
    submissionUid: v.optional(v.string()),     // Submission batch ID
    // Document info
    documentType: v.string(),                  // 01, 02, 03, 11, 12, 13
    documentVersion: v.string(),               // UBL version
    status: v.union(
      v.literal("pending"),
      v.literal("submitted"),
      v.literal("valid"),
      v.literal("invalid"),
      v.literal("cancelled"),
      v.literal("rejected")
    ),
    // Document data
    documentHash: v.optional(v.string()),      // SHA-256 hash
    digitalSignature: v.optional(v.string()),  // RSA-SHA256 signature
    ublJson: v.optional(v.string()),           // Full UBL JSON document
    // Response data
    submissionResponse: v.optional(v.string()), // Raw LHDN response (JSON)
    validationErrors: v.optional(v.string()),   // Error details (JSON)
    // Timestamps
    submittedAt: v.optional(v.number()),
    validatedAt: v.optional(v.number()),
    cancelledAt: v.optional(v.number()),
    // Error tracking
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    retryCount: v.number(),
    lastRetryAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_invoice", ["invoiceId"])
    .index("by_uuid", ["uuid"])
    .index("by_status", ["orgId", "status"])
    .index("by_submission", ["submissionUid"]),

  // ============================================
  // AUDIT & LOGGING
  // ============================================

  /**
   * Audit Log - track all changes for compliance
   */
  auditLog: defineTable({
    orgId: v.id("organizations"),
    userId: v.optional(v.string()),
    apiKeyId: v.optional(v.id("apiKeys")),
    action: v.union(
      v.literal("create"),
      v.literal("update"),
      v.literal("delete"),
      v.literal("login"),
      v.literal("logout"),
      v.literal("export"),
      v.literal("api_call")
    ),
    entityType: v.string(), // "invoice", "expense", etc.
    entityId: v.optional(v.string()),
    changes: v.optional(v.string()), // JSON of old -> new values
    metadata: v.optional(v.string()), // Additional context (JSON)
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_entity", ["entityType", "entityId"])
    .index("by_timestamp", ["orgId", "timestamp"])
    .index("by_user", ["userId"]),
});
