import PDFDocument from "pdfkit";
import { getSetting, getDb } from "../db/index.js";

interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

interface InvoiceData {
  id: number;
  number: string;
  date: string;
  due_date: string;
  customer_name: string;
  customer_email: string;
  customer_address: string;
  items: InvoiceItem[];
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  amount_paid: number;
  notes: string;
}

interface InvoiceRow {
  id: number;
  number: string;
  date: string;
  due_date: string;
  customer_name: string;
  customer_email: string | null;
  customer_address: string | null;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  amount_paid: number;
  notes: string | null;
}

export function getInvoiceData(invoiceId: number): InvoiceData | null {
  const db = getDb();

  const invoice = db.prepare(`
    SELECT
      i.*,
      c.name as customer_name,
      c.email as customer_email,
      c.address as customer_address
    FROM invoices i
    JOIN customers c ON i.customer_id = c.id
    WHERE i.id = ?
  `).get(invoiceId) as InvoiceRow | undefined;

  if (!invoice) return null;

  const items = db.prepare(`
    SELECT description, quantity, unit_price, amount
    FROM invoice_items
    WHERE invoice_id = ?
    ORDER BY sort_order
  `).all(invoiceId) as InvoiceItem[];

  return {
    id: invoice.id,
    number: invoice.number,
    date: invoice.date,
    due_date: invoice.due_date,
    customer_name: invoice.customer_name,
    customer_email: invoice.customer_email || "",
    customer_address: invoice.customer_address || "",
    items,
    subtotal: invoice.subtotal,
    tax_rate: invoice.tax_rate,
    tax_amount: invoice.tax_amount,
    total: invoice.total,
    amount_paid: invoice.amount_paid,
    notes: invoice.notes || "",
  };
}

export async function generateInvoicePDF(invoiceId: number): Promise<Buffer> {
  const data = getInvoiceData(invoiceId);
  if (!data) {
    throw new Error(`Invoice ${invoiceId} not found`);
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const businessName = getSetting("business_name") || "My Business";
    const currency = getSetting("currency") || "USD";

    // Header
    doc.fontSize(24).text(businessName, { align: "left" });
    doc.moveDown(0.5);

    // Invoice details box
    doc.fontSize(10).fillColor("#666666");
    doc.text(`Invoice: ${data.number}`);
    doc.text(`Date: ${data.date}`);
    doc.text(`Due: ${data.due_date}`);
    doc.moveDown(1);

    // Customer info
    doc.fillColor("#000000").fontSize(12).text("Bill To:");
    doc.fontSize(10).text(data.customer_name);
    if (data.customer_address) {
      const addressLines = data.customer_address.split("\n");
      addressLines.forEach((line) => doc.text(line));
    }
    if (data.customer_email) {
      doc.text(data.customer_email);
    }
    doc.moveDown(2);

    // Items table header
    const tableTop = doc.y;
    const descX = 50;
    const qtyX = 300;
    const priceX = 380;
    const amountX = 460;

    doc.fillColor("#333333").fontSize(10);
    doc.text("Description", descX, tableTop);
    doc.text("Qty", qtyX, tableTop);
    doc.text("Price", priceX, tableTop);
    doc.text("Amount", amountX, tableTop);

    // Header underline
    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke("#cccccc");

    // Items
    let y = tableTop + 25;
    doc.fillColor("#000000");

    data.items.forEach((item) => {
      const formatted = formatCurrency(item.amount, currency);
      const unitFormatted = formatCurrency(item.unit_price, currency);

      doc.text(item.description.slice(0, 40), descX, y, { width: 240 });
      doc.text(item.quantity.toString(), qtyX, y);
      doc.text(unitFormatted, priceX, y);
      doc.text(formatted, amountX, y);
      y += 20;
    });

    // Line before totals
    y += 10;
    doc.moveTo(350, y).lineTo(550, y).stroke("#cccccc");
    y += 15;

    // Totals
    doc.text("Subtotal:", 380, y);
    doc.text(formatCurrency(data.subtotal, currency), amountX, y);
    y += 18;

    if (data.tax_rate > 0) {
      doc.text(`Tax (${data.tax_rate}%):`, 380, y);
      doc.text(formatCurrency(data.tax_amount, currency), amountX, y);
      y += 18;
    }

    doc.fontSize(12).font("Helvetica-Bold");
    doc.text("Total:", 380, y);
    doc.text(formatCurrency(data.total, currency), amountX, y);
    doc.font("Helvetica");
    y += 20;

    if (data.amount_paid > 0) {
      doc.fontSize(10);
      doc.text("Paid:", 380, y);
      doc.text(formatCurrency(data.amount_paid, currency), amountX, y);
      y += 18;

      const balance = data.total - data.amount_paid;
      doc.font("Helvetica-Bold").fillColor(balance > 0 ? "#d20f39" : "#40a02b");
      doc.text("Balance Due:", 380, y);
      doc.text(formatCurrency(balance, currency), amountX, y);
      doc.font("Helvetica").fillColor("#000000");
    }

    // Notes
    if (data.notes) {
      doc.moveDown(3);
      doc.fontSize(10).fillColor("#666666");
      doc.text("Notes:", 50);
      doc.fillColor("#000000").text(data.notes, 50, doc.y + 5, { width: 500 });
    }

    // Footer
    doc.fontSize(8).fillColor("#999999");
    doc.text(
      `Generated by ${businessName} • Invoice ${data.number}`,
      50,
      750,
      { align: "center", width: 500 }
    );

    doc.end();
  });
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
  }).format(amount);
}

export function updateInvoiceEmailStatus(invoiceId: number, field: "email_sent_at" | "reminder_sent_at"): void {
  const db = getDb();
  const timestamp = new Date().toISOString();
  db.prepare(`UPDATE invoices SET ${field} = ? WHERE id = ?`).run(timestamp, invoiceId);
}
