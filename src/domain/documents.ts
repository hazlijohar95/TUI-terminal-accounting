// Document management for receipts, statements, etc.
import { getDb, logAudit } from "../db/index.js";
import { existsSync, mkdirSync, copyFileSync, unlinkSync, statSync } from "fs";
import { homedir } from "os";
import { join, basename, extname } from "path";
import { randomUUID } from "crypto";
import { logger } from "../core/logger.js";

const documentLogger = logger.child({ module: "documents" });

// Document storage directory
const DOCUMENTS_DIR = join(homedir(), ".openaccounting", "documents");

// Ensure documents directory exists
export function ensureDocumentsDir(): string {
  if (!existsSync(DOCUMENTS_DIR)) {
    mkdirSync(DOCUMENTS_DIR, { recursive: true });
  }
  return DOCUMENTS_DIR;
}

export interface Document {
  id: number;
  filename: string;
  original_name: string;
  mime_type: string;
  file_path: string;
  file_size: number;
  status: "pending" | "processing" | "processed" | "failed";
  doc_type: "receipt" | "invoice" | "statement" | "contract" | "other" | null;
  extracted_data: string | null;
  expense_id: number | null;
  invoice_id: number | null;
  notes: string | null;
  created_at: string;
  processed_at: string | null;
}

export interface ExtractedData {
  vendor?: string;
  amount?: number;
  date?: string;
  category?: string;
  description?: string;
  items?: Array<{
    description: string;
    amount: number;
    quantity?: number;
  }>;
  tax?: number;
  total?: number;
  payment_method?: string;
  reference?: string;
}

export interface CreateDocumentInput {
  source_path: string;
  original_name?: string;
  doc_type?: Document["doc_type"];
  notes?: string;
}

// Get MIME type from extension
function getMimeType(filename: string): string {
  const ext = extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".csv": "text/csv",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xls": "application/vnd.ms-excel",
  };
  return mimeTypes[ext] || "application/octet-stream";
}

// Store a document file and create database entry
export function createDocument(input: CreateDocumentInput): Document {
  ensureDocumentsDir();

  const originalName = input.original_name || basename(input.source_path);
  const mimeType = getMimeType(originalName);
  const ext = extname(originalName);
  const filename = `${randomUUID()}${ext}`;
  const destPath = join(DOCUMENTS_DIR, filename);

  // Copy file to documents directory
  copyFileSync(input.source_path, destPath);
  const stats = statSync(destPath);

  const db = getDb();
  const result = db.prepare(`
    INSERT INTO documents (filename, original_name, mime_type, file_path, file_size, doc_type, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    filename,
    originalName,
    mimeType,
    destPath,
    stats.size,
    input.doc_type || null,
    input.notes || null
  );

  const doc = getDocument(result.lastInsertRowid as number)!;
  logAudit("create", "document", doc.id, null, doc);

  return doc;
}

// Get a document by ID
export function getDocument(id: number): Document | null {
  const row = getDb().prepare("SELECT * FROM documents WHERE id = ?").get(id) as Document | undefined;
  return row || null;
}

// List documents with optional filters
export function listDocuments(options?: {
  status?: Document["status"];
  doc_type?: Document["doc_type"];
  limit?: number;
}): Document[] {
  let query = "SELECT * FROM documents WHERE 1=1";
  const params: (string | number)[] = [];

  if (options?.status) {
    query += " AND status = ?";
    params.push(options.status);
  }

  if (options?.doc_type) {
    query += " AND doc_type = ?";
    params.push(options.doc_type);
  }

  query += " ORDER BY created_at DESC";

  if (options?.limit) {
    query += " LIMIT ?";
    params.push(options.limit);
  }

  return getDb().prepare(query).all(...params) as Document[];
}

// Update document status
export function updateDocumentStatus(
  id: number,
  status: Document["status"],
  extractedData?: ExtractedData
): void {
  const old = getDocument(id);

  getDb().prepare(`
    UPDATE documents
    SET status = ?, extracted_data = ?, processed_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    status,
    extractedData ? JSON.stringify(extractedData) : null,
    id
  );

  const updated = getDocument(id);
  logAudit("update_status", "document", id, old, updated);
}

// Link document to expense
export function linkDocumentToExpense(documentId: number, expenseId: number): void {
  getDb().prepare(`
    UPDATE documents SET expense_id = ? WHERE id = ?
  `).run(expenseId, documentId);

  logAudit("link_expense", "document", documentId, null, { expense_id: expenseId });
}

// Link document to invoice
export function linkDocumentToInvoice(documentId: number, invoiceId: number): void {
  getDb().prepare(`
    UPDATE documents SET invoice_id = ? WHERE id = ?
  `).run(invoiceId, documentId);

  logAudit("link_invoice", "document", documentId, null, { invoice_id: invoiceId });
}

// Update document type
export function updateDocumentType(id: number, docType: Document["doc_type"]): void {
  getDb().prepare(`
    UPDATE documents SET doc_type = ? WHERE id = ?
  `).run(docType, id);
}

// Delete a document
export function deleteDocument(id: number): boolean {
  const doc = getDocument(id);
  if (!doc) return false;

  // Delete file
  let fileDeleted = false;
  try {
    if (existsSync(doc.file_path)) {
      unlinkSync(doc.file_path);
      fileDeleted = true;
    } else {
      documentLogger.warn({ id, file_path: doc.file_path }, "Document file not found on disk during deletion");
      fileDeleted = true; // File doesn't exist, treat as success
    }
  } catch (err) {
    documentLogger.error(
      { err, id, file_path: doc.file_path },
      "Failed to delete document file from disk"
    );
    // Continue with database deletion - file may be cleaned up manually
  }

  // Delete from database
  getDb().prepare("DELETE FROM documents WHERE id = ?").run(id);
  logAudit("delete", "document", id, { ...doc, file_deleted: fileDeleted }, null);

  return true;
}

// Get pending documents for processing
export function getPendingDocuments(): Document[] {
  return listDocuments({ status: "pending" });
}

// Get parsed extracted data
export function getExtractedData(doc: Document): ExtractedData | null {
  if (!doc.extracted_data) return null;
  try {
    return JSON.parse(doc.extracted_data);
  } catch {
    return null;
  }
}

// Get documents for an expense
export function getDocumentsForExpense(expenseId: number): Document[] {
  return getDb().prepare(
    "SELECT * FROM documents WHERE expense_id = ? ORDER BY created_at DESC"
  ).all(expenseId) as Document[];
}

// Get documents for an invoice
export function getDocumentsForInvoice(invoiceId: number): Document[] {
  return getDb().prepare(
    "SELECT * FROM documents WHERE invoice_id = ? ORDER BY created_at DESC"
  ).all(invoiceId) as Document[];
}

// Get unlinked documents (not attached to any expense or invoice)
export function getUnlinkedDocuments(): Document[] {
  return getDb().prepare(
    "SELECT * FROM documents WHERE expense_id IS NULL AND invoice_id IS NULL ORDER BY created_at DESC"
  ).all() as Document[];
}

// Unlink document from expense
export function unlinkDocumentFromExpense(documentId: number): void {
  getDb().prepare("UPDATE documents SET expense_id = NULL WHERE id = ?").run(documentId);
  logAudit("unlink_expense", "document", documentId, null, null);
}
