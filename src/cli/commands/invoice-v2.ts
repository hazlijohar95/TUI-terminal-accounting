import * as p from "@clack/prompts";
import pc from "picocolors";
import {
  createInvoice,
  getInvoice,
  listInvoices,
  updateInvoiceStatus,
  getInvoiceSummary,
} from "../../domain/invoices.js";
import { getCustomer, createCustomer, listCustomers, searchCustomers } from "../../domain/customers.js";
import { symbols, formatCurrency, printTable, statusBadge, type TableColumn } from "../theme.js";
import { suggestNextAction } from "../session.js";
import "../types/global.js";

// Helper to format money for display
function formatMoney(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

// Parse command line arguments
function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      const value = args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : "true";
      result[key] = value;
      if (value !== "true") i++;
    }
  }
  return result;
}

// Create invoice with interactive prompts
export async function createInvoiceCommand(args: string[]): Promise<void> {
  const parsed = parseArgs(args);

  let customerId: number | undefined;
  let items: Array<{ description: string; quantity: number; unit_price: number }> = [];
  let taxRate = 0;
  let notes: string | undefined;

  // Get customer
  if (parsed.customer) {
    const customer = getCustomer(parsed.customer);
    if (customer) {
      customerId = customer.id;
      p.log.step(`Customer: ${customer.name}`);
    } else {
      const newCustomer = createCustomer({ name: parsed.customer });
      customerId = newCustomer.id;
      p.log.step(`Created customer: ${newCustomer.name}`);
    }
  } else {
    // Interactive customer selection
    const customers = listCustomers();

    if (customers.length > 0) {
      const customerChoice = await p.select({
        message: "Select customer",
        options: [
          ...customers.map((c) => ({
            value: c.id.toString(),
            label: c.name,
            hint: c.balance > 0 ? `owes ${formatCurrency(c.balance)}` : undefined,
          })),
          { value: "new", label: pc.cyan("+ Create new customer") },
        ],
      });

      if (p.isCancel(customerChoice)) return;

      if (customerChoice === "new") {
        const name = await p.text({
          message: "Customer name",
          placeholder: "Acme Corp",
        });
        if (p.isCancel(name)) return;

        const email = await p.text({
          message: "Email (optional)",
          placeholder: "billing@acme.com",
        });
        if (p.isCancel(email)) return;

        const newCustomer = createCustomer({ name: name as string, email: (email as string) || undefined });
        customerId = newCustomer.id;
        p.log.success(`Created customer: ${name}`);
      } else {
        customerId = parseInt(customerChoice as string);
      }
    } else {
      p.log.info("No customers yet. Let's create one.");

      const name = await p.text({
        message: "Customer name",
        placeholder: "Acme Corp",
      });
      if (p.isCancel(name)) return;

      const email = await p.text({
        message: "Email (optional)",
        placeholder: "billing@acme.com",
      });
      if (p.isCancel(email)) return;

      const newCustomer = createCustomer({ name: name as string, email: (email as string) || undefined });
      customerId = newCustomer.id;
      p.log.success(`Created customer: ${name}`);
    }
  }

  // Get items
  if (parsed.amount) {
    items.push({
      description: parsed.description || "Services",
      quantity: 1,
      unit_price: parseFloat(parsed.amount),
    });
  } else {
    // Interactive item entry
    let addMore = true;
    while (addMore) {
      const description = await p.text({
        message: items.length === 0 ? "Item description" : "Next item",
        placeholder: "e.g., Consulting services",
      });
      if (p.isCancel(description)) return;

      const quantity = await p.text({
        message: "Quantity",
        placeholder: "1",
        defaultValue: "1",
      });
      if (p.isCancel(quantity)) return;

      const unitPrice = await p.text({
        message: "Unit price ($)",
        placeholder: "100.00",
      });
      if (p.isCancel(unitPrice)) return;

      items.push({
        description: description as string,
        quantity: parseFloat(quantity as string) || 1,
        unit_price: parseFloat((unitPrice as string).replace(/[$,]/g, "")) || 0,
      });

      // Show running total
      const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
      p.log.step(`Subtotal: ${formatCurrency(subtotal)}`);

      const more = await p.confirm({
        message: "Add another item?",
        initialValue: false,
      });
      if (p.isCancel(more)) return;
      addMore = more as boolean;
    }
  }

  // Tax and notes
  if (parsed.tax) {
    taxRate = parseFloat(parsed.tax);
  } else if (!parsed.amount) {
    const tax = await p.text({
      message: "Tax rate (%)",
      placeholder: "0",
      defaultValue: "0",
    });
    if (p.isCancel(tax)) return;
    taxRate = parseFloat(tax as string) || 0;
  }

  if (!parsed.notes && !parsed.amount) {
    const notesInput = await p.text({
      message: "Notes (optional)",
      placeholder: "Payment due within 30 days",
    });
    if (p.isCancel(notesInput)) return;
    notes = (notesInput as string) || undefined;
  } else {
    notes = parsed.notes;
  }

  // Create the invoice
  try {
    const s = p.spinner();
    s.start("Creating invoice...");

    const invoice = createInvoice({
      customer_id: customerId!,
      items,
      tax_rate: taxRate,
      due_date: parsed.due,
      notes,
    });

    s.stop(`Invoice ${pc.bold(invoice.number)} created`);

    // Summary
    const summaryLines = [
      `Customer: ${invoice.customer_name}`,
      `Date: ${invoice.date}`,
      `Due: ${invoice.due_date}`,
      `Total: ${formatCurrency(invoice.total)}`,
    ];

    if (invoice.items && invoice.items.length > 1) {
      summaryLines.push("");
      for (const item of invoice.items) {
        summaryLines.push(`${symbols.dot} ${item.description}: $${item.amount.toFixed(2)}`);
      }
    }

    p.note(summaryLines.join("\n"), "Invoice Summary");

    // Suggest next action
    const next = await suggestNextAction([
      { value: `send inv ${invoice.number}`, label: "Send this invoice" },
      { value: "create inv", label: "Create another invoice" },
      { value: "list inv", label: "View all invoices" },
    ]);

    // Return the suggestion to be executed
    if (next) {
      globalThis.__nextCommand = next;
    }
  } catch (err) {
    p.log.error((err as Error).message);
  }
}

// List invoices
export async function listInvoicesCommand(args: string[]): Promise<void> {
  const parsed = parseArgs(args);

  const invoices = listInvoices({
    status: parsed.status,
  });

  if (invoices.length === 0) {
    p.log.info("No invoices found. Create one with: create inv");
    return;
  }

  const summary = getInvoiceSummary();

  // Summary bar
  if (summary.count_overdue > 0) {
    p.log.warn(`${summary.count_overdue} overdue (${formatMoney(summary.total_overdue)})`);
  }

  // Table
  const columns: TableColumn[] = [
    { header: "Number", width: 10, align: "left" },
    { header: "Customer", width: 18, align: "left" },
    { header: "Amount", width: 12, align: "right" },
    { header: "Status", width: 10, align: "right" },
  ];

  const rows = invoices.map((inv) => [
    inv.number,
    (inv.customer_name || "").slice(0, 18),
    formatMoney(inv.total),
    statusBadge(inv.status),
  ]);

  printTable(columns, rows);

  console.log();
  console.log(pc.dim(`  Total: ${formatMoney(invoices.reduce((s, i) => s + i.total, 0))}  │  Outstanding: ${formatMoney(summary.total_outstanding)}`));
}

// View invoice
export async function viewInvoiceCommand(id: string): Promise<void> {
  const invoice = getInvoice(id);

  if (!invoice) {
    p.log.error(`Invoice not found: ${id}`);
    return;
  }

  // Build summary
  const lines = [
    `To: ${pc.bold(invoice.customer_name)}`,
    `Date: ${invoice.date}`,
    `Due: ${invoice.due_date}`,
    `Status: ${statusBadge(invoice.status)}`,
  ];

  if (invoice.items && invoice.items.length > 0) {
    lines.push("");
    lines.push(pc.bold("Items:"));
    for (const item of invoice.items) {
      const desc = item.description.length > 25 ? item.description.slice(0, 22) + "..." : item.description;
      lines.push(`  ${desc} - ${formatMoney(item.amount)}`);
    }
  }

  lines.push("");
  lines.push(`Subtotal: ${formatMoney(invoice.subtotal)}`);
  if (invoice.tax_amount > 0) {
    lines.push(`Tax (${invoice.tax_rate}%): ${formatMoney(invoice.tax_amount)}`);
  }
  lines.push(pc.bold(`TOTAL: ${formatCurrency(invoice.total)}`));

  if (invoice.amount_paid > 0) {
    lines.push("");
    lines.push(`Paid: ${pc.green(formatMoney(invoice.amount_paid))}`);
    const balance = invoice.total - invoice.amount_paid;
    if (balance > 0) {
      lines.push(`Balance: ${pc.yellow(formatMoney(balance))}`);
    }
  }

  if (invoice.notes) {
    lines.push("");
    lines.push(pc.dim(`Notes: ${invoice.notes}`));
  }

  p.note(lines.join("\n"), `Invoice ${invoice.number}`);
}

// Send invoice
export async function sendInvoiceCommand(id: string): Promise<void> {
  const invoice = updateInvoiceStatus(
    typeof id === "string" && id.startsWith("INV") ? parseInt(getInvoice(id)?.id.toString() || "0") : parseInt(id),
    "sent"
  );

  if (!invoice) {
    p.log.error(`Invoice not found: ${id}`);
    return;
  }

  p.log.success(`Invoice ${invoice.number} marked as sent`);
}

// Mark paid
export async function markPaidCommand(id: string): Promise<void> {
  const invoice = getInvoice(id);
  if (!invoice) {
    p.log.error(`Invoice not found: ${id}`);
    return;
  }

  const updated = updateInvoiceStatus(invoice.id, "paid");
  p.log.success(`Invoice ${updated!.number} marked as paid`);
}

// Delete invoice
export async function deleteInvoiceCommand(id: string): Promise<void> {
  const invoice = getInvoice(id);
  if (!invoice) {
    p.log.error(`Invoice not found: ${id}`);
    return;
  }

  // Confirm deletion
  const shouldDelete = await p.confirm({
    message: `Delete invoice ${invoice.number} for ${formatMoney(invoice.total)}?`,
    initialValue: false,
  });

  if (p.isCancel(shouldDelete) || !shouldDelete) {
    p.log.info("Cancelled");
    return;
  }

  // Delete from database
  const db = await import("../../db/index.js").then(m => m.getDb());
  db.prepare("DELETE FROM invoice_items WHERE invoice_id = ?").run(invoice.id);
  db.prepare("DELETE FROM invoices WHERE id = ?").run(invoice.id);

  p.log.success(`Invoice ${invoice.number} deleted`);
}

// Main router
export async function invoiceCommandV2(args: string[]): Promise<void> {
  const subcommand = args[0];
  const subArgs = args.slice(1);

  switch (subcommand) {
    case "create":
    case "new":
      await createInvoiceCommand(subArgs);
      break;
    case "list":
    case "ls":
      await listInvoicesCommand(subArgs);
      break;
    case "view":
    case "show":
      if (!subArgs[0]) {
        p.log.error("Missing invoice number");
        p.log.info("Usage: view inv <number>");
        return;
      }
      await viewInvoiceCommand(subArgs[0]);
      break;
    case "send":
      if (!subArgs[0]) {
        p.log.error("Missing invoice number");
        return;
      }
      await sendInvoiceCommand(subArgs[0]);
      break;
    case "paid":
    case "mark-paid":
      if (!subArgs[0]) {
        p.log.error("Missing invoice number");
        return;
      }
      await markPaidCommand(subArgs[0]);
      break;
    case "delete":
    case "rm":
      if (!subArgs[0]) {
        p.log.error("Missing invoice number");
        return;
      }
      await deleteInvoiceCommand(subArgs[0]);
      break;
    default:
      if (subcommand && subcommand.startsWith("INV")) {
        // Direct view
        await viewInvoiceCommand(subcommand);
      } else {
        p.log.error(`Unknown command: ${subcommand || "(none)"}`);
        p.log.info("Commands: create, list, view, send, paid, delete");
      }
  }
}
