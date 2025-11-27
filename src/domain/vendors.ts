import { getDb, logAudit } from "../db/index.js";

export interface Vendor {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  tax_id?: string;
  default_category?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface VendorWithBalance extends Vendor {
  total_expenses: number;
  total_paid: number;
  balance: number;
}

export function createVendor(data: {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  tax_id?: string;
  default_category?: string;
  notes?: string;
}): Vendor {
  const db = getDb();

  const result = db.prepare(`
    INSERT INTO vendors (name, email, phone, address, tax_id, default_category, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.name,
    data.email || null,
    data.phone || null,
    data.address || null,
    data.tax_id || null,
    data.default_category || null,
    data.notes || null
  );

  const vendor = getVendor(result.lastInsertRowid as number)!;
  logAudit("create", "vendor", vendor.id, null, vendor);

  return vendor;
}

export function getVendor(idOrName: number | string): Vendor | undefined {
  const db = getDb();

  if (typeof idOrName === "number") {
    return db.prepare("SELECT * FROM vendors WHERE id = ?").get(idOrName) as Vendor | undefined;
  }

  // Try exact match first, then case-insensitive
  let vendor = db.prepare("SELECT * FROM vendors WHERE name = ?").get(idOrName) as Vendor | undefined;
  if (!vendor) {
    vendor = db.prepare("SELECT * FROM vendors WHERE LOWER(name) = LOWER(?)").get(idOrName) as Vendor | undefined;
  }

  return vendor;
}

export function listVendors(): VendorWithBalance[] {
  const db = getDb();

  return db.prepare(`
    SELECT
      v.*,
      COALESCE(SUM(e.amount), 0) as total_expenses,
      COALESCE(SUM(CASE WHEN e.payment_id IS NOT NULL THEN e.amount ELSE 0 END), 0) as total_paid,
      COALESCE(SUM(CASE WHEN e.payment_id IS NULL THEN e.amount ELSE 0 END), 0) as balance
    FROM vendors v
    LEFT JOIN expenses e ON v.id = e.vendor_id
    GROUP BY v.id
    ORDER BY v.name
  `).all() as VendorWithBalance[];
}

export function updateVendor(id: number, data: Partial<Vendor>): Vendor | undefined {
  const db = getDb();
  const old = getVendor(id);
  if (!old) return undefined;

  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.name !== undefined) { fields.push("name = ?"); values.push(data.name); }
  if (data.email !== undefined) { fields.push("email = ?"); values.push(data.email); }
  if (data.phone !== undefined) { fields.push("phone = ?"); values.push(data.phone); }
  if (data.address !== undefined) { fields.push("address = ?"); values.push(data.address); }
  if (data.tax_id !== undefined) { fields.push("tax_id = ?"); values.push(data.tax_id); }
  if (data.default_category !== undefined) { fields.push("default_category = ?"); values.push(data.default_category); }
  if (data.notes !== undefined) { fields.push("notes = ?"); values.push(data.notes); }

  if (fields.length === 0) return old;

  fields.push("updated_at = CURRENT_TIMESTAMP");
  values.push(id);

  db.prepare(`UPDATE vendors SET ${fields.join(", ")} WHERE id = ?`).run(...values);

  const updated = getVendor(id)!;
  logAudit("update", "vendor", id, old, updated);

  return updated;
}

export function deleteVendor(id: number): boolean {
  const db = getDb();
  const vendor = getVendor(id);
  if (!vendor) return false;

  // Check for expenses
  const expenseCount = db.prepare("SELECT COUNT(*) as count FROM expenses WHERE vendor_id = ?").get(id) as { count: number };
  if (expenseCount.count > 0) {
    throw new Error(`Cannot delete vendor with ${expenseCount.count} expense(s)`);
  }

  db.prepare("DELETE FROM vendors WHERE id = ?").run(id);
  logAudit("delete", "vendor", id, vendor, null);

  return true;
}

export function searchVendors(query: string): Vendor[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM vendors
    WHERE name LIKE ? OR email LIKE ?
    ORDER BY name
    LIMIT 10
  `).all(`%${query}%`, `%${query}%`) as Vendor[];
}
