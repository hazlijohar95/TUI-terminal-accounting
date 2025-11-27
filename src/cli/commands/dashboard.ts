import { loadWorkspaceConfig } from "../../core/workspace.js";
import { parseAnyLedgerFormat } from "../../core/ledger-parser.js";
import { cliLogger } from "../../core/logger.js";

type DashboardData = {
  period: string;
  income: number;
  expenses: number;
  net: number;
  topCategories: Array<{ name: string; amount: number; percentage: number }>;
  alerts: string[];
  transactionCount: number;
  previousPeriod?: {
    income: number;
    expenses: number;
  };
};

export function getDashboardData(month?: string): DashboardData {
  const workspace = loadWorkspaceConfig();
  const entries = parseAnyLedgerFormat(workspace.ledger.path);

  // Default to current month
  const now = new Date();
  const currentMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Previous month for comparison
  const [year, mon] = currentMonth.split("-").map(Number);
  const prevDate = new Date(year, mon - 2, 1);
  const previousMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

  // Normalize date for comparison (handle both YYYY-MM-DD and YYYY/MM/DD)
  const normalizeMonth = (date: string) => date.substring(0, 7).replace("/", "-");

  // Filter entries by period
  const currentEntries = entries.filter(e => normalizeMonth(e.date) === currentMonth);
  const previousEntries = entries.filter(e => normalizeMonth(e.date) === previousMonth);

  // Calculate totals - use account name to determine income vs expense
  let income = 0;
  let expenses = 0;
  const categoryTotals: Record<string, number> = {};

  for (const entry of currentEntries) {
    const amount = Math.abs(entry.amount);
    if (amount === 0) continue; // Skip zero-amount balancing entries

    if (entry.account.startsWith("Income:")) {
      income += amount;
    } else if (entry.account.startsWith("Expenses:")) {
      expenses += amount;
      // Track expense categories
      const category = entry.account.split(":").slice(0, 2).join(":");
      categoryTotals[category] = (categoryTotals[category] || 0) + amount;
    }
    // Skip Assets/Liabilities as they're just the other side of entries
  }

  // Previous period totals
  let prevIncome = 0;
  let prevExpenses = 0;
  const prevCategoryTotals: Record<string, number> = {};

  for (const entry of previousEntries) {
    const amount = Math.abs(entry.amount);
    if (amount === 0) continue;

    if (entry.account.startsWith("Income:")) {
      prevIncome += amount;
    } else if (entry.account.startsWith("Expenses:")) {
      prevExpenses += amount;
      const category = entry.account.split(":").slice(0, 2).join(":");
      prevCategoryTotals[category] = (prevCategoryTotals[category] || 0) + amount;
    }
  }

  // Top categories
  const topCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, amount]) => ({
      name: name.replace("Expenses:", ""),
      amount,
      percentage: expenses > 0 ? Math.round((amount / expenses) * 100) : 0,
    }));

  // Generate alerts
  const alerts: string[] = [];

  // Check for spending increases
  for (const [category, amount] of Object.entries(categoryTotals)) {
    const prevAmount = prevCategoryTotals[category] || 0;
    if (prevAmount > 0) {
      const change = ((amount - prevAmount) / prevAmount) * 100;
      if (change > 20) {
        const catName = category.replace("Expenses:", "");
        alerts.push(`⚠ ${catName} spending up ${Math.round(change)}% vs last month`);
      } else if (change < -20) {
        const catName = category.replace("Expenses:", "");
        alerts.push(`✓ ${catName} spending down ${Math.round(Math.abs(change))}%`);
      }
    }
  }

  // Net income alert
  const net = income - expenses;
  if (net < 0) {
    alerts.push(`⚠ Spending exceeds income by ${formatCurrency(Math.abs(net))}`);
  }

  return {
    period: currentMonth,
    income,
    expenses,
    net,
    topCategories,
    alerts: alerts.slice(0, 3),
    transactionCount: currentEntries.length,
    previousPeriod: {
      income: prevIncome,
      expenses: prevExpenses,
    },
  };
}

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function createBar(percentage: number, maxWidth: number = 10): string {
  const filled = Math.round((percentage / 100) * maxWidth);
  return "█".repeat(filled) + "░".repeat(maxWidth - filled);
}

export function printDashboard(month?: string): void {
  try {
    const data = getDashboardData(month);

    const boxWidth = 45;
    const line = "─".repeat(boxWidth - 2);

    console.log();
    console.log(`┌${line}┐`);
    console.log(`│  \x1b[1m\x1b[36m${data.period} Dashboard\x1b[0m${" ".repeat(boxWidth - 20 - data.period.length)}│`);
    console.log(`├${line}┤`);

    // Summary
    const incomeStr = formatCurrency(data.income).padStart(12);
    const expenseStr = formatCurrency(data.expenses).padStart(12);
    const netStr = formatCurrency(Math.abs(data.net)).padStart(12);
    const netSign = data.net >= 0 ? "+" : "-";
    const netColor = data.net >= 0 ? "\x1b[32m" : "\x1b[31m";

    console.log(`│  Income:   ${incomeStr}${" ".repeat(boxWidth - 27)}│`);
    console.log(`│  Expenses: ${expenseStr}${" ".repeat(boxWidth - 27)}│`);
    console.log(`│  Net:      ${netColor}${netSign}${netStr}\x1b[0m${" ".repeat(boxWidth - 28)}│`);

    // Top spending
    if (data.topCategories.length > 0) {
      console.log(`├${line}┤`);
      console.log(`│  \x1b[1mTop Spending:\x1b[0m${" ".repeat(boxWidth - 17)}│`);

      for (const cat of data.topCategories.slice(0, 4)) {
        const name = cat.name.substring(0, 12).padEnd(12);
        const amount = formatCurrency(cat.amount).padStart(8);
        const pct = `(${cat.percentage}%)`.padStart(5);
        const bar = createBar(cat.percentage, 6);
        console.log(`│  • ${name} ${amount} ${pct} ${bar}│`);
      }
    }

    // Alerts
    if (data.alerts.length > 0) {
      console.log(`├${line}┤`);
      console.log(`│  \x1b[1mAlerts:\x1b[0m${" ".repeat(boxWidth - 11)}│`);

      for (const alert of data.alerts) {
        const truncated = alert.substring(0, boxWidth - 6);
        console.log(`│  ${truncated}${" ".repeat(boxWidth - 4 - truncated.length)}│`);
      }
    }

    // Footer
    console.log(`├${line}┤`);
    console.log(`│  ${data.transactionCount} transactions${" ".repeat(boxWidth - 18 - String(data.transactionCount).length)}│`);
    console.log(`└${line}┘`);
    console.log();

    cliLogger.debug({ month: data.period, transactions: data.transactionCount }, "Dashboard displayed");
  } catch (err) {
    console.error(`\x1b[31mError: ${(err as Error).message}\x1b[0m`);
  }
}

// For TUI usage
export function getDashboardString(month?: string): string {
  const data = getDashboardData(month);

  let output = `## ${data.period} Summary\n\n`;
  output += `**Income:** ${formatCurrency(data.income)}\n`;
  output += `**Expenses:** ${formatCurrency(data.expenses)}\n`;
  output += `**Net:** ${data.net >= 0 ? "+" : ""}${formatCurrency(data.net)}\n\n`;

  if (data.topCategories.length > 0) {
    output += `### Top Spending\n`;
    for (const cat of data.topCategories) {
      output += `• ${cat.name}: ${formatCurrency(cat.amount)} (${cat.percentage}%)\n`;
    }
    output += "\n";
  }

  if (data.alerts.length > 0) {
    output += `### Alerts\n`;
    for (const alert of data.alerts) {
      output += `${alert}\n`;
    }
  }

  return output;
}
