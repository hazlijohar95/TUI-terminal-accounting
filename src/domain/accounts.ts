// Accounts domain logic for Chart of Accounts management
import { getDb } from "../db/index.js";

export interface Account {
  id: number;
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "income" | "expense";
  parent_id: number | null;
  description: string | null;
  is_active: number; // SQLite uses 0/1 for boolean
  created_at: string;
  balance?: number; // Calculated field
  children?: Account[]; // For hierarchy
}

export interface AccountFilters {
  type?: Account["type"];
  is_active?: boolean;
  parent_id?: number | null;
  search?: string;
}

export interface CreateAccountData {
  code: string;
  name: string;
  type: Account["type"];
  parent_id?: number | null;
  description?: string;
  opening_balance?: number;
}

export interface UpdateAccountData {
  code?: string;
  name?: string;
  type?: Account["type"];
  parent_id?: number | null;
  description?: string;
  is_active?: boolean;
}

// List all accounts with optional filtering
export function listAccounts(filters?: AccountFilters): Account[] {
  const db = getDb();
  let sql = "SELECT * FROM accounts WHERE 1=1";
  const params: (string | number | boolean)[] = [];

  if (filters?.type) {
    sql += " AND type = ?";
    params.push(filters.type);
  }

  if (filters?.is_active !== undefined) {
    sql += " AND is_active = ?";
    params.push(filters.is_active ? 1 : 0);
  }

  if (filters?.parent_id !== undefined) {
    if (filters.parent_id === null) {
      sql += " AND parent_id IS NULL";
    } else {
      sql += " AND parent_id = ?";
      params.push(filters.parent_id);
    }
  }

  if (filters?.search) {
    sql += " AND (code LIKE ? OR name LIKE ?)";
    const searchTerm = `%${filters.search}%`;
    params.push(searchTerm, searchTerm);
  }

  sql += " ORDER BY code ASC";

  const accounts = db.prepare(sql).all(...params) as Account[];

  // Calculate balances for all accounts in a single query (fixes N+1)
  const accountIds = accounts.map(a => a.id);
  const balances = getAccountBalances(accountIds);

  return accounts.map(account => ({
    ...account,
    balance: balances.get(account.id) || 0,
  }));
}

// Get single account by ID
export function getAccount(id: number): Account | null {
  const db = getDb();
  const account = db
    .prepare("SELECT * FROM accounts WHERE id = ?")
    .get(id) as Account | undefined;

  if (!account) return null;

  return {
    ...account,
    balance: getAccountBalance(id),
    children: getChildAccounts(id),
  };
}

// Get account by code
export function getAccountByCode(code: string): Account | null {
  const db = getDb();
  const account = db
    .prepare("SELECT * FROM accounts WHERE code = ?")
    .get(code) as Account | undefined;

  if (!account) return null;

  return {
    ...account,
    balance: getAccountBalance(account.id),
  };
}

// Create new account
export function createAccount(data: CreateAccountData): Account {
  const db = getDb();

  // Validate account code is unique
  if (!validateAccountCode(data.code)) {
    throw new Error(`Account code ${data.code} already exists`);
  }

  // Validate code format (must be numeric and 4 digits)
  if (!/^\d{4}$/.test(data.code)) {
    throw new Error("Account code must be a 4-digit number");
  }

  // Validate parent exists if provided
  if (data.parent_id) {
    const parent = getAccount(data.parent_id);
    if (!parent) {
      throw new Error("Parent account does not exist");
    }
  }

  // Insert account
  const result = db
    .prepare(
      `INSERT INTO accounts (code, name, type, parent_id, description, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`
    )
    .run(
      data.code,
      data.name,
      data.type,
      data.parent_id || null,
      data.description || null
    );

  const accountId = result.lastInsertRowid as number;

  // If opening balance provided, create journal entry
  if (data.opening_balance && data.opening_balance !== 0) {
    createOpeningBalanceEntry(accountId, data.opening_balance);
  }

  const account = getAccount(accountId);
  if (!account) throw new Error("Failed to create account");

  return account;
}

// Update existing account
export function updateAccount(id: number, data: UpdateAccountData): Account {
  const db = getDb();

  const account = getAccount(id);
  if (!account) {
    throw new Error("Account not found");
  }

  // If code is being changed, validate it's unique
  if (data.code && data.code !== account.code) {
    if (!validateAccountCode(data.code)) {
      throw new Error(`Account code ${data.code} already exists`);
    }
    if (!/^\d{4}$/.test(data.code)) {
      throw new Error("Account code must be a 4-digit number");
    }
  }

  // Validate parent exists if provided
  if (data.parent_id) {
    // Prevent circular reference
    if (data.parent_id === id) {
      throw new Error("Account cannot be its own parent");
    }
    const parent = getAccount(data.parent_id);
    if (!parent) {
      throw new Error("Parent account does not exist");
    }
  }

  // Build update query dynamically
  const updates: string[] = [];
  const params: (string | number | boolean | null)[] = [];

  if (data.code !== undefined) {
    updates.push("code = ?");
    params.push(data.code);
  }
  if (data.name !== undefined) {
    updates.push("name = ?");
    params.push(data.name);
  }
  if (data.type !== undefined) {
    updates.push("type = ?");
    params.push(data.type);
  }
  if (data.parent_id !== undefined) {
    updates.push("parent_id = ?");
    params.push(data.parent_id);
  }
  if (data.description !== undefined) {
    updates.push("description = ?");
    params.push(data.description);
  }
  if (data.is_active !== undefined) {
    updates.push("is_active = ?");
    params.push(data.is_active ? 1 : 0);
  }

  if (updates.length > 0) {
    params.push(id);
    db.prepare(`UPDATE accounts SET ${updates.join(", ")} WHERE id = ?`).run(
      ...params
    );
  }

  const updatedAccount = getAccount(id);
  if (!updatedAccount) throw new Error("Failed to update account");

  return updatedAccount;
}

// Soft delete account (deactivate)
export function deleteAccount(id: number): void {
  const db = getDb();

  const account = getAccount(id);
  if (!account) {
    throw new Error("Account not found");
  }

  // Check if account has transactions
  const hasTransactions = db
    .prepare(
      "SELECT COUNT(*) as count FROM journal_lines WHERE account_id = ?"
    )
    .get(id) as { count: number };

  if (hasTransactions.count > 0) {
    throw new Error(
      "Cannot delete account with transactions. Deactivate instead."
    );
  }

  // Check if account has children
  const children = getChildAccounts(id);
  if (children.length > 0) {
    throw new Error("Cannot delete account with sub-accounts");
  }

  // Check if account is used in expenses
  const hasExpenses = db
    .prepare("SELECT COUNT(*) as count FROM expenses WHERE account_id = ?")
    .get(id) as { count: number };

  if (hasExpenses.count > 0) {
    throw new Error("Cannot delete account used in expenses. Deactivate instead.");
  }

  // Safe to delete
  db.prepare("DELETE FROM accounts WHERE id = ?").run(id);
}

// Deactivate account (soft delete)
export function deactivateAccount(id: number): void {
  updateAccount(id, { is_active: false });
}

// Reactivate account
export function activateAccount(id: number): void {
  updateAccount(id, { is_active: true });
}

// Calculate account balance from journal entries
export function getAccountBalance(
  accountId: number,
  asOfDate?: string
): number {
  const balances = getAccountBalances([accountId], asOfDate);
  return balances.get(accountId) || 0;
}

/**
 * Batch calculate account balances - fixes N+1 query problem
 * Calculates all account balances in a single query
 */
export function getAccountBalances(
  accountIds?: number[],
  asOfDate?: string
): Map<number, number> {
  const db = getDb();

  let sql = `
    SELECT
      a.id as account_id,
      a.type,
      COALESCE(SUM(jl.debit), 0) as total_debits,
      COALESCE(SUM(jl.credit), 0) as total_credits
    FROM accounts a
    LEFT JOIN journal_lines jl ON jl.account_id = a.id
    LEFT JOIN journal_entries je ON jl.entry_id = je.id
  `;

  const params: (string | number)[] = [];
  const conditions: string[] = [];

  if (accountIds && accountIds.length > 0) {
    conditions.push(`a.id IN (${accountIds.map(() => "?").join(", ")})`);
    params.push(...accountIds);
  }

  if (asOfDate) {
    conditions.push("(je.date IS NULL OR je.date <= ?)");
    params.push(asOfDate);
  }

  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }

  sql += " GROUP BY a.id, a.type";

  const results = db.prepare(sql).all(...params) as Array<{
    account_id: number;
    type: Account["type"];
    total_debits: number;
    total_credits: number;
  }>;

  const balanceMap = new Map<number, number>();

  for (const row of results) {
    // Calculate balance based on account type
    // Assets, Expenses: Debit balance (debits - credits)
    // Liabilities, Equity, Income: Credit balance (credits - debits)
    if (row.type === "asset" || row.type === "expense") {
      balanceMap.set(row.account_id, row.total_debits - row.total_credits);
    } else {
      balanceMap.set(row.account_id, row.total_credits - row.total_debits);
    }
  }

  return balanceMap;
}

// Get account hierarchy (tree structure)
export function getAccountHierarchy(): Account[] {
  const allAccounts = listAccounts({ is_active: true });

  // Build tree structure
  const accountMap = new Map<number, Account>();
  const rootAccounts: Account[] = [];

  // First pass: create map and initialize children arrays
  allAccounts.forEach(account => {
    accountMap.set(account.id, { ...account, children: [] });
  });

  // Second pass: build hierarchy
  allAccounts.forEach(account => {
    const accountWithChildren = accountMap.get(account.id)!;
    if (account.parent_id === null) {
      rootAccounts.push(accountWithChildren);
    } else {
      const parent = accountMap.get(account.parent_id);
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(accountWithChildren);
      }
    }
  });

  return rootAccounts;
}

// Get child accounts
export function getChildAccounts(parentId: number): Account[] {
  return listAccounts({ parent_id: parentId, is_active: true });
}

// Get accounts by type
export function getAccountsByType(type: Account["type"]): Account[] {
  return listAccounts({ type, is_active: true });
}

// Validate account code is unique
export function validateAccountCode(code: string, excludeId?: number): boolean {
  const db = getDb();
  let sql = "SELECT COUNT(*) as count FROM accounts WHERE code = ?";
  const params: (string | number)[] = [code];

  if (excludeId) {
    sql += " AND id != ?";
    params.push(excludeId);
  }

  const result = db.prepare(sql).get(...params) as { count: number };
  return result.count === 0;
}

// Get account transaction history
export function getAccountTransactions(
  accountId: number,
  limit: number = 50
): Array<{
  date: string;
  description: string;
  reference: string | null;
  debit: number;
  credit: number;
  balance: number;
}> {
  const db = getDb();

  const transactions = db
    .prepare(
      `
    SELECT
      je.date,
      jl.description as line_description,
      je.description as entry_description,
      je.reference,
      jl.debit,
      jl.credit
    FROM journal_lines jl
    JOIN journal_entries je ON jl.entry_id = je.id
    WHERE jl.account_id = ?
    ORDER BY je.date DESC, je.id DESC
    LIMIT ?
  `
    )
    .all(accountId, limit) as Array<{
    date: string;
    line_description: string | null;
    entry_description: string;
    reference: string | null;
    debit: number;
    credit: number;
  }>;

  // Calculate running balance
  let runningBalance = 0;
  const account = db
    .prepare("SELECT type FROM accounts WHERE id = ?")
    .get(accountId) as { type: Account["type"] };

  return transactions.reverse().map(tx => {
    if (account.type === "asset" || account.type === "expense") {
      runningBalance += tx.debit - tx.credit;
    } else {
      runningBalance += tx.credit - tx.debit;
    }

    return {
      date: tx.date,
      description: tx.line_description || tx.entry_description,
      reference: tx.reference,
      debit: tx.debit,
      credit: tx.credit,
      balance: runningBalance,
    };
  });
}

// Get accounts grouped by thousands (for display)
export function getAccountsGrouped(): Record<
  string,
  { label: string; type: Account["type"]; accounts: Account[] }
> {
  const accounts = listAccounts({ is_active: true });
  const grouped: Record<
    string,
    { label: string; type: Account["type"]; accounts: Account[] }
  > = {};

  accounts.forEach(account => {
    // Determine group by first digit of code
    const firstDigit = account.code[0];
    let groupKey: string;
    let groupLabel: string;
    let groupType: Account["type"];

    switch (firstDigit) {
      case "1":
        groupKey = "1000s";
        groupLabel = "Assets";
        groupType = "asset";
        break;
      case "2":
        groupKey = "2000s";
        groupLabel = "Liabilities";
        groupType = "liability";
        break;
      case "3":
        groupKey = "3000s";
        groupLabel = "Equity";
        groupType = "equity";
        break;
      case "4":
        groupKey = "4000s";
        groupLabel = "Income";
        groupType = "income";
        break;
      case "5":
      case "6":
        groupKey = "5000s";
        groupLabel = "Expenses";
        groupType = "expense";
        break;
      default:
        groupKey = "other";
        groupLabel = "Other";
        groupType = account.type;
    }

    if (!grouped[groupKey]) {
      grouped[groupKey] = {
        label: groupLabel,
        type: groupType,
        accounts: [],
      };
    }

    grouped[groupKey].accounts.push(account);
  });

  return grouped;
}

// Create opening balance journal entry
function createOpeningBalanceEntry(
  accountId: number,
  amount: number
): void {
  const db = getDb();

  const account = getAccount(accountId);
  if (!account) return;

  // Create journal entry for opening balance
  const entryResult = db
    .prepare(
      `INSERT INTO journal_entries (date, description, reference)
       VALUES (?, ?, ?)`
    )
    .run(
      new Date().toISOString().split("T")[0],
      `Opening balance for ${account.name}`,
      "OPENING"
    );

  const entryId = entryResult.lastInsertRowid as number;

  // Determine debit/credit based on account type and amount sign
  let debit = 0;
  let credit = 0;

  if (account.type === "asset" || account.type === "expense") {
    // Assets and expenses increase with debits
    if (amount > 0) {
      debit = amount;
    } else {
      credit = Math.abs(amount);
    }
  } else {
    // Liabilities, equity, income increase with credits
    if (amount > 0) {
      credit = amount;
    } else {
      debit = Math.abs(amount);
    }
  }

  // Create journal lines (one for account, one for equity)
  db.prepare(
    `INSERT INTO journal_lines (entry_id, account_id, debit, credit, description)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    entryId,
    accountId,
    debit,
    credit,
    `Opening balance for ${account.name}`
  );

  // Offsetting entry to equity account (3100 - Retained Earnings)
  const equityAccount = getAccountByCode("3100");
  if (equityAccount) {
    db.prepare(
      `INSERT INTO journal_lines (entry_id, account_id, debit, credit, description)
       VALUES (?, ?, ?, ?, ?)`
    ).run(
      entryId,
      equityAccount.id,
      credit, // Reverse of above
      debit,
      `Opening balance offset`
    );
  }
}

// Get total assets (for dashboard)
export function getTotalAssets(): number {
  const assets = getAccountsByType("asset");
  return assets.reduce((sum, account) => sum + (account.balance || 0), 0);
}

// Get total liabilities (for dashboard)
export function getTotalLiabilities(): number {
  const liabilities = getAccountsByType("liability");
  return liabilities.reduce((sum, account) => sum + (account.balance || 0), 0);
}

// Get total equity (for dashboard)
export function getTotalEquity(): number {
  const equity = getAccountsByType("equity");
  return equity.reduce((sum, account) => sum + (account.balance || 0), 0);
}

// Search accounts by name or code
export function searchAccounts(query: string): Account[] {
  return listAccounts({ search: query });
}
