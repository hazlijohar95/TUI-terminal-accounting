import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import type { LHDNSettings } from "../services/myinvois/types.js";
import { encrypt, decrypt } from "./encryption.js";

const DB_PATH = "oa.db";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const dir = dirname(DB_PATH);
    if (dir && dir !== "." && !existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");

    initSchema(db);
    runMigrations(db);
  }
  return db;
}

function runMigrations(db: Database.Database): void {
  // Add documents table if it doesn't exist
  const documentsExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='documents'"
  ).get();

  if (!documentsExists) {
    db.exec(`
      CREATE TABLE documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'processed', 'failed')),
        doc_type TEXT CHECK (doc_type IN ('receipt', 'invoice', 'statement', 'contract', 'other')),
        extracted_data TEXT,
        expense_id INTEGER REFERENCES expenses(id),
        invoice_id INTEGER REFERENCES invoices(id),
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        processed_at TEXT
      );

      CREATE INDEX idx_documents_status ON documents(status);
      CREATE INDEX idx_documents_expense ON documents(expense_id);
      CREATE INDEX idx_documents_invoice ON documents(invoice_id);
    `);
  }

  // Add agent memory tables if they don't exist
  const memoriesExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='agent_memories'"
  ).get();

  if (!memoriesExists) {
    db.exec(`
      -- Long-term conversation memory with vector embeddings
      CREATE TABLE agent_memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        embedding BLOB NOT NULL,
        memory_type TEXT NOT NULL CHECK (memory_type IN ('conversation', 'fact', 'preference', 'task')),
        source_message_id TEXT,
        importance REAL DEFAULT 0.5 CHECK (importance >= 0 AND importance <= 1),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        last_accessed_at TEXT,
        access_count INTEGER DEFAULT 0
      );

      -- Indexes for efficient retrieval
      CREATE INDEX idx_memories_type ON agent_memories(memory_type);
      CREATE INDEX idx_memories_importance ON agent_memories(importance DESC);
      CREATE INDEX idx_memories_created ON agent_memories(created_at DESC);

      -- User preferences learned over time
      CREATE TABLE agent_user_preferences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        confidence REAL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
        source TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX idx_preferences_key ON agent_user_preferences(key);
    `);
  }

  // Add email tracking columns to invoices
  const hasEmailSentAt = db.prepare(
    "SELECT COUNT(*) as count FROM pragma_table_info('invoices') WHERE name='email_sent_at'"
  ).get() as { count: number };

  if (hasEmailSentAt.count === 0) {
    db.exec(`
      ALTER TABLE invoices ADD COLUMN email_sent_at TEXT;
      ALTER TABLE invoices ADD COLUMN reminder_sent_at TEXT;
    `);
  }

  // Add email settings if not present
  const hasResendKey = db.prepare(
    "SELECT COUNT(*) as count FROM settings WHERE key='resend_api_key'"
  ).get() as { count: number };

  if (hasResendKey.count === 0) {
    db.exec(`
      INSERT INTO settings (key, value) VALUES
        ('resend_api_key', ''),
        ('from_email', ''),
        ('reply_to', '');
    `);
  }

  // Add e-invoice columns to invoices table (LHDN MyInvois)
  const hasEinvoiceStatus = db.prepare(
    "SELECT COUNT(*) as count FROM pragma_table_info('invoices') WHERE name='einvoice_status'"
  ).get() as { count: number };

  if (hasEinvoiceStatus.count === 0) {
    db.exec(`
      ALTER TABLE invoices ADD COLUMN einvoice_status TEXT DEFAULT 'none'
        CHECK (einvoice_status IN ('none', 'pending', 'submitted', 'valid', 'invalid', 'cancelled', 'rejected'));
      ALTER TABLE invoices ADD COLUMN einvoice_uuid TEXT;
      ALTER TABLE invoices ADD COLUMN einvoice_long_id TEXT;
      ALTER TABLE invoices ADD COLUMN einvoice_submission_uid TEXT;
      ALTER TABLE invoices ADD COLUMN einvoice_submitted_at TEXT;
      ALTER TABLE invoices ADD COLUMN einvoice_validated_at TEXT;
      ALTER TABLE invoices ADD COLUMN einvoice_error TEXT;
    `);

    // Create index for e-invoice status
    db.exec(`CREATE INDEX IF NOT EXISTS idx_invoices_einvoice_status ON invoices(einvoice_status);`);
  }

  // Add LHDN-specific fields to customers table
  const hasCustomerTin = db.prepare(
    "SELECT COUNT(*) as count FROM pragma_table_info('customers') WHERE name='tin'"
  ).get() as { count: number };

  if (hasCustomerTin.count === 0) {
    db.exec(`
      ALTER TABLE customers ADD COLUMN tin TEXT;
      ALTER TABLE customers ADD COLUMN id_type TEXT DEFAULT 'NRIC'
        CHECK (id_type IN ('NRIC', 'PASSPORT', 'BRN', 'ARMY'));
      ALTER TABLE customers ADD COLUMN id_number TEXT;
      ALTER TABLE customers ADD COLUMN sst_registration TEXT;
    `);
  }

  // Add LHDN invoice-level fields (currency, payment mode)
  const hasInvoiceCurrency = db.prepare(
    "SELECT COUNT(*) as count FROM pragma_table_info('invoices') WHERE name='currency_code'"
  ).get() as { count: number };

  if (hasInvoiceCurrency.count === 0) {
    db.exec(`
      ALTER TABLE invoices ADD COLUMN currency_code TEXT DEFAULT 'MYR';
      ALTER TABLE invoices ADD COLUMN payment_mode TEXT DEFAULT '03';
    `);
  }

  // Add LHDN item-level fields (classification, tax type, unit code)
  const hasItemClassification = db.prepare(
    "SELECT COUNT(*) as count FROM pragma_table_info('invoice_items') WHERE name='classification_code'"
  ).get() as { count: number };

  if (hasItemClassification.count === 0) {
    db.exec(`
      ALTER TABLE invoice_items ADD COLUMN classification_code TEXT DEFAULT '002';
      ALTER TABLE invoice_items ADD COLUMN tax_type TEXT DEFAULT 'E';
      ALTER TABLE invoice_items ADD COLUMN unit_code TEXT DEFAULT 'EA';
    `);
  }

  // Add credit/debit note support fields
  const hasDocumentType = db.prepare(
    "SELECT COUNT(*) as count FROM pragma_table_info('invoices') WHERE name='document_type'"
  ).get() as { count: number };

  if (hasDocumentType.count === 0) {
    db.exec(`
      ALTER TABLE invoices ADD COLUMN document_type TEXT DEFAULT '01' CHECK (document_type IN ('01', '02', '03'));
      ALTER TABLE invoices ADD COLUMN original_invoice_id INTEGER REFERENCES invoices(id);
    `);
  }

  // Create LHDN settings table
  const lhdnSettingsExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='lhdn_settings'"
  ).get();

  if (!lhdnSettingsExists) {
    db.exec(`
      CREATE TABLE lhdn_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        environment TEXT DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
        client_id TEXT,
        client_secret TEXT,
        tin TEXT,
        brn TEXT,
        msic_code TEXT,
        business_activity TEXT,
        certificate_path TEXT,
        certificate_password TEXT,
        auto_submit INTEGER DEFAULT 0,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Insert default row
      INSERT INTO lhdn_settings (id) VALUES (1);
    `);
  }

  // Add missing LHDN settings columns (migration for existing databases)
  const hasLHDNCity = db.prepare(
    "SELECT COUNT(*) as count FROM pragma_table_info('lhdn_settings') WHERE name='city'"
  ).get() as { count: number };

  if (hasLHDNCity.count === 0) {
    db.exec(`
      ALTER TABLE lhdn_settings ADD COLUMN sst_registration TEXT;
      ALTER TABLE lhdn_settings ADD COLUMN tourism_tax_registration TEXT;
      ALTER TABLE lhdn_settings ADD COLUMN supplier_email TEXT;
      ALTER TABLE lhdn_settings ADD COLUMN supplier_phone TEXT;
      ALTER TABLE lhdn_settings ADD COLUMN address_line1 TEXT;
      ALTER TABLE lhdn_settings ADD COLUMN address_line2 TEXT;
      ALTER TABLE lhdn_settings ADD COLUMN address_line3 TEXT;
      ALTER TABLE lhdn_settings ADD COLUMN postal_code TEXT;
      ALTER TABLE lhdn_settings ADD COLUMN city TEXT;
      ALTER TABLE lhdn_settings ADD COLUMN state TEXT;
      ALTER TABLE lhdn_settings ADD COLUMN country TEXT DEFAULT 'MYS';
    `);
  }

  // Create e-invoice submissions log table
  const einvoiceSubmissionsExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='einvoice_submissions'"
  ).get();

  if (!einvoiceSubmissionsExists) {
    db.exec(`
      CREATE TABLE einvoice_submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER NOT NULL REFERENCES invoices(id),
        submission_uid TEXT,
        uuid TEXT,
        long_id TEXT,
        status TEXT NOT NULL,
        request_payload TEXT,
        response_payload TEXT,
        error_code TEXT,
        error_message TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX idx_einvoice_submissions_invoice ON einvoice_submissions(invoice_id);
      CREATE INDEX idx_einvoice_submissions_uuid ON einvoice_submissions(uuid);
    `);
  }

  // Add Sales Tax Payable account if missing (needed for invoice journal entries)
  const hasTaxAccount = db.prepare(
    "SELECT COUNT(*) as count FROM accounts WHERE code = '2300'"
  ).get() as { count: number };

  if (hasTaxAccount.count === 0) {
    db.exec(`
      INSERT INTO accounts (code, name, type) VALUES ('2300', 'Sales Tax Payable', 'liability');
    `);
  }

  // Add bank reconciliation columns to payments (migration for existing databases)
  const hasPaymentCleared = db.prepare(
    "SELECT COUNT(*) as count FROM pragma_table_info('payments') WHERE name='cleared_at'"
  ).get() as { count: number };

  if (hasPaymentCleared.count === 0) {
    db.exec(`
      ALTER TABLE payments ADD COLUMN cleared_at TEXT;
      ALTER TABLE payments ADD COLUMN bank_reference TEXT;
      ALTER TABLE payments ADD COLUMN reconciled INTEGER DEFAULT 0;
    `);

    // Create index for unreconciled payments
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_payments_reconciled ON payments(reconciled);
    `);
  }

  // Create categorization_rules table if it doesn't exist (migration for existing databases)
  const categorizationRulesExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='categorization_rules'"
  ).get();

  if (!categorizationRulesExists) {
    db.exec(`
      CREATE TABLE categorization_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pattern TEXT NOT NULL,
        vendor_pattern TEXT,
        account_id INTEGER NOT NULL REFERENCES accounts(id),
        priority INTEGER DEFAULT 0,
        match_count INTEGER DEFAULT 0,
        last_matched_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX idx_categorization_rules_account ON categorization_rules(account_id);
      CREATE INDEX idx_categorization_rules_priority ON categorization_rules(priority DESC);
    `);
  }

  // Create bank_statements and bank_transactions tables (migration for existing databases)
  const bankStatementsExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='bank_statements'"
  ).get();

  if (!bankStatementsExists) {
    db.exec(`
      CREATE TABLE bank_statements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL REFERENCES accounts(id),
        statement_date TEXT NOT NULL,
        opening_balance REAL NOT NULL,
        closing_balance REAL NOT NULL,
        filename TEXT,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reconciling', 'reconciled')),
        reconciled_at TEXT,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE bank_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        statement_id INTEGER REFERENCES bank_statements(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
        reference TEXT,
        balance_after REAL,
        matched_payment_id INTEGER REFERENCES payments(id),
        matched_expense_id INTEGER REFERENCES expenses(id),
        match_status TEXT DEFAULT 'unmatched' CHECK (match_status IN ('unmatched', 'auto_matched', 'manual_matched', 'ignored')),
        match_confidence REAL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX idx_bank_statements_account ON bank_statements(account_id);
      CREATE INDEX idx_bank_statements_date ON bank_statements(statement_date);
      CREATE INDEX idx_bank_transactions_statement ON bank_transactions(statement_id);
      CREATE INDEX idx_bank_transactions_date ON bank_transactions(date);
      CREATE INDEX idx_bank_transactions_status ON bank_transactions(match_status);
      CREATE INDEX idx_bank_transactions_payment ON bank_transactions(matched_payment_id);
      CREATE INDEX idx_bank_transactions_expense ON bank_transactions(matched_expense_id);
    `);
  }

  // Create agent_actions table (migration for existing databases)
  const agentActionsExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='agent_actions'"
  ).get();

  if (!agentActionsExists) {
    db.exec(`
      CREATE TABLE agent_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        category TEXT NOT NULL CHECK (category IN ('read', 'create', 'update', 'delete', 'external', 'financial')),
        risk_level TEXT NOT NULL CHECK (risk_level IN ('none', 'low', 'medium', 'high', 'critical')),
        input_summary TEXT,
        output_summary TEXT,
        success INTEGER NOT NULL DEFAULT 1,
        error_message TEXT,
        execution_time_ms INTEGER,
        requires_review INTEGER DEFAULT 0,
        reviewed_at TEXT,
        reviewed_by TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX idx_agent_actions_session ON agent_actions(session_id);
      CREATE INDEX idx_agent_actions_tool ON agent_actions(tool_name);
      CREATE INDEX idx_agent_actions_created ON agent_actions(created_at);
      CREATE INDEX idx_agent_actions_review ON agent_actions(requires_review, reviewed_at);
    `);
  }

  // Add composite indexes for common query patterns (migration for existing databases)
  const hasCompositeIndexes = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_invoices_status_date'"
  ).get();

  if (!hasCompositeIndexes) {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_invoices_status_date ON invoices(status, date DESC);
      CREATE INDEX IF NOT EXISTS idx_payments_date_type ON payments(date DESC, type);
      CREATE INDEX IF NOT EXISTS idx_expenses_date_account ON expenses(date DESC, account_id);
      CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON journal_lines(account_id);
    `);
  }
}

function initSchema(db: Database.Database): void {
  // Check if already initialized
  const tableExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='settings'"
  ).get();

  if (tableExists) return;

  db.exec(`
    -- Settings
    CREATE TABLE settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Customers
    CREATE TABLE customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      email TEXT,
      phone TEXT,
      address TEXT,
      tax_id TEXT,
      payment_terms TEXT DEFAULT 'net_30',
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Vendors
    CREATE TABLE vendors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      email TEXT,
      phone TEXT,
      address TEXT,
      tax_id TEXT,
      default_category TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Accounts (Chart of Accounts)
    CREATE TABLE accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'income', 'expense')),
      parent_id INTEGER REFERENCES accounts(id),
      description TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Invoices
    CREATE TABLE invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number TEXT NOT NULL UNIQUE,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      date TEXT NOT NULL,
      due_date TEXT NOT NULL,
      status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'partial', 'paid', 'overdue', 'cancelled')),
      subtotal REAL NOT NULL DEFAULT 0,
      tax_rate REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      amount_paid REAL DEFAULT 0,
      payment_terms TEXT,
      notes TEXT,
      journal_entry_id INTEGER REFERENCES journal_entries(id),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Invoice Line Items
    CREATE TABLE invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL,
      amount REAL NOT NULL,
      account_id INTEGER REFERENCES accounts(id),
      sort_order INTEGER DEFAULT 0
    );

    -- Payments
    CREATE TABLE payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('received', 'sent')),
      amount REAL NOT NULL,
      method TEXT DEFAULT 'bank' CHECK (method IN ('cash', 'bank', 'card', 'check', 'other')),
      reference TEXT,
      customer_id INTEGER REFERENCES customers(id),
      vendor_id INTEGER REFERENCES vendors(id),
      invoice_id INTEGER REFERENCES invoices(id),
      account_id INTEGER REFERENCES accounts(id),
      notes TEXT,
      journal_entry_id INTEGER REFERENCES journal_entries(id),
      cleared_at TEXT,
      bank_reference TEXT,
      reconciled INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Expenses
    CREATE TABLE expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      vendor_id INTEGER REFERENCES vendors(id),
      account_id INTEGER NOT NULL REFERENCES accounts(id),
      amount REAL NOT NULL,
      description TEXT,
      reference TEXT,
      payment_id INTEGER REFERENCES payments(id),
      is_recurring INTEGER DEFAULT 0,
      notes TEXT,
      journal_entry_id INTEGER REFERENCES journal_entries(id),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Journal Entries (for manual adjustments)
    CREATE TABLE journal_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      reference TEXT,
      entry_type TEXT DEFAULT 'standard' CHECK (entry_type IN ('standard', 'adjusting', 'closing', 'reversing')),
      is_locked INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Journal Entry Lines
    CREATE TABLE journal_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id INTEGER NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
      account_id INTEGER NOT NULL REFERENCES accounts(id),
      debit REAL DEFAULT 0,
      credit REAL DEFAULT 0,
      description TEXT
    );

    -- Audit Log
    CREATE TABLE audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      old_value TEXT,
      new_value TEXT,
      user TEXT
    );

    -- Documents (for receipts, statements, etc.)
    CREATE TABLE documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'processed', 'failed')),
      doc_type TEXT CHECK (doc_type IN ('receipt', 'invoice', 'statement', 'contract', 'other')),
      extracted_data TEXT,
      expense_id INTEGER REFERENCES expenses(id),
      invoice_id INTEGER REFERENCES invoices(id),
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      processed_at TEXT
    );

    -- Bank Statements (imported from bank)
    CREATE TABLE bank_statements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL REFERENCES accounts(id),
      statement_date TEXT NOT NULL,
      opening_balance REAL NOT NULL,
      closing_balance REAL NOT NULL,
      filename TEXT,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reconciling', 'reconciled')),
      reconciled_at TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Bank Transactions (from bank statements)
    CREATE TABLE bank_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      statement_id INTEGER REFERENCES bank_statements(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
      reference TEXT,
      balance_after REAL,
      matched_payment_id INTEGER REFERENCES payments(id),
      matched_expense_id INTEGER REFERENCES expenses(id),
      match_status TEXT DEFAULT 'unmatched' CHECK (match_status IN ('unmatched', 'auto_matched', 'manual_matched', 'ignored')),
      match_confidence REAL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Categorization Rules (for auto-categorizing expenses)
    CREATE TABLE categorization_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pattern TEXT NOT NULL,
      vendor_pattern TEXT,
      account_id INTEGER NOT NULL REFERENCES accounts(id),
      priority INTEGER DEFAULT 0,
      match_count INTEGER DEFAULT 0,
      last_matched_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Agent Actions (for tracking agent autonomous actions)
    CREATE TABLE agent_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('read', 'create', 'update', 'delete', 'external', 'financial')),
      risk_level TEXT NOT NULL CHECK (risk_level IN ('none', 'low', 'medium', 'high', 'critical')),
      input_summary TEXT,
      output_summary TEXT,
      success INTEGER NOT NULL DEFAULT 1,
      error_message TEXT,
      execution_time_ms INTEGER,
      requires_review INTEGER DEFAULT 0,
      reviewed_at TEXT,
      reviewed_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Indexes
    CREATE INDEX idx_invoices_customer ON invoices(customer_id);
    CREATE INDEX idx_invoices_status ON invoices(status);
    CREATE INDEX idx_invoices_date ON invoices(date);
    CREATE INDEX idx_payments_date ON payments(date);
    CREATE INDEX idx_expenses_date ON expenses(date);
    CREATE INDEX idx_expenses_account ON expenses(account_id);
    CREATE INDEX idx_categorization_rules_account ON categorization_rules(account_id);
    CREATE INDEX idx_categorization_rules_priority ON categorization_rules(priority DESC);
    CREATE INDEX idx_bank_statements_account ON bank_statements(account_id);
    CREATE INDEX idx_bank_statements_date ON bank_statements(statement_date);
    CREATE INDEX idx_bank_transactions_statement ON bank_transactions(statement_id);
    CREATE INDEX idx_bank_transactions_date ON bank_transactions(date);
    CREATE INDEX idx_bank_transactions_status ON bank_transactions(match_status);
    CREATE INDEX idx_bank_transactions_payment ON bank_transactions(matched_payment_id);
    CREATE INDEX idx_bank_transactions_expense ON bank_transactions(matched_expense_id);
    CREATE INDEX idx_agent_actions_session ON agent_actions(session_id);
    CREATE INDEX idx_agent_actions_tool ON agent_actions(tool_name);
    CREATE INDEX idx_agent_actions_created ON agent_actions(created_at);
    CREATE INDEX idx_agent_actions_review ON agent_actions(requires_review, reviewed_at);

    -- Composite indexes for common query patterns
    CREATE INDEX idx_invoices_status_date ON invoices(status, date DESC);
    CREATE INDEX idx_payments_date_type ON payments(date DESC, type);
    CREATE INDEX idx_expenses_date_account ON expenses(date DESC, account_id);
    CREATE INDEX idx_journal_lines_account ON journal_lines(account_id);

    -- Default settings
    INSERT INTO settings (key, value) VALUES
      ('business_name', 'My Business'),
      ('entity_type', ''),
      ('owner_name', ''),
      ('fiscal_year_end', '12'),
      ('currency', 'USD'),
      ('tax_rate', '0'),
      ('invoice_prefix', 'INV'),
      ('next_invoice_number', '1'),
      ('default_payment_terms', 'net_30'),
      ('theme', 'dark');

    -- Default chart of accounts
    INSERT INTO accounts (code, name, type) VALUES
      ('1000', 'Cash', 'asset'),
      ('1100', 'Bank Account', 'asset'),
      ('1200', 'Accounts Receivable', 'asset'),
      ('2000', 'Accounts Payable', 'liability'),
      ('2100', 'Credit Card', 'liability'),
      ('3000', 'Owner Equity', 'equity'),
      ('3100', 'Retained Earnings', 'equity'),
      ('4000', 'Sales Revenue', 'income'),
      ('4100', 'Service Revenue', 'income'),
      ('4200', 'Other Income', 'income'),
      ('5000', 'Cost of Goods Sold', 'expense'),
      ('5100', 'Advertising', 'expense'),
      ('5200', 'Bank Fees', 'expense'),
      ('5300', 'Insurance', 'expense'),
      ('5400', 'Office Supplies', 'expense'),
      ('5500', 'Professional Services', 'expense'),
      ('5600', 'Rent', 'expense'),
      ('5700', 'Software & Subscriptions', 'expense'),
      ('5800', 'Travel', 'expense'),
      ('5900', 'Utilities', 'expense'),
      ('6000', 'Meals & Entertainment', 'expense'),
      ('6100', 'Other Expenses', 'expense');
  `);
}

// Sensitive setting keys that should be encrypted
const ENCRYPTED_SETTINGS = ["resend_api_key"];

// Helper to get setting
export function getSetting(key: string): string | undefined {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  if (!row?.value) return row?.value;

  // Decrypt if this is a sensitive setting
  if (ENCRYPTED_SETTINGS.includes(key)) {
    return decrypt(row.value);
  }
  return row.value;
}

// Helper to set setting
export function setSetting(key: string, value: string): void {
  // Encrypt if this is a sensitive setting
  const storedValue = ENCRYPTED_SETTINGS.includes(key) ? encrypt(value) : value;
  getDb().prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, storedValue);
}

// LHDN Settings
export interface LHDNSettingsRow {
  id: number;
  environment: "sandbox" | "production";
  client_id: string | null;
  client_secret: string | null;
  tin: string | null;
  brn: string | null;
  msic_code: string | null;
  business_activity: string | null;
  certificate_path: string | null;
  certificate_password: string | null;
  auto_submit: number;
  sst_registration: string | null;
  tourism_tax_registration: string | null;
  supplier_email: string | null;
  supplier_phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  address_line3: string | null;
  postal_code: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  updated_at: string;
}

// Re-export for convenience
export type { LHDNSettings };

export function getLHDNSettings(): LHDNSettings | null {
  const row = getDb().prepare("SELECT * FROM lhdn_settings WHERE id = 1").get() as LHDNSettingsRow | undefined;
  if (!row) return null;

  // Only return if required fields are set
  if (!row.tin || !row.msic_code) {
    return null;
  }

  // Decrypt sensitive fields
  const clientSecret = row.client_secret ? decrypt(row.client_secret) : undefined;
  const certificatePassword = row.certificate_password ? decrypt(row.certificate_password) : undefined;

  return {
    tin: row.tin,
    brn: row.brn || undefined,
    sstRegistration: row.sst_registration || undefined,
    tourismTaxRegistration: row.tourism_tax_registration || undefined,
    msicCode: row.msic_code,
    businessActivityDescription: row.business_activity || "",
    supplierEmail: row.supplier_email || undefined,
    supplierPhone: row.supplier_phone || undefined,
    addressLine1: row.address_line1 || "",
    addressLine2: row.address_line2 || undefined,
    addressLine3: row.address_line3 || undefined,
    postalCode: row.postal_code || "",
    city: row.city || "",
    state: row.state || "",
    country: row.country || "MYS",
    clientId: row.client_id || undefined,
    clientSecret,
    certificatePath: row.certificate_path || undefined,
    certificatePassword,
    environment: row.environment || "sandbox",
    autoSubmit: row.auto_submit === 1,
  };
}

export function saveLHDNSettings(settings: Partial<LHDNSettings>): void {
  const db = getDb();

  // Encrypt sensitive fields before saving
  const encryptedClientSecret = settings.clientSecret ? encrypt(settings.clientSecret) : undefined;
  const encryptedCertPassword = settings.certificatePassword ? encrypt(settings.certificatePassword) : undefined;

  db.prepare(`
    UPDATE lhdn_settings SET
      tin = COALESCE(?, tin),
      brn = COALESCE(?, brn),
      sst_registration = COALESCE(?, sst_registration),
      tourism_tax_registration = COALESCE(?, tourism_tax_registration),
      msic_code = COALESCE(?, msic_code),
      business_activity = COALESCE(?, business_activity),
      supplier_email = COALESCE(?, supplier_email),
      supplier_phone = COALESCE(?, supplier_phone),
      address_line1 = COALESCE(?, address_line1),
      address_line2 = COALESCE(?, address_line2),
      address_line3 = COALESCE(?, address_line3),
      postal_code = COALESCE(?, postal_code),
      city = COALESCE(?, city),
      state = COALESCE(?, state),
      country = COALESCE(?, country),
      client_id = COALESCE(?, client_id),
      client_secret = COALESCE(?, client_secret),
      certificate_path = COALESCE(?, certificate_path),
      certificate_password = COALESCE(?, certificate_password),
      environment = COALESCE(?, environment),
      auto_submit = COALESCE(?, auto_submit),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `).run(
    settings.tin,
    settings.brn,
    settings.sstRegistration,
    settings.tourismTaxRegistration,
    settings.msicCode,
    settings.businessActivityDescription,
    settings.supplierEmail,
    settings.supplierPhone,
    settings.addressLine1,
    settings.addressLine2,
    settings.addressLine3,
    settings.postalCode,
    settings.city,
    settings.state,
    settings.country,
    settings.clientId,
    encryptedClientSecret,
    settings.certificatePath,
    encryptedCertPassword,
    settings.environment,
    settings.autoSubmit !== undefined ? (settings.autoSubmit ? 1 : 0) : undefined
  );
}

// Audit logging
export function logAudit(action: string, entityType: string, entityId: number | null, oldValue?: unknown, newValue?: unknown): void {
  getDb().prepare(`
    INSERT INTO audit_log (action, entity_type, entity_id, old_value, new_value)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    action,
    entityType,
    entityId,
    oldValue ? JSON.stringify(oldValue) : null,
    newValue ? JSON.stringify(newValue) : null
  );
}

// Close database
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Execute multiple operations in a single transaction
 * Automatically rolls back on error and re-throws
 *
 * @example
 * withTransaction(() => {
 *   recordPayment(paymentData);
 *   createJournalEntry(journalData);
 *   updateInvoiceStatus(invoiceId, 'paid');
 * });
 */
export function withTransaction<T>(fn: () => T): T {
  const db = getDb();
  const transaction = db.transaction(() => fn());
  return transaction();
}

/**
 * Execute an async operation with transaction-like behavior
 * Note: SQLite doesn't support async operations within transactions,
 * so this uses savepoints for partial rollback support
 *
 * @example
 * await withAsyncTransaction(async () => {
 *   await recordPayment(paymentData);
 *   await createJournalEntry(journalData);
 * });
 */
export async function withAsyncTransaction<T>(fn: () => Promise<T>): Promise<T> {
  const db = getDb();
  const savepointName = `sp_${Date.now()}`;

  db.exec(`SAVEPOINT ${savepointName}`);
  try {
    const result = await fn();
    db.exec(`RELEASE ${savepointName}`);
    return result;
  } catch (error) {
    db.exec(`ROLLBACK TO ${savepointName}`);
    db.exec(`RELEASE ${savepointName}`);
    throw error;
  }
}

// Seed sample business data for first-run experience
export function seedSampleData(): void {
  const db = getDb();

  // Check if already seeded
  const hasCustomers = db.prepare("SELECT COUNT(*) as count FROM customers").get() as { count: number };
  if (hasCustomers.count > 0) return;

  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15).toISOString().split("T")[0];
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  // Insert customers
  db.exec(`
    INSERT INTO customers (name, email, address) VALUES
      ('Acme Corporation', 'billing@acme.com', '123 Business Ave, Suite 100'),
      ('Widget Industries', 'ap@widgets.com', '456 Commerce St'),
      ('Tech Solutions LLC', 'invoices@techsol.com', '789 Innovation Blvd');
  `);

  // Insert vendors
  db.exec(`
    INSERT INTO vendors (name, email, default_category) VALUES
      ('Office Depot', 'orders@officedepot.com', 'Office Supplies'),
      ('Amazon Web Services', 'billing@aws.amazon.com', 'Software & Subscriptions'),
      ('Mailchimp', 'billing@mailchimp.com', 'Advertising');
  `);

  // Get account IDs for expenses
  const advertisingAccount = db.prepare("SELECT id FROM accounts WHERE code = '5100'").get() as { id: number };
  const officeAccount = db.prepare("SELECT id FROM accounts WHERE code = '5400'").get() as { id: number };
  const softwareAccount = db.prepare("SELECT id FROM accounts WHERE code = '5700'").get() as { id: number };

  // Insert invoices with items
  // Invoice 1 - Paid
  const inv1 = db.prepare(`
    INSERT INTO invoices (number, customer_id, date, due_date, status, subtotal, total, amount_paid)
    VALUES ('INV-202411-0001', 1, ?, ?, 'paid', 5000, 5000, 5000)
  `).run(lastMonth, lastMonth);
  db.prepare(`INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, amount) VALUES (?, 'Web Development Services', 1, 5000, 5000)`).run(inv1.lastInsertRowid);

  // Invoice 2 - Sent
  const inv2 = db.prepare(`
    INSERT INTO invoices (number, customer_id, date, due_date, status, subtotal, total)
    VALUES ('INV-202411-0002', 2, ?, ?, 'sent', 3500, 3500)
  `).run(twoWeeksAgo, nextWeek);
  db.prepare(`INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, amount) VALUES (?, 'Consulting Hours', 10, 350, 3500)`).run(inv2.lastInsertRowid);

  // Invoice 3 - Draft
  const inv3 = db.prepare(`
    INSERT INTO invoices (number, customer_id, date, due_date, status, subtotal, total)
    VALUES ('INV-202411-0003', 3, ?, ?, 'draft', 2000, 2000)
  `).run(today, nextWeek);
  db.prepare(`INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, amount) VALUES (?, 'Software License', 1, 2000, 2000)`).run(inv3.lastInsertRowid);

  // Invoice 4 - Overdue
  const inv4 = db.prepare(`
    INSERT INTO invoices (number, customer_id, date, due_date, status, subtotal, total)
    VALUES ('INV-202410-0001', 1, ?, ?, 'overdue', 1500, 1500)
  `).run(lastMonth, lastWeek);
  db.prepare(`INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, amount) VALUES (?, 'Maintenance Support', 1, 1500, 1500)`).run(inv4.lastInsertRowid);

  // Invoice 5 - Partial payment
  const inv5 = db.prepare(`
    INSERT INTO invoices (number, customer_id, date, due_date, status, subtotal, total, amount_paid)
    VALUES ('INV-202411-0004', 2, ?, ?, 'partial', 4000, 4000, 2000)
  `).run(twoWeeksAgo, nextWeek);
  db.prepare(`INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, amount) VALUES (?, 'Project Phase 1', 1, 4000, 4000)`).run(inv5.lastInsertRowid);

  // Insert expenses
  db.prepare(`INSERT INTO expenses (date, vendor_id, account_id, amount, description) VALUES (?, 3, ?, 99, 'Monthly email marketing')`).run(today, advertisingAccount.id);
  db.prepare(`INSERT INTO expenses (date, vendor_id, account_id, amount, description) VALUES (?, 1, ?, 156.50, 'Printer paper and ink')`).run(lastWeek, officeAccount.id);
  db.prepare(`INSERT INTO expenses (date, vendor_id, account_id, amount, description) VALUES (?, 2, ?, 425, 'Cloud hosting - monthly')`).run(twoWeeksAgo, softwareAccount.id);
  db.prepare(`INSERT INTO expenses (date, vendor_id, account_id, amount, description) VALUES (?, 1, ?, 89, 'Office chairs')`).run(lastMonth, officeAccount.id);
  db.prepare(`INSERT INTO expenses (date, vendor_id, account_id, amount, description) VALUES (?, 2, ?, 12.99, 'Domain renewal')`).run(lastMonth, softwareAccount.id);

  // Update next invoice number
  db.prepare("UPDATE settings SET value = '5' WHERE key = 'next_invoice_number'").run();
}
