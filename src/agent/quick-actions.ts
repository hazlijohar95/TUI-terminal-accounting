/**
 * Quick Actions Parser
 *
 * Parses natural language for common financial commands and executes
 * them directly without needing the full AI chain. Faster for simple tasks.
 */

import { recordExpense, recordPayment } from "../domain/payments.js";
import { createInvoice, updateInvoiceStatus, listInvoices } from "../domain/invoices.js";
import { createCustomer, listCustomers } from "../domain/customers.js";
import { listAccounts } from "../domain/accounts.js";
import { formatCurrency } from "../core/localization.js";

export interface QuickActionResult {
  matched: boolean;
  action?: string;
  result?: string;
  error?: string;
  data?: unknown;
}

interface ParsedAmount {
  amount: number;
  currency?: string;
}

interface ParsedExpense {
  amount: number;
  description: string;
  category?: string;
  vendor?: string;
}

interface ParsedInvoice {
  customerName: string;
  amount?: number;
  description?: string;
}

interface ParsedPayment {
  invoiceNumber?: string;
  customerName?: string;
  amount: number;
}

/**
 * Parse an amount from text (e.g., "$50", "RM 100", "50 dollars")
 */
function parseAmount(text: string): ParsedAmount | null {
  // Match patterns like: $50, RM50, RM 50, 50 dollars, 50.00
  const patterns = [
    /\$\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,                    // $50, $1,000.00
    /RM\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,                    // RM50, RM 100
    /(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:dollars?|usd)/i,      // 50 dollars
    /(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:ringgit|myr)/i,       // 50 ringgit
    /(\d+(?:,\d{3})*(?:\.\d{2})?)/,                          // Plain number
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const amount = parseFloat(match[1].replace(/,/g, ""));
      if (!isNaN(amount) && amount > 0) {
        return { amount };
      }
    }
  }

  return null;
}

/**
 * Parse an expense command
 * Examples:
 * - "record $50 for office supplies"
 * - "add expense RM100 grab transport"
 * - "spent 45 on lunch"
 */
function parseExpenseCommand(input: string): ParsedExpense | null {
  const lower = input.toLowerCase();

  // Check if it's an expense-related command
  const expensePatterns = [
    /(?:record|add|log|spent|paid)\s+(?:expense\s+)?/i,
    /expense\s+(?:of\s+)?/i,
  ];

  if (!expensePatterns.some(p => p.test(lower))) {
    return null;
  }

  // Extract amount
  const amountMatch = parseAmount(input);
  if (!amountMatch) return null;

  // Extract description - everything after "for", "on", or after the amount
  let description = "";

  const forMatch = input.match(/(?:for|on)\s+(.+?)(?:\s+(?:to|from|at)\s+|$)/i);
  if (forMatch) {
    description = forMatch[1].trim();
  } else {
    // Try to get description from remainder
    const afterAmount = input.replace(/.*?\d+(?:\.\d{2})?\s*/, "").trim();
    if (afterAmount && !afterAmount.match(/^(for|on|to|expense|dollar|ringgit|rm|usd)/i)) {
      description = afterAmount;
    }
  }

  if (!description) {
    description = "Expense";
  }

  // Try to detect category from common keywords
  let category: string | undefined;
  const categoryKeywords: Record<string, string[]> = {
    "Travel & Transport": ["grab", "uber", "taxi", "petrol", "fuel", "parking", "toll", "transport"],
    "Meals & Entertainment": ["lunch", "dinner", "breakfast", "food", "coffee", "meal", "restaurant"],
    "Office Supplies": ["office", "stationery", "supplies", "paper", "printer"],
    "Utilities": ["electricity", "water", "utility", "tnb", "internet", "phone"],
    "Software & Subscriptions": ["software", "subscription", "saas", "cloud", "hosting"],
  };

  for (const [cat, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(kw => lower.includes(kw))) {
      category = cat;
      break;
    }
  }

  return {
    amount: amountMatch.amount,
    description: description.charAt(0).toUpperCase() + description.slice(1),
    category,
  };
}

/**
 * Parse an invoice creation command
 * Examples:
 * - "invoice John Smith for $500 web design"
 * - "create invoice for Acme Corp RM1000"
 */
function parseInvoiceCommand(input: string): ParsedInvoice | null {
  const lower = input.toLowerCase();

  // Check if it's an invoice-related command
  if (!lower.match(/(?:create|new|make)\s+(?:an?\s+)?invoice|invoice\s+(?:for\s+)?/i)) {
    return null;
  }

  // Extract customer name - look for "for [Name]" pattern
  let customerName = "";
  const forMatch = input.match(/(?:for|to)\s+([A-Z][a-zA-Z\s]+?)(?:\s+(?:for|\$|rm|amount|worth|total)\s*|\d|$)/i);
  if (forMatch) {
    customerName = forMatch[1].trim();
  }

  if (!customerName) {
    // Try to find a capitalized name
    const nameMatch = input.match(/invoice\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/);
    if (nameMatch) {
      customerName = nameMatch[1].trim();
    }
  }

  if (!customerName) return null;

  // Extract amount
  const amountMatch = parseAmount(input);

  // Extract description
  let description = "";
  const descMatch = input.match(/(?:for|worth)\s+\S+\s+(.+?)$/i);
  if (descMatch) {
    description = descMatch[1].trim();
  }

  return {
    customerName,
    amount: amountMatch?.amount,
    description: description || "Services",
  };
}

/**
 * Parse a payment recording command
 * Examples:
 * - "mark INV-001 as paid"
 * - "received $500 from John Smith"
 * - "payment of RM1000 for invoice INV-002"
 */
function parsePaymentCommand(input: string): ParsedPayment | null {
  const lower = input.toLowerCase();

  // Check if it's a payment-related command
  if (!lower.match(/(?:mark|record|received|got|paid|payment)/i)) {
    return null;
  }

  // Look for invoice number
  const invoiceMatch = input.match(/(?:INV|invoice)[- ]?(\d+)/i);
  const invoiceNumber = invoiceMatch ? `INV-${invoiceMatch[1].padStart(3, "0")}` : undefined;

  // Extract customer name
  let customerName: string | undefined;
  const fromMatch = input.match(/(?:from|by)\s+([A-Z][a-zA-Z\s]+?)(?:\s+(?:for|\$|rm|amount)\s*|\d|$)/i);
  if (fromMatch) {
    customerName = fromMatch[1].trim();
  }

  // Extract amount
  const amountMatch = parseAmount(input);
  if (!amountMatch && !invoiceNumber) return null;

  return {
    invoiceNumber,
    customerName,
    amount: amountMatch?.amount || 0,
  };
}

/**
 * Execute a quick action based on parsed input
 */
export async function executeQuickAction(input: string): Promise<QuickActionResult> {
  const trimmedInput = input.trim();

  // Try parsing as expense
  const expense = parseExpenseCommand(trimmedInput);
  if (expense) {
    try {
      // Find the appropriate expense account by category
      const accounts = listAccounts({ type: "expense", is_active: true });
      let categoryName = accounts[0]?.name || "General Expenses";

      if (expense.category) {
        const matchingAccount = accounts.find(a =>
          a.name.toLowerCase().includes(expense.category!.toLowerCase().split(" ")[0])
        );
        if (matchingAccount) {
          categoryName = matchingAccount.name;
        }
      }

      if (accounts.length === 0) {
        return {
          matched: true,
          action: "record_expense",
          error: "No expense accounts available. Please set up your chart of accounts first.",
        };
      }

      const result = recordExpense({
        amount: expense.amount,
        description: expense.description,
        category: categoryName,
        date: new Date().toISOString().split("T")[0],
      });

      return {
        matched: true,
        action: "record_expense",
        result: `Recorded expense: ${formatCurrency(expense.amount)} for "${expense.description}"`,
        data: result,
      };
    } catch (err) {
      return {
        matched: true,
        action: "record_expense",
        error: (err as Error).message,
      };
    }
  }

  // Try parsing as invoice
  const invoice = parseInvoiceCommand(trimmedInput);
  if (invoice && invoice.amount) {
    try {
      // Check if customer exists, create if not
      const customers = listCustomers();
      const existingCustomer = customers.find(c =>
        c.name.toLowerCase() === invoice.customerName.toLowerCase()
      );

      const customerId = existingCustomer
        ? existingCustomer.id
        : createCustomer({ name: invoice.customerName }).id;

      const result = createInvoice({
        customer_id: customerId,
        items: [
          {
            description: invoice.description || "Services",
            quantity: 1,
            unit_price: invoice.amount,
          },
        ],
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      });

      return {
        matched: true,
        action: "create_invoice",
        result: `Created invoice ${result.number} for ${invoice.customerName}: ${formatCurrency(invoice.amount)}`,
        data: result,
      };
    } catch (err) {
      return {
        matched: true,
        action: "create_invoice",
        error: (err as Error).message,
      };
    }
  }

  // Try parsing as payment/mark paid
  const payment = parsePaymentCommand(trimmedInput);
  if (payment && payment.invoiceNumber) {
    try {
      // Find the invoice
      const invoices = listInvoices({ limit: 100 });
      const invoice = invoices.find(i =>
        i.number.toLowerCase() === payment.invoiceNumber!.toLowerCase()
      );

      if (!invoice) {
        return {
          matched: true,
          action: "mark_paid",
          error: `Invoice ${payment.invoiceNumber} not found`,
        };
      }

      // Record payment if amount specified, otherwise mark as paid
      if (payment.amount > 0) {
        const result = recordPayment({
          invoice_id: invoice.id,
          amount: payment.amount,
          date: new Date().toISOString().split("T")[0],
          method: "bank",
        });

        return {
          matched: true,
          action: "record_payment",
          result: `Recorded payment of ${formatCurrency(payment.amount)} for ${invoice.number}`,
          data: result,
        };
      } else {
        // Just mark as paid (full amount)
        updateInvoiceStatus(invoice.id, "paid");

        return {
          matched: true,
          action: "mark_paid",
          result: `Marked ${invoice.number} as paid`,
          data: { invoice_number: invoice.number },
        };
      }
    } catch (err) {
      return {
        matched: true,
        action: "record_payment",
        error: (err as Error).message,
      };
    }
  }

  // No quick action matched
  return { matched: false };
}

/**
 * Check if input might be a quick action (without executing)
 */
export function mightBeQuickAction(input: string): boolean {
  const lower = input.toLowerCase();

  const quickPatterns = [
    /^(?:record|add|log|spent|paid)\s+\$?\d/i,           // expense with amount first
    /^(?:expense|payment)\s+/i,                          // starts with expense/payment
    /^(?:create|new|make)\s+(?:an?\s+)?invoice/i,        // create invoice
    /^invoice\s+[A-Z]/i,                                 // invoice [Name]
    /^mark\s+inv/i,                                      // mark invoice
    /^received\s+/i,                                     // received payment
  ];

  return quickPatterns.some(p => p.test(lower));
}

/**
 * Get examples of quick action commands
 */
export function getQuickActionExamples(): string[] {
  return [
    "Record $50 for office supplies",
    "Spent RM45 on lunch",
    "Invoice John Smith for $500 web design",
    "Mark INV-001 as paid",
    "Received $1000 from Acme Corp",
  ];
}
