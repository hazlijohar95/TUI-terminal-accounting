import { getDb, logAudit, withTransaction } from "../db/index.js";
import { recordPaymentToInvoice } from "./invoices.js";
import {
  createJournalEntry,
  type CreateJournalLineData,
} from "./journal.js";
import { getAccountByCode } from "./accounts.js";
import { logger } from "../core/logger.js";
import { matchExpense } from "./categorization-rules.js";

const paymentLogger = logger.child({ module: "payments" });

export interface Payment {
  id: number;
  date: string;
  type: "received" | "sent";
  amount: number;
  method: "cash" | "bank" | "card" | "check" | "other";
  reference?: string;
  customer_id?: number;
  customer_name?: string;
  vendor_id?: number;
  vendor_name?: string;
  invoice_id?: number;
  invoice_number?: string;
  account_id?: number;
  notes?: string;
  cleared_at?: string;
  bank_reference?: string;
  reconciled: number;
  created_at: string;
}

export interface RecordPaymentData {
  date?: string;
  amount: number;
  method?: Payment["method"];
  reference?: string;
  customer_id?: number;
  invoice_id?: number;
  notes?: string;
}

export interface RecordExpenseData {
  date?: string;
  amount: number;
  vendor_id?: number;
  vendor_name?: string;
  category: string;
  description?: string;
  method?: Payment["method"];
  reference?: string;
  notes?: string;
}

export function recordPayment(data: RecordPaymentData): Payment {
  // Validate amount
  if (data.amount <= 0) {
    throw new Error("Payment amount must be greater than 0");
  }

  return withTransaction(() => {
    const db = getDb();
    const date = data.date || new Date().toISOString().split("T")[0];

    const result = db.prepare(`
      INSERT INTO payments (date, type, amount, method, reference, customer_id, invoice_id, notes)
      VALUES (?, 'received', ?, ?, ?, ?, ?, ?)
    `).run(
      date,
      data.amount,
      data.method || "bank",
      data.reference || null,
      data.customer_id || null,
      data.invoice_id || null,
      data.notes || null
    );

    const paymentId = result.lastInsertRowid as number;

    // Update invoice if linked
    if (data.invoice_id) {
      recordPaymentToInvoice(data.invoice_id, data.amount);
    }

    // Create journal entry for payment received
    const journalLines: CreateJournalLineData[] = [];

    // Debit: Cash/Bank
    const cashAccount = getAccountByCode("1100");
    if (!cashAccount) {
      throw new Error("Bank Account (1100) not found. Please ensure chart of accounts is set up.");
    }
    journalLines.push({
      account_id: cashAccount.id,
      debit: data.amount,
      credit: 0,
      description: `Payment received ${data.reference ? `- ${data.reference}` : ""}`,
    });

    // Credit: Accounts Receivable
    const arAccount = getAccountByCode("1200");
    if (!arAccount) {
      throw new Error("Accounts Receivable (1200) not found. Please ensure chart of accounts is set up.");
    }
    journalLines.push({
      account_id: arAccount.id,
      debit: 0,
      credit: data.amount,
      description: `Payment received ${data.reference ? `- ${data.reference}` : ""}`,
    });

    // Create the journal entry
    const journalEntry = createJournalEntry({
      date,
      description: `Payment received ${data.reference ? `- ${data.reference}` : ""}`,
      reference: data.reference || null,
      entry_type: "standard",
      lines: journalLines,
    });

    // Link journal entry to payment
    db.prepare("UPDATE payments SET journal_entry_id = ? WHERE id = ?").run(
      journalEntry.id,
      paymentId
    );

    const payment = getPayment(paymentId)!;
    logAudit("create", "payment", payment.id, null, payment);

    return payment;
  });
}

export function recordExpense(data: RecordExpenseData): Payment {
  // Validate amount
  if (data.amount <= 0) {
    throw new Error("Expense amount must be greater than 0");
  }

  return withTransaction(() => {
    const db = getDb();
    const date = data.date || new Date().toISOString().split("T")[0];

    let account: { id: number; code: string; name: string } | undefined;

    // First, try to find account by provided category
    if (data.category) {
      account = db.prepare(
        "SELECT id, code, name FROM accounts WHERE name = ? OR code = ? OR LOWER(name) = LOWER(?)"
      ).get(data.category, data.category, data.category) as { id: number; code: string; name: string } | undefined;
    }

    // If no category provided or not found, try auto-categorization
    if (!account && (data.description || data.vendor_name)) {
      const match = matchExpense(data.description || "", data.vendor_name);
      if (match && match.confidence >= 0.7) {
        account = db.prepare(
          "SELECT id, code, name FROM accounts WHERE id = ?"
        ).get(match.rule.account_id) as { id: number; code: string; name: string } | undefined;

        paymentLogger.info({
          msg: "Auto-categorized expense",
          description: data.description,
          vendor: data.vendor_name,
          category: account?.name,
          confidence: match.confidence,
        });
      }
    }

    // If still no account, fall back to "Other Expenses" or throw error
    if (!account) {
      // Try to find a generic "Other Expenses" account
      account = db.prepare(
        "SELECT id, code, name FROM accounts WHERE LOWER(name) LIKE '%other%expense%' AND type = 'expense' LIMIT 1"
      ).get() as { id: number; code: string; name: string } | undefined;

      if (!account && data.category) {
        // List available expense accounts to help user
        const expenseAccounts = db.prepare(
          "SELECT code, name FROM accounts WHERE type = 'expense' ORDER BY code"
        ).all() as Array<{ code: string; name: string }>;

        const accountList = expenseAccounts.map(a => `${a.code}: ${a.name}`).join(", ");
        throw new Error(
          `Expense category "${data.category}" not found. Available expense accounts: ${accountList || "None"}. ` +
          `Please create an expense account first or use an existing account code/name.`
        );
      }
    }

    if (!account) {
      throw new Error("No expense account found and auto-categorization failed. Please specify a category.");
    }

    // Create expense record
    const expenseResult = db.prepare(`
      INSERT INTO expenses (date, vendor_id, account_id, amount, description, reference, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      date,
      data.vendor_id || null,
      account.id,
      data.amount,
      data.description || data.category,
      data.reference || null,
      data.notes || null
    );

    const expenseId = expenseResult.lastInsertRowid as number;

    // Create payment record
    const result = db.prepare(`
      INSERT INTO payments (date, type, amount, method, reference, vendor_id, account_id, notes)
      VALUES (?, 'sent', ?, ?, ?, ?, ?, ?)
    `).run(
      date,
      data.amount,
      data.method || "bank",
      data.reference || null,
      data.vendor_id || null,
      account.id,
      data.notes || null
    );

    const paymentId = result.lastInsertRowid as number;

    // Create journal entry for expense
    const journalLines: CreateJournalLineData[] = [];

    // Debit: Expense account
    journalLines.push({
      account_id: account.id,
      debit: data.amount,
      credit: 0,
      description: data.description || data.category,
    });

    // Credit: Cash/Bank
    const cashAccount = getAccountByCode("1100");
    if (!cashAccount) {
      throw new Error("Bank Account (1100) not found. Please ensure chart of accounts is set up.");
    }
    journalLines.push({
      account_id: cashAccount.id,
      debit: 0,
      credit: data.amount,
      description: `Payment for ${data.description || data.category}`,
    });

    // Create the journal entry
    const journalEntry = createJournalEntry({
      date,
      description: `Expense: ${data.description || data.category}`,
      reference: data.reference || null,
      entry_type: "standard",
      lines: journalLines,
    });

    // Link journal entry to payment
    db.prepare("UPDATE payments SET journal_entry_id = ? WHERE id = ?").run(
      journalEntry.id,
      paymentId
    );

    const payment = getPayment(paymentId)!;
    logAudit("create", "expense", payment.id, null, payment);

    return payment;
  });
}

export function getPayment(id: number): Payment | undefined {
  const db = getDb();

  return db.prepare(`
    SELECT
      p.*,
      c.name as customer_name,
      v.name as vendor_name,
      i.number as invoice_number
    FROM payments p
    LEFT JOIN customers c ON p.customer_id = c.id
    LEFT JOIN vendors v ON p.vendor_id = v.id
    LEFT JOIN invoices i ON p.invoice_id = i.id
    WHERE p.id = ?
  `).get(id) as Payment | undefined;
}

export function listPayments(filters?: {
  type?: "received" | "sent";
  from_date?: string;
  to_date?: string;
  customer_id?: number;
  vendor_id?: number;
  limit?: number;
}): Payment[] {
  const db = getDb();

  let sql = `
    SELECT
      p.*,
      c.name as customer_name,
      v.name as vendor_name,
      i.number as invoice_number
    FROM payments p
    LEFT JOIN customers c ON p.customer_id = c.id
    LEFT JOIN vendors v ON p.vendor_id = v.id
    LEFT JOIN invoices i ON p.invoice_id = i.id
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (filters?.type) {
    sql += " AND p.type = ?";
    params.push(filters.type);
  }
  if (filters?.from_date) {
    sql += " AND p.date >= ?";
    params.push(filters.from_date);
  }
  if (filters?.to_date) {
    sql += " AND p.date <= ?";
    params.push(filters.to_date);
  }
  if (filters?.customer_id) {
    sql += " AND p.customer_id = ?";
    params.push(filters.customer_id);
  }
  if (filters?.vendor_id) {
    sql += " AND p.vendor_id = ?";
    params.push(filters.vendor_id);
  }

  sql += " ORDER BY p.date DESC, p.id DESC";

  if (filters?.limit) {
    sql += " LIMIT ?";
    params.push(filters.limit);
  }

  return db.prepare(sql).all(...params) as Payment[];
}

export function getPaymentSummary(fromDate?: string, toDate?: string): {
  total_received: number;
  total_sent: number;
  net_cash_flow: number;
  by_method: Record<string, number>;
} {
  const db = getDb();

  let whereClause = "";
  const params: string[] = [];

  if (fromDate) {
    whereClause += " AND date >= ?";
    params.push(fromDate);
  }
  if (toDate) {
    whereClause += " AND date <= ?";
    params.push(toDate);
  }

  const received = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM payments WHERE type = 'received' ${whereClause}
  `).get(...params) as { total: number };

  const sent = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM payments WHERE type = 'sent' ${whereClause}
  `).get(...params) as { total: number };

  const byMethod = db.prepare(`
    SELECT method, SUM(amount) as total
    FROM payments
    WHERE 1=1 ${whereClause}
    GROUP BY method
  `).all(...params) as Array<{ method: string; total: number }>;

  const methodTotals: Record<string, number> = {};
  for (const row of byMethod) {
    methodTotals[row.method] = row.total;
  }

  return {
    total_received: received.total,
    total_sent: sent.total,
    net_cash_flow: received.total - sent.total,
    by_method: methodTotals,
  };
}
