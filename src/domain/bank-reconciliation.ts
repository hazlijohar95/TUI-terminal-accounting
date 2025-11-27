import { getDb, logAudit, withTransaction } from "../db/index.js";

export interface BankStatement {
  id: number;
  account_id: number;
  account_name?: string;
  statement_date: string;
  opening_balance: number;
  closing_balance: number;
  filename?: string;
  status: "pending" | "reconciling" | "reconciled";
  reconciled_at?: string;
  notes?: string;
  created_at: string;
  transaction_count?: number;
  matched_count?: number;
}

export interface BankTransaction {
  id: number;
  statement_id?: number;
  date: string;
  description: string;
  amount: number;
  type: "credit" | "debit";
  reference?: string;
  balance_after?: number;
  matched_payment_id?: number;
  matched_expense_id?: number;
  match_status: "unmatched" | "auto_matched" | "manual_matched" | "ignored";
  match_confidence?: number;
  created_at: string;
  // Joined data
  payment_reference?: string;
  expense_description?: string;
}

export interface CreateStatementData {
  account_id: number;
  statement_date: string;
  opening_balance: number;
  closing_balance: number;
  filename?: string;
  notes?: string;
}

export interface CreateTransactionData {
  statement_id?: number;
  date: string;
  description: string;
  amount: number;
  type: "credit" | "debit";
  reference?: string;
  balance_after?: number;
}

export interface MatchCandidate {
  type: "payment" | "expense";
  id: number;
  date: string;
  amount: number;
  description: string;
  reference?: string;
  confidence: number;
  reason: string;
}

/**
 * Create a new bank statement
 */
export function createStatement(data: CreateStatementData): BankStatement {
  const db = getDb();

  const result = db.prepare(`
    INSERT INTO bank_statements (account_id, statement_date, opening_balance, closing_balance, filename, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    data.account_id,
    data.statement_date,
    data.opening_balance,
    data.closing_balance,
    data.filename || null,
    data.notes || null
  );

  const statement = getStatement(result.lastInsertRowid as number)!;
  logAudit("create", "bank_statement", statement.id, null, statement);

  return statement;
}

/**
 * Get a bank statement by ID
 */
export function getStatement(id: number): BankStatement | undefined {
  const db = getDb();

  return db.prepare(`
    SELECT
      s.*,
      a.name as account_name,
      (SELECT COUNT(*) FROM bank_transactions WHERE statement_id = s.id) as transaction_count,
      (SELECT COUNT(*) FROM bank_transactions WHERE statement_id = s.id AND match_status IN ('auto_matched', 'manual_matched')) as matched_count
    FROM bank_statements s
    JOIN accounts a ON s.account_id = a.id
    WHERE s.id = ?
  `).get(id) as BankStatement | undefined;
}

/**
 * List bank statements
 */
export function listStatements(accountId?: number): BankStatement[] {
  const db = getDb();

  let sql = `
    SELECT
      s.*,
      a.name as account_name,
      (SELECT COUNT(*) FROM bank_transactions WHERE statement_id = s.id) as transaction_count,
      (SELECT COUNT(*) FROM bank_transactions WHERE statement_id = s.id AND match_status IN ('auto_matched', 'manual_matched')) as matched_count
    FROM bank_statements s
    JOIN accounts a ON s.account_id = a.id
  `;
  const params: unknown[] = [];

  if (accountId) {
    sql += " WHERE s.account_id = ?";
    params.push(accountId);
  }

  sql += " ORDER BY s.statement_date DESC, s.id DESC";

  return db.prepare(sql).all(...params) as BankStatement[];
}

/**
 * Delete a bank statement and its transactions
 */
export function deleteStatement(id: number): boolean {
  const db = getDb();

  const old = getStatement(id);
  if (!old) return false;

  // Delete cascades to transactions
  db.prepare("DELETE FROM bank_statements WHERE id = ?").run(id);
  logAudit("delete", "bank_statement", id, old, null);

  return true;
}

/**
 * Create a bank transaction
 */
export function createTransaction(data: CreateTransactionData): BankTransaction {
  const db = getDb();

  const result = db.prepare(`
    INSERT INTO bank_transactions (statement_id, date, description, amount, type, reference, balance_after)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.statement_id || null,
    data.date,
    data.description,
    data.amount,
    data.type,
    data.reference || null,
    data.balance_after || null
  );

  return getTransaction(result.lastInsertRowid as number)!;
}

/**
 * Import multiple transactions (batch)
 */
export function importTransactions(statementId: number, transactions: Omit<CreateTransactionData, "statement_id">[]): BankTransaction[] {
  return withTransaction(() => {
    const results: BankTransaction[] = [];

    for (const tx of transactions) {
      results.push(createTransaction({ ...tx, statement_id: statementId }));
    }

    // Update statement status to reconciling
    getDb().prepare("UPDATE bank_statements SET status = 'reconciling' WHERE id = ?").run(statementId);

    return results;
  });
}

/**
 * Get a bank transaction by ID
 */
export function getTransaction(id: number): BankTransaction | undefined {
  const db = getDb();

  return db.prepare(`
    SELECT
      t.*,
      p.reference as payment_reference,
      e.description as expense_description
    FROM bank_transactions t
    LEFT JOIN payments p ON t.matched_payment_id = p.id
    LEFT JOIN expenses e ON t.matched_expense_id = e.id
    WHERE t.id = ?
  `).get(id) as BankTransaction | undefined;
}

/**
 * List transactions for a statement
 */
export function listTransactions(statementId?: number, matchStatus?: string): BankTransaction[] {
  const db = getDb();

  let sql = `
    SELECT
      t.*,
      p.reference as payment_reference,
      e.description as expense_description
    FROM bank_transactions t
    LEFT JOIN payments p ON t.matched_payment_id = p.id
    LEFT JOIN expenses e ON t.matched_expense_id = e.id
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (statementId) {
    sql += " AND t.statement_id = ?";
    params.push(statementId);
  }

  if (matchStatus) {
    sql += " AND t.match_status = ?";
    params.push(matchStatus);
  }

  sql += " ORDER BY t.date DESC, t.id DESC";

  return db.prepare(sql).all(...params) as BankTransaction[];
}

/**
 * Find potential matches for a bank transaction
 * Uses multi-factor matching: amount, date proximity, reference/description similarity
 */
export function findMatches(transactionId: number): MatchCandidate[] {
  const db = getDb();

  const transaction = getTransaction(transactionId);
  if (!transaction) return [];

  const candidates: MatchCandidate[] = [];
  const descLower = transaction.description.toLowerCase();
  const refLower = transaction.reference?.toLowerCase() || "";

  // Look for matching payments
  const payments = db.prepare(`
    SELECT
      p.id, p.date, p.amount, p.reference, p.type,
      c.name as customer_name,
      v.name as vendor_name
    FROM payments p
    LEFT JOIN customers c ON p.customer_id = c.id
    LEFT JOIN vendors v ON p.vendor_id = v.id
    WHERE p.reconciled = 0
    ORDER BY p.date DESC
    LIMIT 100
  `).all() as Array<{
    id: number;
    date: string;
    amount: number;
    reference?: string;
    type: "received" | "sent";
    customer_name?: string;
    vendor_name?: string;
  }>;

  for (const payment of payments) {
    // Skip mismatched types (credit should match received, debit should match sent)
    if (transaction.type === "credit" && payment.type !== "received") continue;
    if (transaction.type === "debit" && payment.type !== "sent") continue;

    let confidence = 0;
    const reasons: string[] = [];

    // Amount match (most important)
    const amountDiff = Math.abs(payment.amount - transaction.amount);
    if (amountDiff === 0) {
      confidence += 0.5;
      reasons.push("exact amount");
    } else if (amountDiff <= 0.01) {
      confidence += 0.4;
      reasons.push("amount (rounding)");
    } else if (amountDiff / transaction.amount < 0.01) {
      confidence += 0.2;
      reasons.push("similar amount");
    }

    // Date proximity (within 5 days)
    const txDate = new Date(transaction.date);
    const payDate = new Date(payment.date);
    const daysDiff = Math.abs((txDate.getTime() - payDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff === 0) {
      confidence += 0.25;
      reasons.push("same date");
    } else if (daysDiff <= 3) {
      confidence += 0.15;
      reasons.push(`${daysDiff}d apart`);
    } else if (daysDiff <= 7) {
      confidence += 0.05;
      reasons.push(`${Math.round(daysDiff)}d apart`);
    }

    // Reference/description match
    const payRefLower = payment.reference?.toLowerCase() || "";
    const customerLower = payment.customer_name?.toLowerCase() || "";
    const vendorLower = payment.vendor_name?.toLowerCase() || "";

    if (payRefLower && (descLower.includes(payRefLower) || refLower.includes(payRefLower))) {
      confidence += 0.2;
      reasons.push("reference match");
    }
    if (customerLower && descLower.includes(customerLower)) {
      confidence += 0.15;
      reasons.push("customer match");
    }
    if (vendorLower && descLower.includes(vendorLower)) {
      confidence += 0.15;
      reasons.push("vendor match");
    }

    if (confidence > 0.3) {
      candidates.push({
        type: "payment",
        id: payment.id,
        date: payment.date,
        amount: payment.amount,
        description: payment.reference || `${payment.customer_name || payment.vendor_name || "Payment"}`,
        reference: payment.reference,
        confidence: Math.min(confidence, 0.99),
        reason: reasons.join(", "),
      });
    }
  }

  // Look for matching expenses (for debit transactions)
  if (transaction.type === "debit") {
    const expenses = db.prepare(`
      SELECT
        e.id, e.date, e.amount, e.description, e.reference,
        v.name as vendor_name
      FROM expenses e
      LEFT JOIN vendors v ON e.vendor_id = v.id
      WHERE e.payment_id IS NULL
      ORDER BY e.date DESC
      LIMIT 100
    `).all() as Array<{
      id: number;
      date: string;
      amount: number;
      description?: string;
      reference?: string;
      vendor_name?: string;
    }>;

    for (const expense of expenses) {
      let confidence = 0;
      const reasons: string[] = [];

      // Amount match
      const amountDiff = Math.abs(expense.amount - transaction.amount);
      if (amountDiff === 0) {
        confidence += 0.5;
        reasons.push("exact amount");
      } else if (amountDiff <= 0.01) {
        confidence += 0.4;
        reasons.push("amount (rounding)");
      }

      // Date proximity
      const txDate = new Date(transaction.date);
      const expDate = new Date(expense.date);
      const daysDiff = Math.abs((txDate.getTime() - expDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff === 0) {
        confidence += 0.25;
        reasons.push("same date");
      } else if (daysDiff <= 3) {
        confidence += 0.15;
        reasons.push(`${daysDiff}d apart`);
      }

      // Description/vendor match
      const expDescLower = expense.description?.toLowerCase() || "";
      const vendorLower = expense.vendor_name?.toLowerCase() || "";

      if (expDescLower && descLower.includes(expDescLower)) {
        confidence += 0.15;
        reasons.push("description match");
      }
      if (vendorLower && descLower.includes(vendorLower)) {
        confidence += 0.2;
        reasons.push("vendor match");
      }

      if (confidence > 0.3) {
        candidates.push({
          type: "expense",
          id: expense.id,
          date: expense.date,
          amount: expense.amount,
          description: expense.description || expense.vendor_name || "Expense",
          reference: expense.reference,
          confidence: Math.min(confidence, 0.99),
          reason: reasons.join(", "),
        });
      }
    }
  }

  // Sort by confidence descending
  candidates.sort((a, b) => b.confidence - a.confidence);

  return candidates.slice(0, 10);
}

/**
 * Auto-match all unmatched transactions in a statement
 */
export function autoMatchTransactions(statementId: number, minConfidence: number = 0.7): {
  matched: number;
  skipped: number;
  results: Array<{
    transaction_id: number;
    matched_type: "payment" | "expense";
    matched_id: number;
    confidence: number;
  }>;
} {
  const transactions = listTransactions(statementId, "unmatched");
  const results: Array<{
    transaction_id: number;
    matched_type: "payment" | "expense";
    matched_id: number;
    confidence: number;
  }> = [];

  let matched = 0;
  let skipped = 0;

  for (const tx of transactions) {
    const candidates = findMatches(tx.id);

    if (candidates.length > 0 && candidates[0].confidence >= minConfidence) {
      const best = candidates[0];

      if (best.type === "payment") {
        matchToPayment(tx.id, best.id, true);
      } else {
        matchToExpense(tx.id, best.id, true);
      }

      matched++;
      results.push({
        transaction_id: tx.id,
        matched_type: best.type,
        matched_id: best.id,
        confidence: best.confidence,
      });
    } else {
      skipped++;
    }
  }

  return { matched, skipped, results };
}

/**
 * Manually match a transaction to a payment
 */
export function matchToPayment(transactionId: number, paymentId: number, isAutoMatch: boolean = false): boolean {
  const db = getDb();

  const tx = getTransaction(transactionId);
  if (!tx) return false;

  db.prepare(`
    UPDATE bank_transactions
    SET matched_payment_id = ?, matched_expense_id = NULL, match_status = ?, match_confidence = NULL
    WHERE id = ?
  `).run(paymentId, isAutoMatch ? "auto_matched" : "manual_matched", transactionId);

  // Mark payment as reconciled
  db.prepare("UPDATE payments SET reconciled = 1 WHERE id = ?").run(paymentId);

  logAudit("match", "bank_transaction", transactionId, { matched_payment_id: null }, { matched_payment_id: paymentId });

  return true;
}

/**
 * Manually match a transaction to an expense
 */
export function matchToExpense(transactionId: number, expenseId: number, isAutoMatch: boolean = false): boolean {
  const db = getDb();

  const tx = getTransaction(transactionId);
  if (!tx) return false;

  db.prepare(`
    UPDATE bank_transactions
    SET matched_expense_id = ?, matched_payment_id = NULL, match_status = ?, match_confidence = NULL
    WHERE id = ?
  `).run(expenseId, isAutoMatch ? "auto_matched" : "manual_matched", transactionId);

  logAudit("match", "bank_transaction", transactionId, { matched_expense_id: null }, { matched_expense_id: expenseId });

  return true;
}

/**
 * Unmatch a transaction
 */
export function unmatchTransaction(transactionId: number): boolean {
  const db = getDb();

  const tx = getTransaction(transactionId);
  if (!tx) return false;

  // If was matched to payment, unreconcile the payment
  if (tx.matched_payment_id) {
    db.prepare("UPDATE payments SET reconciled = 0 WHERE id = ?").run(tx.matched_payment_id);
  }

  db.prepare(`
    UPDATE bank_transactions
    SET matched_payment_id = NULL, matched_expense_id = NULL, match_status = 'unmatched', match_confidence = NULL
    WHERE id = ?
  `).run(transactionId);

  logAudit("unmatch", "bank_transaction", transactionId, { matched_payment_id: tx.matched_payment_id, matched_expense_id: tx.matched_expense_id }, { matched_payment_id: null, matched_expense_id: null });

  return true;
}

/**
 * Ignore a transaction (no matching entry expected)
 */
export function ignoreTransaction(transactionId: number): boolean {
  const db = getDb();

  db.prepare(`
    UPDATE bank_transactions
    SET match_status = 'ignored', matched_payment_id = NULL, matched_expense_id = NULL
    WHERE id = ?
  `).run(transactionId);

  return true;
}

/**
 * Mark a statement as reconciled
 */
export function markStatementReconciled(statementId: number): boolean {
  const db = getDb();

  const statement = getStatement(statementId);
  if (!statement) return false;

  // Check all transactions are matched or ignored
  const unmatched = db.prepare(`
    SELECT COUNT(*) as count FROM bank_transactions
    WHERE statement_id = ? AND match_status = 'unmatched'
  `).get(statementId) as { count: number };

  if (unmatched.count > 0) {
    throw new Error(`Cannot reconcile: ${unmatched.count} unmatched transaction(s) remain`);
  }

  db.prepare(`
    UPDATE bank_statements
    SET status = 'reconciled', reconciled_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(statementId);

  logAudit("reconcile", "bank_statement", statementId, { status: statement.status }, { status: "reconciled" });

  return true;
}

/**
 * Get reconciliation progress for a statement
 */
export function getReconciliationProgress(statementId: number): {
  total_transactions: number;
  matched: number;
  unmatched: number;
  ignored: number;
  progress_percentage: number;
  expected_balance: number;
  calculated_balance: number;
  difference: number;
} {
  const db = getDb();

  const statement = getStatement(statementId);
  if (!statement) {
    throw new Error("Statement not found");
  }

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN match_status IN ('auto_matched', 'manual_matched') THEN 1 ELSE 0 END) as matched,
      SUM(CASE WHEN match_status = 'unmatched' THEN 1 ELSE 0 END) as unmatched,
      SUM(CASE WHEN match_status = 'ignored' THEN 1 ELSE 0 END) as ignored,
      SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END) as net_movement
    FROM bank_transactions
    WHERE statement_id = ?
  `).get(statementId) as {
    total: number;
    matched: number;
    unmatched: number;
    ignored: number;
    net_movement: number;
  };

  const calculatedBalance = statement.opening_balance + (stats.net_movement || 0);

  return {
    total_transactions: stats.total,
    matched: stats.matched,
    unmatched: stats.unmatched,
    ignored: stats.ignored,
    progress_percentage: stats.total > 0 ? Math.round(((stats.matched + stats.ignored) / stats.total) * 100) : 100,
    expected_balance: statement.closing_balance,
    calculated_balance: calculatedBalance,
    difference: Math.round((statement.closing_balance - calculatedBalance) * 100) / 100,
  };
}

/**
 * Get overall reconciliation statistics
 */
export function getReconciliationStats(): {
  total_statements: number;
  reconciled_statements: number;
  pending_statements: number;
  total_transactions: number;
  matched_transactions: number;
  unmatched_transactions: number;
  match_rate: number;
} {
  const db = getDb();

  const stats = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM bank_statements) as total_statements,
      (SELECT COUNT(*) FROM bank_statements WHERE status = 'reconciled') as reconciled_statements,
      (SELECT COUNT(*) FROM bank_statements WHERE status IN ('pending', 'reconciling')) as pending_statements,
      (SELECT COUNT(*) FROM bank_transactions) as total_transactions,
      (SELECT COUNT(*) FROM bank_transactions WHERE match_status IN ('auto_matched', 'manual_matched')) as matched_transactions,
      (SELECT COUNT(*) FROM bank_transactions WHERE match_status = 'unmatched') as unmatched_transactions
  `).get() as {
    total_statements: number;
    reconciled_statements: number;
    pending_statements: number;
    total_transactions: number;
    matched_transactions: number;
    unmatched_transactions: number;
  };

  return {
    ...stats,
    match_rate: stats.total_transactions > 0
      ? Math.round((stats.matched_transactions / stats.total_transactions) * 100)
      : 100,
  };
}
