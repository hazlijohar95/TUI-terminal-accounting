import { parseAnyLedgerFormat } from "../core/ledger-parser.js";
import type { LedgerEntry } from "./tools.js";
import { agentLogger } from "../core/logger.js";

type PeriodMetrics = {
  income: number;
  expenses: number;
  net: number;
  transactionCount: number;
};

type CategoryMetrics = {
  name: string;
  amount: number;
  percentage: number;
  transactionCount: number;
  avgTransaction: number;
};

type TrendData = {
  category: string;
  currentAmount: number;
  previousAmount: number;
  changePercent: number;
  direction: "up" | "down" | "stable";
};

type FinancialContext = {
  summary: string;
  currentMonth: PeriodMetrics;
  previousMonth: PeriodMetrics;
  yearToDate: PeriodMetrics;
  topExpenseCategories: CategoryMetrics[];
  topIncomeCategories: CategoryMetrics[];
  trends: TrendData[];
  alerts: string[];
  recentTransactions: Array<{
    date: string;
    description: string;
    amount: number;
    account: string;
  }>;
  accounts: string[];
  dateRange: {
    earliest: string;
    latest: string;
  };
};

function getMonthKey(date: string): string {
  return date.substring(0, 7).replace("/", "-");
}

function calculatePeriodMetrics(entries: LedgerEntry[]): PeriodMetrics {
  let income = 0;
  let expenses = 0;

  for (const entry of entries) {
    if (entry.amount > 0) {
      income += entry.amount;
    } else {
      expenses += Math.abs(entry.amount);
    }
  }

  return {
    income,
    expenses,
    net: income - expenses,
    transactionCount: entries.length,
  };
}

function calculateCategoryMetrics(entries: LedgerEntry[], totalAmount: number): CategoryMetrics[] {
  const categoryTotals: Record<string, { amount: number; count: number }> = {};

  for (const entry of entries) {
    const category = entry.account.split(":").slice(0, 2).join(":");
    if (!categoryTotals[category]) {
      categoryTotals[category] = { amount: 0, count: 0 };
    }
    categoryTotals[category].amount += Math.abs(entry.amount);
    categoryTotals[category].count += 1;
  }

  return Object.entries(categoryTotals)
    .map(([name, data]) => ({
      name,
      amount: data.amount,
      percentage: totalAmount > 0 ? Math.round((data.amount / totalAmount) * 100) : 0,
      transactionCount: data.count,
      avgTransaction: data.count > 0 ? Math.round((data.amount / data.count) * 100) / 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export function buildFinancialContext(ledgerPath: string): FinancialContext {
  const entries = parseAnyLedgerFormat(ledgerPath);

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
  const yearStart = `${now.getFullYear()}-01`;

  // Normalize dates for comparison
  const normalizedEntries = entries.map(e => ({
    ...e,
    monthKey: getMonthKey(e.date),
  }));

  // Filter by periods
  const currentMonthEntries = normalizedEntries.filter(e => e.monthKey === currentMonthKey);
  const previousMonthEntries = normalizedEntries.filter(e => e.monthKey === previousMonthKey);
  const ytdEntries = normalizedEntries.filter(e => e.monthKey >= yearStart);

  // Calculate period metrics
  const currentMonth = calculatePeriodMetrics(currentMonthEntries);
  const previousMonth = calculatePeriodMetrics(previousMonthEntries);
  const yearToDate = calculatePeriodMetrics(ytdEntries);

  // Category breakdowns
  const expenseEntries = currentMonthEntries.filter(e => e.amount < 0);
  const incomeEntries = currentMonthEntries.filter(e => e.amount > 0);
  const prevExpenseEntries = previousMonthEntries.filter(e => e.amount < 0);

  const topExpenseCategories = calculateCategoryMetrics(expenseEntries, currentMonth.expenses).slice(0, 5);
  const topIncomeCategories = calculateCategoryMetrics(incomeEntries, currentMonth.income).slice(0, 3);

  // Calculate trends
  const currentCategoryTotals: Record<string, number> = {};
  const prevCategoryTotals: Record<string, number> = {};

  for (const entry of expenseEntries) {
    const cat = entry.account.split(":").slice(0, 2).join(":");
    currentCategoryTotals[cat] = (currentCategoryTotals[cat] || 0) + Math.abs(entry.amount);
  }

  for (const entry of prevExpenseEntries) {
    const cat = entry.account.split(":").slice(0, 2).join(":");
    prevCategoryTotals[cat] = (prevCategoryTotals[cat] || 0) + Math.abs(entry.amount);
  }

  const trends: TrendData[] = [];
  const allCategories = new Set([...Object.keys(currentCategoryTotals), ...Object.keys(prevCategoryTotals)]);

  for (const category of allCategories) {
    const current = currentCategoryTotals[category] || 0;
    const previous = prevCategoryTotals[category] || 0;

    if (previous > 0 || current > 0) {
      const changePercent = previous > 0 ? Math.round(((current - previous) / previous) * 100) : 100;
      trends.push({
        category,
        currentAmount: current,
        previousAmount: previous,
        changePercent,
        direction: changePercent > 10 ? "up" : changePercent < -10 ? "down" : "stable",
      });
    }
  }

  // Generate alerts
  const alerts: string[] = [];

  // Net income alert
  if (currentMonth.net < 0) {
    alerts.push(`Spending exceeds income by $${Math.abs(currentMonth.net).toFixed(2)} this month`);
  }

  // Significant increases
  for (const trend of trends) {
    if (trend.changePercent > 50 && trend.currentAmount > 100) {
      alerts.push(`${trend.category.replace("Expenses:", "")} up ${trend.changePercent}% vs last month`);
    }
  }

  // Large transactions
  const largeTransactions = currentMonthEntries.filter(e => Math.abs(e.amount) > 500);
  if (largeTransactions.length > 0) {
    alerts.push(`${largeTransactions.length} large transaction(s) over $500 this month`);
  }

  // Get recent transactions
  const recentTransactions = [...entries]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10)
    .map(e => ({
      date: e.date,
      description: e.description,
      amount: e.amount,
      account: e.account,
    }));

  // Get unique accounts
  const accounts = [...new Set(entries.map(e => e.account))].sort();

  // Date range
  const dates = entries.map(e => e.date).sort();
  const dateRange = {
    earliest: dates[0] || "",
    latest: dates[dates.length - 1] || "",
  };

  // Build summary string for the agent
  const summary = buildContextSummary({
    currentMonth,
    previousMonth,
    yearToDate,
    topExpenseCategories,
    trends,
    alerts,
    transactionCount: entries.length,
  });

  agentLogger.debug({
    currentMonth: currentMonthKey,
    transactionCount: entries.length,
    alertCount: alerts.length
  }, "Financial context built");

  return {
    summary,
    currentMonth,
    previousMonth,
    yearToDate,
    topExpenseCategories,
    topIncomeCategories,
    trends,
    alerts,
    recentTransactions,
    accounts,
    dateRange,
  };
}

function buildContextSummary(data: {
  currentMonth: PeriodMetrics;
  previousMonth: PeriodMetrics;
  yearToDate: PeriodMetrics;
  topExpenseCategories: CategoryMetrics[];
  trends: TrendData[];
  alerts: string[];
  transactionCount: number;
}): string {
  const lines: string[] = [];

  lines.push("## Current Month Summary");
  lines.push(`- Income: $${data.currentMonth.income.toFixed(2)}`);
  lines.push(`- Expenses: $${data.currentMonth.expenses.toFixed(2)}`);
  lines.push(`- Net: $${data.currentMonth.net.toFixed(2)}`);
  lines.push(`- Transactions: ${data.currentMonth.transactionCount}`);
  lines.push("");

  if (data.topExpenseCategories.length > 0) {
    lines.push("## Top Expense Categories");
    for (const cat of data.topExpenseCategories.slice(0, 5)) {
      lines.push(`- ${cat.name}: $${cat.amount.toFixed(2)} (${cat.percentage}%)`);
    }
    lines.push("");
  }

  const significantTrends = data.trends.filter(t => Math.abs(t.changePercent) > 20);
  if (significantTrends.length > 0) {
    lines.push("## Notable Trends vs Last Month");
    for (const trend of significantTrends.slice(0, 5)) {
      const dir = trend.changePercent > 0 ? "↑" : "↓";
      lines.push(`- ${trend.category}: ${dir} ${Math.abs(trend.changePercent)}%`);
    }
    lines.push("");
  }

  if (data.alerts.length > 0) {
    lines.push("## Alerts");
    for (const alert of data.alerts) {
      lines.push(`- ${alert}`);
    }
    lines.push("");
  }

  lines.push(`Total transactions in ledger: ${data.transactionCount}`);

  return lines.join("\n");
}

export function getContextForAgent(ledgerPath: string): string {
  const context = buildFinancialContext(ledgerPath);
  return context.summary;
}
