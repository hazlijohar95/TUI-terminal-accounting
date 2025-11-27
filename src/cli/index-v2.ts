#!/usr/bin/env node

// Load environment variables from package directory
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Load .env from project root (two levels up from dist/cli/)
config({ path: join(__dirname, "../../.env") });

import inquirer from "inquirer";
import { getDb, getSetting, setSetting } from "../db/index.js";
import { invoiceCommandV2 } from "./commands/invoice-v2.js";
import { askCommand, chatCommand } from "./commands/agent.js";
import { createCustomer, getCustomer, listCustomers, searchCustomers } from "../domain/customers.js";
import { recordPayment, recordExpense, listPayments, getPaymentSummary } from "../domain/payments.js";
import { getInvoice } from "../domain/invoices.js";
import {
  getBalanceSheet,
  getProfitLoss,
  getReceivablesAging,
  getCashFlow,
  getExpensesByCategory,
} from "../domain/reports.js";
import { printSuccess, printError, printDim } from "./ui.js";
import {
  printHeader,
  printSection,
  printSectionEnd,
  printTable,
  formatMoney,
  colors,
  printHint,
  printWarningBox,
} from "./ui-components.js";
import { startSession } from "./session.js";
import { isFirstRun, runSetupWizard, quickInit } from "./commands/setup.js";

// Initialize database on startup
getDb();

// Check for first run and show setup wizard
async function checkFirstRun(): Promise<void> {
  if (isFirstRun()) {
    await runSetupWizard();
  }
}

// Parse arguments
const args = process.argv.slice(2);
const command = args[0];
const subArgs = args.slice(1);

// Command aliases
const ALIASES: Record<string, string> = {
  inv: "invoice",
  cust: "customer",
  vend: "vendor",
  pay: "payment",
  exp: "expense",
  stmt: "statement",
  rep: "report",
};

// Resolve alias
const resolvedCommand = ALIASES[command] || command;

// Parse --flags
function parseFlags(args: string[]): Record<string, string> {
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

// Help text
function printHelp(): void {
  const businessName = getSetting("business_name") || "OpenAccounting";

  console.log(`
\x1b[1m\x1b[34m${businessName}\x1b[0m - CLI Accounting

\x1b[1mUsage:\x1b[0m oa <action> <entity> [options]

\x1b[1mInvoicing:\x1b[0m
  create inv           Create invoice (interactive)
  list inv             List invoices
  view inv <num>       View invoice details
  send inv <num>       Mark as sent
  paid inv <num>       Mark as paid
  delete inv <num>     Delete invoice

\x1b[1mCustomers:\x1b[0m
  add cust             Add customer (interactive)
  list cust            List customers
  view cust <name>     View customer details
  search cust <query>  Search customers

\x1b[1mPayments & Expenses:\x1b[0m
  record pay           Record payment received
  list pay             List payments
  add exp              Add expense
  list exp             List expenses

\x1b[1mReports:\x1b[0m
  report balance       Balance sheet
  report pl            Profit & Loss
  report ar            Accounts receivable aging
  report cashflow      Cash flow statement
  report expenses      Expenses by category

\x1b[1mAI Agent:\x1b[0m
  chat                 Interactive AI chat (can create invoices, expenses)
  ask <question>       Quick question about your finances

  \x1b[2mIn chat mode, drop a file path to upload receipts/statements:\x1b[0m
  \x1b[2m  ~/Downloads/receipt.jpg\x1b[0m
  \x1b[2m  /path/to/statement.csv\x1b[0m

\x1b[1mSetup & Config:\x1b[0m
  init                 Run setup wizard
  config list          Show all settings
  config set <k> <v>   Set a configuration value
  config get <key>     Get a configuration value
  backup               Create database backup
  restore <file>       Restore from backup

\x1b[1mSession:\x1b[0m
  oa                   Start interactive session
  dashboard            Show dashboard
  help                 Show this help

\x1b[1mExamples:\x1b[0m
  oa                            # Start interactive mode
  oa chat                       # Chat with AI agent
  oa create inv                 # Create invoice
  oa ask "what am I owed?"      # Quick AI query
  oa report pl                  # Profit & Loss report
  oa config set business_name "Acme Inc"
`);
}

// Customer commands
async function customerCommand(args: string[]): Promise<void> {
  const sub = args[0];
  const parsed = parseFlags(args.slice(1));

  switch (sub) {
    case "add":
    case "new": {
      let name = args[1] && !args[1].startsWith("--") ? args[1] : parsed.name;

      if (!name) {
        const answers = await inquirer.prompt([
          { type: "input", name: "name", message: "Customer name:" },
          { type: "input", name: "email", message: "Email:" },
          { type: "input", name: "phone", message: "Phone:" },
          { type: "input", name: "address", message: "Address:" },
        ]);
        const customer = createCustomer(answers);
        printSuccess(`Customer added: ${customer.name}`);
      } else {
        const customer = createCustomer({
          name,
          email: parsed.email,
          phone: parsed.phone,
          address: parsed.address,
        });
        printSuccess(`Customer added: ${customer.name}`);
      }
      break;
    }

    case "list":
    case "ls": {
      const customers = listCustomers();
      if (customers.length === 0) {
        printDim("No customers. Add one with: oa cust add");
        return;
      }

      console.log();
      printHeader("Customers");
      console.log();

      const columns = [
        { header: "Name", width: 20, align: "left" as const },
        { header: "Email", width: 25, align: "left" as const },
        { header: "Balance", width: 12, align: "right" as const },
      ];

      const rows = customers.map((c) => [
        c.name.slice(0, 20),
        (c.email || "").slice(0, 25),
        c.balance > 0 ? `${colors.yellow}${formatMoney(c.balance).trim()}${colors.reset}` : formatMoney(0).trim(),
      ]);

      printTable(columns, rows);
      console.log();
      break;
    }

    case "view":
    case "show": {
      const name = args[1];
      if (!name) {
        printError("Missing customer name");
        return;
      }
      const customer = getCustomer(name);
      if (!customer) {
        printError(`Customer not found: ${name}`);
        return;
      }

      console.log();
      console.log(`\x1b[1m${customer.name}\x1b[0m`);
      if (customer.email) console.log(`  Email: ${customer.email}`);
      if (customer.phone) console.log(`  Phone: ${customer.phone}`);
      if (customer.address) console.log(`  Address: ${customer.address}`);
      console.log(`  Terms: ${customer.payment_terms}`);
      console.log();
      break;
    }

    case "find":
    case "search": {
      const query = args[1];
      if (!query) {
        printError("Missing search term");
        printDim("Usage: oa cust find <name>");
        return;
      }
      const results = searchCustomers(query);
      if (results.length === 0) {
        printDim(`No customers found matching "${query}"`);
        return;
      }
      console.log();
      console.log(`\x1b[1mSearch results for "${query}":\x1b[0m`);
      for (const c of results) {
        console.log(`  ${c.name}${c.email ? ` (${c.email})` : ""}`);
      }
      console.log();
      break;
    }

    default:
      printError(`Unknown: cust ${sub || ""}`);
      printDim("Commands: add, list, view, find");
  }
}

// Payment commands
async function paymentCommand(args: string[]): Promise<void> {
  const sub = args[0];
  const parsed = parseFlags(args.slice(1));

  switch (sub) {
    case "record":
    case "new": {
      let amount = parsed.amount ? parseFloat(parsed.amount) : undefined;
      let invoiceId: number | undefined;
      let customerId: number | undefined;

      if (!amount) {
        const answers = await inquirer.prompt([
          { type: "number", name: "amount", message: "Amount received ($):" },
          { type: "input", name: "invoice", message: "Invoice # (optional):" },
          { type: "input", name: "reference", message: "Reference (optional):" },
        ]);
        amount = answers.amount;

        if (answers.invoice) {
          const inv = getInvoice(answers.invoice);
          if (inv) {
            invoiceId = inv.id;
            customerId = inv.customer_id;
          }
        }
      } else {
        if (parsed.invoice) {
          const inv = getInvoice(parsed.invoice);
          if (inv) {
            invoiceId = inv.id;
            customerId = inv.customer_id;
          }
        }
        if (parsed.from) {
          const cust = getCustomer(parsed.from);
          if (cust) customerId = cust.id;
        }
      }

      const payment = recordPayment({
        amount: amount!,
        invoice_id: invoiceId,
        customer_id: customerId,
        reference: parsed.reference,
      });

      printSuccess(`Payment recorded: $${payment.amount.toFixed(2)}`);
      if (invoiceId) {
        const inv = getInvoice(invoiceId);
        console.log(`  Invoice ${inv?.number}: ${inv?.status}`);
      }
      break;
    }

    case "list":
    case "ls": {
      const payments = listPayments({ type: "received" });
      if (payments.length === 0) {
        printDim("No payments recorded");
        return;
      }

      console.log();
      printHeader("Payments Received");
      console.log();

      const columns = [
        { header: "Date", width: 12, align: "left" as const },
        { header: "From", width: 18, align: "left" as const },
        { header: "Amount", width: 12, align: "right" as const },
        { header: "Method", width: 8, align: "left" as const },
      ];

      const rows = payments.slice(0, 20).map((p) => [
        p.date,
        (p.customer_name || p.invoice_number || "").slice(0, 18),
        `${colors.green}${formatMoney(p.amount).trim()}${colors.reset}`,
        p.method,
      ]);

      printTable(columns, rows);

      const summary = getPaymentSummary();
      console.log();
      console.log(`  Total received: ${colors.green}${formatMoney(summary.total_received).trim()}${colors.reset}`);
      console.log();
      break;
    }

    default:
      printError(`Unknown: pay ${sub || ""}`);
      printDim("Commands: record, list");
  }
}

// Expense commands
async function expenseCommand(args: string[]): Promise<void> {
  const sub = args[0];
  const parsed = parseFlags(args.slice(1));

  switch (sub) {
    case "add":
    case "new": {
      let amount = parsed.amount ? parseFloat(parsed.amount) : undefined;
      let category = parsed.category;

      if (!amount || !category) {
        const answers = await inquirer.prompt([
          { type: "number", name: "amount", message: "Amount ($):" },
          {
            type: "list",
            name: "category",
            message: "Category:",
            choices: [
              "Software & Subscriptions",
              "Office Supplies",
              "Professional Services",
              "Travel",
              "Meals & Entertainment",
              "Advertising",
              "Rent",
              "Utilities",
              "Other",
            ],
          },
          { type: "input", name: "description", message: "Description:" },
          { type: "input", name: "vendor", message: "Vendor (optional):" },
        ]);

        amount = answers.amount;
        category = answers.category;
        parsed.description = answers.description;
        parsed.vendor = answers.vendor;
      }

      const expense = recordExpense({
        amount: amount!,
        category: category!,
        description: parsed.description,
        vendor_name: parsed.vendor,
      });

      printSuccess(`Expense recorded: $${expense.amount.toFixed(2)}`);
      console.log(`  Category: ${category}`);
      break;
    }

    case "list":
    case "ls": {
      const payments = listPayments({ type: "sent" });
      if (payments.length === 0) {
        printDim("No expenses recorded");
        return;
      }

      console.log();
      console.log("\x1b[1m\x1b[36mExpenses\x1b[0m");
      console.log();

      for (const p of payments.slice(0, 20)) {
        const vendor = p.vendor_name || "";
        console.log(`  ${p.date}  \x1b[31m-$${p.amount.toFixed(2)}\x1b[0m  ${vendor}`);
      }

      const summary = getPaymentSummary();
      console.log();
      console.log(`  Total expenses: $${summary.total_sent.toFixed(2)}`);
      break;
    }

    default:
      // Default to add
      await expenseCommand(["add", ...args]);
  }
}

// Report commands
async function reportCommand(args: string[]): Promise<void> {
  const sub = args[0];
  const parsed = parseFlags(args.slice(1));

  // Default date range: current month
  const now = new Date();
  const fromDate = parsed.from || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const toDate = parsed.to || now.toISOString().split("T")[0];

  switch (sub) {
    case "balance":
    case "bs": {
      const report = getBalanceSheet();

      console.log();
      printHeader("Balance Sheet");
      console.log(`  As of ${report.date}`);
      console.log();

      printSection("Assets");
      console.log(`${colors.dim}│${colors.reset}  Cash                   ${formatMoney(report.assets.cash)}`);
      console.log(`${colors.dim}│${colors.reset}  Accounts Receivable    ${formatMoney(report.assets.receivables)}`);
      console.log(`${colors.dim}│${colors.reset}  ${colors.bold}Total Assets           ${formatMoney(report.assets.total)}${colors.reset}`);
      printSectionEnd();
      console.log();

      printSection("Equity");
      console.log(`${colors.dim}│${colors.reset}  Retained Earnings      ${formatMoney(report.equity.retained_earnings)}`);
      printSectionEnd();
      console.log();
      break;
    }

    case "pl":
    case "profit-loss":
    case "income": {
      const report = getProfitLoss(fromDate, toDate);

      console.log();
      printHeader("Profit & Loss");
      console.log(`  ${report.from_date} to ${report.to_date}`);
      console.log();

      printSection("Revenue");
      for (const item of report.revenue.items) {
        if (item.amount > 0) {
          console.log(`${colors.dim}│${colors.reset}  ${item.name.padEnd(22)}${formatMoney(item.amount)}`);
        }
      }
      console.log(`${colors.dim}│${colors.reset}  ${colors.bold}Total Revenue          ${colors.green}${formatMoney(report.revenue.total)}${colors.reset}`);
      printSectionEnd();
      console.log();

      printSection("Expenses");
      for (const item of report.expenses.items) {
        console.log(`${colors.dim}│${colors.reset}  ${item.name.padEnd(22)}${formatMoney(item.amount)}`);
      }
      console.log(`${colors.dim}│${colors.reset}  ${colors.bold}Total Expenses         ${colors.red}${formatMoney(report.expenses.total)}${colors.reset}`);
      printSectionEnd();
      console.log();

      const netColor = report.net_income >= 0 ? colors.green : colors.red;
      console.log(`  ${colors.bold}Net Income             ${netColor}${formatMoney(report.net_income)}${colors.reset}`);
      console.log();
      break;
    }

    case "ar":
    case "receivables": {
      const report = getReceivablesAging();

      console.log();
      printHeader("Accounts Receivable Aging");
      console.log();

      const printBucket = (label: string, items: typeof report.current, total: number, color: string = colors.reset) => {
        if (items.length === 0) return;
        printSection(`${label} (${formatMoney(total).trim()})`);
        for (const inv of items) {
          console.log(`${colors.dim}│${colors.reset}  ${inv.invoice}  ${inv.customer.slice(0, 18).padEnd(18)}  ${color}${formatMoney(inv.amount)}${colors.reset}`);
        }
        printSectionEnd();
        console.log();
      };

      printBucket("Current", report.current, report.totals.current, colors.green);
      printBucket("1-30 Days", report.days_1_30, report.totals.days_1_30, colors.yellow);
      printBucket("31-60 Days", report.days_31_60, report.totals.days_31_60, colors.yellow);
      printBucket("61-90 Days", report.days_61_90, report.totals.days_61_90, colors.red);
      printBucket("90+ Days", report.days_90_plus, report.totals.days_90_plus, colors.red);

      console.log(`  ${colors.bold}Total Outstanding:${formatMoney(report.totals.total)}${colors.reset}`);
      console.log();
      break;
    }

    case "cashflow":
    case "cash": {
      const report = getCashFlow(fromDate, toDate);

      console.log();
      printHeader("Cash Flow Statement");
      console.log(`  ${report.from_date} to ${report.to_date}`);
      console.log();

      console.log(`  Opening Balance:    ${formatMoney(report.opening_balance)}`);
      console.log();

      printSection("Inflows");
      for (const item of report.inflows.items) {
        console.log(`${colors.dim}│${colors.reset}  ${item.description.slice(0, 20).padEnd(20)}  ${colors.green}+${formatMoney(item.amount).trim()}${colors.reset}`);
      }
      printSectionEnd();
      console.log();

      printSection("Outflows");
      for (const item of report.outflows.items) {
        console.log(`${colors.dim}│${colors.reset}  ${item.description.slice(0, 20).padEnd(20)}  ${colors.red}-${formatMoney(item.amount).trim()}${colors.reset}`);
      }
      printSectionEnd();
      console.log();

      const netColor = report.net_change >= 0 ? colors.green : colors.red;
      console.log(`  Net Change:         ${netColor}${formatMoney(report.net_change)}${colors.reset}`);
      console.log(`  ${colors.bold}Closing Balance:    ${formatMoney(report.closing_balance)}${colors.reset}`);
      console.log();
      break;
    }

    case "expenses": {
      const expenses = getExpensesByCategory(fromDate, toDate);

      console.log();
      printHeader("Expenses by Category");
      console.log(`  ${fromDate} to ${toDate}`);
      console.log();

      if (expenses.length === 0) {
        printHint("  No expenses recorded for this period");
      } else {
        const columns = [
          { header: "Category", width: 20, align: "left" as const },
          { header: "Amount", width: 12, align: "right" as const },
          { header: "%", width: 6, align: "right" as const },
        ];

        const rows = expenses.map((exp) => [
          exp.category.slice(0, 20),
          formatMoney(exp.amount).trim(),
          `${exp.percentage}%`,
        ]);

        printTable(columns, rows);

        const total = expenses.reduce((s, e) => s + e.amount, 0);
        console.log();
        console.log(`  ${colors.bold}Total:${formatMoney(total)}${colors.reset}`);
      }
      console.log();
      break;
    }

    default:
      printError(`Unknown report: ${sub || ""}`);
      printDim("Reports: balance, pl, ar, cashflow, expenses");
  }
}

// Dashboard view
async function showDashboard(): Promise<void> {
  const businessName = getSetting("business_name") || "OpenAccounting";

  console.log();
  printHeader(`${businessName} - Dashboard`);
  console.log();

  // Get summary data
  const balanceSheet = getBalanceSheet();
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const today = now.toISOString().split("T")[0];
  const pl = getProfitLoss(monthStart, today);
  const ar = getReceivablesAging();

  // Cash position
  printSection("Cash Position");
  console.log(`${colors.dim}│${colors.reset}  Balance:      ${colors.green}${formatMoney(balanceSheet.assets.cash)}${colors.reset}`);
  console.log(`${colors.dim}│${colors.reset}  Receivables:  ${formatMoney(balanceSheet.assets.receivables)}`);
  printSectionEnd();
  console.log();

  // This month
  printSection("This Month");
  console.log(`${colors.dim}│${colors.reset}  Revenue:      ${colors.green}${formatMoney(pl.revenue.total)}${colors.reset}`);
  console.log(`${colors.dim}│${colors.reset}  Expenses:     ${colors.red}${formatMoney(pl.expenses.total)}${colors.reset}`);
  const netColor = pl.net_income >= 0 ? colors.green : colors.red;
  console.log(`${colors.dim}│${colors.reset}  ${colors.bold}Net:          ${netColor}${formatMoney(pl.net_income)}${colors.reset}`);
  printSectionEnd();
  console.log();

  // Alerts
  if (ar.totals.days_1_30 > 0 || ar.totals.days_31_60 > 0 || ar.totals.days_90_plus > 0) {
    printSection("Alerts", 43);
    if (ar.days_90_plus.length > 0) {
      console.log(`${colors.dim}│${colors.reset}  ${colors.red}⚠ ${ar.days_90_plus.length} invoice(s) 90+ days overdue (${formatMoney(ar.totals.days_90_plus).trim()})${colors.reset}`);
    }
    if (ar.days_31_60.length > 0 || ar.days_61_90.length > 0) {
      const count = ar.days_31_60.length + ar.days_61_90.length;
      const amount = ar.totals.days_31_60 + ar.totals.days_61_90;
      console.log(`${colors.dim}│${colors.reset}  ${colors.yellow}⚠ ${count} invoice(s) 30-90 days overdue (${formatMoney(amount).trim()})${colors.reset}`);
    }
    if (ar.days_1_30.length > 0) {
      console.log(`${colors.dim}│${colors.reset}  ${colors.yellow}• ${ar.days_1_30.length} invoice(s) due soon (${formatMoney(ar.totals.days_1_30).trim()})${colors.reset}`);
    }
    printSectionEnd();
    console.log();
  }

  // Quick actions
  printHint("Quick: create inv │ add cust │ report pl │ help");
  console.log();
}

// Entity aliases
const ENTITY_ALIASES: Record<string, string> = {
  inv: "invoice",
  invoices: "invoice",
  cust: "customer",
  customers: "customer",
  pay: "payment",
  payments: "payment",
  exp: "expense",
  expenses: "expense",
  rep: "report",
  reports: "report",
};

// Valid actions for fuzzy matching
const VALID_ACTIONS = ["create", "new", "list", "ls", "view", "show", "add", "record", "send", "paid", "delete", "rm", "search", "report", "rep", "help", "dashboard", "dash", "ask", "chat", "init", "config", "backup", "restore"];

// Simple fuzzy match - find closest action
function fuzzyMatch(input: string): string | null {
  if (!input) return null;
  const lower = input.toLowerCase();

  // Exact match
  if (VALID_ACTIONS.includes(lower)) return lower;

  // Prefix match (e.g., "cre" -> "create")
  const prefixMatch = VALID_ACTIONS.find(a => a.startsWith(lower));
  if (prefixMatch) return prefixMatch;

  // Contains match (e.g., "eate" -> "create")
  const containsMatch = VALID_ACTIONS.find(a => a.includes(lower));
  if (containsMatch) return containsMatch;

  // Levenshtein distance for typos (simple version)
  let bestMatch = null;
  let bestScore = 3; // Max 2 character difference
  for (const action of VALID_ACTIONS) {
    const dist = levenshtein(lower, action);
    if (dist < bestScore) {
      bestScore = dist;
      bestMatch = action;
    }
  }
  return bestMatch;
}

// Simple Levenshtein distance
function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

// Execute a command (used by both CLI and session modes)
async function executeCommand(cmdArgs: string[]): Promise<void> {
  let action = cmdArgs[0];
  const entity = cmdArgs[1];
  const restArgs = cmdArgs.slice(2);

  // Fuzzy match the action
  if (action && !VALID_ACTIONS.includes(action.toLowerCase())) {
    const matched = fuzzyMatch(action);
    if (matched && matched !== action.toLowerCase()) {
      printDim(`Interpreting "${action}" as "${matched}"`);
      action = matched;
    }
  }

  // Handle built-in commands
  if (action === "help" || action === "--help" || action === "-h") {
    printHelp();
    return;
  }

  if (action === "dashboard" || action === "dash") {
    await showDashboard();
    return;
  }

  // Resolve entity alias
  const resolvedEntity = ENTITY_ALIASES[entity] || entity;

  // Action-first routing: create inv, list cust, etc.
  switch (action) {
    case "create":
    case "new":
      if (resolvedEntity === "invoice") {
        await invoiceCommandV2(["create", ...restArgs]);
      } else if (resolvedEntity === "customer") {
        await customerCommand(["add", ...restArgs]);
      } else {
        printError(`Can't create: ${entity || "(nothing)"}`);
        printDim("Try: create inv, create cust");
      }
      break;

    case "list":
    case "ls":
      if (resolvedEntity === "invoice") {
        await invoiceCommandV2(["list", ...restArgs]);
      } else if (resolvedEntity === "customer") {
        await customerCommand(["list", ...restArgs]);
      } else if (resolvedEntity === "payment") {
        await paymentCommand(["list", ...restArgs]);
      } else if (resolvedEntity === "expense") {
        await expenseCommand(["list", ...restArgs]);
      } else {
        printError(`Can't list: ${entity || "(nothing)"}`);
        printDim("Try: list inv, list cust, list pay");
      }
      break;

    case "view":
    case "show":
      if (resolvedEntity === "invoice" || entity?.startsWith("INV")) {
        const invId = entity?.startsWith("INV") ? entity : restArgs[0];
        await invoiceCommandV2(["view", invId]);
      } else if (resolvedEntity === "customer") {
        await customerCommand(["view", restArgs[0]]);
      } else {
        printError(`Can't view: ${entity || "(nothing)"}`);
        printDim("Try: view inv INV-001, view cust John");
      }
      break;

    case "add":
      if (resolvedEntity === "customer") {
        await customerCommand(["add", ...restArgs]);
      } else if (resolvedEntity === "expense") {
        await expenseCommand(["add", ...restArgs]);
      } else {
        printError(`Can't add: ${entity || "(nothing)"}`);
        printDim("Try: add cust, add exp");
      }
      break;

    case "record":
      if (resolvedEntity === "payment") {
        await paymentCommand(["record", ...restArgs]);
      } else if (resolvedEntity === "expense") {
        await expenseCommand(["add", ...restArgs]);
      } else {
        printError(`Can't record: ${entity || "(nothing)"}`);
        printDim("Try: record pay, record exp");
      }
      break;

    case "send":
      if (resolvedEntity === "invoice" || entity?.startsWith("INV")) {
        const invId = entity?.startsWith("INV") ? entity : restArgs[0];
        await invoiceCommandV2(["send", invId]);
      } else {
        printError("Usage: send inv <number>");
      }
      break;

    case "paid":
    case "mark-paid":
      if (resolvedEntity === "invoice" || entity?.startsWith("INV")) {
        const invId = entity?.startsWith("INV") ? entity : restArgs[0];
        await invoiceCommandV2(["paid", invId]);
      } else {
        printError("Usage: paid inv <number>");
      }
      break;

    case "delete":
    case "rm":
      if (resolvedEntity === "invoice") {
        await invoiceCommandV2(["delete", restArgs[0]]);
      } else if (resolvedEntity === "customer") {
        await customerCommand(["delete", restArgs[0]]);
      } else {
        printError(`Can't delete: ${entity || "(nothing)"}`);
      }
      break;

    case "search":
      if (resolvedEntity === "customer") {
        await customerCommand(["search", ...restArgs]);
      } else {
        printError("Usage: search cust <query>");
      }
      break;

    case "report":
    case "rep":
      // report balance, report pl, etc.
      await reportCommand([entity, ...restArgs]);
      break;

    case "ask":
      // AI agent query: ask <question>
      await askCommand([entity, ...restArgs].filter(Boolean));
      break;

    case "chat":
      // Conversational agent mode
      await chatCommand();
      break;

    case "init":
      // Initialize / setup wizard
      if (entity === "--sample" || restArgs.includes("--sample")) {
        await quickInit({ sampleData: true });
      } else {
        await runSetupWizard();
      }
      break;

    case "config": {
      // Configuration management
      const configAction = entity;
      const configKey = restArgs[0];
      const configValue = restArgs.slice(1).join(" ");

      if (configAction === "set" && configKey && configValue) {
        if (configKey === "api_key") {
          // Save to .env file
          const { writeFileSync, existsSync, readFileSync } = await import("fs");
          const { join } = await import("path");
          const envPath = join(process.cwd(), ".env");
          let envContent = existsSync(envPath) ? readFileSync(envPath, "utf-8") : "";

          if (envContent.includes("OPENAI_API_KEY=")) {
            envContent = envContent.replace(/OPENAI_API_KEY=.*/g, `OPENAI_API_KEY=${configValue}`);
          } else {
            envContent += `${envContent ? "\n" : ""}OPENAI_API_KEY=${configValue}`;
          }
          writeFileSync(envPath, envContent);
          printSuccess("API key saved to .env");
        } else {
          setSetting(configKey, configValue);
          printSuccess(`Set ${configKey} = ${configValue}`);
        }
      } else if (configAction === "get" && configKey) {
        const value = getSetting(configKey);
        if (value) {
          console.log(`${configKey} = ${value}`);
        } else {
          printDim(`${configKey} is not set`);
        }
      } else if (configAction === "list" || !configAction) {
        console.log();
        printHeader("Configuration");
        console.log();
        console.log(`  business_name:    ${getSetting("business_name") || "(not set)"}`);
        console.log(`  currency:         ${getSetting("currency") || "USD"}`);
        console.log(`  invoice_prefix:   ${getSetting("invoice_prefix") || "INV"}`);
        console.log(`  tax_rate:         ${getSetting("tax_rate") || "0"}%`);
        console.log(`  payment_terms:    ${getSetting("default_payment_terms") || "net_30"}`);
        console.log();
      } else {
        printError("Usage: config set <key> <value> | config get <key> | config list");
      }
      break;
    }

    case "backup": {
      // Backup database
      const { copyFileSync, existsSync } = await import("fs");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const backupPath = `oa-backup-${timestamp}.db`;

      if (existsSync("oa.db")) {
        copyFileSync("oa.db", backupPath);
        printSuccess(`Backup created: ${backupPath}`);
      } else {
        printError("No database found to backup");
      }
      break;
    }

    case "restore": {
      // Restore from backup
      const backupFile = entity;
      if (!backupFile) {
        printError("Usage: oa restore <backup-file>");
        printDim("Example: oa restore oa-backup-2024-01-15.db");
        return;
      }

      const { copyFileSync, existsSync } = await import("fs");
      if (!existsSync(backupFile)) {
        printError(`Backup file not found: ${backupFile}`);
        return;
      }

      // Create safety backup first
      if (existsSync("oa.db")) {
        copyFileSync("oa.db", "oa-before-restore.db");
      }

      copyFileSync(backupFile, "oa.db");
      printSuccess(`Restored from: ${backupFile}`);
      printDim("Previous database saved as oa-before-restore.db");
      break;
    }

    default:
      printError(`Unknown command: ${action || "(none)"}`);
      printDim("Commands: create, list, view, add, record, send, paid, delete, report, ask, chat, config");
  }
}

// Main router
async function main() {
  // No command = start interactive session
  if (!resolvedCommand) {
    // Check for first run
    await checkFirstRun();

    await startSession({
      onCommand: executeCommand,
    });
    return;
  }

  // Version (only as direct CLI arg)
  if (resolvedCommand === "--version" || resolvedCommand === "-v") {
    console.log("oa 0.2.0");
    process.exit(0);
  }

  // Execute command directly
  try {
    await executeCommand([command, ...subArgs]);
  } catch (err) {
    printError((err as Error).message);
    process.exit(1);
  }
}

main();
