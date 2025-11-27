/**
 * Invoice Schemas
 *
 * Zod validation schemas for invoice API requests.
 */

import { z } from "zod";

/**
 * Invoice line item schema
 */
export const invoiceItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  quantity: z.number().positive("Quantity must be positive"),
  unitPrice: z.number().min(0, "Unit price cannot be negative"),
  incomeAccountId: z.string().optional(),
});

/**
 * Create invoice request schema
 */
export const createInvoiceSchema = z.object({
  customerId: z.string().min(1, "Customer ID is required"),
  number: z.string().min(1, "Invoice number is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Due date must be YYYY-MM-DD format"),
  items: z.array(invoiceItemSchema).min(1, "At least one line item is required"),
  taxRate: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
  terms: z.string().optional(),
});

/**
 * Update invoice request schema
 */
export const updateInvoiceSchema = z.object({
  customerId: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
  terms: z.string().optional(),
});

/**
 * Update invoice status schema
 */
export const updateInvoiceStatusSchema = z.object({
  status: z.enum([
    "draft",
    "sent",
    "viewed",
    "partial",
    "paid",
    "overdue",
    "cancelled",
    "void",
  ]),
});

/**
 * Record payment schema
 */
export const recordPaymentSchema = z.object({
  amount: z.number().positive("Payment amount must be positive"),
});

/**
 * Invoice query params schema
 */
export const invoiceQuerySchema = z.object({
  status: z
    .enum(["draft", "sent", "viewed", "partial", "paid", "overdue", "cancelled", "void"])
    .optional(),
  customerId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type InvoiceQueryParams = z.infer<typeof invoiceQuerySchema>;
