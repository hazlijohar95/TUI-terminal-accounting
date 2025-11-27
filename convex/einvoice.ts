/**
 * E-Invoice Convex Functions
 *
 * Functions for LHDN e-invoice management including settings,
 * submissions, and status tracking.
 */

import { mutation, query, action } from "./_generated/server";
import { v } from "convex/values";

// ============================================
// LHDN SETTINGS
// ============================================

/**
 * Get LHDN settings for an organization
 */
export const getSettings = query({
  args: {
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("lhdnSettings")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .first();

    return settings;
  },
});

/**
 * Save or update LHDN settings
 */
export const saveSettings = mutation({
  args: {
    orgId: v.id("organizations"),
    tin: v.string(),
    brn: v.optional(v.string()),
    sstRegistration: v.optional(v.string()),
    tourismTaxRegistration: v.optional(v.string()),
    msicCode: v.string(),
    businessActivityDescription: v.string(),
    supplierEmail: v.optional(v.string()),
    supplierPhone: v.optional(v.string()),
    addressLine1: v.string(),
    addressLine2: v.optional(v.string()),
    addressLine3: v.optional(v.string()),
    postalCode: v.string(),
    city: v.string(),
    state: v.string(),
    country: v.string(),
    clientId: v.optional(v.string()),
    clientSecretEncrypted: v.optional(v.string()),
    certificatePath: v.optional(v.string()),
    certificatePasswordEncrypted: v.optional(v.string()),
    environment: v.union(v.literal("sandbox"), v.literal("production")),
    autoSubmit: v.boolean(),
    defaultClassificationCode: v.optional(v.string()),
    defaultTaxType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("lhdnSettings")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        updatedAt: now,
      });
      return { success: true, id: existing._id, created: false };
    }

    const id = await ctx.db.insert("lhdnSettings", {
      ...args,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return { success: true, id, created: true };
  },
});

/**
 * Update LHDN credentials only
 */
export const updateCredentials = mutation({
  args: {
    orgId: v.id("organizations"),
    clientId: v.string(),
    clientSecretEncrypted: v.string(),
  },
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("lhdnSettings")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .first();

    if (!settings) {
      throw new Error("LHDN settings not found. Please configure settings first.");
    }

    await ctx.db.patch(settings._id, {
      clientId: args.clientId,
      clientSecretEncrypted: args.clientSecretEncrypted,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Update certificate information
 */
export const updateCertificate = mutation({
  args: {
    orgId: v.id("organizations"),
    certificatePath: v.string(),
    certificatePasswordEncrypted: v.string(),
  },
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("lhdnSettings")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .first();

    if (!settings) {
      throw new Error("LHDN settings not found. Please configure settings first.");
    }

    await ctx.db.patch(settings._id, {
      certificatePath: args.certificatePath,
      certificatePasswordEncrypted: args.certificatePasswordEncrypted,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// ============================================
// E-INVOICE SUBMISSIONS
// ============================================

/**
 * Create a new e-invoice submission record
 */
export const createSubmission = mutation({
  args: {
    orgId: v.id("organizations"),
    invoiceId: v.id("invoices"),
    documentType: v.string(),
    documentVersion: v.string(),
    documentHash: v.optional(v.string()),
    digitalSignature: v.optional(v.string()),
    ublJson: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const id = await ctx.db.insert("einvoiceSubmissions", {
      orgId: args.orgId,
      invoiceId: args.invoiceId,
      documentType: args.documentType,
      documentVersion: args.documentVersion,
      status: "pending",
      documentHash: args.documentHash,
      digitalSignature: args.digitalSignature,
      ublJson: args.ublJson,
      retryCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    // Update invoice e-invoice status
    await ctx.db.patch(args.invoiceId, {
      einvoiceStatus: "pending",
      updatedAt: now,
    });

    return { success: true, id };
  },
});

/**
 * Update submission after LHDN response
 */
export const updateSubmission = mutation({
  args: {
    id: v.id("einvoiceSubmissions"),
    uuid: v.optional(v.string()),
    longId: v.optional(v.string()),
    submissionUid: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("submitted"),
      v.literal("valid"),
      v.literal("invalid"),
      v.literal("cancelled"),
      v.literal("rejected")
    ),
    submissionResponse: v.optional(v.string()),
    validationErrors: v.optional(v.string()),
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.id);
    if (!submission) {
      throw new Error("Submission not found");
    }

    const now = Date.now();
    const updates: Record<string, unknown> = {
      status: args.status,
      updatedAt: now,
    };

    if (args.uuid) updates.uuid = args.uuid;
    if (args.longId) updates.longId = args.longId;
    if (args.submissionUid) updates.submissionUid = args.submissionUid;
    if (args.submissionResponse) updates.submissionResponse = args.submissionResponse;
    if (args.validationErrors) updates.validationErrors = args.validationErrors;
    if (args.errorCode) updates.errorCode = args.errorCode;
    if (args.errorMessage) updates.errorMessage = args.errorMessage;

    // Set timestamps based on status
    if (args.status === "submitted") {
      updates.submittedAt = now;
    } else if (args.status === "valid") {
      updates.validatedAt = now;
    } else if (args.status === "cancelled") {
      updates.cancelledAt = now;
    }

    await ctx.db.patch(args.id, updates);

    // Update invoice e-invoice status
    await ctx.db.patch(submission.invoiceId, {
      einvoiceStatus: args.status === "pending" ? "pending" : args.status,
      einvoiceUuid: args.uuid,
      einvoiceLongId: args.longId,
      einvoiceSubmittedAt: args.status === "submitted" ? now : undefined,
      einvoiceValidatedAt: args.status === "valid" ? now : undefined,
      updatedAt: now,
    });

    return { success: true };
  },
});

/**
 * Record a retry attempt
 */
export const recordRetry = mutation({
  args: {
    id: v.id("einvoiceSubmissions"),
  },
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.id);
    if (!submission) {
      throw new Error("Submission not found");
    }

    await ctx.db.patch(args.id, {
      retryCount: submission.retryCount + 1,
      lastRetryAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { success: true, retryCount: submission.retryCount + 1 };
  },
});

/**
 * Get submission for an invoice
 */
export const getSubmission = query({
  args: {
    invoiceId: v.id("invoices"),
  },
  handler: async (ctx, args) => {
    const submissions = await ctx.db
      .query("einvoiceSubmissions")
      .withIndex("by_invoice", (q) => q.eq("invoiceId", args.invoiceId))
      .order("desc")
      .collect();

    return submissions[0] || null;
  },
});

/**
 * Get submission by UUID
 */
export const getSubmissionByUuid = query({
  args: {
    uuid: v.string(),
  },
  handler: async (ctx, args) => {
    const submission = await ctx.db
      .query("einvoiceSubmissions")
      .withIndex("by_uuid", (q) => q.eq("uuid", args.uuid))
      .first();

    return submission;
  },
});

/**
 * List submissions for an organization
 */
export const listSubmissions = query({
  args: {
    orgId: v.id("organizations"),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("submitted"),
        v.literal("valid"),
        v.literal("invalid"),
        v.literal("cancelled"),
        v.literal("rejected")
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let query;

    if (args.status) {
      query = ctx.db
        .query("einvoiceSubmissions")
        .withIndex("by_status", (q) =>
          q.eq("orgId", args.orgId).eq("status", args.status!)
        );
    } else {
      query = ctx.db
        .query("einvoiceSubmissions")
        .withIndex("by_org", (q) => q.eq("orgId", args.orgId));
    }

    const submissions = await query.order("desc").take(args.limit ?? 50);

    // Get associated invoices
    const result = await Promise.all(
      submissions.map(async (sub) => {
        const invoice = await ctx.db.get(sub.invoiceId);
        return {
          ...sub,
          invoiceNumber: invoice?.number,
          invoiceTotal: invoice?.total,
        };
      })
    );

    return result;
  },
});

/**
 * Get pending submissions for retry
 */
export const getPendingSubmissions = query({
  args: {
    orgId: v.id("organizations"),
    maxRetries: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const submissions = await ctx.db
      .query("einvoiceSubmissions")
      .withIndex("by_status", (q) =>
        q.eq("orgId", args.orgId).eq("status", "pending")
      )
      .collect();

    // Filter by retry count
    const maxRetries = args.maxRetries ?? 3;
    return submissions.filter((s) => s.retryCount < maxRetries);
  },
});

// ============================================
// INVOICE E-INVOICE STATUS UPDATES
// ============================================

/**
 * Update invoice e-invoice status directly
 */
export const updateInvoiceEinvoiceStatus = mutation({
  args: {
    invoiceId: v.id("invoices"),
    status: v.union(
      v.literal("none"),
      v.literal("pending"),
      v.literal("submitted"),
      v.literal("valid"),
      v.literal("invalid"),
      v.literal("cancelled"),
      v.literal("rejected")
    ),
    uuid: v.optional(v.string()),
    longId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) {
      throw new Error("Invoice not found");
    }

    const now = Date.now();
    const updates: Record<string, unknown> = {
      einvoiceStatus: args.status,
      updatedAt: now,
    };

    if (args.uuid) updates.einvoiceUuid = args.uuid;
    if (args.longId) updates.einvoiceLongId = args.longId;

    if (args.status === "submitted") {
      updates.einvoiceSubmittedAt = now;
    } else if (args.status === "valid") {
      updates.einvoiceValidatedAt = now;
    }

    await ctx.db.patch(args.invoiceId, updates);
    return { success: true };
  },
});

/**
 * List invoices by e-invoice status
 */
export const listByEinvoiceStatus = query({
  args: {
    orgId: v.id("organizations"),
    status: v.union(
      v.literal("none"),
      v.literal("pending"),
      v.literal("submitted"),
      v.literal("valid"),
      v.literal("invalid"),
      v.literal("cancelled"),
      v.literal("rejected")
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_einvoice_status", (q) =>
        q.eq("orgId", args.orgId).eq("einvoiceStatus", args.status)
      )
      .order("desc")
      .take(args.limit ?? 50);

    return invoices;
  },
});

/**
 * Get e-invoice statistics for dashboard
 */
export const getStatistics = query({
  args: {
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const submissions = await ctx.db
      .query("einvoiceSubmissions")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    const stats = {
      total: submissions.length,
      pending: 0,
      submitted: 0,
      valid: 0,
      invalid: 0,
      cancelled: 0,
      rejected: 0,
    };

    for (const sub of submissions) {
      stats[sub.status as keyof typeof stats]++;
    }

    return stats;
  },
});
