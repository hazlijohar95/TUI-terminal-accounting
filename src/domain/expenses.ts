import { getDb, logAudit } from "../db/index.js";

export interface Expense {
  id: number;
  date: string;
  vendor_id?: number;
  account_id: number;
  amount: number;
  description?: string;
  reference?: string;
  payment_id?: number;
  is_recurring: number;
  notes?: string;
  created_at: string;
}

export interface ExpenseWithDetails extends Expense {
  vendor_name?: string;
  account_name: string;
  category?: string;
}

export function createExpense(data: {
  date: string;
  vendor_id?: number;
  account_id: number;
  amount: number;
  description?: string;
  reference?: string;
  notes?: string;
  is_recurring?: boolean;
}): Expense {
  const db = getDb();

  const result = db.prepare(`
    INSERT INTO expenses (date, vendor_id, account_id, amount, description, reference, notes, is_recurring)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.date,
    data.vendor_id || null,
    data.account_id,
    data.amount,
    data.description || null,
    data.reference || null,
    data.notes || null,
    data.is_recurring ? 1 : 0
  );

  const expense = getExpense(result.lastInsertRowid as number)!;
  logAudit("create", "expense", expense.id, null, expense);

  return expense;
}

export function getExpense(id: number): Expense | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM expenses WHERE id = ?").get(id) as Expense | undefined;
}

export function listExpenses(options: {
  vendor_id?: number;
  account_id?: number;
  start_date?: string;
  end_date?: string;
  limit?: number;
} = {}): ExpenseWithDetails[] {
  const db = getDb();

  let query = `
    SELECT
      e.*,
      v.name as vendor_name,
      a.name as account_name,
      a.type as category
    FROM expenses e
    LEFT JOIN vendors v ON e.vendor_id = v.id
    LEFT JOIN accounts a ON e.account_id = a.id
    WHERE 1=1
  `;

  const params: (string | number)[] = [];

  if (options.vendor_id) {
    query += " AND e.vendor_id = ?";
    params.push(options.vendor_id);
  }

  if (options.account_id) {
    query += " AND e.account_id = ?";
    params.push(options.account_id);
  }

  if (options.start_date) {
    query += " AND e.date >= ?";
    params.push(options.start_date);
  }

  if (options.end_date) {
    query += " AND e.date <= ?";
    params.push(options.end_date);
  }

  query += " ORDER BY e.date DESC, e.id DESC";

  if (options.limit) {
    query += " LIMIT ?";
    params.push(options.limit);
  }

  return db.prepare(query).all(...params) as ExpenseWithDetails[];
}

export function updateExpense(id: number, data: Partial<Expense>): Expense | undefined {
  const db = getDb();
  const old = getExpense(id);
  if (!old) return undefined;

  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.date !== undefined) { fields.push("date = ?"); values.push(data.date); }
  if (data.vendor_id !== undefined) { fields.push("vendor_id = ?"); values.push(data.vendor_id); }
  if (data.account_id !== undefined) { fields.push("account_id = ?"); values.push(data.account_id); }
  if (data.amount !== undefined) { fields.push("amount = ?"); values.push(data.amount); }
  if (data.description !== undefined) { fields.push("description = ?"); values.push(data.description); }
  if (data.reference !== undefined) { fields.push("reference = ?"); values.push(data.reference); }
  if (data.notes !== undefined) { fields.push("notes = ?"); values.push(data.notes); }

  if (fields.length === 0) return old;

  values.push(id);

  db.prepare(`UPDATE expenses SET ${fields.join(", ")} WHERE id = ?`).run(...values);

  const updated = getExpense(id)!;
  logAudit("update", "expense", id, old, updated);

  return updated;
}

export function deleteExpense(id: number): boolean {
  const db = getDb();
  const expense = getExpense(id);
  if (!expense) return false;

  db.prepare("DELETE FROM expenses WHERE id = ?").run(id);
  logAudit("delete", "expense", id, expense, null);

  return true;
}

export function getExpenseCategories(): { id: number; name: string }[] {
  const db = getDb();
  return db.prepare(`
    SELECT id, name FROM accounts
    WHERE type = 'expense'
    ORDER BY name
  `).all() as { id: number; name: string }[];
}
