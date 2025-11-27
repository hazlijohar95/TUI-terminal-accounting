import { loadWorkspaceConfig } from "../core/workspace.js";
import { parseAnyLedgerFormat } from "../core/ledger-parser.js";
import {
  printTitle,
  printSection,
  printKeyValue,
  printError,
  printDim,
} from "./ui.js";
import { cliLogger } from "../core/logger.js";

function formatCurrency(amount: number): string {
  return `RM ${Math.abs(amount).toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function expensesReport(month: string): void {
  cliLogger.debug({ month }, "Generating expenses report");
  try {
    const workspace = loadWorkspaceConfig();
    const entries = parseAnyLedgerFormat(workspace.ledger.path);

    // Filter by month and only negative amounts (expenses)
    const expenses = entries.filter(
      (e) => e.date.startsWith(month) && e.amount < 0
    );

    // Group by account and sum
    const byAccount: { [account: string]: number } = {};
    let total = 0;

    for (const expense of expenses) {
      const absAmount = Math.abs(expense.amount);
      total += absAmount;
      byAccount[expense.account] = (byAccount[expense.account] || 0) + absAmount;
    }

    // Print report
    printTitle(`Expenses Report (${month})`);

    if (expenses.length === 0) {
      printDim("No expenses found for this period.");
      console.log();
      return;
    }

    printKeyValue("Total expenses", formatCurrency(total));
    console.log();

    printSection("By Account");
    const accounts = Object.entries(byAccount).sort((a, b) => b[1] - a[1]);
    for (const [account, amount] of accounts) {
      console.log(`  ${account.padEnd(30)} ${formatCurrency(amount)}`);
    }
    console.log();
  } catch (err) {
    printError((err as Error).message);
    process.exit(1);
  }
}

export function incomeReport(month: string): void {
  cliLogger.debug({ month }, "Generating income report");
  try {
    const workspace = loadWorkspaceConfig();
    const entries = parseAnyLedgerFormat(workspace.ledger.path);

    // Filter by month and only positive amounts (income)
    const income = entries.filter(
      (e) => e.date.startsWith(month) && e.amount > 0
    );

    // Group by account and sum
    const byAccount: { [account: string]: number } = {};
    let total = 0;

    for (const entry of income) {
      total += entry.amount;
      byAccount[entry.account] = (byAccount[entry.account] || 0) + entry.amount;
    }

    // Print report
    printTitle(`Income Report (${month})`);

    if (income.length === 0) {
      printDim("No income found for this period.");
      console.log();
      return;
    }

    printKeyValue("Total income", formatCurrency(total));
    console.log();

    printSection("By Source");
    const accounts = Object.entries(byAccount).sort((a, b) => b[1] - a[1]);
    for (const [account, amount] of accounts) {
      console.log(`  ${account.padEnd(30)} ${formatCurrency(amount)}`);
    }
    console.log();
  } catch (err) {
    printError((err as Error).message);
    process.exit(1);
  }
}

export function balanceReport(): void {
  cliLogger.debug("Generating balance report");
  try {
    const workspace = loadWorkspaceConfig();
    const entries = parseAnyLedgerFormat(workspace.ledger.path);

    // Group by account and sum all amounts
    const balances: { [account: string]: number } = {};

    for (const entry of entries) {
      balances[entry.account] = (balances[entry.account] || 0) + entry.amount;
    }

    // Print report
    printTitle("Account Balances");

    if (Object.keys(balances).length === 0) {
      printDim("No accounts found.");
      console.log();
      return;
    }

    // Group by account type
    const assets: [string, number][] = [];
    const liabilities: [string, number][] = [];
    const income: [string, number][] = [];
    const expenses: [string, number][] = [];
    const other: [string, number][] = [];

    for (const [account, balance] of Object.entries(balances)) {
      const entry: [string, number] = [account, balance];
      if (account.startsWith("Assets:")) assets.push(entry);
      else if (account.startsWith("Liabilities:")) liabilities.push(entry);
      else if (account.startsWith("Income:")) income.push(entry);
      else if (account.startsWith("Expenses:")) expenses.push(entry);
      else other.push(entry);
    }

    const printGroup = (name: string, items: [string, number][]) => {
      if (items.length === 0) return;
      printSection(name);
      for (const [account, balance] of items.sort((a, b) => b[1] - a[1])) {
        const sign = balance >= 0 ? "+" : "";
        console.log(`  ${account.padEnd(30)} ${sign}${formatCurrency(balance)}`);
      }
      console.log();
    };

    printGroup("Assets", assets);
    printGroup("Liabilities", liabilities);
    printGroup("Income", income);
    printGroup("Expenses", expenses);
    printGroup("Other", other);
  } catch (err) {
    printError((err as Error).message);
    process.exit(1);
  }
}

export function summaryReport(month: string): void {
  cliLogger.debug({ month }, "Generating summary report");
  try {
    const workspace = loadWorkspaceConfig();
    const entries = parseAnyLedgerFormat(workspace.ledger.path);

    // Filter by month
    const monthEntries = entries.filter((e) => e.date.startsWith(month));

    let totalIncome = 0;
    let totalExpenses = 0;

    for (const entry of monthEntries) {
      if (entry.amount > 0) {
        totalIncome += entry.amount;
      } else {
        totalExpenses += Math.abs(entry.amount);
      }
    }

    const netIncome = totalIncome - totalExpenses;

    // Print report
    printTitle(`Monthly Summary (${month})`);

    if (monthEntries.length === 0) {
      printDim("No transactions found for this period.");
      console.log();
      return;
    }

    printKeyValue("Total income", formatCurrency(totalIncome));
    printKeyValue("Total expenses", formatCurrency(totalExpenses));
    console.log();

    printSection("Net Income");
    const sign = netIncome >= 0 ? "+" : "-";
    const color = netIncome >= 0 ? "\x1b[32m" : "\x1b[31m";
    console.log(`  ${color}${sign}${formatCurrency(Math.abs(netIncome))}\x1b[0m`);
    console.log();

    printKeyValue("Transactions", monthEntries.length.toString());
    console.log();
  } catch (err) {
    printError((err as Error).message);
    process.exit(1);
  }
}
