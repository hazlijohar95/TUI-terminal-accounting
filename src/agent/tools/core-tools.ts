/**
 * Core Tools
 *
 * Core business operation tools for the AI Accounting Agent.
 * Covers customers, vendors, invoices, payments, and expenses.
 */

import {
  createInvoice,
  getInvoice,
  listInvoices,
  updateInvoiceStatus,
} from "../../domain/invoices.js";
import { createCustomer, getCustomer, listCustomers } from "../../domain/customers.js";
import { createVendor, getVendor, listVendors } from "../../domain/vendors.js";
import { recordPayment, recordExpense, listPayments } from "../../domain/payments.js";
import { listExpenses, getExpense, updateExpense, deleteExpense, getExpenseCategories } from "../../domain/expenses.js";
import { matchExpense } from "../../domain/categorization-rules.js";
import { linkDocumentToExpense, getUnlinkedDocuments } from "../../domain/documents.js";
import { defineTool, type AgentTool } from "./tool-registry.js";

// ============================================================================
// Customer Tools
// ============================================================================

export const createCustomerTool = defineTool(
  "create_customer",
  "Create a new customer",
  "customer",
  {
    type: "object",
    properties: {
      name: { type: "string", description: "Customer name" },
      email: { type: "string", description: "Customer email address" },
      phone: { type: "string", description: "Customer phone number" },
      address: { type: "string", description: "Customer address" },
    },
    required: ["name"],
  },
  async (args) => {
    const existing = getCustomer(args.name as string);
    if (existing) {
      return {
        success: true,
        result: `Customer "${args.name}" already exists (ID: ${existing.id})`,
        data: { customer_id: existing.id, existing: true },
      };
    }

    const customer = createCustomer({
      name: args.name as string,
      email: args.email as string | undefined,
      phone: args.phone as string | undefined,
      address: args.address as string | undefined,
    });

    return {
      success: true,
      result: `Created customer "${customer.name}" (ID: ${customer.id})`,
      data: { customer_id: customer.id },
    };
  }
);

export const getCustomerTool = defineTool(
  "get_customer",
  "Get customer details by name or ID",
  "customer",
  {
    type: "object",
    properties: {
      identifier: {
        type: "string",
        description: "Customer name or ID",
      },
    },
    required: ["identifier"],
  },
  async (args) => {
    const customer = getCustomer(args.identifier as string);
    if (!customer) {
      return {
        success: false,
        result: `Customer "${args.identifier}" not found`,
      };
    }

    return {
      success: true,
      result: `Customer: ${customer.name}
Email: ${customer.email || "N/A"}
Phone: ${customer.phone || "N/A"}
Address: ${customer.address || "N/A"}`,
      data: customer,
    };
  }
);

export const listCustomersTool = defineTool(
  "list_customers",
  "List all customers, optionally with outstanding balance",
  "customer",
  {
    type: "object",
    properties: {
      with_balance: {
        type: "boolean",
        description: "Only show customers with outstanding balance",
      },
    },
  },
  async (args) => {
    const customers = listCustomers();
    const filtered = args.with_balance
      ? customers.filter((c) => c.balance > 0)
      : customers;

    if (filtered.length === 0) {
      return {
        success: true,
        result: "No customers found",
        data: { count: 0, customers: [] },
      };
    }

    const summary = filtered
      .map(
        (c) => `${c.name}${c.balance > 0 ? ` - owes $${c.balance.toFixed(2)}` : ""}`
      )
      .join("\n");

    return {
      success: true,
      result: `Customers (${filtered.length}):\n${summary}`,
      data: { count: filtered.length, customers: filtered },
    };
  }
);

// ============================================================================
// Vendor Tools
// ============================================================================

export const createVendorTool = defineTool(
  "create_vendor",
  "Create a new vendor/supplier",
  "vendor",
  {
    type: "object",
    properties: {
      name: { type: "string", description: "Vendor name" },
      email: { type: "string", description: "Vendor email address" },
      phone: { type: "string", description: "Vendor phone number" },
      default_category: { type: "string", description: "Default expense category for this vendor" },
    },
    required: ["name"],
  },
  async (args) => {
    const existing = getVendor(args.name as string);
    if (existing) {
      return {
        success: true,
        result: `Vendor "${args.name}" already exists (ID: ${existing.id})`,
        data: { vendor_id: existing.id, existing: true },
      };
    }

    const vendor = createVendor({
      name: args.name as string,
      email: args.email as string | undefined,
      phone: args.phone as string | undefined,
      default_category: args.default_category as string | undefined,
    });

    return {
      success: true,
      result: `Created vendor "${vendor.name}" (ID: ${vendor.id})`,
      data: { vendor_id: vendor.id },
    };
  }
);

export const listVendorsTool = defineTool(
  "list_vendors",
  "List all vendors/suppliers",
  "vendor",
  {
    type: "object",
    properties: {},
  },
  async () => {
    const vendors = listVendors();

    if (vendors.length === 0) {
      return {
        success: true,
        result: "No vendors found",
        data: { count: 0, vendors: [] },
      };
    }

    const summary = vendors.map((v) => `${v.name}${v.default_category ? ` (${v.default_category})` : ""}`).join("\n");

    return {
      success: true,
      result: `Vendors (${vendors.length}):\n${summary}`,
      data: { count: vendors.length, vendors },
    };
  }
);

// ============================================================================
// Invoice Tools
// ============================================================================

export const createInvoiceTool = defineTool(
  "create_invoice",
  "Create a new invoice for a customer",
  "invoice",
  {
    type: "object",
    properties: {
      customer_name: {
        type: "string",
        description: "Name of the customer (will create if doesn't exist)",
      },
      customer_email: {
        type: "string",
        description: "Customer email (optional, for new customers)",
      },
      items: {
        type: "array",
        description: "Line items on the invoice",
        items: {
          type: "object",
          properties: {
            description: { type: "string", description: "Item description" },
            quantity: { type: "number", description: "Quantity (default 1)" },
            unit_price: { type: "number", description: "Price per unit" },
          },
          required: ["description", "unit_price"],
        },
      },
      notes: { type: "string", description: "Additional notes for the invoice" },
      due_days: { type: "number", description: "Days until due (default 30)" },
    },
    required: ["customer_name", "items"],
  },
  async (args) => {
    // Find or create customer
    let customer = getCustomer(args.customer_name as string);
    if (!customer) {
      customer = createCustomer({
        name: args.customer_name as string,
        email: args.customer_email as string | undefined,
      });
    }

    // Calculate due date
    const dueDays = (args.due_days as number) || 30;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + dueDays);

    // Create invoice
    const items = (args.items as Array<{ description: string; quantity?: number; unit_price: number }>).map(
      (item) => ({
        description: item.description,
        quantity: item.quantity || 1,
        unit_price: item.unit_price,
      })
    );

    const invoice = createInvoice({
      customer_id: customer.id,
      items,
      notes: args.notes as string | undefined,
      due_date: dueDate.toISOString().split("T")[0],
    });

    return {
      success: true,
      result: `Created invoice ${invoice.number} for ${customer.name}. Total: $${invoice.total.toFixed(2)}`,
      data: { invoice_number: invoice.number, total: invoice.total, customer_id: customer.id },
    };
  }
);

export const getInvoiceTool = defineTool(
  "get_invoice",
  "Get details of a specific invoice by number or ID",
  "invoice",
  {
    type: "object",
    properties: {
      identifier: {
        type: "string",
        description: "Invoice number (e.g., INV-0001) or ID",
      },
    },
    required: ["identifier"],
  },
  async (args) => {
    const identifier = args.identifier as string;
    const invoice = getInvoice(identifier.startsWith("INV") ? identifier : parseInt(identifier));

    if (!invoice) {
      return {
        success: false,
        result: `Invoice "${identifier}" not found`,
      };
    }

    const itemsList = invoice.items?.map((i) => `  - ${i.description}: ${i.quantity} x $${i.unit_price} = $${i.amount}`).join("\n") || "";

    return {
      success: true,
      result: `Invoice ${invoice.number}
Customer: ${invoice.customer_name}
Date: ${invoice.date}
Due: ${invoice.due_date}
Status: ${invoice.status}
Subtotal: $${invoice.subtotal.toFixed(2)}
Tax: $${invoice.tax_amount.toFixed(2)} (${invoice.tax_rate}%)
Total: $${invoice.total.toFixed(2)}
Paid: $${invoice.amount_paid.toFixed(2)}
Items:
${itemsList}`,
      data: invoice,
    };
  }
);

export const listInvoicesTool = defineTool(
  "list_invoices",
  "List invoices, optionally filtered by status or customer",
  "invoice",
  {
    type: "object",
    properties: {
      status: {
        type: "string",
        enum: ["draft", "sent", "partial", "paid", "overdue", "cancelled"],
        description: "Filter by invoice status",
      },
      customer_id: {
        type: "number",
        description: "Filter by customer ID",
      },
      from_date: {
        type: "string",
        description: "Filter invoices from this date (YYYY-MM-DD)",
      },
      to_date: {
        type: "string",
        description: "Filter invoices to this date (YYYY-MM-DD)",
      },
    },
  },
  async (args) => {
    const invoices = listInvoices({
      status: args.status as string | undefined,
      customer_id: args.customer_id as number | undefined,
      from_date: args.from_date as string | undefined,
      to_date: args.to_date as string | undefined,
    });

    if (invoices.length === 0) {
      return {
        success: true,
        result: "No invoices found matching the criteria",
        data: { count: 0, invoices: [] },
      };
    }

    const summary = invoices
      .map((inv) => `${inv.number}: ${inv.customer_name} - $${inv.total.toFixed(2)} (${inv.status})`)
      .join("\n");

    return {
      success: true,
      result: `Invoices (${invoices.length}):\n${summary}`,
      data: { count: invoices.length, invoices },
    };
  }
);

export const sendInvoiceTool = defineTool(
  "send_invoice",
  "Mark an invoice as sent",
  "invoice",
  {
    type: "object",
    properties: {
      invoice_number: {
        type: "string",
        description: "Invoice number (e.g., INV-0001)",
      },
    },
    required: ["invoice_number"],
  },
  async (args) => {
    const invoice = getInvoice(args.invoice_number as string);
    if (!invoice) {
      return { success: false, result: `Invoice ${args.invoice_number} not found` };
    }

    updateInvoiceStatus(invoice.id, "sent");
    return {
      success: true,
      result: `Invoice ${args.invoice_number} marked as sent`,
      data: { invoice_number: args.invoice_number },
    };
  }
);

export const markInvoicePaidTool = defineTool(
  "mark_invoice_paid",
  "Mark an invoice as fully paid",
  "invoice",
  {
    type: "object",
    properties: {
      invoice_number: {
        type: "string",
        description: "Invoice number (e.g., INV-0001)",
      },
    },
    required: ["invoice_number"],
  },
  async (args) => {
    const invoice = getInvoice(args.invoice_number as string);
    if (!invoice) {
      return { success: false, result: `Invoice ${args.invoice_number} not found` };
    }

    updateInvoiceStatus(invoice.id, "paid");
    return {
      success: true,
      result: `Invoice ${args.invoice_number} marked as paid`,
      data: { invoice_number: args.invoice_number },
    };
  }
);

// ============================================================================
// Payment Tools
// ============================================================================

export const recordPaymentTool = defineTool(
  "record_payment",
  "Record a payment received from a customer",
  "payment",
  {
    type: "object",
    properties: {
      invoice_number: {
        type: "string",
        description: "Invoice number being paid (optional)",
      },
      amount: {
        type: "number",
        description: "Payment amount",
      },
      date: {
        type: "string",
        description: "Payment date (YYYY-MM-DD). Defaults to today.",
      },
      method: {
        type: "string",
        enum: ["cash", "bank", "card", "check", "other"],
        description: "Payment method",
      },
      reference: {
        type: "string",
        description: "Payment reference (check number, transaction ID, etc.)",
      },
      notes: {
        type: "string",
        description: "Additional notes",
      },
    },
    required: ["amount"],
  },
  async (args) => {
    let invoiceId: number | undefined;
    let customerId: number | undefined;

    if (args.invoice_number) {
      const invoice = getInvoice(args.invoice_number as string);
      if (!invoice) {
        return { success: false, result: `Invoice ${args.invoice_number} not found` };
      }
      invoiceId = invoice.id;
      customerId = invoice.customer_id;
    }

    const payment = recordPayment({
      invoice_id: invoiceId,
      customer_id: customerId,
      amount: args.amount as number,
      date: args.date as string | undefined,
      method: args.method as "cash" | "bank" | "card" | "check" | "other" | undefined,
      reference: args.reference as string | undefined,
      notes: args.notes as string | undefined,
    });

    return {
      success: true,
      result: `Recorded payment of $${(args.amount as number).toFixed(2)}${args.invoice_number ? ` for invoice ${args.invoice_number}` : ""}`,
      data: { payment_id: payment.id },
    };
  }
);

export const listPaymentsTool = defineTool(
  "list_payments",
  "List payments received or sent",
  "payment",
  {
    type: "object",
    properties: {
      type: {
        type: "string",
        enum: ["received", "sent"],
        description: "Filter by payment type",
      },
      from_date: {
        type: "string",
        description: "Filter from this date (YYYY-MM-DD)",
      },
      to_date: {
        type: "string",
        description: "Filter to this date (YYYY-MM-DD)",
      },
    },
  },
  async (args) => {
    const payments = listPayments({
      type: args.type as "received" | "sent" | undefined,
      from_date: args.from_date as string | undefined,
      to_date: args.to_date as string | undefined,
    });

    if (payments.length === 0) {
      return {
        success: true,
        result: "No payments found",
        data: { count: 0, payments: [] },
      };
    }

    const total = payments.reduce((sum, p) => sum + p.amount, 0);
    const summary = payments
      .slice(0, 20)
      .map((p) => `${p.date}: ${p.customer_name || p.vendor_name || "N/A"} - $${p.amount.toFixed(2)} (${p.type})`)
      .join("\n");

    return {
      success: true,
      result: `Payments (${payments.length}, total: $${total.toFixed(2)}):\n${summary}`,
      data: { count: payments.length, total, payments },
    };
  }
);

// ============================================================================
// Expense Tools
// ============================================================================

export const recordExpenseTool = defineTool(
  "record_expense",
  "Record a business expense",
  "expense",
  {
    type: "object",
    properties: {
      description: {
        type: "string",
        description: "What the expense was for",
      },
      amount: {
        type: "number",
        description: "Expense amount",
      },
      category: {
        type: "string",
        description: "Expense category (e.g., office, travel, utilities)",
      },
      date: {
        type: "string",
        description: "Expense date (YYYY-MM-DD). Defaults to today.",
      },
      vendor_name: {
        type: "string",
        description: "Vendor/supplier name",
      },
      reference: {
        type: "string",
        description: "Receipt or reference number",
      },
      notes: {
        type: "string",
        description: "Additional notes",
      },
    },
    required: ["description", "amount"],
  },
  async (args) => {
    const expense = recordExpense({
      description: args.description as string,
      amount: args.amount as number,
      category: (args.category as string) || "Other Expenses",
      date: args.date as string | undefined,
      vendor_name: args.vendor_name as string | undefined,
      reference: args.reference as string | undefined,
      notes: args.notes as string | undefined,
    });

    return {
      success: true,
      result: `Recorded expense: ${args.description} - $${(args.amount as number).toFixed(2)}`,
      data: { expense_id: expense.id },
    };
  }
);

export const listExpensesTool = defineTool(
  "list_expenses",
  "List expenses, optionally filtered by date or category",
  "expense",
  {
    type: "object",
    properties: {
      from_date: {
        type: "string",
        description: "Filter from this date (YYYY-MM-DD)",
      },
      to_date: {
        type: "string",
        description: "Filter to this date (YYYY-MM-DD)",
      },
      category: {
        type: "string",
        description: "Filter by category",
      },
    },
  },
  async (args) => {
    const expenses = listExpenses({
      start_date: args.from_date as string | undefined,
      end_date: args.to_date as string | undefined,
    });

    // Filter by category if specified
    const filtered = args.category
      ? expenses.filter((e) => e.account_name?.toLowerCase().includes((args.category as string).toLowerCase()))
      : expenses;

    if (filtered.length === 0) {
      return {
        success: true,
        result: "No expenses found",
        data: { count: 0, expenses: [] },
      };
    }

    const total = filtered.reduce((sum, e) => sum + e.amount, 0);
    const summary = filtered
      .slice(0, 20)
      .map((e) => `${e.date}: ${e.description} - $${e.amount.toFixed(2)} (${e.account_name || "N/A"})`)
      .join("\n");

    return {
      success: true,
      result: `Expenses (${filtered.length}, total: $${total.toFixed(2)}):\n${summary}`,
      data: { count: filtered.length, total, expenses: filtered },
    };
  }
);

export const getExpenseTool = defineTool(
  "get_expense",
  "Get details of a specific expense by ID",
  "expense",
  {
    type: "object",
    properties: {
      expense_id: {
        type: "number",
        description: "The expense ID",
      },
    },
    required: ["expense_id"],
  },
  async (args) => {
    const expense = getExpense(args.expense_id as number);
    if (!expense) {
      return {
        success: false,
        result: `Expense with ID ${args.expense_id} not found`,
      };
    }

    // Get full details
    const expenses = listExpenses({ limit: 1000 });
    const details = expenses.find(e => e.id === expense.id);

    return {
      success: true,
      result: `Expense #${expense.id}
Date: ${expense.date}
Description: ${expense.description || "N/A"}
Amount: $${expense.amount.toFixed(2)}
Category: ${details?.account_name || "N/A"}
Vendor: ${details?.vendor_name || "N/A"}
Reference: ${expense.reference || "N/A"}
Notes: ${expense.notes || "N/A"}`,
      data: { ...expense, ...details },
    };
  }
);

export const updateExpenseTool = defineTool(
  "update_expense",
  "Update an existing expense",
  "expense",
  {
    type: "object",
    properties: {
      expense_id: {
        type: "number",
        description: "The expense ID to update",
      },
      date: {
        type: "string",
        description: "New date (YYYY-MM-DD)",
      },
      amount: {
        type: "number",
        description: "New amount",
      },
      description: {
        type: "string",
        description: "New description",
      },
      reference: {
        type: "string",
        description: "New reference number",
      },
      notes: {
        type: "string",
        description: "New notes",
      },
    },
    required: ["expense_id"],
  },
  async (args) => {
    const expenseId = args.expense_id as number;
    const existing = getExpense(expenseId);
    if (!existing) {
      return {
        success: false,
        result: `Expense with ID ${expenseId} not found`,
      };
    }

    const updates: Record<string, unknown> = {};
    if (args.date) updates.date = args.date;
    if (args.amount !== undefined) updates.amount = args.amount;
    if (args.description) updates.description = args.description;
    if (args.reference) updates.reference = args.reference;
    if (args.notes) updates.notes = args.notes;

    const updated = updateExpense(expenseId, updates);
    if (!updated) {
      return {
        success: false,
        result: "Failed to update expense",
      };
    }

    return {
      success: true,
      result: `Updated expense #${expenseId}: ${updated.description} - $${updated.amount.toFixed(2)}`,
      data: updated,
    };
  }
);

export const deleteExpenseTool = defineTool(
  "delete_expense",
  "Delete an expense record",
  "expense",
  {
    type: "object",
    properties: {
      expense_id: {
        type: "number",
        description: "The expense ID to delete",
      },
      confirm: {
        type: "boolean",
        description: "Must be true to confirm deletion",
      },
    },
    required: ["expense_id", "confirm"],
  },
  async (args) => {
    if (!args.confirm) {
      return {
        success: false,
        result: "Deletion not confirmed. Set confirm=true to delete.",
      };
    }

    const expenseId = args.expense_id as number;
    const existing = getExpense(expenseId);
    if (!existing) {
      return {
        success: false,
        result: `Expense with ID ${expenseId} not found`,
      };
    }

    const deleted = deleteExpense(expenseId);
    if (!deleted) {
      return {
        success: false,
        result: "Failed to delete expense",
      };
    }

    return {
      success: true,
      result: `Deleted expense #${expenseId}: ${existing.description} - $${existing.amount.toFixed(2)}`,
      data: { deleted_id: expenseId },
    };
  }
);

export const categorizeExpenseTool = defineTool(
  "categorize_expense",
  "Suggest or apply a category to an expense based on categorization rules",
  "expense",
  {
    type: "object",
    properties: {
      expense_id: {
        type: "number",
        description: "The expense ID to categorize",
      },
      apply: {
        type: "boolean",
        description: "If true, apply the suggested category. If false, just suggest.",
      },
    },
    required: ["expense_id"],
  },
  async (args) => {
    const expenseId = args.expense_id as number;
    const expenses = listExpenses({ limit: 1000 });
    const expense = expenses.find(e => e.id === expenseId);

    if (!expense) {
      return {
        success: false,
        result: `Expense with ID ${expenseId} not found`,
      };
    }

    const match = matchExpense(expense.description || "", expense.vendor_name);

    if (!match) {
      return {
        success: true,
        result: `No categorization rule matches expense "${expense.description}"`,
        data: { expense_id: expenseId, suggestion: null },
      };
    }

    if (args.apply) {
      updateExpense(expenseId, { account_id: match.rule.account_id });
      return {
        success: true,
        result: `Applied category "${match.rule.account_name}" to expense "${expense.description}" (confidence: ${(match.confidence * 100).toFixed(0)}%)`,
        data: { expense_id: expenseId, applied_category: match.rule.account_name, confidence: match.confidence },
      };
    }

    return {
      success: true,
      result: `Suggested category for "${expense.description}": ${match.rule.account_name} (confidence: ${(match.confidence * 100).toFixed(0)}%, matched on: ${match.matched_on})`,
      data: { expense_id: expenseId, suggested_category: match.rule.account_name, confidence: match.confidence, matched_on: match.matched_on },
    };
  }
);

export const linkExpenseDocumentTool = defineTool(
  "link_expense_document",
  "Link a document (receipt) to an expense",
  "expense",
  {
    type: "object",
    properties: {
      expense_id: {
        type: "number",
        description: "The expense ID to link the document to",
      },
      document_id: {
        type: "number",
        description: "The document ID to link. If not provided, lists unlinked documents.",
      },
    },
    required: ["expense_id"],
  },
  async (args) => {
    const expenseId = args.expense_id as number;
    const expense = getExpense(expenseId);

    if (!expense) {
      return {
        success: false,
        result: `Expense with ID ${expenseId} not found`,
      };
    }

    // If no document ID, list unlinked documents
    if (!args.document_id) {
      const unlinked = getUnlinkedDocuments();
      if (unlinked.length === 0) {
        return {
          success: true,
          result: "No unlinked documents available",
          data: { unlinked_documents: [] },
        };
      }

      const list = unlinked.slice(0, 10).map(d => `#${d.id}: ${d.original_name} (${d.created_at})`).join("\n");
      return {
        success: true,
        result: `Unlinked documents available:\n${list}`,
        data: { unlinked_documents: unlinked.slice(0, 10) },
      };
    }

    // Link the document
    try {
      linkDocumentToExpense(args.document_id as number, expenseId);
      return {
        success: true,
        result: `Linked document #${args.document_id} to expense #${expenseId}`,
        data: { document_id: args.document_id, expense_id: expenseId },
      };
    } catch (error) {
      return {
        success: false,
        result: `Failed to link document: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }
);

export const listExpenseCategoriesTools = defineTool(
  "list_expense_categories",
  "List all available expense categories/accounts",
  "expense",
  {
    type: "object",
    properties: {},
  },
  async () => {
    const categories = getExpenseCategories();

    if (categories.length === 0) {
      return {
        success: true,
        result: "No expense categories found",
        data: { categories: [] },
      };
    }

    const list = categories.map(c => `${c.id}: ${c.name}`).join("\n");
    return {
      success: true,
      result: `Expense categories:\n${list}`,
      data: { categories },
    };
  }
);

/**
 * All core tools
 */
export const coreTools: AgentTool[] = [
  // Customers
  createCustomerTool,
  getCustomerTool,
  listCustomersTool,
  // Vendors
  createVendorTool,
  listVendorsTool,
  // Invoices
  createInvoiceTool,
  getInvoiceTool,
  listInvoicesTool,
  sendInvoiceTool,
  markInvoicePaidTool,
  // Payments
  recordPaymentTool,
  listPaymentsTool,
  // Expenses
  recordExpenseTool,
  listExpensesTool,
  getExpenseTool,
  updateExpenseTool,
  deleteExpenseTool,
  categorizeExpenseTool,
  linkExpenseDocumentTool,
  listExpenseCategoriesTools,
];
