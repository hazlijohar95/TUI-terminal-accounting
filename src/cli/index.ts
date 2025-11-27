#!/usr/bin/env node

// Load environment variables FIRST
import "dotenv/config";

import { init, ensureWorkspace } from "./commands/init.js";
import { invoiceCommand } from "./commands/invoice.js";
import { vendorCommand } from "./commands/vendor.js";
import { customerCommand } from "./commands/customer.js";
import { paymentCommand, expenseCommand } from "./commands/payment.js";
import { statementCommand } from "./commands/statement.js";
import { printImportAnalysis, analyzeCSVImport, commitImport } from "./commands/import.js";
import {
  printSuccess,
  printError,
  printDim,
  printBullet,
} from "./ui.js";

// Parse argv: oa <command> <subcommand> [args]
const args = process.argv.slice(2);
const command = args[0];
const subArgs = args.slice(1);

// Help text
function printHelp(): void {
  console.log(`
\x1b[1m\x1b[34mOpen\x1b[35mAccounting\x1b[0m - CLI Accounting Tool

\x1b[1mUsage:\x1b[0m oa <command> [options]

\x1b[1mInvoicing:\x1b[0m
  invoice create    Create new invoice
  invoice list      List all invoices
  invoice view      View invoice details
  invoice send      Mark invoice as sent
  invoice mark-paid Mark invoice as paid

\x1b[1mCustomers & Vendors:\x1b[0m
  customer add      Add new customer
  customer list     List all customers
  customer view     View customer details
  vendor add        Add new vendor
  vendor list       List all vendors

\x1b[1mPayments & Expenses:\x1b[0m
  payment record    Record payment received
  payment list      List all payments
  expense add       Add an expense

\x1b[1mStatements:\x1b[0m
  statement balance     Balance sheet
  statement income      Income statement (P&L)
  statement receivables Accounts receivable aging
  statement cashflow    Cash flow statement

\x1b[1mOther:\x1b[0m
  tui               Launch interactive dashboard
  import <csv>      Import bank CSV
  init              Initialize workspace
  init --demo       Initialize with sample data
  help              Show this help

\x1b[1mExamples:\x1b[0m
  oa invoice create --customer "Acme Corp" --amount 1000
  oa customer add "Acme Corp" --email billing@acme.com
  oa payment record --amount 1000 --from "Acme Corp" --invoice INV-0001
  oa expense add --amount 50 --category hosting --vendor AWS
  oa statement income --month 2025-11
`);
}

// Handle flags
if (!command || command === "--help" || command === "-h" || command === "help") {
  printHelp();
  process.exit(0);
}

if (command === "--version" || command === "-v") {
  console.log("oa 0.2.0");
  process.exit(0);
}

// Ensure workspace exists for most commands
if (command !== "init" && command !== "help") {
  await ensureWorkspace();
}

// Router
switch (command) {
  case "init":
    const demoMode = subArgs.includes("--demo");
    const created = await init({ demo: demoMode });
    if (created) {
      printSuccess("Workspace initialized");
      if (demoMode) {
        printSuccess("Demo data added (sample customers, vendors, invoices, expenses)");
      }
    }
    break;

  case "invoice":
    invoiceCommand(subArgs);
    break;

  case "customer":
    customerCommand(subArgs);
    break;

  case "vendor":
    vendorCommand(subArgs);
    break;

  case "payment":
    paymentCommand(subArgs);
    break;

  case "expense":
    expenseCommand(subArgs);
    break;

  case "statement":
    statementCommand(subArgs);
    break;

  case "tui":
    // Launch the TUI dashboard
    await import("../tui/dashboard-entry.js");
    break;

  case "import": {
    const csvCommand = subArgs[0];
    if (csvCommand === "commit") {
      const csvPath = subArgs[1];
      if (!csvPath) {
        printError("Please provide CSV file path");
        process.exit(1);
      }
      const analysis = analyzeCSVImport(csvPath);
      if (!analysis.success) {
        printError(analysis.message);
        process.exit(1);
      }
      const result = commitImport(analysis.transactions);
      if (result.success) {
        printSuccess(result.message);
      } else {
        printError(result.message);
        process.exit(1);
      }
    } else {
      const csvPath = csvCommand;
      if (!csvPath) {
        printError("Please provide CSV file path");
        printDim("Usage: oa import <csv>");
        process.exit(1);
      }
      printImportAnalysis(csvPath);
    }
    break;
  }

  default:
    printError(`Unknown command: ${command}`);
    console.log();
    printDim("Run 'oa help' for usage information");
    process.exit(1);
}
