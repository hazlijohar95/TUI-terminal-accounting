import { getDb, logAudit } from "../db/index.js";
import type { Payment } from "./payments.js";

/**
 * Mark a payment as cleared by the bank
 */
export function markPaymentCleared(
  paymentId: number,
  clearedDate: string,
  bankReference?: string
): Payment | undefined {
  const db = getDb();

  const old = db.prepare("SELECT * FROM payments WHERE id = ?").get(paymentId) as Payment | undefined;
  if (!old) return undefined;

  db.prepare(`
    UPDATE payments
    SET cleared_at = ?, bank_reference = ?
    WHERE id = ?
  `).run(clearedDate, bankReference || null, paymentId);

  const updated = db.prepare(`
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
  `).get(paymentId) as Payment;

  logAudit("mark_cleared", "payment", paymentId, { cleared_at: old.cleared_at }, { cleared_at: clearedDate, bank_reference: bankReference });

  return updated;
}

/**
 * Get payments that haven't been reconciled with bank statements
 */
export function getUnreconciledPayments(accountId?: number): Payment[] {
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
    WHERE p.reconciled = 0
  `;
  const params: unknown[] = [];

  if (accountId) {
    sql += " AND p.account_id = ?";
    params.push(accountId);
  }

  sql += " ORDER BY p.date DESC, p.id DESC";

  return db.prepare(sql).all(...params) as Payment[];
}

/**
 * Mark a payment as reconciled (matched with bank statement)
 */
export function reconcilePayment(
  paymentId: number,
  bankTransactionId?: number
): Payment | undefined {
  const db = getDb();

  const old = db.prepare("SELECT * FROM payments WHERE id = ?").get(paymentId) as Payment | undefined;
  if (!old) return undefined;

  db.prepare(`
    UPDATE payments
    SET reconciled = 1
    WHERE id = ?
  `).run(paymentId);

  const updated = db.prepare(`
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
  `).get(paymentId) as Payment;

  logAudit("reconcile", "payment", paymentId, { reconciled: 0 }, { reconciled: 1, bank_transaction_id: bankTransactionId });

  return updated;
}

/**
 * Get reconciliation summary for a date range
 */
export function getReconciliationSummary(fromDate?: string, toDate?: string): {
  total_payments: number;
  reconciled_count: number;
  unreconciled_count: number;
  reconciled_amount: number;
  unreconciled_amount: number;
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

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total_payments,
      SUM(CASE WHEN reconciled = 1 THEN 1 ELSE 0 END) as reconciled_count,
      SUM(CASE WHEN reconciled = 0 THEN 1 ELSE 0 END) as unreconciled_count,
      COALESCE(SUM(CASE WHEN reconciled = 1 THEN amount ELSE 0 END), 0) as reconciled_amount,
      COALESCE(SUM(CASE WHEN reconciled = 0 THEN amount ELSE 0 END), 0) as unreconciled_amount
    FROM payments
    WHERE 1=1 ${whereClause}
  `).get(...params) as {
    total_payments: number;
    reconciled_count: number;
    unreconciled_count: number;
    reconciled_amount: number;
    unreconciled_amount: number;
  };

  return stats;
}

/**
 * Unreconcile a payment (undo reconciliation)
 */
export function unreconcilePayment(paymentId: number): Payment | undefined {
  const db = getDb();

  const old = db.prepare("SELECT * FROM payments WHERE id = ?").get(paymentId) as Payment | undefined;
  if (!old) return undefined;

  db.prepare(`
    UPDATE payments
    SET reconciled = 0
    WHERE id = ?
  `).run(paymentId);

  const updated = db.prepare(`
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
  `).get(paymentId) as Payment;

  logAudit("unreconcile", "payment", paymentId, { reconciled: 1 }, { reconciled: 0 });

  return updated;
}
