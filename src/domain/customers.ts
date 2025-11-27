import { getDb, logAudit } from "../db/index.js";

export interface Customer {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  tax_id?: string;
  payment_terms: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  // LHDN e-Invoice fields
  tin?: string;              // Tax Identification Number (12 digits)
  id_type?: string;          // NRIC | PASSPORT | BRN | ARMY
  id_number?: string;        // ID value
  sst_registration?: string; // SST Registration Number
}

export interface CustomerWithBalance extends Customer {
  total_invoiced: number;
  total_paid: number;
  balance: number;
}

export function createCustomer(data: {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  tax_id?: string;
  payment_terms?: string;
  notes?: string;
  // LHDN fields
  tin?: string;
  id_type?: string;
  id_number?: string;
  sst_registration?: string;
}): Customer {
  const db = getDb();

  const result = db.prepare(`
    INSERT INTO customers (name, email, phone, address, tax_id, payment_terms, notes, tin, id_type, id_number, sst_registration)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.name,
    data.email || null,
    data.phone || null,
    data.address || null,
    data.tax_id || null,
    data.payment_terms || "net_30",
    data.notes || null,
    data.tin || null,
    data.id_type || null,
    data.id_number || null,
    data.sst_registration || null
  );

  const customer = getCustomer(result.lastInsertRowid as number)!;
  logAudit("create", "customer", customer.id, null, customer);

  return customer;
}

export function getCustomer(idOrName: number | string): Customer | undefined {
  const db = getDb();

  if (typeof idOrName === "number") {
    return db.prepare("SELECT * FROM customers WHERE id = ?").get(idOrName) as Customer | undefined;
  }

  // Try exact match first, then case-insensitive
  let customer = db.prepare("SELECT * FROM customers WHERE name = ?").get(idOrName) as Customer | undefined;
  if (!customer) {
    customer = db.prepare("SELECT * FROM customers WHERE LOWER(name) = LOWER(?)").get(idOrName) as Customer | undefined;
  }

  return customer;
}

export function listCustomers(): CustomerWithBalance[] {
  const db = getDb();

  return db.prepare(`
    SELECT
      c.*,
      COALESCE(SUM(i.total), 0) as total_invoiced,
      COALESCE(SUM(i.amount_paid), 0) as total_paid,
      COALESCE(SUM(i.total - i.amount_paid), 0) as balance
    FROM customers c
    LEFT JOIN invoices i ON c.id = i.customer_id AND i.status != 'cancelled'
    GROUP BY c.id
    ORDER BY c.name
  `).all() as CustomerWithBalance[];
}

export function updateCustomer(id: number, data: Partial<Customer>): Customer | undefined {
  const db = getDb();
  const old = getCustomer(id);
  if (!old) return undefined;

  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.name !== undefined) { fields.push("name = ?"); values.push(data.name); }
  if (data.email !== undefined) { fields.push("email = ?"); values.push(data.email); }
  if (data.phone !== undefined) { fields.push("phone = ?"); values.push(data.phone); }
  if (data.address !== undefined) { fields.push("address = ?"); values.push(data.address); }
  if (data.tax_id !== undefined) { fields.push("tax_id = ?"); values.push(data.tax_id); }
  if (data.payment_terms !== undefined) { fields.push("payment_terms = ?"); values.push(data.payment_terms); }
  if (data.notes !== undefined) { fields.push("notes = ?"); values.push(data.notes); }
  // LHDN fields
  if (data.tin !== undefined) { fields.push("tin = ?"); values.push(data.tin); }
  if (data.id_type !== undefined) { fields.push("id_type = ?"); values.push(data.id_type); }
  if (data.id_number !== undefined) { fields.push("id_number = ?"); values.push(data.id_number); }
  if (data.sst_registration !== undefined) { fields.push("sst_registration = ?"); values.push(data.sst_registration); }

  if (fields.length === 0) return old;

  fields.push("updated_at = CURRENT_TIMESTAMP");
  values.push(id);

  db.prepare(`UPDATE customers SET ${fields.join(", ")} WHERE id = ?`).run(...values);

  const updated = getCustomer(id)!;
  logAudit("update", "customer", id, old, updated);

  return updated;
}

export function deleteCustomer(id: number): boolean {
  const db = getDb();
  const customer = getCustomer(id);
  if (!customer) return false;

  // Check for invoices
  const invoiceCount = db.prepare("SELECT COUNT(*) as count FROM invoices WHERE customer_id = ?").get(id) as { count: number };
  if (invoiceCount.count > 0) {
    throw new Error(`Cannot delete customer with ${invoiceCount.count} invoice(s)`);
  }

  db.prepare("DELETE FROM customers WHERE id = ?").run(id);
  logAudit("delete", "customer", id, customer, null);

  return true;
}

export function searchCustomers(query: string): Customer[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM customers
    WHERE name LIKE ? OR email LIKE ?
    ORDER BY name
    LIMIT 10
  `).all(`%${query}%`, `%${query}%`) as Customer[];
}
