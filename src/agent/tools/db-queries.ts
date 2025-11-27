// Database-aware tools for the agent
import { getDb } from "../../db/index.js";
import {
  getBalanceSheet,
  getProfitLoss,
  getReceivablesAging,
  getCashFlow,
  getExpensesByCategory,
} from "../../domain/reports.js";
import { listInvoices, getInvoiceSummary } from "../../domain/invoices.js";
import { listCustomers } from "../../domain/customers.js";
import { listPayments, getPaymentSummary } from "../../domain/payments.js";
import { listAccounts } from "../../domain/accounts.js";
import { buildSmartContext, type ContextAlert, type ContextInsight } from "../smart-context.js";

export interface DatabaseContext {
  summary: {
    totalCustomers: number;
    totalInvoices: number;
    totalPayments: number;
    cash: number;
    receivables: number;
    payables: number;
  };
  invoices: {
    total: number;
    outstanding: number;
    overdue: number;
    countOverdue: number;
  };
  recentInvoices: Array<{
    number: string;
    customer: string;
    amount: number;
    status: string;
    dueDate: string;
  }>;
  recentPayments: Array<{
    date: string;
    customer: string;
    amount: number;
    invoiceNumber: string;
  }>;
  customers: Array<{
    name: string;
    balance: number;
  }>;
  balanceSheet: {
    cash: number;
    receivables: number;
    totalAssets: number;
    payables: number;
    totalLiabilities: number;
    equity: number;
  };
  profitLoss: {
    revenue: number;
    expenses: number;
    netIncome: number;
  };
  cashFlow: {
    inflows: number;
    outflows: number;
    net: number;
  };
  expensesByCategory: Array<{
    category: string;
    amount: number;
  }>;
  aging: {
    current: number;
    days1_30: number;
    days31_60: number;
    days61_90: number;
    days90Plus: number;
  };
  // Schema awareness - valid options for the agent
  expenseAccounts: Array<{ code: string; name: string }>;
  incomeAccounts: Array<{ code: string; name: string }>;
  validInvoiceNumbers: string[];
  // Smart context - alerts and insights
  alerts: ContextAlert[];
  insights: ContextInsight[];
}

export function getDatabaseContext(): DatabaseContext {
  const db = getDb();

  // Get smart context for alerts and insights
  const smartContext = buildSmartContext();

  // Get basic counts
  const customerCount = db.prepare("SELECT COUNT(*) as count FROM customers").get() as { count: number };
  const invoiceCount = db.prepare("SELECT COUNT(*) as count FROM invoices").get() as { count: number };
  const paymentCount = db.prepare("SELECT COUNT(*) as count FROM payments").get() as { count: number };

  // Calculate date range (current month)
  const now = new Date();
  const fromDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const toDate = now.toISOString().split("T")[0];

  // Get reports
  const balance = getBalanceSheet();
  const pl = getProfitLoss(fromDate, toDate);
  const ar = getReceivablesAging();
  const cf = getCashFlow(fromDate, toDate);
  const expenses = getExpensesByCategory(fromDate, toDate);
  const invoiceSummary = getInvoiceSummary();

  // Get recent invoices (use LIMIT to avoid loading all data)
  const invoices = listInvoices({ limit: 10 });
  const recentInvoices = invoices.map(inv => ({
    number: inv.number,
    customer: inv.customer_name || "Unknown",
    amount: inv.total,
    status: inv.status,
    dueDate: inv.due_date,
  }));

  // Get recent payments (use LIMIT to avoid loading all data)
  const payments = listPayments({ limit: 10 });
  const recentPayments = payments.map(p => ({
    date: p.date,
    customer: p.customer_name || "Unknown",
    amount: p.amount,
    invoiceNumber: p.invoice_number || "",
  }));

  // Get customers with balances (limit to top 20)
  const customers = listCustomers().slice(0, 20).map(c => ({
    name: c.name,
    balance: c.balance,
  }));

  // Get total invoiced with efficient aggregate query
  const totalInvoicedResult = db.prepare(
    "SELECT COALESCE(SUM(total), 0) as total FROM invoices WHERE status != 'cancelled'"
  ).get() as { total: number };
  const totalInvoiced = totalInvoicedResult.total;

  // Schema awareness - get valid account names for agent to use
  const expenseAccounts = listAccounts({ type: 'expense', is_active: true })
    .map(a => ({ code: a.code, name: a.name }));
  const incomeAccounts = listAccounts({ type: 'income', is_active: true })
    .map(a => ({ code: a.code, name: a.name }));

  // Get all outstanding invoice numbers the agent can reference
  const outstandingInvoices = listInvoices({ status: 'outstanding', limit: 50 });
  const validInvoiceNumbers = outstandingInvoices.map(inv => inv.number);

  return {
    summary: {
      totalCustomers: customerCount.count,
      totalInvoices: invoiceCount.count,
      totalPayments: paymentCount.count,
      cash: balance.assets.cash,
      receivables: balance.assets.receivables,
      payables: balance.liabilities.payables,
    },
    invoices: {
      total: totalInvoiced,
      outstanding: invoiceSummary.total_outstanding,
      overdue: invoiceSummary.total_overdue,
      countOverdue: invoiceSummary.count_overdue,
    },
    recentInvoices,
    recentPayments,
    customers,
    balanceSheet: {
      cash: balance.assets.cash,
      receivables: balance.assets.receivables,
      totalAssets: balance.assets.total,
      payables: balance.liabilities.payables,
      totalLiabilities: balance.liabilities.total,
      equity: balance.equity.total,
    },
    profitLoss: {
      revenue: pl.revenue.total,
      expenses: pl.expenses.total,
      netIncome: pl.net_income,
    },
    cashFlow: {
      inflows: cf.inflows.total,
      outflows: cf.outflows.total,
      net: cf.net_change,
    },
    expensesByCategory: expenses.map(c => ({
      category: c.category,
      amount: c.amount,
    })),
    aging: {
      current: ar.totals.current,
      days1_30: ar.totals.days_1_30,
      days31_60: ar.totals.days_31_60,
      days61_90: ar.totals.days_61_90,
      days90Plus: ar.totals.days_90_plus,
    },
    // Schema awareness
    expenseAccounts,
    incomeAccounts,
    validInvoiceNumbers,
    // Smart context
    alerts: smartContext.alerts,
    insights: smartContext.insights,
  };
}

export function buildDatabaseContextString(ctx: DatabaseContext): string {
  let text = "";

  // Lead with alerts - most important for proactive assistance
  if (ctx.alerts && ctx.alerts.length > 0) {
    const criticalAlerts = ctx.alerts.filter(a => a.type === "critical" || a.type === "warning");
    if (criticalAlerts.length > 0) {
      text += `## ⚠️ ALERTS REQUIRING ATTENTION\n`;
      for (const alert of criticalAlerts) {
        const icon = alert.type === "critical" ? "🔴" : "🟡";
        text += `${icon} **${alert.title}**: ${alert.message}\n`;
        if (alert.actionSuggestion) {
          text += `   → Suggested action: ${alert.actionSuggestion}\n`;
        }
      }
      text += `\n`;
    }
  }

  // Add insights for proactive suggestions
  if (ctx.insights && ctx.insights.length > 0) {
    text += `## 📊 Key Insights\n`;
    for (const insight of ctx.insights.slice(0, 3)) {
      const arrow = insight.trend === "up" ? "↑" : insight.trend === "down" ? "↓" : "→";
      text += `${arrow} **${insight.title}**: ${insight.description}\n`;
    }
    text += `\n`;
  }

  // Schema awareness - CRITICAL for agent to know valid options
  text += `## IMPORTANT: Available Account Categories
When recording expenses, you MUST use one of these exact account names:
`;
  if (ctx.expenseAccounts.length > 0) {
    for (const acc of ctx.expenseAccounts) {
      text += `- ${acc.code}: ${acc.name}\n`;
    }
  } else {
    text += `- No expense accounts configured yet\n`;
  }

  text += `\nWhen recording income, use one of these account names:\n`;
  if (ctx.incomeAccounts.length > 0) {
    for (const acc of ctx.incomeAccounts) {
      text += `- ${acc.code}: ${acc.name}\n`;
    }
  } else {
    text += `- No income accounts configured yet\n`;
  }

  if (ctx.validInvoiceNumbers.length > 0) {
    text += `\n## Outstanding Invoices (valid for payments)\n`;
    text += `Invoice numbers: ${ctx.validInvoiceNumbers.join(', ')}\n`;
    text += `NOTE: Only use invoice numbers from this list when recording payments.\n`;
  }

  text += `
## Business Summary
- Customers: ${ctx.summary.totalCustomers}
- Invoices: ${ctx.summary.totalInvoices}
- Payments: ${ctx.summary.totalPayments}
- Cash: $${ctx.summary.cash.toFixed(2)}
- Receivables: $${ctx.summary.receivables.toFixed(2)}
- Payables: $${ctx.summary.payables.toFixed(2)}

## Invoice Status
- Total Invoiced: $${ctx.invoices.total.toFixed(2)}
- Outstanding: $${ctx.invoices.outstanding.toFixed(2)}
- Overdue: $${ctx.invoices.overdue.toFixed(2)} (${ctx.invoices.countOverdue} invoices)

## Balance Sheet
- Cash: $${ctx.balanceSheet.cash.toFixed(2)}
- Receivables: $${ctx.balanceSheet.receivables.toFixed(2)}
- Total Assets: $${ctx.balanceSheet.totalAssets.toFixed(2)}
- Payables: $${ctx.balanceSheet.payables.toFixed(2)}
- Total Liabilities: $${ctx.balanceSheet.totalLiabilities.toFixed(2)}
- Equity: $${ctx.balanceSheet.equity.toFixed(2)}

## Profit & Loss
- Revenue: $${ctx.profitLoss.revenue.toFixed(2)}
- Expenses: $${ctx.profitLoss.expenses.toFixed(2)}
- Net Income: $${ctx.profitLoss.netIncome.toFixed(2)}

## Cash Flow
- Inflows: $${ctx.cashFlow.inflows.toFixed(2)}
- Outflows: $${ctx.cashFlow.outflows.toFixed(2)}
- Net: $${ctx.cashFlow.net.toFixed(2)}

## Receivables Aging
- Current: $${ctx.aging.current.toFixed(2)}
- 1-30 days: $${ctx.aging.days1_30.toFixed(2)}
- 31-60 days: $${ctx.aging.days31_60.toFixed(2)}
- 61-90 days: $${ctx.aging.days61_90.toFixed(2)}
- 90+ days: $${ctx.aging.days90Plus.toFixed(2)}

`;

  if (ctx.expensesByCategory.length > 0) {
    text += `## Expenses by Category\n`;
    for (const exp of ctx.expensesByCategory) {
      text += `- ${exp.category}: $${exp.amount.toFixed(2)}\n`;
    }
    text += `\n`;
  }

  if (ctx.customers.length > 0) {
    text += `## Customers\n`;
    for (const cust of ctx.customers) {
      text += `- ${cust.name}: ${cust.balance > 0 ? `owes $${cust.balance.toFixed(2)}` : "paid up"}\n`;
    }
    text += `\n`;
  }

  if (ctx.recentInvoices.length > 0) {
    text += `## Recent Invoices\n`;
    for (const inv of ctx.recentInvoices) {
      text += `- ${inv.number}: ${inv.customer} - $${inv.amount.toFixed(2)} (${inv.status})\n`;
    }
    text += `\n`;
  }

  if (ctx.recentPayments.length > 0) {
    text += `## Recent Payments\n`;
    for (const pay of ctx.recentPayments) {
      text += `- ${pay.date}: ${pay.customer} - $${pay.amount.toFixed(2)}\n`;
    }
  }

  return text;
}
