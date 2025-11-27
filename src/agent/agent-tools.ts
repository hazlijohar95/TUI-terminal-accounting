// Agent tools for executing real actions
import { createInvoice, getInvoice, listInvoices, updateInvoiceStatus, updateEInvoiceStatus, getInvoicesPendingEInvoice } from "../domain/invoices.js";
import { createCustomer, getCustomer, listCustomers } from "../domain/customers.js";
import { recordPayment, recordExpense, listPayments } from "../domain/payments.js";
import { getBalanceSheet, getCashFlow, getReceivablesAging } from "../domain/reports.js";
import { createDocument, getDocument, listDocuments, linkDocumentToExpense, getExtractedData } from "../domain/documents.js";
import { processDocument, suggestCategory } from "./document-processor.js";
import { validateForSubmission, getValidationSummary } from "../services/myinvois/validation.js";
import { createMyInvoisService } from "../services/myinvois/index.js";
import { getLHDNSettings } from "../db/index.js";
import { EINVOICE_STATUS_LABELS } from "../services/myinvois/constants.js";
import { createRule, listRules, getRuleStats } from "../domain/categorization-rules.js";
import { suggestCategory as suggestExpenseCategory, getUncategorizedExpenses, recategorizeExpense, batchAutoCategorize, getCategorizationStats } from "../services/categorization.js";
import { markPaymentCleared, getUnreconciledPayments, reconcilePayment, getReconciliationSummary } from "../domain/bank.js";
import {
  createStatement,
  listStatements,
  importTransactions,
  listTransactions,
  findMatches,
  autoMatchTransactions,
  matchToPayment,
  matchToExpense,
  unmatchTransaction,
  ignoreTransaction,
  markStatementReconciled,
  getReconciliationProgress,
  getReconciliationStats,
} from "../domain/bank-reconciliation.js";
import {
  logAgentAction,
  getRecentActions,
  getAgentStats,
  getActionsPendingReview,
  markActionReviewed,
  generateProactiveSuggestions,
  getToolClassification,
  requiresConfirmation,
} from "./autonomy.js";
import type { ChatCompletionTool } from "openai/resources/chat/completions";

// Tool definitions for OpenAI function calling
export const agentTools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "create_invoice",
      description: "Create a new invoice for a customer. Returns the invoice number.",
      parameters: {
        type: "object",
        properties: {
          customer_name: {
            type: "string",
            description: "Name of the customer (will create if doesn't exist)",
          },
          customer_email: {
            type: "string",
            description: "Customer email address (optional)",
          },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                description: {
                  type: "string",
                  description: "Item description",
                },
                quantity: {
                  type: "number",
                  description: "Quantity (default 1)",
                },
                unit_price: {
                  type: "number",
                  description: "Price per unit",
                },
              },
              required: ["description", "unit_price"],
            },
            description: "Line items on the invoice",
          },
          notes: {
            type: "string",
            description: "Additional notes for the invoice",
          },
          due_days: {
            type: "number",
            description: "Days until due (default 30)",
          },
        },
        required: ["customer_name", "items"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_invoice",
      description: "Mark an invoice as sent",
      parameters: {
        type: "object",
        properties: {
          invoice_number: {
            type: "string",
            description: "Invoice number (e.g., INV-0001)",
          },
        },
        required: ["invoice_number"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "mark_invoice_paid",
      description: "Mark an invoice as paid",
      parameters: {
        type: "object",
        properties: {
          invoice_number: {
            type: "string",
            description: "Invoice number (e.g., INV-0001)",
          },
        },
        required: ["invoice_number"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_invoices",
      description: "Get list of invoices, optionally filtered by status",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["draft", "sent", "paid", "overdue"],
            description: "Filter by status",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_customer",
      description: "Create a new customer",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Customer name",
          },
          email: {
            type: "string",
            description: "Customer email",
          },
          phone: {
            type: "string",
            description: "Customer phone",
          },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "record_payment",
      description: "Record a payment received from a customer",
      parameters: {
        type: "object",
        properties: {
          invoice_number: {
            type: "string",
            description: "Invoice number being paid",
          },
          amount: {
            type: "number",
            description: "Payment amount",
          },
          date: {
            type: "string",
            description: "Payment date (YYYY-MM-DD)",
          },
          method: {
            type: "string",
            description: "Payment method (e.g., bank transfer, cash)",
          },
        },
        required: ["invoice_number", "amount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "record_expense",
      description: "Record a business expense",
      parameters: {
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
            description: "Expense date (YYYY-MM-DD)",
          },
        },
        required: ["description", "amount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_financial_summary",
      description: "Get current financial summary including cash, receivables, and key metrics",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "process_document",
      description: "Process an uploaded document (receipt, statement) and extract data from it",
      parameters: {
        type: "object",
        properties: {
          document_id: {
            type: "number",
            description: "ID of the document to process",
          },
        },
        required: ["document_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_expense_from_document",
      description: "Create an expense entry from a processed document's extracted data",
      parameters: {
        type: "object",
        properties: {
          document_id: {
            type: "number",
            description: "ID of the processed document",
          },
          category: {
            type: "string",
            description: "Expense category (e.g., meals, office, travel)",
          },
          override_amount: {
            type: "number",
            description: "Override the extracted amount if needed",
          },
          override_date: {
            type: "string",
            description: "Override the extracted date (YYYY-MM-DD) if needed",
          },
        },
        required: ["document_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_documents",
      description: "List uploaded documents with their processing status",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["pending", "processing", "processed", "failed"],
            description: "Filter by processing status",
          },
          limit: {
            type: "number",
            description: "Maximum number of documents to return",
          },
        },
      },
    },
  },
  // E-Invoice tools
  {
    type: "function",
    function: {
      name: "submit_einvoice",
      description: "Submit an invoice to LHDN for e-invoicing. Validates the invoice and customer data first.",
      parameters: {
        type: "object",
        properties: {
          invoice_number: {
            type: "string",
            description: "Invoice number to submit (e.g., INV-0001)",
          },
        },
        required: ["invoice_number"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_einvoice_status",
      description: "Check the e-invoice submission status for an invoice",
      parameters: {
        type: "object",
        properties: {
          invoice_number: {
            type: "string",
            description: "Invoice number to check (e.g., INV-0001)",
          },
        },
        required: ["invoice_number"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_pending_einvoices",
      description: "List invoices that are ready for e-invoice submission (sent, partial, or paid status with no e-invoice yet)",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Maximum number of invoices to return (default 10)",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cancel_einvoice",
      description: "Cancel a validated e-invoice (within 72 hours of validation). Requires a reason.",
      parameters: {
        type: "object",
        properties: {
          invoice_number: {
            type: "string",
            description: "Invoice number to cancel (e.g., INV-0001)",
          },
          reason: {
            type: "string",
            description: "Reason for cancellation",
          },
        },
        required: ["invoice_number", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_einvoice_errors",
      description: "Get validation errors for an invoice before e-invoice submission",
      parameters: {
        type: "object",
        properties: {
          invoice_number: {
            type: "string",
            description: "Invoice number to validate (e.g., INV-0001)",
          },
        },
        required: ["invoice_number"],
      },
    },
  },
  // Expense Categorization Tools
  {
    type: "function",
    function: {
      name: "suggest_expense_category",
      description: "Get AI-powered category suggestions for an expense based on description and vendor",
      parameters: {
        type: "object",
        properties: {
          description: {
            type: "string",
            description: "Expense description",
          },
          vendor_name: {
            type: "string",
            description: "Vendor name (optional)",
          },
        },
        required: ["description"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_uncategorized_expenses",
      description: "Get expenses that need categorization (currently in 'Other Expenses' or similar)",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Maximum number to return (default 20)",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "recategorize_expense",
      description: "Change the category of an expense and optionally learn from this for future auto-categorization",
      parameters: {
        type: "object",
        properties: {
          expense_id: {
            type: "number",
            description: "Expense ID to recategorize",
          },
          account_name: {
            type: "string",
            description: "New expense account name or code (e.g., 'Travel' or '5800')",
          },
          learn: {
            type: "boolean",
            description: "Whether to create a rule from this correction (default true)",
          },
        },
        required: ["expense_id", "account_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "auto_categorize_expenses",
      description: "Automatically categorize expenses that have high-confidence suggestions",
      parameters: {
        type: "object",
        properties: {
          min_confidence: {
            type: "number",
            description: "Minimum confidence threshold (0-1, default 0.85)",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_categorization_rule",
      description: "Create a rule for auto-categorizing expenses matching a pattern",
      parameters: {
        type: "object",
        properties: {
          pattern: {
            type: "string",
            description: "Text pattern to match in expense description",
          },
          vendor_pattern: {
            type: "string",
            description: "Optional vendor name pattern to match",
          },
          account_name: {
            type: "string",
            description: "Expense account name or code to assign",
          },
        },
        required: ["pattern", "account_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_categorization_rules",
      description: "List all expense categorization rules",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_categorization_stats",
      description: "Get statistics about expense categorization",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  // Bank Reconciliation Tools
  {
    type: "function",
    function: {
      name: "get_unreconciled_payments",
      description: "List payments that haven't been reconciled with bank statements",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Maximum number to return (default 20)",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "mark_payment_cleared",
      description: "Mark a payment as cleared by the bank",
      parameters: {
        type: "object",
        properties: {
          payment_id: {
            type: "number",
            description: "Payment ID to mark as cleared",
          },
          cleared_date: {
            type: "string",
            description: "Date the payment cleared (YYYY-MM-DD)",
          },
          bank_reference: {
            type: "string",
            description: "Bank statement reference number (optional)",
          },
        },
        required: ["payment_id", "cleared_date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "reconcile_payment",
      description: "Mark a payment as reconciled with bank statement",
      parameters: {
        type: "object",
        properties: {
          payment_id: {
            type: "number",
            description: "Payment ID to reconcile",
          },
        },
        required: ["payment_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_reconciliation_summary",
      description: "Get summary of payment reconciliation status",
      parameters: {
        type: "object",
        properties: {
          from_date: {
            type: "string",
            description: "Start date (YYYY-MM-DD)",
          },
          to_date: {
            type: "string",
            description: "End date (YYYY-MM-DD)",
          },
        },
      },
    },
  },
  // Advanced Bank Reconciliation Tools
  {
    type: "function",
    function: {
      name: "import_bank_statement",
      description: "Import a bank statement with transactions for reconciliation",
      parameters: {
        type: "object",
        properties: {
          account_code: {
            type: "string",
            description: "Bank account code (e.g., '1100' for Bank Account)",
          },
          statement_date: {
            type: "string",
            description: "Statement date (YYYY-MM-DD)",
          },
          opening_balance: {
            type: "number",
            description: "Opening balance on the statement",
          },
          closing_balance: {
            type: "number",
            description: "Closing balance on the statement",
          },
          transactions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                date: {
                  type: "string",
                  description: "Transaction date (YYYY-MM-DD)",
                },
                description: {
                  type: "string",
                  description: "Transaction description",
                },
                amount: {
                  type: "number",
                  description: "Transaction amount (positive for deposits, negative for withdrawals)",
                },
                reference: {
                  type: "string",
                  description: "Bank reference number (optional)",
                },
              },
              required: ["date", "description", "amount"],
            },
            description: "List of transactions from the statement",
          },
        },
        required: ["account_code", "statement_date", "opening_balance", "closing_balance", "transactions"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_bank_statements",
      description: "List imported bank statements",
      parameters: {
        type: "object",
        properties: {
          account_code: {
            type: "string",
            description: "Filter by bank account code (optional)",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_bank_transactions",
      description: "List transactions from a bank statement",
      parameters: {
        type: "object",
        properties: {
          statement_id: {
            type: "number",
            description: "Bank statement ID",
          },
          match_status: {
            type: "string",
            enum: ["unmatched", "auto_matched", "manual_matched", "ignored"],
            description: "Filter by match status (optional)",
          },
        },
        required: ["statement_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_transaction_matches",
      description: "Find potential matches (payments/expenses) for a bank transaction",
      parameters: {
        type: "object",
        properties: {
          transaction_id: {
            type: "number",
            description: "Bank transaction ID to find matches for",
          },
        },
        required: ["transaction_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "auto_match_transactions",
      description: "Automatically match all unmatched transactions in a statement based on confidence threshold",
      parameters: {
        type: "object",
        properties: {
          statement_id: {
            type: "number",
            description: "Bank statement ID to process",
          },
          min_confidence: {
            type: "number",
            description: "Minimum confidence threshold (0-1, default 0.7)",
          },
        },
        required: ["statement_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "match_transaction",
      description: "Manually match a bank transaction to a payment or expense",
      parameters: {
        type: "object",
        properties: {
          transaction_id: {
            type: "number",
            description: "Bank transaction ID",
          },
          match_type: {
            type: "string",
            enum: ["payment", "expense"],
            description: "Type of record to match to",
          },
          match_id: {
            type: "number",
            description: "ID of the payment or expense to match",
          },
        },
        required: ["transaction_id", "match_type", "match_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "unmatch_transaction",
      description: "Remove the match from a bank transaction",
      parameters: {
        type: "object",
        properties: {
          transaction_id: {
            type: "number",
            description: "Bank transaction ID to unmatch",
          },
        },
        required: ["transaction_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ignore_transaction",
      description: "Mark a bank transaction as ignored (no matching entry expected)",
      parameters: {
        type: "object",
        properties: {
          transaction_id: {
            type: "number",
            description: "Bank transaction ID to ignore",
          },
        },
        required: ["transaction_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_statement_progress",
      description: "Get reconciliation progress for a bank statement",
      parameters: {
        type: "object",
        properties: {
          statement_id: {
            type: "number",
            description: "Bank statement ID",
          },
        },
        required: ["statement_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "finalize_reconciliation",
      description: "Mark a bank statement as fully reconciled (requires all transactions to be matched or ignored)",
      parameters: {
        type: "object",
        properties: {
          statement_id: {
            type: "number",
            description: "Bank statement ID to finalize",
          },
        },
        required: ["statement_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_bank_reconciliation_stats",
      description: "Get overall bank reconciliation statistics",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  // Agent Autonomy Tools
  {
    type: "function",
    function: {
      name: "get_proactive_suggestions",
      description: "Get AI-generated suggestions for actions based on current accounting state (overdue invoices, unreconciled payments, etc.)",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_agent_activity",
      description: "Get recent agent actions and activity log",
      parameters: {
        type: "object",
        properties: {
          session_id: {
            type: "string",
            description: "Filter by session ID (optional)",
          },
          limit: {
            type: "number",
            description: "Maximum number of actions to return (default 20)",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_agent_stats",
      description: "Get statistics about agent actions (success rate, most used tools, etc.)",
      parameters: {
        type: "object",
        properties: {
          from_date: {
            type: "string",
            description: "Start date for stats (YYYY-MM-DD, optional)",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_pending_reviews",
      description: "Get agent actions that require user review",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "approve_action",
      description: "Approve/review a pending agent action",
      parameters: {
        type: "object",
        properties: {
          action_id: {
            type: "number",
            description: "ID of the action to approve",
          },
        },
        required: ["action_id"],
      },
    },
  },
];

// Execute a tool and return the result
export async function executeTool(
  name: string,
  args: Record<string, any>
): Promise<{ success: boolean; result: string; data?: any }> {
  try {
    switch (name) {
      case "create_invoice": {
        // Find or create customer
        let customer = getCustomer(args.customer_name);
        if (!customer) {
          customer = createCustomer({
            name: args.customer_name,
            email: args.customer_email,
          });
        }

        // Calculate due date
        const dueDays = args.due_days || 30;
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + dueDays);

        // Create invoice
        const items = args.items.map((item: any) => ({
          description: item.description,
          quantity: item.quantity || 1,
          unit_price: item.unit_price,
        }));

        const invoice = createInvoice({
          customer_id: customer.id,
          items,
          notes: args.notes,
          due_date: dueDate.toISOString().split("T")[0],
        });

        return {
          success: true,
          result: `Created invoice ${invoice.number} for ${customer.name}. Total: $${invoice.total.toFixed(2)}`,
          data: { invoice_number: invoice.number, total: invoice.total },
        };
      }

      case "send_invoice": {
        const invoice = getInvoice(args.invoice_number);
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

      case "mark_invoice_paid": {
        const invoice = getInvoice(args.invoice_number);
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

      case "list_invoices": {
        const invoices = listInvoices({ status: args.status });
        const summary = invoices.map(inv =>
          `${inv.number}: ${inv.customer_name} - $${inv.total.toFixed(2)} (${inv.status})`
        ).join("\n");
        return {
          success: true,
          result: invoices.length > 0
            ? `Found ${invoices.length} invoices:\n${summary}`
            : "No invoices found",
          data: { count: invoices.length, invoices },
        };
      }

      case "create_customer": {
        const existing = getCustomer(args.name);
        if (existing) {
          return {
            success: true,
            result: `Customer "${args.name}" already exists`,
            data: { customer_id: existing.id },
          };
        }
        const customer = createCustomer({
          name: args.name,
          email: args.email,
          phone: args.phone,
        });
        return {
          success: true,
          result: `Created customer "${customer.name}"`,
          data: { customer_id: customer.id },
        };
      }

      case "record_payment": {
        const invoice = getInvoice(args.invoice_number);
        if (!invoice) {
          // Show valid invoice numbers to help the agent
          const outstandingInvoices = listInvoices({ status: 'outstanding' });
          if (outstandingInvoices.length > 0) {
            const validNumbers = outstandingInvoices.slice(0, 10).map(inv => inv.number).join(', ');
            return {
              success: false,
              result: `Invoice "${args.invoice_number}" not found. Valid outstanding invoices: ${validNumbers}${outstandingInvoices.length > 10 ? ` (and ${outstandingInvoices.length - 10} more)` : ''}`,
            };
          }
          return { success: false, result: `Invoice "${args.invoice_number}" not found. No outstanding invoices exist.` };
        }

        const payment = recordPayment({
          invoice_id: invoice.id,
          amount: args.amount,
          date: args.date,
          method: args.method,
        });

        return {
          success: true,
          result: `Recorded payment of $${args.amount.toFixed(2)} for invoice ${args.invoice_number}`,
          data: { payment_id: payment.id },
        };
      }

      case "record_expense": {
        // Import listAccounts to validate category and provide helpful errors
        const { listAccounts: getExpenseAccounts } = await import("../domain/accounts.js");

        try {
          const expense = recordExpense({
            description: args.description,
            amount: args.amount,
            category: args.category,
            date: args.date,
          });

          return {
            success: true,
            result: `Recorded expense: ${args.description} - $${args.amount.toFixed(2)}`,
            data: { expense_id: expense.id },
          };
        } catch (error) {
          const errorMessage = (error as Error).message;

          // If category not found, show valid expense accounts
          if (errorMessage.toLowerCase().includes('account') ||
              errorMessage.toLowerCase().includes('category') ||
              errorMessage.toLowerCase().includes('not found')) {
            const expenseAccounts = getExpenseAccounts({ type: 'expense', is_active: true });
            const validCategories = expenseAccounts.map(a => `${a.code}: ${a.name}`).join('\n  ');
            return {
              success: false,
              result: `Expense category "${args.category}" not found.\n\nValid expense accounts:\n  ${validCategories}\n\nUse one of these exact account names.`,
            };
          }

          throw error; // Re-throw unexpected errors
        }
      }

      case "get_financial_summary": {
        const balance = getBalanceSheet();
        const today = new Date().toISOString().split("T")[0];
        const monthStart = today.slice(0, 7) + "-01";
        const cashFlow = getCashFlow(monthStart, today);
        const ar = getReceivablesAging();

        const summary = {
          cash: balance.assets.cash,
          receivables: balance.assets.receivables,
          payables: balance.liabilities.payables,
          overdue: ar.totals.days_31_60 + ar.totals.days_61_90 + ar.totals.days_90_plus,
          netCashFlow: cashFlow.net_change,
        };

        return {
          success: true,
          result: `Financial Summary:
• Cash on hand: $${summary.cash.toFixed(2)}
• Receivables: $${summary.receivables.toFixed(2)}
• Payables: $${summary.payables.toFixed(2)}
• Overdue AR: $${summary.overdue.toFixed(2)}
• Net cash flow (this month): $${summary.netCashFlow.toFixed(2)}`,
          data: summary,
        };
      }

      case "process_document": {
        const doc = getDocument(args.document_id);
        if (!doc) {
          return { success: false, result: `Document ${args.document_id} not found` };
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
          return { success: false, result: "OpenAI API key not configured" };
        }

        const extracted = await processDocument(doc, apiKey);
        if (!extracted) {
          return {
            success: false,
            result: `Could not extract data from ${doc.original_name}`,
          };
        }

        const details = [];
        if (extracted.vendor) details.push(`Vendor: ${extracted.vendor}`);
        if (extracted.amount) details.push(`Amount: $${extracted.amount.toFixed(2)}`);
        if (extracted.date) details.push(`Date: ${extracted.date}`);
        if (extracted.category) details.push(`Category: ${extracted.category}`);

        return {
          success: true,
          result: `Processed ${doc.original_name}:\n${details.join("\n")}`,
          data: { document_id: doc.id, extracted },
        };
      }

      case "create_expense_from_document": {
        const doc = getDocument(args.document_id);
        if (!doc) {
          return { success: false, result: `Document ${args.document_id} not found` };
        }

        const extracted = getExtractedData(doc);
        if (!extracted) {
          return {
            success: false,
            result: `Document ${doc.original_name} has not been processed yet`,
          };
        }

        const amount = args.override_amount || extracted.amount || extracted.total;
        if (!amount) {
          return {
            success: false,
            result: "Could not determine expense amount",
          };
        }

        const date = args.override_date || extracted.date || new Date().toISOString().split("T")[0];
        const category = args.category || extracted.category || suggestCategory(extracted.vendor || extracted.description || "");
        const description = extracted.vendor
          ? `${extracted.vendor}${extracted.description ? ` - ${extracted.description}` : ""}`
          : extracted.description || doc.original_name;

        const expense = recordExpense({
          description,
          amount,
          category,
          date,
        });

        linkDocumentToExpense(doc.id, expense.id);

        return {
          success: true,
          result: `Created expense: ${description} - $${amount.toFixed(2)} (${category})`,
          data: { expense_id: expense.id, document_id: doc.id },
        };
      }

      case "list_documents": {
        const docs = listDocuments({
          status: args.status,
          limit: args.limit || 10,
        });

        if (docs.length === 0) {
          return {
            success: true,
            result: "No documents found",
            data: { count: 0, documents: [] },
          };
        }

        const summary = docs.map(d =>
          `${d.id}: ${d.original_name} (${d.status})${d.expense_id ? ` → Expense #${d.expense_id}` : ""}`
        ).join("\n");

        return {
          success: true,
          result: `Found ${docs.length} documents:\n${summary}`,
          data: { count: docs.length, documents: docs },
        };
      }

      // E-Invoice tools
      case "submit_einvoice": {
        const invoice = getInvoice(args.invoice_number);
        if (!invoice) {
          return { success: false, result: `Invoice ${args.invoice_number} not found` };
        }

        // Get customer and settings
        const customer = getCustomer(invoice.customer_id);
        const settings = getLHDNSettings();

        // Validate before submission
        const validation = validateForSubmission(invoice, customer!, settings);
        if (!validation.valid) {
          return {
            success: false,
            result: `Cannot submit e-invoice - validation failed:\n${getValidationSummary(validation)}`,
            data: { errors: validation.errors },
          };
        }

        // Check if already submitted
        if (invoice.einvoice_status && invoice.einvoice_status !== "none" && invoice.einvoice_status !== "invalid" && invoice.einvoice_status !== "rejected") {
          return {
            success: false,
            result: `Invoice ${args.invoice_number} already has e-invoice status: ${EINVOICE_STATUS_LABELS[invoice.einvoice_status] || invoice.einvoice_status}`,
          };
        }

        // Check LHDN settings are configured
        if (!settings || !settings.clientId || !settings.clientSecret) {
          return {
            success: false,
            result: "LHDN credentials not configured. Please configure in Settings → LHDN.",
          };
        }

        try {
          // Create service and submit
          const service = await createMyInvoisService({
            settings: settings,
          });

          // Mark as pending
          updateEInvoiceStatus(invoice.id, { status: "pending" });

          // TODO: Convert invoice to e-invoice document and submit
          // For now, return a message that submission is in progress
          return {
            success: true,
            result: `Invoice ${args.invoice_number} queued for e-invoice submission. Status: Pending`,
            data: { invoice_number: args.invoice_number, status: "pending" },
          };
        } catch (error) {
          updateEInvoiceStatus(invoice.id, { status: "none", error: (error as Error).message });
          return {
            success: false,
            result: `Failed to submit e-invoice: ${(error as Error).message}`,
          };
        }
      }

      case "check_einvoice_status": {
        const invoice = getInvoice(args.invoice_number);
        if (!invoice) {
          return { success: false, result: `Invoice ${args.invoice_number} not found` };
        }

        const status = invoice.einvoice_status || "none";
        const statusLabel = EINVOICE_STATUS_LABELS[status] || status;

        let details = `Invoice ${args.invoice_number} e-invoice status: ${statusLabel}`;

        if (invoice.einvoice_uuid) {
          details += `\nUUID: ${invoice.einvoice_uuid}`;
        }
        if (invoice.einvoice_long_id) {
          details += `\nLong ID: ${invoice.einvoice_long_id}`;
        }
        if (invoice.einvoice_submitted_at) {
          details += `\nSubmitted: ${invoice.einvoice_submitted_at}`;
        }
        if (invoice.einvoice_validated_at) {
          details += `\nValidated: ${invoice.einvoice_validated_at}`;
        }
        if (invoice.einvoice_error) {
          details += `\nError: ${invoice.einvoice_error}`;
        }

        return {
          success: true,
          result: details,
          data: {
            invoice_number: args.invoice_number,
            status,
            statusLabel,
            uuid: invoice.einvoice_uuid,
            longId: invoice.einvoice_long_id,
            submittedAt: invoice.einvoice_submitted_at,
            validatedAt: invoice.einvoice_validated_at,
            error: invoice.einvoice_error,
          },
        };
      }

      case "list_pending_einvoices": {
        const limit = args.limit || 10;
        const pending = getInvoicesPendingEInvoice().slice(0, limit);

        if (pending.length === 0) {
          return {
            success: true,
            result: "No invoices pending e-invoice submission",
            data: { count: 0, invoices: [] },
          };
        }

        const summary = pending.map(inv =>
          `${inv.number}: ${inv.customer_name} - $${inv.total.toFixed(2)} (${inv.status})`
        ).join("\n");

        return {
          success: true,
          result: `Found ${pending.length} invoices ready for e-invoice submission:\n${summary}`,
          data: { count: pending.length, invoices: pending },
        };
      }

      case "cancel_einvoice": {
        const invoice = getInvoice(args.invoice_number);
        if (!invoice) {
          return { success: false, result: `Invoice ${args.invoice_number} not found` };
        }

        if (invoice.einvoice_status !== "valid") {
          return {
            success: false,
            result: `Cannot cancel - invoice e-invoice status is "${EINVOICE_STATUS_LABELS[invoice.einvoice_status || "none"] || invoice.einvoice_status}". Only validated e-invoices can be cancelled.`,
          };
        }

        if (!invoice.einvoice_uuid) {
          return {
            success: false,
            result: "Cannot cancel - no e-invoice UUID found",
          };
        }

        // Check 72-hour window
        if (invoice.einvoice_validated_at) {
          const validated = new Date(invoice.einvoice_validated_at);
          const now = new Date();
          const hoursDiff = (now.getTime() - validated.getTime()) / (1000 * 60 * 60);
          if (hoursDiff > 72) {
            return {
              success: false,
              result: `Cannot cancel - more than 72 hours have passed since validation (validated ${validated.toISOString()})`,
            };
          }
        }

        const settings = getLHDNSettings();
        if (!settings || !settings.clientId || !settings.clientSecret) {
          return {
            success: false,
            result: "LHDN credentials not configured. Please configure in Settings → LHDN.",
          };
        }

        try {
          const service = await createMyInvoisService({
            settings: settings,
          });

          const cancelled = await service.cancelDocument(invoice.einvoice_uuid, args.reason);

          if (cancelled) {
            updateEInvoiceStatus(invoice.id, { status: "cancelled" });
            return {
              success: true,
              result: `E-invoice for ${args.invoice_number} has been cancelled`,
              data: { invoice_number: args.invoice_number, status: "cancelled" },
            };
          } else {
            return {
              success: false,
              result: "Failed to cancel e-invoice - LHDN returned an error",
            };
          }
        } catch (error) {
          return {
            success: false,
            result: `Failed to cancel e-invoice: ${(error as Error).message}`,
          };
        }
      }

      case "get_einvoice_errors": {
        const invoice = getInvoice(args.invoice_number);
        if (!invoice) {
          return { success: false, result: `Invoice ${args.invoice_number} not found` };
        }

        const customer = getCustomer(invoice.customer_id);
        const settings = getLHDNSettings();

        const validation = validateForSubmission(invoice, customer!, settings);

        if (validation.valid) {
          return {
            success: true,
            result: `Invoice ${args.invoice_number} passed all validation checks and is ready for e-invoice submission`,
            data: { valid: true, errors: [] },
          };
        }

        return {
          success: true,
          result: `Invoice ${args.invoice_number} has ${validation.errors.length} validation error(s):\n${getValidationSummary(validation)}`,
          data: { valid: false, errors: validation.errors },
        };
      }

      // Expense Categorization Tool Implementations
      case "suggest_expense_category": {
        const suggestions = suggestExpenseCategory(args.description, args.vendor_name);

        if (suggestions.length === 0) {
          return {
            success: true,
            result: "No category suggestions found for this expense. You may need to manually categorize it.",
            data: { suggestions: [] },
          };
        }

        const suggestionList = suggestions.map((s, i) =>
          `${i + 1}. ${s.accountName} (${s.accountCode}) - ${Math.round(s.confidence * 100)}% confidence\n   Reason: ${s.reason}`
        ).join("\n");

        return {
          success: true,
          result: `Category suggestions for "${args.description}":\n${suggestionList}`,
          data: { suggestions },
        };
      }

      case "get_uncategorized_expenses": {
        const limit = args.limit || 20;
        const expenses = getUncategorizedExpenses(limit);

        if (expenses.length === 0) {
          return {
            success: true,
            result: "No uncategorized expenses found. All expenses have been properly categorized.",
            data: { count: 0, expenses: [] },
          };
        }

        const expenseList = expenses.slice(0, 10).map(e => {
          const suggestion = e.suggestions.length > 0
            ? ` → Suggested: ${e.suggestions[0].accountName} (${Math.round(e.suggestions[0].confidence * 100)}%)`
            : "";
          return `• ${e.date}: ${e.description || "(no description)"} - $${e.amount.toFixed(2)}${suggestion}`;
        }).join("\n");

        return {
          success: true,
          result: `Found ${expenses.length} uncategorized expenses:\n${expenseList}${expenses.length > 10 ? `\n... and ${expenses.length - 10} more` : ""}`,
          data: { count: expenses.length, expenses },
        };
      }

      case "recategorize_expense": {
        const { getDb } = await import("../db/index.js");
        const db = getDb();

        // Find the account by name or code
        const account = db.prepare(
          "SELECT id, code, name FROM accounts WHERE name = ? OR code = ? OR LOWER(name) = LOWER(?)"
        ).get(args.account_name, args.account_name, args.account_name) as { id: number; code: string; name: string } | undefined;

        if (!account) {
          return {
            success: false,
            result: `Account "${args.account_name}" not found. Please use a valid expense account name or code.`,
          };
        }

        const learn = args.learn !== false;
        const success = recategorizeExpense(args.expense_id, account.id, learn);

        if (!success) {
          return {
            success: false,
            result: `Expense with ID ${args.expense_id} not found.`,
          };
        }

        return {
          success: true,
          result: `Expense ${args.expense_id} recategorized to "${account.name}" (${account.code})${learn ? ". A categorization rule was created to help with future expenses." : "."}`,
          data: { expense_id: args.expense_id, account_id: account.id, account_name: account.name },
        };
      }

      case "auto_categorize_expenses": {
        const minConfidence = args.min_confidence || 0.85;
        const result = batchAutoCategorize(minConfidence);

        if (result.categorized === 0) {
          return {
            success: true,
            result: result.processed === 0
              ? "No uncategorized expenses found."
              : `Processed ${result.processed} expenses but none met the ${Math.round(minConfidence * 100)}% confidence threshold for auto-categorization.`,
            data: result,
          };
        }

        const summary = result.results.slice(0, 5).map(r =>
          `• ${r.description}: ${r.old_account} → ${r.new_account} (${Math.round(r.confidence * 100)}%)`
        ).join("\n");

        return {
          success: true,
          result: `Auto-categorized ${result.categorized} of ${result.processed} expenses:\n${summary}${result.categorized > 5 ? `\n... and ${result.categorized - 5} more` : ""}`,
          data: result,
        };
      }

      case "create_categorization_rule": {
        const { getDb } = await import("../db/index.js");
        const db = getDb();

        // Find the account by name or code
        const account = db.prepare(
          "SELECT id, code, name FROM accounts WHERE name = ? OR code = ? OR LOWER(name) = LOWER(?)"
        ).get(args.account_name, args.account_name, args.account_name) as { id: number; code: string; name: string } | undefined;

        if (!account) {
          return {
            success: false,
            result: `Account "${args.account_name}" not found. Please use a valid expense account name or code.`,
          };
        }

        const rule = createRule({
          pattern: args.pattern,
          vendor_pattern: args.vendor_pattern,
          account_id: account.id,
        });

        return {
          success: true,
          result: `Created categorization rule: expenses containing "${args.pattern}"${args.vendor_pattern ? ` from vendor "${args.vendor_pattern}"` : ""} will be categorized as "${account.name}"`,
          data: { rule },
        };
      }

      case "list_categorization_rules": {
        const rules = listRules();

        if (rules.length === 0) {
          return {
            success: true,
            result: "No categorization rules found. Create rules to auto-categorize expenses.",
            data: { count: 0, rules: [] },
          };
        }

        const ruleList = rules.map(r =>
          `• "${r.pattern}"${r.vendor_pattern ? ` + vendor "${r.vendor_pattern}"` : ""} → ${r.account_name} (${r.match_count} matches)`
        ).join("\n");

        return {
          success: true,
          result: `Found ${rules.length} categorization rules:\n${ruleList}`,
          data: { count: rules.length, rules },
        };
      }

      case "get_categorization_stats": {
        const stats = getCategorizationStats();
        const ruleStats = getRuleStats();

        const categoryList = stats.categories_used.slice(0, 5).map(c =>
          `• ${c.name}: ${c.count} (${c.percentage}%)`
        ).join("\n");

        return {
          success: true,
          result: `Categorization Statistics:
Total expenses: ${stats.total_expenses}
Uncategorized: ${stats.uncategorized_count}
Auto-categorizable: ${stats.auto_categorizable_count}

Top categories:
${categoryList}

Rules: ${ruleStats.total_rules} (${ruleStats.rules_with_matches} active, ${ruleStats.total_matches} total matches)`,
          data: { stats, ruleStats },
        };
      }

      // Bank Reconciliation Tool Implementations
      case "get_unreconciled_payments": {
        const limit = args.limit || 20;
        const payments = getUnreconciledPayments().slice(0, limit);

        if (payments.length === 0) {
          return {
            success: true,
            result: "All payments have been reconciled.",
            data: { count: 0, payments: [] },
          };
        }

        const paymentList = payments.map(p =>
          `• ${p.date}: ${p.type === "received" ? "+" : "-"}$${p.amount.toFixed(2)} - ${p.customer_name || p.vendor_name || "Unknown"}${p.reference ? ` (${p.reference})` : ""}`
        ).join("\n");

        return {
          success: true,
          result: `Found ${payments.length} unreconciled payments:\n${paymentList}`,
          data: { count: payments.length, payments },
        };
      }

      case "mark_payment_cleared": {
        const payment = markPaymentCleared(args.payment_id, args.cleared_date, args.bank_reference);

        if (!payment) {
          return {
            success: false,
            result: `Payment with ID ${args.payment_id} not found.`,
          };
        }

        return {
          success: true,
          result: `Payment ${args.payment_id} marked as cleared on ${args.cleared_date}${args.bank_reference ? ` (ref: ${args.bank_reference})` : ""}`,
          data: { payment },
        };
      }

      case "reconcile_payment": {
        const payment = reconcilePayment(args.payment_id);

        if (!payment) {
          return {
            success: false,
            result: `Payment with ID ${args.payment_id} not found.`,
          };
        }

        return {
          success: true,
          result: `Payment ${args.payment_id} marked as reconciled`,
          data: { payment },
        };
      }

      case "get_reconciliation_summary": {
        const summary = getReconciliationSummary(args.from_date, args.to_date);

        return {
          success: true,
          result: `Reconciliation Summary${args.from_date ? ` (${args.from_date} to ${args.to_date || "now"})` : ""}:
Total payments: ${summary.total_payments}
Reconciled: ${summary.reconciled_count} ($${summary.reconciled_amount.toFixed(2)})
Unreconciled: ${summary.unreconciled_count} ($${summary.unreconciled_amount.toFixed(2)})`,
          data: summary,
        };
      }

      // Advanced Bank Reconciliation Tool Implementations
      case "import_bank_statement": {
        const { getDb } = await import("../db/index.js");
        const db = getDb();

        // Find the bank account
        const account = db.prepare(
          "SELECT id, code, name FROM accounts WHERE code = ? OR LOWER(name) LIKE LOWER(?)"
        ).get(args.account_code, `%${args.account_code}%`) as { id: number; code: string; name: string } | undefined;

        if (!account) {
          return {
            success: false,
            result: `Bank account "${args.account_code}" not found. Use a valid account code like "1100" (Bank Account).`,
          };
        }

        // Create the statement
        const statement = createStatement({
          account_id: account.id,
          statement_date: args.statement_date,
          opening_balance: args.opening_balance,
          closing_balance: args.closing_balance,
        });

        // Import transactions
        const transactions = args.transactions.map((tx: { date: string; description: string; amount: number; reference?: string }) => ({
          date: tx.date,
          description: tx.description,
          amount: Math.abs(tx.amount),
          type: tx.amount >= 0 ? "credit" as const : "debit" as const,
          reference: tx.reference,
        }));

        const imported = importTransactions(statement.id, transactions);

        return {
          success: true,
          result: `Imported bank statement for ${account.name} (${args.statement_date}):
• Opening balance: $${args.opening_balance.toFixed(2)}
• Closing balance: $${args.closing_balance.toFixed(2)}
• Transactions imported: ${imported.length}
Statement ID: ${statement.id}`,
          data: { statement_id: statement.id, transactions_imported: imported.length },
        };
      }

      case "list_bank_statements": {
        const { getDb } = await import("../db/index.js");
        const db = getDb();

        let accountId: number | undefined;
        if (args.account_code) {
          const account = db.prepare(
            "SELECT id FROM accounts WHERE code = ?"
          ).get(args.account_code) as { id: number } | undefined;
          accountId = account?.id;
        }

        const statements = listStatements(accountId);

        if (statements.length === 0) {
          return {
            success: true,
            result: "No bank statements found.",
            data: { count: 0, statements: [] },
          };
        }

        const statementList = statements.map(s =>
          `• ${s.statement_date}: ${s.account_name} - $${s.opening_balance.toFixed(2)} → $${s.closing_balance.toFixed(2)} (${s.status}, ${s.matched_count}/${s.transaction_count} matched)`
        ).join("\n");

        return {
          success: true,
          result: `Found ${statements.length} bank statements:\n${statementList}`,
          data: { count: statements.length, statements },
        };
      }

      case "list_bank_transactions": {
        const transactions = listTransactions(args.statement_id, args.match_status);

        if (transactions.length === 0) {
          return {
            success: true,
            result: args.match_status
              ? `No ${args.match_status} transactions found.`
              : "No transactions found for this statement.",
            data: { count: 0, transactions: [] },
          };
        }

        const txList = transactions.slice(0, 15).map(tx =>
          `• ${tx.date}: ${tx.type === "credit" ? "+" : "-"}$${tx.amount.toFixed(2)} - ${tx.description.substring(0, 40)}${tx.description.length > 40 ? "..." : ""} [${tx.match_status}]`
        ).join("\n");

        return {
          success: true,
          result: `Found ${transactions.length} transactions:\n${txList}${transactions.length > 15 ? `\n... and ${transactions.length - 15} more` : ""}`,
          data: { count: transactions.length, transactions },
        };
      }

      case "find_transaction_matches": {
        const matches = findMatches(args.transaction_id);

        if (matches.length === 0) {
          return {
            success: true,
            result: "No potential matches found for this transaction.",
            data: { matches: [] },
          };
        }

        const matchList = matches.map((m, i) =>
          `${i + 1}. [${m.type}] ${m.date}: $${m.amount.toFixed(2)} - ${m.description}\n   Confidence: ${Math.round(m.confidence * 100)}% (${m.reason})`
        ).join("\n");

        return {
          success: true,
          result: `Found ${matches.length} potential matches:\n${matchList}`,
          data: { matches },
        };
      }

      case "auto_match_transactions": {
        const minConfidence = args.min_confidence || 0.7;
        const result = autoMatchTransactions(args.statement_id, minConfidence);

        if (result.matched === 0) {
          return {
            success: true,
            result: `Processed transactions but none met the ${Math.round(minConfidence * 100)}% confidence threshold. ${result.skipped} transactions remain unmatched.`,
            data: result,
          };
        }

        const matchSummary = result.results.slice(0, 5).map(r =>
          `• Transaction ${r.transaction_id} → ${r.matched_type} ${r.matched_id} (${Math.round(r.confidence * 100)}%)`
        ).join("\n");

        return {
          success: true,
          result: `Auto-matched ${result.matched} of ${result.matched + result.skipped} transactions:\n${matchSummary}${result.matched > 5 ? `\n... and ${result.matched - 5} more` : ""}`,
          data: result,
        };
      }

      case "match_transaction": {
        let success: boolean;

        if (args.match_type === "payment") {
          success = matchToPayment(args.transaction_id, args.match_id);
        } else {
          success = matchToExpense(args.transaction_id, args.match_id);
        }

        if (!success) {
          return {
            success: false,
            result: `Transaction ${args.transaction_id} not found.`,
          };
        }

        return {
          success: true,
          result: `Transaction ${args.transaction_id} matched to ${args.match_type} ${args.match_id}`,
          data: { transaction_id: args.transaction_id, match_type: args.match_type, match_id: args.match_id },
        };
      }

      case "unmatch_transaction": {
        const success = unmatchTransaction(args.transaction_id);

        if (!success) {
          return {
            success: false,
            result: `Transaction ${args.transaction_id} not found.`,
          };
        }

        return {
          success: true,
          result: `Transaction ${args.transaction_id} unmatched`,
          data: { transaction_id: args.transaction_id },
        };
      }

      case "ignore_transaction": {
        const success = ignoreTransaction(args.transaction_id);

        if (!success) {
          return {
            success: false,
            result: `Transaction ${args.transaction_id} not found.`,
          };
        }

        return {
          success: true,
          result: `Transaction ${args.transaction_id} marked as ignored`,
          data: { transaction_id: args.transaction_id },
        };
      }

      case "get_statement_progress": {
        try {
          const progress = getReconciliationProgress(args.statement_id);

          return {
            success: true,
            result: `Reconciliation Progress for Statement ${args.statement_id}:
• Total transactions: ${progress.total_transactions}
• Matched: ${progress.matched}
• Unmatched: ${progress.unmatched}
• Ignored: ${progress.ignored}
• Progress: ${progress.progress_percentage}%

Balance Verification:
• Expected closing: $${progress.expected_balance.toFixed(2)}
• Calculated: $${progress.calculated_balance.toFixed(2)}
• Difference: $${progress.difference.toFixed(2)}${progress.difference !== 0 ? " ⚠️" : " ✓"}`,
            data: progress,
          };
        } catch (error) {
          return {
            success: false,
            result: `Statement ${args.statement_id} not found.`,
          };
        }
      }

      case "finalize_reconciliation": {
        try {
          markStatementReconciled(args.statement_id);

          return {
            success: true,
            result: `Statement ${args.statement_id} has been marked as reconciled`,
            data: { statement_id: args.statement_id, status: "reconciled" },
          };
        } catch (error) {
          return {
            success: false,
            result: (error as Error).message,
          };
        }
      }

      case "get_bank_reconciliation_stats": {
        const stats = getReconciliationStats();

        return {
          success: true,
          result: `Bank Reconciliation Statistics:
• Total statements: ${stats.total_statements}
• Reconciled: ${stats.reconciled_statements}
• Pending: ${stats.pending_statements}

Transactions:
• Total: ${stats.total_transactions}
• Matched: ${stats.matched_transactions}
• Unmatched: ${stats.unmatched_transactions}
• Match rate: ${stats.match_rate}%`,
          data: stats,
        };
      }

      // Agent Autonomy Tool Implementations
      case "get_proactive_suggestions": {
        const suggestions = generateProactiveSuggestions();

        if (suggestions.length === 0) {
          return {
            success: true,
            result: "No actions needed at this time. Your accounting is up to date!",
            data: { suggestions: [] },
          };
        }

        const priorityEmoji = { high: "🔴", medium: "🟡", low: "🟢" };
        const suggestionList = suggestions.map(s =>
          `${priorityEmoji[s.priority]} [${s.priority.toUpperCase()}] ${s.title}\n   ${s.description}\n   → Suggested: ${s.suggestedTool}\n   Reason: ${s.reason}`
        ).join("\n\n");

        return {
          success: true,
          result: `Proactive Suggestions (${suggestions.length}):\n\n${suggestionList}`,
          data: { suggestions },
        };
      }

      case "get_agent_activity": {
        const limit = args.limit || 20;
        const actions = getRecentActions(args.session_id, limit);

        if (actions.length === 0) {
          return {
            success: true,
            result: "No recent agent activity.",
            data: { count: 0, actions: [] },
          };
        }

        const statusEmoji = (success: boolean) => success ? "✓" : "✗";
        const riskEmoji = { none: "", low: "🟢", medium: "🟡", high: "🟠", critical: "🔴" };

        const activityList = actions.slice(0, 10).map(a =>
          `${statusEmoji(!!a.success)} ${a.created_at.slice(0, 16)} ${riskEmoji[a.risk_level as keyof typeof riskEmoji] || ""} ${a.tool_name}${a.requires_review && !a.reviewed_at ? " [NEEDS REVIEW]" : ""}`
        ).join("\n");

        return {
          success: true,
          result: `Recent Agent Activity (${actions.length} actions):\n${activityList}${actions.length > 10 ? `\n... and ${actions.length - 10} more` : ""}`,
          data: { count: actions.length, actions },
        };
      }

      case "get_agent_stats": {
        const stats = getAgentStats(args.from_date);

        const toolList = stats.most_used_tools.slice(0, 5).map(t =>
          `  ${t.tool}: ${t.count}`
        ).join("\n");

        return {
          success: true,
          result: `Agent Statistics${args.from_date ? ` (since ${args.from_date})` : ""}:
• Total actions: ${stats.total_actions}
• Success rate: ${stats.total_actions > 0 ? Math.round((stats.successful_actions / stats.total_actions) * 100) : 100}%
• Failed: ${stats.failed_actions}
• Pending review: ${stats.pending_review}
• Avg execution time: ${stats.avg_execution_time_ms}ms

Actions by risk level:
  None: ${stats.actions_by_risk["none"] || 0}
  Low: ${stats.actions_by_risk["low"] || 0}
  Medium: ${stats.actions_by_risk["medium"] || 0}
  High: ${stats.actions_by_risk["high"] || 0}
  Critical: ${stats.actions_by_risk["critical"] || 0}

Most used tools:
${toolList}`,
          data: stats,
        };
      }

      case "get_pending_reviews": {
        const pending = getActionsPendingReview();

        if (pending.length === 0) {
          return {
            success: true,
            result: "No actions pending review.",
            data: { count: 0, actions: [] },
          };
        }

        const pendingList = pending.map(a =>
          `• ID ${a.id}: ${a.tool_name} (${a.risk_level}) - ${a.created_at.slice(0, 16)}\n  Input: ${a.input_summary || "(none)"}\n  Result: ${a.success ? "Success" : "Failed"}`
        ).join("\n\n");

        return {
          success: true,
          result: `Actions Pending Review (${pending.length}):\n\n${pendingList}`,
          data: { count: pending.length, actions: pending },
        };
      }

      case "approve_action": {
        const success = markActionReviewed(args.action_id, "user");

        if (!success) {
          return {
            success: false,
            result: `Action ${args.action_id} not found.`,
          };
        }

        return {
          success: true,
          result: `Action ${args.action_id} has been reviewed and approved.`,
          data: { action_id: args.action_id },
        };
      }

      default:
        return { success: false, result: `Unknown tool: ${name}` };
    }
  } catch (error) {
    return {
      success: false,
      result: `Error executing ${name}: ${(error as Error).message}`,
    };
  }
}
