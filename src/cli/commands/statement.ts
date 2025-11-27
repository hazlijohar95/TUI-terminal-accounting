import {
  getInvoices,
  getPayments,
  getExpenses,
  getCustomers,
} from "../../core/storage/index.js";
import {
  printTitle,
  printSection,
  printKeyValue,
  printDim,
  printBullet,
  printError,
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

// Balance Sheet
export function balanceStatement(): void {
  const payments = getPayments();
  const invoices = getInvoices();

  // Calculate totals
  const received = payments.filter((p) => p.type === "received").reduce((s, p) => s + p.amount, 0);
  const sent = payments.filter((p) => p.type === "sent").reduce((s, p) => s + p.amount, 0);
  const cashBalance = received - sent;

  const receivables = invoices
    .filter((i) => i.status !== "paid" && i.status !== "cancelled")
    .reduce((s, i) => s + i.total, 0);

  printTitle("Balance Sheet");
  console.log();

  printSection("Assets");
  printKeyValue("  Cash", `$${cashBalance.toFixed(2)}`);
  printKeyValue("  Accounts Receivable", `$${receivables.toFixed(2)}`);
  console.log();
  printKeyValue("  Total Assets", `$${(cashBalance + receivables).toFixed(2)}`);

  console.log();
  printSection("Equity");
  printKeyValue("  Retained Earnings", `$${(cashBalance + receivables).toFixed(2)}`);
}

// Income Statement (P&L)
export function incomeStatement(args: string[]): void {
  const parsed = parseArgs(args);
  const payments = getPayments();
  const expenses = getExpenses();

  // Filter by month if specified
  let filteredPayments = payments;
  let filteredExpenses = expenses;
  let periodLabel = "All Time";

  if (parsed.month) {
    filteredPayments = payments.filter((p) => p.date.startsWith(parsed.month));
    filteredExpenses = expenses.filter((e) => e.date.startsWith(parsed.month));
    periodLabel = parsed.month;
  }

  // Calculate income
  const income = filteredPayments
    .filter((p) => p.type === "received")
    .reduce((s, p) => s + p.amount, 0);

  // Calculate expenses by category
  const expensesByCategory: Record<string, number> = {};
  for (const expense of filteredExpenses) {
    const cat = expense.category || "General";
    expensesByCategory[cat] = (expensesByCategory[cat] || 0) + expense.amount;
  }

  const totalExpenses = Object.values(expensesByCategory).reduce((s, v) => s + v, 0);
  const netIncome = income - totalExpenses;

  printTitle(`Income Statement - ${periodLabel}`);
  console.log();

  printSection("Revenue");
  printKeyValue("  Sales/Services", `$${income.toFixed(2)}`);
  console.log();

  printSection("Expenses");
  const sortedCategories = Object.entries(expensesByCategory).sort((a, b) => b[1] - a[1]);
  for (const [cat, amount] of sortedCategories) {
    printKeyValue(`  ${cat}`, `$${amount.toFixed(2)}`);
  }
  if (sortedCategories.length === 0) {
    printDim("  (no expenses)");
  }
  console.log();
  printKeyValue("  Total Expenses", `$${totalExpenses.toFixed(2)}`);

  console.log();
  const netColor = netIncome >= 0 ? "\x1b[32m" : "\x1b[31m";
  console.log(`  Net Income:  ${netColor}$${netIncome.toFixed(2)}\x1b[0m`);
}

// Accounts Receivable Aging
export function receivablesStatement(): void {
  const invoices = getInvoices();
  const customers = getCustomers();

  const unpaid = invoices.filter((i) => i.status !== "paid" && i.status !== "cancelled");

  if (unpaid.length === 0) {
    printDim("No outstanding receivables");
    return;
  }

  const today = new Date();

  // Categorize by aging
  const current: typeof unpaid = [];
  const days30: typeof unpaid = [];
  const days60: typeof unpaid = [];
  const days90plus: typeof unpaid = [];

  for (const inv of unpaid) {
    const dueDate = new Date(inv.dueDate);
    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysOverdue <= 0) {
      current.push(inv);
    } else if (daysOverdue <= 30) {
      days30.push(inv);
    } else if (daysOverdue <= 60) {
      days60.push(inv);
    } else {
      days90plus.push(inv);
    }
  }

  printTitle("Accounts Receivable Aging");
  console.log();

  const printAging = (label: string, items: typeof unpaid) => {
    if (items.length === 0) return;
    const total = items.reduce((s, i) => s + i.total, 0);
    printSection(`${label} ($${total.toFixed(2)})`);
    for (const inv of items) {
      console.log(`  ${inv.number}  ${inv.customerName.padEnd(20)}  $${inv.total.toFixed(2)}`);
    }
    console.log();
  };

  printAging("Current", current);
  printAging("1-30 Days", days30);
  printAging("31-60 Days", days60);
  printAging("90+ Days", days90plus);

  const total = unpaid.reduce((s, i) => s + i.total, 0);
  printKeyValue("Total Receivables", `$${total.toFixed(2)}`);
}

// Accounts Payable (future - based on bills)
export function payablesStatement(): void {
  printDim("Accounts payable tracking coming soon");
  printDim("Currently tracking expenses only");
}

// Cash Flow Statement
export function cashFlowStatement(args: string[]): void {
  const parsed = parseArgs(args);
  const payments = getPayments();

  // Filter by month if specified
  let filtered = payments;
  let periodLabel = "All Time";

  if (parsed.month) {
    filtered = payments.filter((p) => p.date.startsWith(parsed.month));
    periodLabel = parsed.month;
  }

  // Group by week/day
  const received = filtered.filter((p) => p.type === "received").reduce((s, p) => s + p.amount, 0);
  const sent = filtered.filter((p) => p.type === "sent").reduce((s, p) => s + p.amount, 0);
  const netCash = received - sent;

  printTitle(`Cash Flow - ${periodLabel}`);
  console.log();

  printSection("Cash Inflows");
  printKeyValue("  Customer Payments", `$${received.toFixed(2)}`);
  console.log();

  printSection("Cash Outflows");
  printKeyValue("  Expenses/Payments", `$${sent.toFixed(2)}`);
  console.log();

  const netColor = netCash >= 0 ? "\x1b[32m" : "\x1b[31m";
  console.log(`  Net Cash Flow:  ${netColor}$${netCash.toFixed(2)}\x1b[0m`);
}

// Main statement command router
export function statementCommand(args: string[]): void {
  const subcommand = args[0];
  const subArgs = args.slice(1);

  switch (subcommand) {
    case "balance":
      balanceStatement();
      break;
    case "income":
      incomeStatement(subArgs);
      break;
    case "receivables":
    case "ar":
      receivablesStatement();
      break;
    case "payables":
    case "ap":
      payablesStatement();
      break;
    case "cashflow":
    case "cash":
      cashFlowStatement(subArgs);
      break;
    default:
      printError(`Unknown statement: ${subcommand || "(none)"}`);
      console.log();
      printDim("Available statements:");
      printBullet("balance     - Balance sheet");
      printBullet("income      - Income statement (P&L)");
      printBullet("receivables - Accounts receivable aging");
      printBullet("payables    - Accounts payable");
      printBullet("cashflow    - Cash flow statement");
      console.log();
      printDim("Options: --month <YYYY-MM>");
  }
}
