import {
  getInvoices,
  getInvoice,
  saveInvoice,
  getNextInvoiceNumber,
  getCustomer,
  getCustomers,
  saveCustomer,
  getPayments,
} from "../../core/storage/index.js";
import {
  generateId,
  timestamp,
  type Invoice,
  type Customer,
} from "../../core/models/index.js";
import {
  printTitle,
  printSuccess,
  printError,
  printSection,
  printKeyValue,
  printDim,
  printBullet,
} from "../ui.js";

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

// Create a new invoice
export function createInvoice(args: string[]): void {
  const parsed = parseArgs(args);

  if (!parsed.customer) {
    printError("Missing required: --customer");
    printDim("Usage: oa invoice create --customer <name> --amount <amount> [--due <date>] [--description <desc>]");
    return;
  }

  if (!parsed.amount) {
    printError("Missing required: --amount");
    return;
  }

  const amount = parseFloat(parsed.amount);
  if (isNaN(amount)) {
    printError("Invalid amount");
    return;
  }

  // Find or create customer
  let customer = getCustomer(parsed.customer);
  if (!customer) {
    // Create new customer
    customer = {
      id: generateId(),
      name: parsed.customer,
      createdAt: timestamp(),
      updatedAt: timestamp(),
    };
    saveCustomer(customer);
    printDim(`Created new customer: ${customer.name}`);
  }

  // Calculate due date (default 30 days)
  const today = new Date();
  const dueDate = parsed.due || new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
    .toISOString().split("T")[0];

  const invoice: Invoice = {
    id: generateId(),
    number: getNextInvoiceNumber(),
    customerId: customer.id,
    customerName: customer.name,
    date: today.toISOString().split("T")[0],
    dueDate,
    lineItems: [
      {
        description: parsed.description || "Services",
        quantity: 1,
        unitPrice: amount,
        amount,
      },
    ],
    subtotal: amount,
    tax: 0,
    total: amount,
    status: "draft",
    payments: [],
    notes: parsed.notes,
    createdAt: timestamp(),
    updatedAt: timestamp(),
  };

  saveInvoice(invoice);

  printSuccess(`Invoice ${invoice.number} created`);
  printKeyValue("Customer", customer.name);
  printKeyValue("Amount", `$${amount.toFixed(2)}`);
  printKeyValue("Due", dueDate);
}

// List all invoices
export function listInvoices(args: string[]): void {
  const parsed = parseArgs(args);
  const invoices = getInvoices();

  if (invoices.length === 0) {
    printDim("No invoices found. Create one with: oa invoice create");
    return;
  }

  // Filter by status if specified
  let filtered = invoices;
  if (parsed.status) {
    filtered = invoices.filter((i) => i.status === parsed.status);
  }

  // Sort by date descending
  filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  printTitle("Invoices");
  console.log();

  for (const inv of filtered) {
    const statusColor = inv.status === "paid" ? "\x1b[32m" :
                        inv.status === "overdue" ? "\x1b[31m" :
                        inv.status === "sent" ? "\x1b[33m" : "\x1b[90m";
    const reset = "\x1b[0m";

    console.log(`  ${inv.number}  ${inv.customerName.padEnd(20)}  $${inv.total.toFixed(2).padStart(10)}  ${statusColor}${inv.status}${reset}`);
  }

  console.log();

  // Summary
  const total = filtered.reduce((sum, i) => sum + i.total, 0);
  const unpaid = filtered.filter((i) => i.status !== "paid" && i.status !== "cancelled")
    .reduce((sum, i) => sum + i.total, 0);

  printKeyValue("Total", `$${total.toFixed(2)}`);
  printKeyValue("Unpaid", `$${unpaid.toFixed(2)}`);
}

// View single invoice
export function viewInvoice(id: string): void {
  const invoice = getInvoice(id);

  if (!invoice) {
    printError(`Invoice not found: ${id}`);
    return;
  }

  printTitle(`Invoice ${invoice.number}`);
  console.log();

  printKeyValue("Customer", invoice.customerName);
  printKeyValue("Date", invoice.date);
  printKeyValue("Due", invoice.dueDate);
  printKeyValue("Status", invoice.status);
  console.log();

  printSection("Line Items");
  for (const item of invoice.lineItems) {
    console.log(`  ${item.description}`);
    console.log(`    ${item.quantity} x $${item.unitPrice.toFixed(2)} = $${item.amount.toFixed(2)}`);
  }
  console.log();

  printKeyValue("Subtotal", `$${invoice.subtotal.toFixed(2)}`);
  if (invoice.tax > 0) {
    printKeyValue("Tax", `$${invoice.tax.toFixed(2)}`);
  }
  printKeyValue("Total", `$${invoice.total.toFixed(2)}`);
  console.log();

  // Show payments
  if (invoice.payments.length > 0) {
    printSection("Payments");
    const payments = getPayments().filter((p) => invoice.payments.includes(p.id));
    for (const payment of payments) {
      console.log(`  ${payment.date}  $${payment.amount.toFixed(2)}  ${payment.method}`);
    }
    console.log();
  }
}

// Mark invoice as paid
export function markInvoicePaid(id: string): void {
  const invoice = getInvoice(id);

  if (!invoice) {
    printError(`Invoice not found: ${id}`);
    return;
  }

  invoice.status = "paid";
  invoice.updatedAt = timestamp();
  saveInvoice(invoice);

  printSuccess(`Invoice ${invoice.number} marked as paid`);
}

// Mark invoice as sent
export function sendInvoice(id: string): void {
  const invoice = getInvoice(id);

  if (!invoice) {
    printError(`Invoice not found: ${id}`);
    return;
  }

  invoice.status = "sent";
  invoice.updatedAt = timestamp();
  saveInvoice(invoice);

  printSuccess(`Invoice ${invoice.number} marked as sent`);
}

// Main invoice command router
export function invoiceCommand(args: string[]): void {
  const subcommand = args[0];
  const subArgs = args.slice(1);

  switch (subcommand) {
    case "create":
      createInvoice(subArgs);
      break;
    case "list":
      listInvoices(subArgs);
      break;
    case "view":
      if (!subArgs[0]) {
        printError("Missing invoice ID or number");
        printDim("Usage: oa invoice view <invoice-number>");
        return;
      }
      viewInvoice(subArgs[0]);
      break;
    case "mark-paid":
      if (!subArgs[0]) {
        printError("Missing invoice ID or number");
        return;
      }
      markInvoicePaid(subArgs[0]);
      break;
    case "send":
      if (!subArgs[0]) {
        printError("Missing invoice ID or number");
        return;
      }
      sendInvoice(subArgs[0]);
      break;
    default:
      printError(`Unknown invoice command: ${subcommand || "(none)"}`);
      console.log();
      printDim("Available commands:");
      printBullet("create  - Create new invoice");
      printBullet("list    - List all invoices");
      printBullet("view    - View invoice details");
      printBullet("send    - Mark invoice as sent");
      printBullet("mark-paid - Mark invoice as paid");
  }
}
