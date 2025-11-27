// Journal entries domain logic for double-entry bookkeeping
import { getDb } from "../db/index.js";
import { getAccount, getAccountByCode, type Account } from "./accounts.js";

export interface JournalEntry {
  id: number;
  date: string;
  description: string;
  reference: string | null;
  entry_type: "standard" | "adjusting" | "closing" | "reversing";
  is_locked: number; // SQLite uses 0/1 for boolean
  created_at: string;
  lines: JournalLine[];
  total_debits?: number;
  total_credits?: number;
}

export interface JournalLine {
  id: number;
  entry_id: number;
  account_id: number;
  debit: number;
  credit: number;
  description: string | null;
  account?: Pick<Account, "id" | "code" | "name" | "type">; // Populated with account details
}

export interface CreateJournalEntryData {
  date: string;
  description: string;
  reference?: string | null;
  entry_type?: "standard" | "adjusting" | "closing" | "reversing";
  lines: CreateJournalLineData[];
}

export interface CreateJournalLineData {
  account_id: number;
  debit: number;
  credit: number;
  description?: string | null;
}

export interface UpdateJournalEntryData {
  date?: string;
  description?: string;
  reference?: string | null;
  lines?: CreateJournalLineData[];
}

export interface JournalEntryFilters {
  start_date?: string;
  end_date?: string;
  account_id?: number;
  entry_type?: JournalEntry["entry_type"];
  search?: string;
  reference?: string;
  is_locked?: boolean;
}

// Validate that debits equal credits
export function validateBalance(lines: CreateJournalLineData[]): boolean {
  const totalDebits = lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredits = lines.reduce((sum, line) => sum + line.credit, 0);

  // Allow for small floating point differences (0.01)
  return Math.abs(totalDebits - totalCredits) < 0.01;
}

// Validate journal entry data
export function validateJournalEntry(data: CreateJournalEntryData): void {
  // Check required fields
  if (!data.date) {
    throw new Error("Date is required");
  }
  if (!data.description || data.description.trim().length === 0) {
    throw new Error("Description is required");
  }

  // Check lines exist
  if (!data.lines || data.lines.length === 0) {
    throw new Error("At least one journal line is required");
  }

  // Must have at least 2 lines (double-entry)
  if (data.lines.length < 2) {
    throw new Error("Journal entry must have at least 2 lines (double-entry bookkeeping)");
  }

  // Validate each line
  data.lines.forEach((line, index) => {
    if (!line.account_id) {
      throw new Error(`Line ${index + 1}: Account is required`);
    }

    // Check account exists
    const account = getAccount(line.account_id);
    if (!account) {
      throw new Error(`Line ${index + 1}: Account does not exist`);
    }

    // Must have either debit or credit, but not both
    if (line.debit > 0 && line.credit > 0) {
      throw new Error(`Line ${index + 1}: Cannot have both debit and credit`);
    }
    if (line.debit === 0 && line.credit === 0) {
      throw new Error(`Line ${index + 1}: Must have either debit or credit amount`);
    }
    if (line.debit < 0 || line.credit < 0) {
      throw new Error(`Line ${index + 1}: Amounts cannot be negative`);
    }
  });

  // Validate balance
  if (!validateBalance(data.lines)) {
    const totalDebits = data.lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredits = data.lines.reduce((sum, line) => sum + line.credit, 0);
    throw new Error(
      `Journal entry is not balanced. Debits: $${totalDebits.toFixed(2)}, Credits: $${totalCredits.toFixed(2)}`
    );
  }
}

// Create new journal entry
export function createJournalEntry(data: CreateJournalEntryData): JournalEntry {
  const db = getDb();

  // Validate entry
  validateJournalEntry(data);

  // Insert journal entry
  const entryResult = db
    .prepare(
      `INSERT INTO journal_entries (date, description, reference, entry_type, is_locked)
       VALUES (?, ?, ?, ?, 0)`
    )
    .run(
      data.date,
      data.description,
      data.reference || null,
      data.entry_type || "standard"
    );

  const entryId = entryResult.lastInsertRowid as number;

  // Insert journal lines
  const lineStmt = db.prepare(
    `INSERT INTO journal_lines (entry_id, account_id, debit, credit, description)
     VALUES (?, ?, ?, ?, ?)`
  );

  data.lines.forEach((line) => {
    lineStmt.run(
      entryId,
      line.account_id,
      line.debit,
      line.credit,
      line.description || null
    );
  });

  const entry = getJournalEntry(entryId);
  if (!entry) throw new Error("Failed to create journal entry");

  return entry;
}

// Get single journal entry by ID
export function getJournalEntry(id: number): JournalEntry | null {
  const db = getDb();

  const entry = db
    .prepare("SELECT * FROM journal_entries WHERE id = ?")
    .get(id) as Omit<JournalEntry, "lines"> | undefined;

  if (!entry) return null;

  // Get lines with account details
  interface JournalLineWithAccountRow {
    id: number;
    entry_id: number;
    account_id: number;
    debit: number;
    credit: number;
    description: string | null;
    code: string;
    name: string;
    type: Account["type"];
  }

  const lines = db
    .prepare(
      `SELECT jl.*, a.code, a.name, a.type
       FROM journal_lines jl
       JOIN accounts a ON jl.account_id = a.id
       WHERE jl.entry_id = ?
       ORDER BY jl.id`
    )
    .all(id) as JournalLineWithAccountRow[];

  const linesWithAccounts: JournalLine[] = lines.map((line) => ({
    id: line.id,
    entry_id: line.entry_id,
    account_id: line.account_id,
    debit: line.debit,
    credit: line.credit,
    description: line.description,
    account: {
      id: line.account_id,
      code: line.code,
      name: line.name,
      type: line.type,
    },
  }));

  // Calculate totals
  const total_debits = linesWithAccounts.reduce((sum, line) => sum + line.debit, 0);
  const total_credits = linesWithAccounts.reduce((sum, line) => sum + line.credit, 0);

  return {
    ...entry,
    lines: linesWithAccounts,
    total_debits,
    total_credits,
  };
}

// List journal entries with optional filtering
export function listJournalEntries(filters?: JournalEntryFilters): JournalEntry[] {
  const db = getDb();
  let sql = "SELECT * FROM journal_entries WHERE 1=1";
  const params: (string | number | boolean)[] = [];

  if (filters?.start_date) {
    sql += " AND date >= ?";
    params.push(filters.start_date);
  }

  if (filters?.end_date) {
    sql += " AND date <= ?";
    params.push(filters.end_date);
  }

  if (filters?.entry_type) {
    sql += " AND entry_type = ?";
    params.push(filters.entry_type);
  }

  if (filters?.is_locked !== undefined) {
    sql += " AND is_locked = ?";
    params.push(filters.is_locked ? 1 : 0);
  }

  if (filters?.reference) {
    sql += " AND reference LIKE ?";
    params.push(`%${filters.reference}%`);
  }

  if (filters?.search) {
    sql += " AND (description LIKE ? OR reference LIKE ?)";
    const searchTerm = `%${filters.search}%`;
    params.push(searchTerm, searchTerm);
  }

  // Filter by account if provided
  if (filters?.account_id) {
    sql += ` AND id IN (
      SELECT DISTINCT entry_id
      FROM journal_lines
      WHERE account_id = ?
    )`;
    params.push(filters.account_id);
  }

  sql += " ORDER BY date DESC, id DESC";

  const entries = db.prepare(sql).all(...params) as Omit<JournalEntry, "lines">[];

  // Get lines for each entry
  return entries.map((entry) => {
    const fullEntry = getJournalEntry(entry.id);
    return fullEntry!;
  });
}

// Update existing journal entry
export function updateJournalEntry(
  id: number,
  data: UpdateJournalEntryData
): JournalEntry {
  const db = getDb();

  const entry = getJournalEntry(id);
  if (!entry) {
    throw new Error("Journal entry not found");
  }

  if (entry.is_locked) {
    throw new Error("Cannot update locked journal entry (period is closed)");
  }

  // If updating lines, validate the new entry
  if (data.lines) {
    const updatedData: CreateJournalEntryData = {
      date: data.date || entry.date,
      description: data.description || entry.description,
      reference: data.reference !== undefined ? data.reference : entry.reference,
      lines: data.lines,
    };
    validateJournalEntry(updatedData);
  }

  // Update entry
  const updates: string[] = [];
  const params: (string | number | null)[] = [];

  if (data.date !== undefined) {
    updates.push("date = ?");
    params.push(data.date);
  }
  if (data.description !== undefined) {
    updates.push("description = ?");
    params.push(data.description);
  }
  if (data.reference !== undefined) {
    updates.push("reference = ?");
    params.push(data.reference);
  }

  if (updates.length > 0) {
    params.push(id);
    db.prepare(`UPDATE journal_entries SET ${updates.join(", ")} WHERE id = ?`).run(
      ...params
    );
  }

  // Update lines if provided
  if (data.lines) {
    // Delete existing lines
    db.prepare("DELETE FROM journal_lines WHERE entry_id = ?").run(id);

    // Insert new lines
    const lineStmt = db.prepare(
      `INSERT INTO journal_lines (entry_id, account_id, debit, credit, description)
       VALUES (?, ?, ?, ?, ?)`
    );

    data.lines.forEach((line) => {
      lineStmt.run(
        id,
        line.account_id,
        line.debit,
        line.credit,
        line.description || null
      );
    });
  }

  const updatedEntry = getJournalEntry(id);
  if (!updatedEntry) throw new Error("Failed to update journal entry");

  return updatedEntry;
}

// Delete journal entry
export function deleteJournalEntry(id: number): void {
  const db = getDb();

  const entry = getJournalEntry(id);
  if (!entry) {
    throw new Error("Journal entry not found");
  }

  if (entry.is_locked) {
    throw new Error("Cannot delete locked journal entry (period is closed)");
  }

  // Check if linked to invoices, expenses, or payments
  const linkedInvoices = db
    .prepare("SELECT COUNT(*) as count FROM invoices WHERE journal_entry_id = ?")
    .get(id) as { count: number };

  const linkedExpenses = db
    .prepare("SELECT COUNT(*) as count FROM expenses WHERE journal_entry_id = ?")
    .get(id) as { count: number };

  const linkedPayments = db
    .prepare("SELECT COUNT(*) as count FROM payments WHERE journal_entry_id = ?")
    .get(id) as { count: number };

  if (linkedInvoices.count > 0 || linkedExpenses.count > 0 || linkedPayments.count > 0) {
    throw new Error(
      "Cannot delete journal entry that is linked to invoices, expenses, or payments. " +
      "Delete those transactions first or reverse the entry instead."
    );
  }

  // Delete entry (lines will cascade)
  db.prepare("DELETE FROM journal_entries WHERE id = ?").run(id);
}

// Create a reversing entry
export function reverseJournalEntry(
  id: number,
  reverseDate?: string,
  description?: string
): JournalEntry {
  const originalEntry = getJournalEntry(id);
  if (!originalEntry) {
    throw new Error("Journal entry not found");
  }

  // Create reversed lines (swap debits and credits)
  const reversedLines: CreateJournalLineData[] = originalEntry.lines.map((line) => ({
    account_id: line.account_id,
    debit: line.credit, // Swap
    credit: line.debit, // Swap
    description: line.description,
  }));

  const reverseEntryData: CreateJournalEntryData = {
    date: reverseDate || new Date().toISOString().split("T")[0],
    description: description || `Reversal of: ${originalEntry.description}`,
    reference: originalEntry.reference ? `REV-${originalEntry.reference}` : null,
    entry_type: "reversing",
    lines: reversedLines,
  };

  return createJournalEntry(reverseEntryData);
}

// Lock journal entry (for period closing)
export function lockJournalEntry(id: number): void {
  const db = getDb();
  db.prepare("UPDATE journal_entries SET is_locked = 1 WHERE id = ?").run(id);
}

// Unlock journal entry (requires admin)
export function unlockJournalEntry(id: number): void {
  const db = getDb();
  db.prepare("UPDATE journal_entries SET is_locked = 0 WHERE id = ?").run(id);
}

// Get journal entries for a specific account (general ledger)
export function getGeneralLedger(
  accountId: number,
  startDate?: string,
  endDate?: string,
  limit: number = 100
): Array<{
  date: string;
  entry_id: number;
  description: string;
  reference: string | null;
  debit: number;
  credit: number;
  balance: number;
}> {
  const db = getDb();

  let sql = `
    SELECT
      je.id as entry_id,
      je.date,
      je.description as entry_description,
      je.reference,
      jl.debit,
      jl.credit,
      jl.description as line_description
    FROM journal_lines jl
    JOIN journal_entries je ON jl.entry_id = je.id
    WHERE jl.account_id = ?
  `;

  const params: (string | number)[] = [accountId];

  if (startDate) {
    sql += " AND je.date >= ?";
    params.push(startDate);
  }

  if (endDate) {
    sql += " AND je.date <= ?";
    params.push(endDate);
  }

  sql += " ORDER BY je.date ASC, je.id ASC LIMIT ?";
  params.push(limit);

  const transactions = db.prepare(sql).all(...params) as Array<{
    entry_id: number;
    date: string;
    entry_description: string;
    reference: string | null;
    debit: number;
    credit: number;
    line_description: string | null;
  }>;

  // Calculate running balance
  const account = getAccount(accountId);
  if (!account) throw new Error("Account not found");

  let runningBalance = 0;

  return transactions.map((tx) => {
    // Update running balance based on account type
    if (account.type === "asset" || account.type === "expense") {
      runningBalance += tx.debit - tx.credit;
    } else {
      runningBalance += tx.credit - tx.debit;
    }

    return {
      date: tx.date,
      entry_id: tx.entry_id,
      description: tx.line_description || tx.entry_description,
      reference: tx.reference,
      debit: tx.debit,
      credit: tx.credit,
      balance: runningBalance,
    };
  });
}

// Get trial balance (all account balances)
export function getTrialBalance(asOfDate?: string): Array<{
  account_id: number;
  account_code: string;
  account_name: string;
  account_type: Account["type"];
  debit_balance: number;
  credit_balance: number;
}> {
  const db = getDb();

  let sql = `
    SELECT
      a.id as account_id,
      a.code as account_code,
      a.name as account_name,
      a.type as account_type,
      COALESCE(SUM(jl.debit), 0) as total_debits,
      COALESCE(SUM(jl.credit), 0) as total_credits
    FROM accounts a
    LEFT JOIN journal_lines jl ON a.id = jl.account_id
    LEFT JOIN journal_entries je ON jl.entry_id = je.id
    WHERE a.is_active = 1
  `;

  const params: string[] = [];

  if (asOfDate) {
    sql += " AND (je.date IS NULL OR je.date <= ?)";
    params.push(asOfDate);
  }

  sql += `
    GROUP BY a.id, a.code, a.name, a.type
    HAVING total_debits != 0 OR total_credits != 0
    ORDER BY a.code
  `;

  const results = db.prepare(sql).all(...params) as Array<{
    account_id: number;
    account_code: string;
    account_name: string;
    account_type: Account["type"];
    total_debits: number;
    total_credits: number;
  }>;

  return results.map((row) => {
    let debit_balance = 0;
    let credit_balance = 0;

    // Calculate balance based on account type normal balance
    if (row.account_type === "asset" || row.account_type === "expense") {
      // Debit normal balance
      const balance = row.total_debits - row.total_credits;
      if (balance > 0) {
        debit_balance = balance;
      } else {
        credit_balance = Math.abs(balance);
      }
    } else {
      // Credit normal balance (liability, equity, income)
      const balance = row.total_credits - row.total_debits;
      if (balance > 0) {
        credit_balance = balance;
      } else {
        debit_balance = Math.abs(balance);
      }
    }

    return {
      account_id: row.account_id,
      account_code: row.account_code,
      account_name: row.account_name,
      account_type: row.account_type,
      debit_balance,
      credit_balance,
    };
  });
}

// Verify trial balance is balanced
export function verifyTrialBalance(asOfDate?: string): {
  is_balanced: boolean;
  total_debits: number;
  total_credits: number;
  difference: number;
} {
  const trialBalance = getTrialBalance(asOfDate);

  const total_debits = trialBalance.reduce((sum, row) => sum + row.debit_balance, 0);
  const total_credits = trialBalance.reduce((sum, row) => sum + row.credit_balance, 0);
  const difference = Math.abs(total_debits - total_credits);

  return {
    is_balanced: difference < 0.01, // Allow for small floating point differences
    total_debits,
    total_credits,
    difference,
  };
}

// Search journal entries
export function searchJournalEntries(query: string): JournalEntry[] {
  return listJournalEntries({ search: query });
}

// Get journal entries by date range
export function getJournalEntriesByDateRange(
  startDate: string,
  endDate: string
): JournalEntry[] {
  return listJournalEntries({ start_date: startDate, end_date: endDate });
}

// Get journal entries by reference
export function getJournalEntriesByReference(reference: string): JournalEntry[] {
  return listJournalEntries({ reference });
}
