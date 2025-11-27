import { getDb, getSetting, setSetting, logAudit, withTransaction } from "../db/index.js";
import {
  createJournalEntry,
  type CreateJournalLineData,
} from "./journal.js";
import { getAccountByCode } from "./accounts.js";
import { logger } from "../core/logger.js";

const invoiceLogger = logger.child({ module: "invoices" });

export interface InvoiceItem {
  id?: number;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  // LHDN e-Invoice fields
  classification_code?: string;  // 001-015
  tax_type?: string;             // 01-06, E
  unit_code?: string;            // EA, KGM, etc.
}

// Document types for LHDN e-invoicing
export type InvoiceDocumentType = "01" | "02" | "03"; // 01=Invoice, 02=Credit Note, 03=Debit Note

export interface Invoice {
  id: number;
  number: string;
  customer_id: number;
  customer_name?: string;
  date: string;
  due_date: string;
  status: "draft" | "sent" | "partial" | "paid" | "overdue" | "cancelled";
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  amount_paid: number;
  payment_terms?: string;
  notes?: string;
  items?: InvoiceItem[];
  created_at: string;
  updated_at: string;
  email_sent_at?: string;
  reminder_sent_at?: string;
  // Document type (Invoice, Credit Note, Debit Note)
  document_type?: InvoiceDocumentType;
  original_invoice_id?: number;  // Reference to original invoice for credit/debit notes
  // LHDN e-Invoice fields (invoice level)
  currency_code?: string;    // ISO 4217, default MYR
  payment_mode?: string;     // LHDN payment mode code
  // LHDN e-Invoice submission status
  einvoice_status?: "none" | "pending" | "submitted" | "valid" | "invalid" | "cancelled" | "rejected";
  einvoice_uuid?: string;
  einvoice_long_id?: string;
  einvoice_submission_uid?: string;
  einvoice_submitted_at?: string;
  einvoice_validated_at?: string;
  einvoice_error?: string;
}

export interface CreateInvoiceData {
  customer_id: number;
  date?: string;
  due_date?: string;
  items: Array<{
    description: string;
    quantity?: number;
    unit_price: number;
    // LHDN item fields
    classification_code?: string;
    tax_type?: string;
    unit_code?: string;
  }>;
  tax_rate?: number;
  payment_terms?: string;
  notes?: string;
  // LHDN invoice fields
  currency_code?: string;
  payment_mode?: string;
}

export function createInvoice(data: CreateInvoiceData): Invoice {
  return withTransaction(() => {
    const db = getDb();

    // Verify customer exists
    const customer = db.prepare("SELECT id, name FROM customers WHERE id = ?").get(data.customer_id) as { id: number; name: string } | undefined;
    if (!customer) {
      throw new Error(`Customer with ID ${data.customer_id} not found`);
    }

    // Get next invoice number
    const prefix = getSetting("invoice_prefix") || "INV";
    const nextNum = parseInt(getSetting("next_invoice_number") || "1");
    const number = `${prefix}-${String(nextNum).padStart(4, "0")}`;
    setSetting("next_invoice_number", String(nextNum + 1));

    // Calculate dates
    const date = data.date || new Date().toISOString().split("T")[0];
    const terms = data.payment_terms || getSetting("default_payment_terms") || "net_30";
    const daysMatch = terms.match(/net_(\d+)/);
    const days = daysMatch ? parseInt(daysMatch[1]) : 30;
    const dueDate = data.due_date || new Date(new Date(date).getTime() + days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // Calculate totals
    let subtotal = 0;
    const items = data.items.map((item) => {
      const qty = item.quantity || 1;
      const amount = qty * item.unit_price;
      subtotal += amount;
      return { ...item, quantity: qty, amount };
    });

    const taxRate = data.tax_rate ?? parseFloat(getSetting("tax_rate") || "0");
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;

    // Insert invoice with LHDN fields
    const currencyCode = data.currency_code || "MYR";
    const paymentMode = data.payment_mode || "03"; // Bank Transfer default

    const result = db.prepare(`
      INSERT INTO invoices (number, customer_id, date, due_date, subtotal, tax_rate, tax_amount, total, payment_terms, notes, currency_code, payment_mode)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(number, data.customer_id, date, dueDate, subtotal, taxRate, taxAmount, total, terms, data.notes || null, currencyCode, paymentMode);

    const invoiceId = result.lastInsertRowid as number;

    // Insert line items with LHDN fields
    const insertItem = db.prepare(`
      INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, amount, sort_order, classification_code, tax_type, unit_code)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    items.forEach((item, index) => {
      const originalItem = data.items[index];
      insertItem.run(
        invoiceId,
        item.description,
        item.quantity,
        item.unit_price,
        item.amount,
        index,
        originalItem?.classification_code || "002",  // Services default
        originalItem?.tax_type || "E",               // Tax exempt default
        originalItem?.unit_code || "EA"              // Each default
      );
    });

    // Create journal entry for invoice
    const journalLines: CreateJournalLineData[] = [];

    // Debit: Accounts Receivable
    const arAccount = getAccountByCode("1200");
    if (!arAccount) {
      throw new Error("Accounts Receivable account (1200) not found. Please ensure chart of accounts is set up.");
    }
    journalLines.push({
      account_id: arAccount.id,
      debit: total,
      credit: 0,
      description: `Invoice ${number} - ${customer.name}`,
    });

    // Credit: Revenue (default to 4000 - Sales Revenue)
    const revenueAccount = getAccountByCode("4000");
    if (!revenueAccount) {
      throw new Error("Sales Revenue account (4000) not found. Please ensure chart of accounts is set up.");
    }
    journalLines.push({
      account_id: revenueAccount.id,
      debit: 0,
      credit: subtotal,
      description: `Revenue - Invoice ${number}`,
    });

    // Credit: Sales Tax Payable (if applicable)
    if (taxAmount > 0) {
      const taxAccount = getAccountByCode("2300");
      if (!taxAccount) {
        throw new Error("Sales Tax Payable account (2300) not found. Please ensure chart of accounts is set up.");
      }
      journalLines.push({
        account_id: taxAccount.id,
        debit: 0,
        credit: taxAmount,
        description: `Sales Tax - Invoice ${number}`,
      });
    }

    // Create the journal entry
    const journalEntry = createJournalEntry({
      date,
      description: `Invoice ${number} - ${customer.name}`,
      reference: number,
      entry_type: "standard",
      lines: journalLines,
    });

    // Link journal entry to invoice
    db.prepare("UPDATE invoices SET journal_entry_id = ? WHERE id = ?").run(
      journalEntry.id,
      invoiceId
    );

    const invoice = getInvoice(invoiceId)!;
    logAudit("create", "invoice", invoice.id, null, invoice);

    return invoice;
  });
}

export function getInvoice(idOrNumber: number | string): Invoice | undefined {
  const db = getDb();

  let invoice: Invoice | undefined;

  if (typeof idOrNumber === "number") {
    invoice = db.prepare(`
      SELECT i.*, c.name as customer_name
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      WHERE i.id = ?
    `).get(idOrNumber) as Invoice | undefined;
  } else {
    invoice = db.prepare(`
      SELECT i.*, c.name as customer_name
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      WHERE i.number = ?
    `).get(idOrNumber) as Invoice | undefined;
  }

  if (invoice) {
    invoice.items = db.prepare(`
      SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order
    `).all(invoice.id) as InvoiceItem[];
  }

  return invoice;
}

export function listInvoices(filters?: {
  status?: string;
  customer_id?: number;
  from_date?: string;
  to_date?: string;
  limit?: number;
}): Invoice[] {
  const db = getDb();

  let sql = `
    SELECT i.*, c.name as customer_name
    FROM invoices i
    JOIN customers c ON i.customer_id = c.id
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (filters?.status) {
    sql += " AND i.status = ?";
    params.push(filters.status);
  }
  if (filters?.customer_id) {
    sql += " AND i.customer_id = ?";
    params.push(filters.customer_id);
  }
  if (filters?.from_date) {
    sql += " AND i.date >= ?";
    params.push(filters.from_date);
  }
  if (filters?.to_date) {
    sql += " AND i.date <= ?";
    params.push(filters.to_date);
  }

  sql += " ORDER BY i.date DESC, i.id DESC";

  if (filters?.limit) {
    sql += " LIMIT ?";
    params.push(filters.limit);
  }

  return db.prepare(sql).all(...params) as Invoice[];
}

export function updateInvoiceStatus(id: number, status: Invoice["status"]): Invoice | undefined {
  const db = getDb();
  const old = getInvoice(id);
  if (!old) return undefined;

  db.prepare("UPDATE invoices SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(status, id);

  const updated = getInvoice(id)!;
  logAudit("update_status", "invoice", id, { status: old.status }, { status });

  return updated;
}

export function recordPaymentToInvoice(invoiceId: number, amount: number): Invoice | undefined {
  const db = getDb();
  const invoice = getInvoice(invoiceId);
  if (!invoice) return undefined;

  const newPaid = invoice.amount_paid + amount;
  let newStatus: Invoice["status"] = invoice.status;

  if (newPaid >= invoice.total) {
    newStatus = "paid";
  } else if (newPaid > 0) {
    newStatus = "partial";
  }

  db.prepare(`
    UPDATE invoices
    SET amount_paid = ?, status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(newPaid, newStatus, invoiceId);

  logAudit("payment", "invoice", invoiceId, { amount_paid: invoice.amount_paid }, { amount_paid: newPaid });

  return getInvoice(invoiceId);
}

export function getOverdueInvoices(): Invoice[] {
  const db = getDb();
  const today = new Date().toISOString().split("T")[0];

  return db.prepare(`
    SELECT i.*, c.name as customer_name
    FROM invoices i
    JOIN customers c ON i.customer_id = c.id
    WHERE i.status NOT IN ('paid', 'cancelled')
    AND i.due_date < ?
    ORDER BY i.due_date
  `).all(today) as Invoice[];
}

export function getInvoiceSummary(): {
  total_outstanding: number;
  total_overdue: number;
  count_outstanding: number;
  count_overdue: number;
} {
  const db = getDb();
  const today = new Date().toISOString().split("T")[0];

  const outstanding = db.prepare(`
    SELECT COUNT(*) as count, COALESCE(SUM(total - amount_paid), 0) as amount
    FROM invoices
    WHERE status NOT IN ('paid', 'cancelled')
  `).get() as { count: number; amount: number };

  const overdue = db.prepare(`
    SELECT COUNT(*) as count, COALESCE(SUM(total - amount_paid), 0) as amount
    FROM invoices
    WHERE status NOT IN ('paid', 'cancelled')
    AND due_date < ?
  `).get(today) as { count: number; amount: number };

  return {
    total_outstanding: outstanding.amount,
    total_overdue: overdue.amount,
    count_outstanding: outstanding.count,
    count_overdue: overdue.count,
  };
}

/**
 * Update e-invoice status for an invoice
 */
export function updateEInvoiceStatus(
  invoiceId: number,
  update: {
    status: Invoice["einvoice_status"];
    uuid?: string;
    longId?: string;
    submissionUid?: string;
    error?: string;
  }
): Invoice | undefined {
  const db = getDb();
  const old = getInvoice(invoiceId);
  if (!old) return undefined;

  const now = new Date().toISOString();
  const fields: string[] = ["einvoice_status = ?", "updated_at = CURRENT_TIMESTAMP"];
  const params: unknown[] = [update.status];

  if (update.uuid !== undefined) {
    fields.push("einvoice_uuid = ?");
    params.push(update.uuid);
  }
  if (update.longId !== undefined) {
    fields.push("einvoice_long_id = ?");
    params.push(update.longId);
  }
  if (update.submissionUid !== undefined) {
    fields.push("einvoice_submission_uid = ?");
    params.push(update.submissionUid);
  }
  if (update.error !== undefined) {
    fields.push("einvoice_error = ?");
    params.push(update.error);
  }

  // Set timestamps based on status
  if (update.status === "submitted" || update.status === "pending") {
    fields.push("einvoice_submitted_at = ?");
    params.push(now);
  }
  if (update.status === "valid") {
    fields.push("einvoice_validated_at = ?");
    params.push(now);
  }

  params.push(invoiceId);

  db.prepare(`UPDATE invoices SET ${fields.join(", ")} WHERE id = ?`).run(...params);

  const updated = getInvoice(invoiceId)!;
  logAudit("update_einvoice", "invoice", invoiceId, { einvoice_status: old.einvoice_status }, { einvoice_status: update.status });

  return updated;
}

/**
 * Get invoices pending e-invoice submission
 */
export function getInvoicesPendingEInvoice(): Invoice[] {
  const db = getDb();
  return db.prepare(`
    SELECT i.*, c.name as customer_name
    FROM invoices i
    JOIN customers c ON i.customer_id = c.id
    WHERE i.status IN ('sent', 'partial', 'paid')
    AND (i.einvoice_status IS NULL OR i.einvoice_status = 'none')
    ORDER BY i.date DESC
  `).all() as Invoice[];
}

// ============================================================================
// Credit Note & Debit Note Functions
// ============================================================================

export interface CreateCreditNoteData {
  original_invoice_id: number;
  date?: string;
  reason: string;
  items?: Array<{
    description: string;
    quantity?: number;
    unit_price: number;
    classification_code?: string;
    tax_type?: string;
    unit_code?: string;
  }>;
  // If items not provided, creates a full credit of the original invoice
  full_credit?: boolean;
}

export interface CreateDebitNoteData {
  original_invoice_id: number;
  date?: string;
  reason: string;
  items: Array<{
    description: string;
    quantity?: number;
    unit_price: number;
    classification_code?: string;
    tax_type?: string;
    unit_code?: string;
  }>;
}

/**
 * Create a Credit Note for an invoice
 * Credit notes reduce the amount owed by the customer
 */
export function createCreditNote(data: CreateCreditNoteData): Invoice {
  return withTransaction(() => {
    const db = getDb();

    // Get original invoice
    const originalInvoice = getInvoice(data.original_invoice_id);
    if (!originalInvoice) {
      throw new Error(`Original invoice with ID ${data.original_invoice_id} not found`);
    }

    // Get customer info
    const customer = db.prepare("SELECT id, name FROM customers WHERE id = ?").get(originalInvoice.customer_id) as { id: number; name: string } | undefined;
    if (!customer) {
      throw new Error(`Customer not found for original invoice`);
    }

    // Get next credit note number
    const prefix = getSetting("credit_note_prefix") || "CN";
    const nextNum = parseInt(getSetting("next_credit_note_number") || "1");
    const number = `${prefix}-${String(nextNum).padStart(4, "0")}`;
    setSetting("next_credit_note_number", String(nextNum + 1));

    const date = data.date || new Date().toISOString().split("T")[0];

    // Calculate items and totals
    let items: Array<{ description: string; quantity: number; unit_price: number; amount: number; classification_code?: string; tax_type?: string; unit_code?: string; }>;
    let subtotal: number;

    if (data.full_credit || !data.items || data.items.length === 0) {
      // Full credit of original invoice
      items = (originalInvoice.items || []).map(item => ({
        description: `Credit: ${item.description}`,
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.amount,
        classification_code: item.classification_code,
        tax_type: item.tax_type,
        unit_code: item.unit_code,
      }));
      subtotal = originalInvoice.subtotal;
    } else {
      // Partial credit with specified items
      subtotal = 0;
      items = data.items.map(item => {
        const qty = item.quantity || 1;
        const amount = qty * item.unit_price;
        subtotal += amount;
        return {
          description: item.description,
          quantity: qty,
          unit_price: item.unit_price,
          amount,
          classification_code: item.classification_code,
          tax_type: item.tax_type,
          unit_code: item.unit_code,
        };
      });
    }

    const taxRate = originalInvoice.tax_rate;
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;

    // Insert credit note
    const result = db.prepare(`
      INSERT INTO invoices (
        number, customer_id, date, due_date, subtotal, tax_rate, tax_amount, total,
        status, notes, currency_code, payment_mode, document_type, original_invoice_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, '02', ?)
    `).run(
      number,
      originalInvoice.customer_id,
      date,
      date, // Credit notes are due immediately
      subtotal,
      taxRate,
      taxAmount,
      total,
      `Credit Note for ${originalInvoice.number}: ${data.reason}`,
      originalInvoice.currency_code || "MYR",
      originalInvoice.payment_mode || "03",
      data.original_invoice_id
    );

    const creditNoteId = result.lastInsertRowid as number;

    // Insert line items
    const insertItem = db.prepare(`
      INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, amount, sort_order, classification_code, tax_type, unit_code)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    items.forEach((item, index) => {
      insertItem.run(
        creditNoteId,
        item.description,
        item.quantity,
        item.unit_price,
        item.amount,
        index,
        item.classification_code || "002",
        item.tax_type || "E",
        item.unit_code || "EA"
      );
    });

    // Create journal entry (reverse of invoice)
    const journalLines: CreateJournalLineData[] = [];

    // Credit: Accounts Receivable (reduce receivable)
    const arAccount = getAccountByCode("1200");
    if (!arAccount) {
      throw new Error("Accounts Receivable account (1200) not found");
    }
    journalLines.push({
      account_id: arAccount.id,
      debit: 0,
      credit: total,
      description: `Credit Note ${number} - ${customer.name}`,
    });

    // Debit: Revenue (reduce revenue)
    const revenueAccount = getAccountByCode("4000");
    if (!revenueAccount) {
      throw new Error("Sales Revenue account (4000) not found");
    }
    journalLines.push({
      account_id: revenueAccount.id,
      debit: subtotal,
      credit: 0,
      description: `Revenue Reversal - Credit Note ${number}`,
    });

    // Debit: Sales Tax Payable (reduce tax liability)
    if (taxAmount > 0) {
      const taxAccount = getAccountByCode("2300");
      if (!taxAccount) {
        throw new Error("Sales Tax Payable account (2300) not found");
      }
      journalLines.push({
        account_id: taxAccount.id,
        debit: taxAmount,
        credit: 0,
        description: `Sales Tax Reversal - Credit Note ${number}`,
      });
    }

    const journalEntry = createJournalEntry({
      date,
      description: `Credit Note ${number} - ${customer.name}`,
      reference: number,
      entry_type: "standard",
      lines: journalLines,
    });

    db.prepare("UPDATE invoices SET journal_entry_id = ? WHERE id = ?").run(
      journalEntry.id,
      creditNoteId
    );

    const creditNote = getInvoice(creditNoteId)!;
    logAudit("create", "credit_note", creditNote.id, null, creditNote);

    return creditNote;
  });
}

/**
 * Create a Debit Note for an invoice
 * Debit notes increase the amount owed by the customer (additional charges)
 */
export function createDebitNote(data: CreateDebitNoteData): Invoice {
  return withTransaction(() => {
    const db = getDb();

    // Get original invoice
    const originalInvoice = getInvoice(data.original_invoice_id);
    if (!originalInvoice) {
      throw new Error(`Original invoice with ID ${data.original_invoice_id} not found`);
    }

    // Get customer info
    const customer = db.prepare("SELECT id, name FROM customers WHERE id = ?").get(originalInvoice.customer_id) as { id: number; name: string } | undefined;
    if (!customer) {
      throw new Error(`Customer not found for original invoice`);
    }

    if (!data.items || data.items.length === 0) {
      throw new Error("Debit note must have at least one item");
    }

    // Get next debit note number
    const prefix = getSetting("debit_note_prefix") || "DN";
    const nextNum = parseInt(getSetting("next_debit_note_number") || "1");
    const number = `${prefix}-${String(nextNum).padStart(4, "0")}`;
    setSetting("next_debit_note_number", String(nextNum + 1));

    const date = data.date || new Date().toISOString().split("T")[0];
    const terms = originalInvoice.payment_terms || "net_30";
    const daysMatch = terms.match(/net_(\d+)/);
    const days = daysMatch ? parseInt(daysMatch[1]) : 30;
    const dueDate = new Date(new Date(date).getTime() + days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // Calculate items and totals
    let subtotal = 0;
    const items = data.items.map(item => {
      const qty = item.quantity || 1;
      const amount = qty * item.unit_price;
      subtotal += amount;
      return {
        description: item.description,
        quantity: qty,
        unit_price: item.unit_price,
        amount,
        classification_code: item.classification_code,
        tax_type: item.tax_type,
        unit_code: item.unit_code,
      };
    });

    const taxRate = originalInvoice.tax_rate;
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;

    // Insert debit note
    const result = db.prepare(`
      INSERT INTO invoices (
        number, customer_id, date, due_date, subtotal, tax_rate, tax_amount, total,
        status, notes, currency_code, payment_mode, document_type, original_invoice_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, '03', ?)
    `).run(
      number,
      originalInvoice.customer_id,
      date,
      dueDate,
      subtotal,
      taxRate,
      taxAmount,
      total,
      `Debit Note for ${originalInvoice.number}: ${data.reason}`,
      originalInvoice.currency_code || "MYR",
      originalInvoice.payment_mode || "03",
      data.original_invoice_id
    );

    const debitNoteId = result.lastInsertRowid as number;

    // Insert line items
    const insertItem = db.prepare(`
      INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, amount, sort_order, classification_code, tax_type, unit_code)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    items.forEach((item, index) => {
      insertItem.run(
        debitNoteId,
        item.description,
        item.quantity,
        item.unit_price,
        item.amount,
        index,
        item.classification_code || "002",
        item.tax_type || "E",
        item.unit_code || "EA"
      );
    });

    // Create journal entry (same as invoice - increase receivable)
    const journalLines: CreateJournalLineData[] = [];

    // Debit: Accounts Receivable (increase receivable)
    const arAccount = getAccountByCode("1200");
    if (!arAccount) {
      throw new Error("Accounts Receivable account (1200) not found");
    }
    journalLines.push({
      account_id: arAccount.id,
      debit: total,
      credit: 0,
      description: `Debit Note ${number} - ${customer.name}`,
    });

    // Credit: Revenue (increase revenue)
    const revenueAccount = getAccountByCode("4000");
    if (!revenueAccount) {
      throw new Error("Sales Revenue account (4000) not found");
    }
    journalLines.push({
      account_id: revenueAccount.id,
      debit: 0,
      credit: subtotal,
      description: `Additional Revenue - Debit Note ${number}`,
    });

    // Credit: Sales Tax Payable (increase tax liability)
    if (taxAmount > 0) {
      const taxAccount = getAccountByCode("2300");
      if (!taxAccount) {
        throw new Error("Sales Tax Payable account (2300) not found");
      }
      journalLines.push({
        account_id: taxAccount.id,
        debit: 0,
        credit: taxAmount,
        description: `Sales Tax - Debit Note ${number}`,
      });
    }

    const journalEntry = createJournalEntry({
      date,
      description: `Debit Note ${number} - ${customer.name}`,
      reference: number,
      entry_type: "standard",
      lines: journalLines,
    });

    db.prepare("UPDATE invoices SET journal_entry_id = ? WHERE id = ?").run(
      journalEntry.id,
      debitNoteId
    );

    const debitNote = getInvoice(debitNoteId)!;
    logAudit("create", "debit_note", debitNote.id, null, debitNote);

    return debitNote;
  });
}

/**
 * Get credit/debit notes for an invoice
 */
export function getRelatedNotes(invoiceId: number): Invoice[] {
  const db = getDb();
  return db.prepare(`
    SELECT i.*, c.name as customer_name
    FROM invoices i
    JOIN customers c ON i.customer_id = c.id
    WHERE i.original_invoice_id = ?
    ORDER BY i.date DESC
  `).all(invoiceId) as Invoice[];
}

/**
 * Check if an invoice can have a credit note issued
 */
export function canIssueCreditNote(invoiceId: number): { allowed: boolean; reason?: string } {
  const invoice = getInvoice(invoiceId);
  if (!invoice) {
    return { allowed: false, reason: "Invoice not found" };
  }

  // Can't credit a draft invoice
  if (invoice.status === "draft") {
    return { allowed: false, reason: "Cannot issue credit note for draft invoice" };
  }

  // Can't credit a cancelled invoice
  if (invoice.status === "cancelled") {
    return { allowed: false, reason: "Cannot issue credit note for cancelled invoice" };
  }

  // Can't credit a credit/debit note
  if (invoice.document_type === "02" || invoice.document_type === "03") {
    return { allowed: false, reason: "Cannot issue credit note for a credit/debit note" };
  }

  // For e-invoices: can only credit if original is valid and within 72 hours
  if (invoice.einvoice_status === "valid" && invoice.einvoice_validated_at) {
    const validatedAt = new Date(invoice.einvoice_validated_at);
    const hoursSinceValidation = (Date.now() - validatedAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceValidation > 72) {
      return { allowed: false, reason: "E-invoice validation window (72 hours) has expired" };
    }
  }

  return { allowed: true };
}
