/**
 * Smart Context Builder
 *
 * Builds intelligent financial context from the database for AI conversations.
 * Provides relevant insights, alerts, and summaries based on current state.
 */

import { getDb } from "../db/index.js";
import { getBalanceSheet, getProfitLoss, getReceivablesAging, getCashFlow } from "../domain/reports.js";
import { listInvoices, getOverdueInvoices, getInvoiceSummary } from "../domain/invoices.js";
import { listExpenses } from "../domain/expenses.js";
import { listPayments, getPaymentSummary } from "../domain/payments.js";
import { formatCurrency } from "../core/localization.js";

export interface SmartContext {
  /** Summary for the AI prompt */
  summary: string;
  /** Key financial metrics */
  metrics: FinancialMetrics;
  /** Active alerts that need attention */
  alerts: ContextAlert[];
  /** Recent activity summary */
  recentActivity: ActivitySummary;
  /** Insights for proactive suggestions */
  insights: ContextInsight[];
}

export interface FinancialMetrics {
  cashBalance: number;
  accountsReceivable: number;
  accountsPayable: number;
  monthlyRevenue: number;
  monthlyExpenses: number;
  netIncome: number;
  profitMargin: number;
  overdueAmount: number;
  overdueCount: number;
}

export interface ContextAlert {
  type: "warning" | "info" | "success" | "critical";
  title: string;
  message: string;
  actionSuggestion?: string;
}

export interface ActivitySummary {
  invoicesThisMonth: number;
  paymentsReceived: number;
  expensesRecorded: number;
  lastInvoiceDate?: string;
  lastPaymentDate?: string;
}

export interface ContextInsight {
  category: "cashflow" | "receivables" | "expenses" | "growth" | "efficiency";
  title: string;
  description: string;
  value?: number;
  trend?: "up" | "down" | "stable";
}

/**
 * Build comprehensive financial context for AI
 */
export function buildSmartContext(): SmartContext {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthKey = `${lastMonthStart.getFullYear()}-${String(lastMonthStart.getMonth() + 1).padStart(2, "0")}-01`;
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];
  const today = now.toISOString().split("T")[0];

  // Get reports
  const balance = getBalanceSheet();
  const pl = getProfitLoss(monthStart, today);
  const lastPl = getProfitLoss(lastMonthKey, lastMonthEnd);
  const ar = getReceivablesAging();
  const invoiceSummary = getInvoiceSummary();
  const paymentSummary = getPaymentSummary(monthStart, today);

  // Get recent activity
  const recentInvoices = listInvoices({ from_date: monthStart, limit: 50 });
  const recentExpenses = listExpenses({ start_date: monthStart });
  const overdueInvoices = getOverdueInvoices();

  // Build metrics
  const metrics: FinancialMetrics = {
    cashBalance: balance.assets.cash,
    accountsReceivable: balance.assets.receivables,
    accountsPayable: balance.liabilities.payables,
    monthlyRevenue: pl.revenue.total,
    monthlyExpenses: pl.expenses.total,
    netIncome: pl.net_income,
    profitMargin: pl.revenue.total > 0 ? (pl.net_income / pl.revenue.total) * 100 : 0,
    overdueAmount: invoiceSummary.total_overdue,
    overdueCount: invoiceSummary.count_overdue,
  };

  // Build alerts
  const alerts = buildAlerts(metrics, overdueInvoices, balance, ar);

  // Build activity summary
  const recentActivity: ActivitySummary = {
    invoicesThisMonth: recentInvoices.length,
    paymentsReceived: paymentSummary.total_received,
    expensesRecorded: recentExpenses.reduce((sum, e) => sum + e.amount, 0),
    lastInvoiceDate: recentInvoices[0]?.date,
    lastPaymentDate: undefined, // Would need to get from payments
  };

  // Build insights
  const insights = buildInsights(metrics, pl, lastPl, ar);

  // Build summary for AI
  const summary = buildContextSummary(metrics, alerts, recentActivity, insights);

  return {
    summary,
    metrics,
    alerts,
    recentActivity,
    insights,
  };
}

function buildAlerts(
  metrics: FinancialMetrics,
  overdueInvoices: any[],
  balance: any,
  ar: any
): ContextAlert[] {
  const alerts: ContextAlert[] = [];

  // Critical: Negative cash flow
  if (metrics.cashBalance < 0) {
    alerts.push({
      type: "critical",
      title: "Negative Cash Balance",
      message: `Cash account is ${formatCurrency(-metrics.cashBalance)} overdrawn.`,
      actionSuggestion: "Review outstanding payments and consider collecting receivables.",
    });
  }

  // Critical: High overdue amount
  if (metrics.overdueAmount > metrics.monthlyRevenue * 0.5 && metrics.overdueAmount > 1000) {
    alerts.push({
      type: "critical",
      title: "High Overdue Receivables",
      message: `${formatCurrency(metrics.overdueAmount)} overdue across ${metrics.overdueCount} invoices.`,
      actionSuggestion: "Send payment reminders or consider offering payment plans.",
    });
  }

  // Warning: Invoices 90+ days overdue
  if (ar.days_90_plus.length > 0) {
    const amount = ar.totals.days_90_plus;
    alerts.push({
      type: "warning",
      title: "Aged Receivables",
      message: `${ar.days_90_plus.length} invoice(s) are 90+ days overdue (${formatCurrency(amount)}).`,
      actionSuggestion: "These may need escalation or write-off consideration.",
    });
  }

  // Warning: Expenses exceed revenue
  if (metrics.monthlyExpenses > metrics.monthlyRevenue && metrics.monthlyRevenue > 0) {
    const deficit = metrics.monthlyExpenses - metrics.monthlyRevenue;
    alerts.push({
      type: "warning",
      title: "Operating at Loss",
      message: `Expenses exceed revenue by ${formatCurrency(deficit)} this month.`,
      actionSuggestion: "Review expense categories for reduction opportunities.",
    });
  }

  // Info: Low cash runway
  if (metrics.monthlyExpenses > 0 && metrics.cashBalance > 0) {
    const runway = metrics.cashBalance / metrics.monthlyExpenses;
    if (runway < 3) {
      alerts.push({
        type: "info",
        title: "Low Cash Runway",
        message: `At current expense rate, cash covers ${runway.toFixed(1)} months.`,
        actionSuggestion: "Consider collecting receivables or reducing expenses.",
      });
    }
  }

  // Success: Healthy profit margin
  if (metrics.profitMargin > 20 && metrics.monthlyRevenue > 1000) {
    alerts.push({
      type: "success",
      title: "Strong Profitability",
      message: `Profit margin of ${metrics.profitMargin.toFixed(1)}% this month.`,
    });
  }

  return alerts;
}

function buildInsights(
  metrics: FinancialMetrics,
  currentPl: any,
  lastPl: any,
  ar: any
): ContextInsight[] {
  const insights: ContextInsight[] = [];

  // Revenue trend
  if (lastPl.revenue.total > 0) {
    const revenueChange = ((currentPl.revenue.total - lastPl.revenue.total) / lastPl.revenue.total) * 100;
    if (Math.abs(revenueChange) > 10) {
      insights.push({
        category: "growth",
        title: revenueChange > 0 ? "Revenue Growing" : "Revenue Declining",
        description: `Revenue ${revenueChange > 0 ? "up" : "down"} ${Math.abs(revenueChange).toFixed(0)}% vs last month.`,
        value: revenueChange,
        trend: revenueChange > 0 ? "up" : "down",
      });
    }
  }

  // Collection efficiency
  const totalReceivable = metrics.accountsReceivable;
  if (totalReceivable > 0) {
    const overduePercent = (metrics.overdueAmount / totalReceivable) * 100;
    insights.push({
      category: "receivables",
      title: "Collection Health",
      description: overduePercent > 30
        ? `${overduePercent.toFixed(0)}% of receivables are overdue - attention needed.`
        : `${(100 - overduePercent).toFixed(0)}% of receivables are current - healthy.`,
      value: 100 - overduePercent,
      trend: overduePercent > 30 ? "down" : "stable",
    });
  }

  // Expense insights
  if (currentPl.expenses.items.length > 0) {
    const topExpense = currentPl.expenses.items.sort((a: any, b: any) => b.amount - a.amount)[0];
    if (topExpense && topExpense.amount > currentPl.expenses.total * 0.3) {
      insights.push({
        category: "expenses",
        title: "Top Expense Category",
        description: `${topExpense.name} accounts for ${((topExpense.amount / currentPl.expenses.total) * 100).toFixed(0)}% of expenses.`,
        value: topExpense.amount,
      });
    }
  }

  // Cash flow insight
  const netCashFlow = metrics.monthlyRevenue - metrics.monthlyExpenses;
  insights.push({
    category: "cashflow",
    title: "Monthly Cash Flow",
    description: netCashFlow >= 0
      ? `Positive cash flow of ${formatCurrency(netCashFlow)} this month.`
      : `Negative cash flow of ${formatCurrency(Math.abs(netCashFlow))} this month.`,
    value: netCashFlow,
    trend: netCashFlow >= 0 ? "up" : "down",
  });

  return insights;
}

function buildContextSummary(
  metrics: FinancialMetrics,
  alerts: ContextAlert[],
  activity: ActivitySummary,
  insights: ContextInsight[]
): string {
  const lines: string[] = [];

  lines.push("## Financial Snapshot");
  lines.push(`- Cash Balance: ${formatCurrency(metrics.cashBalance)}`);
  lines.push(`- Accounts Receivable: ${formatCurrency(metrics.accountsReceivable)}`);
  if (metrics.overdueAmount > 0) {
    lines.push(`- Overdue: ${formatCurrency(metrics.overdueAmount)} (${metrics.overdueCount} invoices)`);
  }
  lines.push("");

  lines.push("## This Month");
  lines.push(`- Revenue: ${formatCurrency(metrics.monthlyRevenue)}`);
  lines.push(`- Expenses: ${formatCurrency(metrics.monthlyExpenses)}`);
  lines.push(`- Net Income: ${formatCurrency(metrics.netIncome)} (${metrics.profitMargin.toFixed(1)}% margin)`);
  lines.push(`- Invoices Created: ${activity.invoicesThisMonth}`);
  lines.push("");

  if (alerts.length > 0) {
    lines.push("## Alerts Requiring Attention");
    for (const alert of alerts.filter(a => a.type === "critical" || a.type === "warning")) {
      lines.push(`- [${alert.type.toUpperCase()}] ${alert.title}: ${alert.message}`);
    }
    lines.push("");
  }

  if (insights.length > 0) {
    lines.push("## Key Insights");
    for (const insight of insights.slice(0, 3)) {
      const arrow = insight.trend === "up" ? "↑" : insight.trend === "down" ? "↓" : "→";
      lines.push(`- ${arrow} ${insight.title}: ${insight.description}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Get quick financial summary for chat suggestions
 */
export function getQuickSummary(): string {
  const context = buildSmartContext();

  const parts: string[] = [];

  // Cash position
  parts.push(`Cash: ${formatCurrency(context.metrics.cashBalance)}`);

  // Outstanding
  if (context.metrics.accountsReceivable > 0) {
    parts.push(`Receivables: ${formatCurrency(context.metrics.accountsReceivable)}`);
  }

  // This month
  if (context.metrics.netIncome !== 0) {
    const sign = context.metrics.netIncome >= 0 ? "+" : "";
    parts.push(`Month: ${sign}${formatCurrency(context.metrics.netIncome)}`);
  }

  // Alert count
  const criticalAlerts = context.alerts.filter(a => a.type === "critical" || a.type === "warning");
  if (criticalAlerts.length > 0) {
    parts.push(`${criticalAlerts.length} alert(s)`);
  }

  return parts.join(" | ");
}

/**
 * Get suggested questions based on current state
 */
export function getSuggestedQuestions(): string[] {
  const context = buildSmartContext();
  const suggestions: string[] = [];

  // Based on alerts
  if (context.metrics.overdueCount > 0) {
    suggestions.push("Show me overdue invoices");
    suggestions.push("Who owes me money?");
  }

  if (context.metrics.netIncome < 0) {
    suggestions.push("Why am I losing money this month?");
    suggestions.push("Break down my expenses");
  }

  // Based on activity
  if (context.recentActivity.invoicesThisMonth === 0) {
    suggestions.push("Create a new invoice");
  }

  // General suggestions
  suggestions.push("How's my cash flow?");
  suggestions.push("Show me this month's P&L");
  suggestions.push("What are my biggest expenses?");

  // Limit to 5 unique suggestions
  return [...new Set(suggestions)].slice(0, 5);
}

/**
 * Get context for a specific query type
 */
export function getContextForQuery(queryType: "cashflow" | "receivables" | "expenses" | "overview"): string {
  const context = buildSmartContext();

  switch (queryType) {
    case "cashflow":
      return `
Cash Position: ${formatCurrency(context.metrics.cashBalance)}
Monthly Inflow: ${formatCurrency(context.metrics.monthlyRevenue)}
Monthly Outflow: ${formatCurrency(context.metrics.monthlyExpenses)}
Net: ${formatCurrency(context.metrics.netIncome)}
Runway: ${context.metrics.monthlyExpenses > 0 ? (context.metrics.cashBalance / context.metrics.monthlyExpenses).toFixed(1) : "∞"} months
      `.trim();

    case "receivables":
      return `
Total Receivables: ${formatCurrency(context.metrics.accountsReceivable)}
Overdue Amount: ${formatCurrency(context.metrics.overdueAmount)}
Overdue Count: ${context.metrics.overdueCount} invoices
Collection Rate: ${context.metrics.accountsReceivable > 0 ? ((1 - context.metrics.overdueAmount / context.metrics.accountsReceivable) * 100).toFixed(0) : 100}%
      `.trim();

    case "expenses":
      return `
This Month: ${formatCurrency(context.metrics.monthlyExpenses)}
Expense Ratio: ${context.metrics.monthlyRevenue > 0 ? ((context.metrics.monthlyExpenses / context.metrics.monthlyRevenue) * 100).toFixed(0) : 0}% of revenue
      `.trim();

    case "overview":
    default:
      return context.summary;
  }
}
