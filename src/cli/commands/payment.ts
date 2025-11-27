import {
  getPayments,
  savePayment,
  getInvoice,
  saveInvoice,
  getCustomer,
  getVendor,
  saveExpense,
} from "../../core/storage/index.js";
import {
  generateId,
  timestamp,
  type Payment,
  type Expense,
} from "../../core/models/index.js";
import {
  printTitle,
  printSuccess,
  printError,
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

// Record a payment received
export function recordPayment(args: string[]): void {
  const parsed = parseArgs(args);

  if (!parsed.amount) {
    printError("Missing required: --amount");
    printDim("Usage: oa payment record --amount <amount> [--from <customer>] [--invoice <inv>] [--method <method>]");
    return;
  }

  const amount = parseFloat(parsed.amount);
  if (isNaN(amount) || amount <= 0) {
    printError("Invalid amount");
    return;
  }

  const payment: Payment = {
    id: generateId(),
    date: parsed.date || new Date().toISOString().split("T")[0],
    amount,
    type: "received",
    method: (parsed.method as Payment["method"]) || "bank",
    reference: parsed.reference,
    createdAt: timestamp(),
    updatedAt: timestamp(),
  };

  // Link to customer
  if (parsed.from) {
    const customer = getCustomer(parsed.from);
    if (customer) {
      payment.customerId = customer.id;
      payment.customerName = customer.name;
    } else {
      payment.customerName = parsed.from;
    }
  }

  // Link to invoice
  if (parsed.invoice) {
    const invoice = getInvoice(parsed.invoice);
    if (invoice) {
      payment.invoiceId = invoice.id;
      payment.customerId = invoice.customerId;
      payment.customerName = invoice.customerName;

      // Update invoice
      invoice.payments.push(payment.id);
      const totalPaid = invoice.payments.length > 0
        ? getPayments()
            .filter((p) => invoice.payments.includes(p.id))
            .reduce((sum, p) => sum + p.amount, 0) + amount
        : amount;

      if (totalPaid >= invoice.total) {
        invoice.status = "paid";
      }
      invoice.updatedAt = timestamp();
      saveInvoice(invoice);
    } else {
      printError(`Invoice not found: ${parsed.invoice}`);
      return;
    }
  }

  savePayment(payment);

  printSuccess(`Payment recorded: $${amount.toFixed(2)}`);
  if (payment.customerName) {
    printKeyValue("From", payment.customerName);
  }
  if (parsed.invoice) {
    printKeyValue("Invoice", parsed.invoice);
  }
}

// Record expense/payment made
export function recordExpense(args: string[]): void {
  const parsed = parseArgs(args);

  if (!parsed.amount) {
    printError("Missing required: --amount");
    printDim("Usage: oa expense add --amount <amount> --category <cat> [--vendor <vendor>] [--description <desc>]");
    return;
  }

  const amount = parseFloat(parsed.amount);
  if (isNaN(amount) || amount <= 0) {
    printError("Invalid amount");
    return;
  }

  // Create expense record
  const expense: Expense = {
    id: generateId(),
    date: parsed.date || new Date().toISOString().split("T")[0],
    category: parsed.category || "General",
    description: parsed.description || "",
    amount,
    notes: parsed.notes,
    createdAt: timestamp(),
    updatedAt: timestamp(),
  };

  // Link to vendor
  if (parsed.vendor) {
    const vendor = getVendor(parsed.vendor);
    if (vendor) {
      expense.vendorId = vendor.id;
      expense.vendorName = vendor.name;
    } else {
      expense.vendorName = parsed.vendor;
    }
  }

  // Create payment record
  const payment: Payment = {
    id: generateId(),
    date: expense.date,
    amount,
    type: "sent",
    method: (parsed.method as Payment["method"]) || "bank",
    vendorId: expense.vendorId,
    vendorName: expense.vendorName,
    expenseCategory: expense.category,
    description: expense.description,
    createdAt: timestamp(),
    updatedAt: timestamp(),
  };

  expense.paymentId = payment.id;

  saveExpense(expense);
  savePayment(payment);

  printSuccess(`Expense recorded: $${amount.toFixed(2)}`);
  printKeyValue("Category", expense.category);
  if (expense.vendorName) {
    printKeyValue("Vendor", expense.vendorName);
  }
}

// List payments
export function listPayments(args: string[]): void {
  const parsed = parseArgs(args);
  const payments = getPayments();

  if (payments.length === 0) {
    printDim("No payments found");
    return;
  }

  // Filter by type
  let filtered = payments;
  if (parsed.type === "received") {
    filtered = payments.filter((p) => p.type === "received");
  } else if (parsed.type === "sent") {
    filtered = payments.filter((p) => p.type === "sent");
  }

  // Sort by date
  filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  printTitle("Payments");
  console.log();

  for (const payment of filtered.slice(0, 20)) {
    const typeColor = payment.type === "received" ? "\x1b[32m+" : "\x1b[31m-";
    const name = payment.customerName || payment.vendorName || "";
    console.log(`  ${payment.date}  ${typeColor}$${payment.amount.toFixed(2)}\x1b[0m  ${name}  ${payment.method}`);
  }

  if (filtered.length > 20) {
    printDim(`  ... and ${filtered.length - 20} more`);
  }

  console.log();

  // Summary
  const received = filtered.filter((p) => p.type === "received").reduce((s, p) => s + p.amount, 0);
  const sent = filtered.filter((p) => p.type === "sent").reduce((s, p) => s + p.amount, 0);
  printKeyValue("Received", `$${received.toFixed(2)}`);
  printKeyValue("Sent", `$${sent.toFixed(2)}`);
}

// Main payment command router
export function paymentCommand(args: string[]): void {
  const subcommand = args[0];
  const subArgs = args.slice(1);

  switch (subcommand) {
    case "record":
      recordPayment(subArgs);
      break;
    case "list":
      listPayments(subArgs);
      break;
    default:
      printError(`Unknown payment command: ${subcommand || "(none)"}`);
      console.log();
      printDim("Available commands:");
      printBullet("record  - Record payment received");
      printBullet("list    - List all payments");
  }
}

// Main expense command router
export function expenseCommand(args: string[]): void {
  const subcommand = args[0];
  const subArgs = args.slice(1);

  switch (subcommand) {
    case "add":
      recordExpense(subArgs);
      break;
    default:
      printError(`Unknown expense command: ${subcommand || "(none)"}`);
      console.log();
      printDim("Available commands:");
      printBullet("add  - Add expense");
  }
}
