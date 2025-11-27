import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
/**
 * List invoices for an organization
 */
export const list = query({
    args: {
        orgId: v.id("organizations"),
        status: v.optional(v.union(v.literal("draft"), v.literal("sent"), v.literal("viewed"), v.literal("partial"), v.literal("paid"), v.literal("overdue"), v.literal("cancelled"), v.literal("void"))),
        customerId: v.optional(v.id("customers")),
        limit: v.optional(v.number()),
        cursor: v.optional(v.id("invoices")),
    },
    handler: async (ctx, args) => {
        let invoicesQuery = ctx.db
            .query("invoices")
            .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
            .order("desc");
        let invoices = await invoicesQuery.take(args.limit ?? 50);
        // Apply filters
        if (args.status) {
            invoices = invoices.filter((inv) => inv.status === args.status);
        }
        if (args.customerId) {
            invoices = invoices.filter((inv) => inv.customerId === args.customerId);
        }
        return invoices;
    },
});
/**
 * Get a single invoice by ID
 */
export const get = query({
    args: {
        orgId: v.id("organizations"),
        id: v.id("invoices"),
    },
    handler: async (ctx, args) => {
        const invoice = await ctx.db.get(args.id);
        if (!invoice || invoice.orgId !== args.orgId) {
            return null;
        }
        // Get line items
        const items = await ctx.db
            .query("invoiceItems")
            .withIndex("by_invoice", (q) => q.eq("invoiceId", args.id))
            .collect();
        // Get customer
        const customer = await ctx.db.get(invoice.customerId);
        return {
            ...invoice,
            items,
            customer,
        };
    },
});
/**
 * Get invoice by number
 */
export const getByNumber = query({
    args: {
        orgId: v.id("organizations"),
        number: v.string(),
    },
    handler: async (ctx, args) => {
        const invoice = await ctx.db
            .query("invoices")
            .withIndex("by_number", (q) => q.eq("orgId", args.orgId).eq("number", args.number))
            .first();
        return invoice;
    },
});
/**
 * Create a new invoice
 */
export const create = mutation({
    args: {
        orgId: v.id("organizations"),
        customerId: v.id("customers"),
        number: v.string(),
        date: v.string(),
        dueDate: v.string(),
        items: v.array(v.object({
            description: v.string(),
            quantity: v.number(),
            unitPrice: v.number(),
            incomeAccountId: v.optional(v.id("accounts")),
        })),
        taxRate: v.optional(v.number()),
        notes: v.optional(v.string()),
        terms: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        // Calculate totals
        const subtotal = args.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
        const taxAmount = args.taxRate
            ? Math.round(subtotal * (args.taxRate / 100))
            : 0;
        const total = subtotal + taxAmount;
        // Create invoice
        const invoiceId = await ctx.db.insert("invoices", {
            orgId: args.orgId,
            customerId: args.customerId,
            number: args.number,
            date: args.date,
            dueDate: args.dueDate,
            status: "draft",
            subtotal,
            taxRate: args.taxRate,
            taxAmount,
            total,
            amountPaid: 0,
            balanceDue: total,
            notes: args.notes,
            terms: args.terms,
            createdAt: now,
            updatedAt: now,
        });
        // Create line items
        for (let i = 0; i < args.items.length; i++) {
            const item = args.items[i];
            await ctx.db.insert("invoiceItems", {
                invoiceId,
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                amount: item.quantity * item.unitPrice,
                incomeAccountId: item.incomeAccountId,
                sortOrder: i,
            });
        }
        return { _id: invoiceId, number: args.number };
    },
});
/**
 * Update an invoice
 */
export const update = mutation({
    args: {
        id: v.id("invoices"),
        orgId: v.id("organizations"),
        customerId: v.optional(v.id("customers")),
        date: v.optional(v.string()),
        dueDate: v.optional(v.string()),
        taxRate: v.optional(v.number()),
        notes: v.optional(v.string()),
        terms: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const invoice = await ctx.db.get(args.id);
        if (!invoice || invoice.orgId !== args.orgId) {
            throw new Error("Invoice not found");
        }
        if (invoice.status !== "draft") {
            throw new Error("Can only update draft invoices");
        }
        const updates = {
            updatedAt: Date.now(),
        };
        if (args.customerId)
            updates.customerId = args.customerId;
        if (args.date)
            updates.date = args.date;
        if (args.dueDate)
            updates.dueDate = args.dueDate;
        if (args.taxRate !== undefined) {
            updates.taxRate = args.taxRate;
            updates.taxAmount = Math.round(invoice.subtotal * (args.taxRate / 100));
            updates.total = invoice.subtotal + updates.taxAmount;
            updates.balanceDue = updates.total - invoice.amountPaid;
        }
        if (args.notes !== undefined)
            updates.notes = args.notes;
        if (args.terms !== undefined)
            updates.terms = args.terms;
        await ctx.db.patch(args.id, updates);
        return { success: true };
    },
});
/**
 * Update invoice status
 */
export const updateStatus = mutation({
    args: {
        id: v.id("invoices"),
        orgId: v.id("organizations"),
        status: v.union(v.literal("draft"), v.literal("sent"), v.literal("viewed"), v.literal("partial"), v.literal("paid"), v.literal("overdue"), v.literal("cancelled"), v.literal("void")),
    },
    handler: async (ctx, args) => {
        const invoice = await ctx.db.get(args.id);
        if (!invoice || invoice.orgId !== args.orgId) {
            throw new Error("Invoice not found");
        }
        const updates = {
            status: args.status,
            updatedAt: Date.now(),
        };
        if (args.status === "sent" && !invoice.sentAt) {
            updates.sentAt = Date.now();
        }
        if (args.status === "paid" && !invoice.paidAt) {
            updates.paidAt = Date.now();
        }
        await ctx.db.patch(args.id, updates);
        return { success: true };
    },
});
/**
 * Record a payment against an invoice
 */
export const recordPayment = mutation({
    args: {
        id: v.id("invoices"),
        orgId: v.id("organizations"),
        amount: v.number(),
    },
    handler: async (ctx, args) => {
        const invoice = await ctx.db.get(args.id);
        if (!invoice || invoice.orgId !== args.orgId) {
            throw new Error("Invoice not found");
        }
        const newAmountPaid = invoice.amountPaid + args.amount;
        const newBalanceDue = invoice.total - newAmountPaid;
        let newStatus = invoice.status;
        if (newBalanceDue <= 0) {
            newStatus = "paid";
        }
        else if (newAmountPaid > 0) {
            newStatus = "partial";
        }
        await ctx.db.patch(args.id, {
            amountPaid: newAmountPaid,
            balanceDue: Math.max(0, newBalanceDue),
            status: newStatus,
            paidAt: newStatus === "paid" ? Date.now() : invoice.paidAt,
            updatedAt: Date.now(),
        });
        return {
            success: true,
            newStatus,
            amountPaid: newAmountPaid,
            balanceDue: Math.max(0, newBalanceDue),
        };
    },
});
/**
 * Delete a draft invoice
 */
export const remove = mutation({
    args: {
        id: v.id("invoices"),
        orgId: v.id("organizations"),
    },
    handler: async (ctx, args) => {
        const invoice = await ctx.db.get(args.id);
        if (!invoice || invoice.orgId !== args.orgId) {
            throw new Error("Invoice not found");
        }
        if (invoice.status !== "draft") {
            throw new Error("Can only delete draft invoices");
        }
        // Delete line items first
        const items = await ctx.db
            .query("invoiceItems")
            .withIndex("by_invoice", (q) => q.eq("invoiceId", args.id))
            .collect();
        for (const item of items) {
            await ctx.db.delete(item._id);
        }
        // Delete the invoice
        await ctx.db.delete(args.id);
        return { success: true };
    },
});
