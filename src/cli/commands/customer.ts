import {
  getCustomers,
  getCustomer,
  saveCustomer,
  deleteCustomer,
  getInvoices,
} from "../../core/storage/index.js";
import { generateId, timestamp, type Customer } from "../../core/models/index.js";
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

// Add a customer
export function addCustomer(args: string[]): void {
  const name = args.find((a) => !a.startsWith("--"));
  const parsed = parseArgs(args);

  if (!name) {
    printError("Missing customer name");
    printDim("Usage: oa customer add <name> [--email <email>] [--phone <phone>]");
    return;
  }

  // Check if customer exists
  const existing = getCustomer(name);
  if (existing) {
    printError(`Customer already exists: ${name}`);
    return;
  }

  const customer: Customer = {
    id: generateId(),
    name,
    email: parsed.email,
    phone: parsed.phone,
    address: parsed.address,
    notes: parsed.notes,
    createdAt: timestamp(),
    updatedAt: timestamp(),
  };

  saveCustomer(customer);
  printSuccess(`Customer added: ${name}`);
}

// List customers
export function listCustomers(): void {
  const customers = getCustomers();

  if (customers.length === 0) {
    printDim("No customers found. Add one with: oa customer add <name>");
    return;
  }

  printTitle("Customers");
  console.log();

  // Get invoice data to show balances
  const invoices = getInvoices();

  for (const customer of customers) {
    const customerInvoices = invoices.filter((i) => i.customerId === customer.id);
    const outstanding = customerInvoices
      .filter((i) => i.status !== "paid" && i.status !== "cancelled")
      .reduce((sum, i) => sum + i.total, 0);

    console.log(`  ${customer.name}`);
    if (outstanding > 0) {
      console.log(`    \x1b[33mOwes: $${outstanding.toFixed(2)}\x1b[0m`);
    } else if (customer.email) {
      printDim(`    ${customer.email}`);
    }
  }
  console.log();
  printDim(`${customers.length} customer(s)`);
}

// View customer
export function viewCustomer(id: string): void {
  const customer = getCustomer(id);

  if (!customer) {
    printError(`Customer not found: ${id}`);
    return;
  }

  printTitle(customer.name);
  console.log();

  if (customer.email) printKeyValue("Email", customer.email);
  if (customer.phone) printKeyValue("Phone", customer.phone);
  if (customer.address) printKeyValue("Address", customer.address);
  if (customer.notes) printKeyValue("Notes", customer.notes);
  printKeyValue("Added", customer.createdAt.split("T")[0]);

  // Show invoice history
  const invoices = getInvoices().filter((i) => i.customerId === customer.id);
  if (invoices.length > 0) {
    console.log();
    printTitle("Invoices");
    for (const inv of invoices.slice(0, 5)) {
      const statusColor = inv.status === "paid" ? "\x1b[32m" : "\x1b[33m";
      console.log(`  ${inv.number}  $${inv.total.toFixed(2)}  ${statusColor}${inv.status}\x1b[0m`);
    }
    if (invoices.length > 5) {
      printDim(`  ... and ${invoices.length - 5} more`);
    }
  }
}

// Remove customer
export function removeCustomer(id: string): void {
  const customer = getCustomer(id);

  if (!customer) {
    printError(`Customer not found: ${id}`);
    return;
  }

  // Check for unpaid invoices
  const invoices = getInvoices().filter(
    (i) => i.customerId === customer.id && i.status !== "paid" && i.status !== "cancelled"
  );

  if (invoices.length > 0) {
    printError(`Cannot remove customer with ${invoices.length} unpaid invoice(s)`);
    return;
  }

  deleteCustomer(customer.id);
  printSuccess(`Customer removed: ${customer.name}`);
}

// Main customer command router
export function customerCommand(args: string[]): void {
  const subcommand = args[0];
  const subArgs = args.slice(1);

  switch (subcommand) {
    case "add":
      addCustomer(subArgs);
      break;
    case "list":
      listCustomers();
      break;
    case "view":
      if (!subArgs[0]) {
        printError("Missing customer name");
        return;
      }
      viewCustomer(subArgs[0]);
      break;
    case "remove":
      if (!subArgs[0]) {
        printError("Missing customer name");
        return;
      }
      removeCustomer(subArgs[0]);
      break;
    default:
      printError(`Unknown customer command: ${subcommand || "(none)"}`);
      console.log();
      printDim("Available commands:");
      printBullet("add     - Add new customer");
      printBullet("list    - List all customers");
      printBullet("view    - View customer details");
      printBullet("remove  - Remove customer");
  }
}
