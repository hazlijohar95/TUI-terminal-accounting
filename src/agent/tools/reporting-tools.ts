/**
 * Reporting Tools
 *
 * Financial reporting tools for the AI Accounting Agent.
 * These tools provide access to financial statements and analytics.
 */

import {
  getBalanceSheet,
  getProfitLoss,
  getReceivablesAging,
  getCashFlow,
  getExpensesByCategory,
} from "../../domain/reports.js";
import { getInvoiceSummary, listInvoices, getOverdueInvoices } from "../../domain/invoices.js";
import { getPaymentSummary, listPayments } from "../../domain/payments.js";
import { listCustomers } from "../../domain/customers.js";
import { defineTool, type AgentTool } from "./tool-registry.js";

/**
 * Get balance sheet report
 */
export const getBalanceSheetTool = defineTool(
  "get_balance_sheet",
  "Get the current balance sheet showing assets, liabilities, and equity",
  "report",
  {
    type: "object",
    properties: {
      as_of_date: {
        type: "string",
        description: "Optional date (YYYY-MM-DD) for the balance sheet. Defaults to today.",
      },
    },
  },
  async (args) => {
    const asOfDate = args.as_of_date as string | undefined;
    const report = getBalanceSheet(asOfDate);

    const summary = `Balance Sheet as of ${report.date}:

ASSETS
  Cash: $${report.assets.cash.toFixed(2)}
  Accounts Receivable: $${report.assets.receivables.toFixed(2)}
  Total Assets: $${report.assets.total.toFixed(2)}

LIABILITIES
  Accounts Payable: $${report.liabilities.payables.toFixed(2)}
  Total Liabilities: $${report.liabilities.total.toFixed(2)}

EQUITY
  Retained Earnings: $${report.equity.retained_earnings.toFixed(2)}
  Total Equity: $${report.equity.total.toFixed(2)}`;

    return {
      success: true,
      result: summary,
      data: report,
    };
  }
);

/**
 * Get profit & loss statement
 */
export const getProfitLossTool = defineTool(
  "get_profit_loss",
  "Get the profit and loss statement for a date range",
  "report",
  {
    type: "object",
    properties: {
      from_date: {
        type: "string",
        description: "Start date (YYYY-MM-DD). Defaults to first of current month.",
      },
      to_date: {
        type: "string",
        description: "End date (YYYY-MM-DD). Defaults to today.",
      },
    },
  },
  async (args) => {
    const now = new Date();
    const fromDate =
      (args.from_date as string) || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const toDate = (args.to_date as string) || now.toISOString().split("T")[0];

    const report = getProfitLoss(fromDate, toDate);

    let summary = `Profit & Loss: ${report.from_date} to ${report.to_date}\n\nREVENUE\n`;
    for (const item of report.revenue.items) {
      summary += `  ${item.name}: $${item.amount.toFixed(2)}\n`;
    }
    summary += `  Total Revenue: $${report.revenue.total.toFixed(2)}\n\nEXPENSES\n`;
    for (const item of report.expenses.items) {
      summary += `  ${item.name}: $${item.amount.toFixed(2)}\n`;
    }
    summary += `  Total Expenses: $${report.expenses.total.toFixed(2)}\n\n`;
    summary += `NET INCOME: $${report.net_income.toFixed(2)}`;

    return {
      success: true,
      result: summary,
      data: report,
    };
  }
);

/**
 * Get accounts receivable aging report
 */
export const getReceivablesAgingTool = defineTool(
  "get_receivables_aging",
  "Get the accounts receivable aging report showing overdue invoices by age",
  "report",
  {
    type: "object",
    properties: {},
  },
  async () => {
    const report = getReceivablesAging();

    let summary = `Accounts Receivable Aging\n\n`;
    summary += `Current (not yet due): $${report.totals.current.toFixed(2)}\n`;
    summary += `1-30 days overdue: $${report.totals.days_1_30.toFixed(2)}\n`;
    summary += `31-60 days overdue: $${report.totals.days_31_60.toFixed(2)}\n`;
    summary += `61-90 days overdue: $${report.totals.days_61_90.toFixed(2)}\n`;
    summary += `90+ days overdue: $${report.totals.days_90_plus.toFixed(2)}\n`;
    summary += `\nTotal Receivables: $${report.totals.total.toFixed(2)}`;

    if (report.days_31_60.length > 0 || report.days_61_90.length > 0 || report.days_90_plus.length > 0) {
      summary += `\n\nSeriously Overdue Invoices:`;
      const serious = [...report.days_31_60, ...report.days_61_90, ...report.days_90_plus];
      for (const inv of serious.slice(0, 10)) {
        summary += `\n  ${inv.invoice}: ${inv.customer} - $${inv.amount.toFixed(2)} (${inv.days_overdue} days)`;
      }
    }

    return {
      success: true,
      result: summary,
      data: report,
    };
  }
);

/**
 * Get cash flow statement
 */
export const getCashFlowTool = defineTool(
  "get_cash_flow",
  "Get the cash flow statement showing inflows and outflows for a period",
  "report",
  {
    type: "object",
    properties: {
      from_date: {
        type: "string",
        description: "Start date (YYYY-MM-DD). Defaults to first of current month.",
      },
      to_date: {
        type: "string",
        description: "End date (YYYY-MM-DD). Defaults to today.",
      },
    },
  },
  async (args) => {
    const now = new Date();
    const fromDate =
      (args.from_date as string) || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const toDate = (args.to_date as string) || now.toISOString().split("T")[0];

    const report = getCashFlow(fromDate, toDate);

    let summary = `Cash Flow Statement: ${report.from_date} to ${report.to_date}\n\n`;
    summary += `Opening Balance: $${report.opening_balance.toFixed(2)}\n\n`;
    summary += `INFLOWS\n`;
    for (const item of report.inflows.items) {
      summary += `  ${item.description}: $${item.amount.toFixed(2)}\n`;
    }
    summary += `  Total Inflows: $${report.inflows.total.toFixed(2)}\n\n`;
    summary += `OUTFLOWS\n`;
    for (const item of report.outflows.items) {
      summary += `  ${item.description}: $${item.amount.toFixed(2)}\n`;
    }
    summary += `  Total Outflows: $${report.outflows.total.toFixed(2)}\n\n`;
    summary += `Net Change: $${report.net_change.toFixed(2)}\n`;
    summary += `Closing Balance: $${report.closing_balance.toFixed(2)}`;

    return {
      success: true,
      result: summary,
      data: report,
    };
  }
);

/**
 * Get expenses by category
 */
export const getExpensesByCategoryTool = defineTool(
  "get_expenses_by_category",
  "Get expense breakdown by category for a date range",
  "report",
  {
    type: "object",
    properties: {
      from_date: {
        type: "string",
        description: "Start date (YYYY-MM-DD). Defaults to first of current month.",
      },
      to_date: {
        type: "string",
        description: "End date (YYYY-MM-DD). Defaults to today.",
      },
    },
  },
  async (args) => {
    const now = new Date();
    const fromDate =
      (args.from_date as string) || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const toDate = (args.to_date as string) || now.toISOString().split("T")[0];

    const expenses = getExpensesByCategory(fromDate, toDate);
    const total = expenses.reduce((sum, e) => sum + e.amount, 0);

    let summary = `Expenses by Category: ${fromDate} to ${toDate}\n\n`;
    for (const exp of expenses) {
      summary += `${exp.category}: $${exp.amount.toFixed(2)} (${exp.percentage}%)\n`;
    }
    summary += `\nTotal: $${total.toFixed(2)}`;

    return {
      success: true,
      result: summary,
      data: { from_date: fromDate, to_date: toDate, expenses, total },
    };
  }
);

/**
 * Get invoice summary
 */
export const getInvoiceSummaryTool = defineTool(
  "get_invoice_summary",
  "Get a summary of invoice status including outstanding and overdue amounts",
  "report",
  {
    type: "object",
    properties: {},
  },
  async () => {
    const summary = getInvoiceSummary();

    const result = `Invoice Summary:

Outstanding: $${summary.total_outstanding.toFixed(2)} (${summary.count_outstanding} invoices)
Overdue: $${summary.total_overdue.toFixed(2)} (${summary.count_overdue} invoices)`;

    return {
      success: true,
      result,
      data: summary,
    };
  }
);

/**
 * Get overdue invoices
 */
export const getOverdueInvoicesTool = defineTool(
  "get_overdue_invoices",
  "List all overdue invoices that need attention",
  "invoice",
  {
    type: "object",
    properties: {},
  },
  async () => {
    const invoices = getOverdueInvoices();

    if (invoices.length === 0) {
      return {
        success: true,
        result: "No overdue invoices! All invoices are current.",
        data: { count: 0, invoices: [] },
      };
    }

    let summary = `Overdue Invoices (${invoices.length}):\n\n`;
    for (const inv of invoices) {
      const daysOverdue = Math.floor(
        (Date.now() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24)
      );
      const outstanding = inv.total - inv.amount_paid;
      summary += `${inv.number}: ${inv.customer_name} - $${outstanding.toFixed(2)} (${daysOverdue} days overdue)\n`;
    }

    return {
      success: true,
      result: summary,
      data: { count: invoices.length, invoices },
    };
  }
);

/**
 * Get payment summary
 */
export const getPaymentSummaryTool = defineTool(
  "get_payment_summary",
  "Get a summary of payments received and sent for a period",
  "report",
  {
    type: "object",
    properties: {
      from_date: {
        type: "string",
        description: "Start date (YYYY-MM-DD). Optional.",
      },
      to_date: {
        type: "string",
        description: "End date (YYYY-MM-DD). Optional.",
      },
    },
  },
  async (args) => {
    const summary = getPaymentSummary(args.from_date as string, args.to_date as string);

    let result = `Payment Summary:\n\n`;
    result += `Total Received: $${summary.total_received.toFixed(2)}\n`;
    result += `Total Sent: $${summary.total_sent.toFixed(2)}\n`;
    result += `Net Cash Flow: $${summary.net_cash_flow.toFixed(2)}\n\n`;
    result += `By Method:\n`;
    for (const [method, amount] of Object.entries(summary.by_method)) {
      result += `  ${method}: $${amount.toFixed(2)}\n`;
    }

    return {
      success: true,
      result,
      data: summary,
    };
  }
);

/**
 * Get revenue by customer
 */
export const getRevenueByCustomerTool = defineTool(
  "get_revenue_by_customer",
  "Get revenue breakdown by customer for a period",
  "report",
  {
    type: "object",
    properties: {
      from_date: {
        type: "string",
        description: "Start date (YYYY-MM-DD). Optional.",
      },
      to_date: {
        type: "string",
        description: "End date (YYYY-MM-DD). Optional.",
      },
    },
  },
  async (args) => {
    const fromDate = args.from_date as string | undefined;
    const toDate = args.to_date as string | undefined;

    const payments = listPayments({
      type: "received",
      from_date: fromDate,
      to_date: toDate,
    });

    // Group by customer
    const byCustomer: Record<string, number> = {};
    for (const payment of payments) {
      const customer = payment.customer_name || "Unknown";
      byCustomer[customer] = (byCustomer[customer] || 0) + payment.amount;
    }

    // Sort by amount
    const sorted = Object.entries(byCustomer).sort((a, b) => b[1] - a[1]);
    const total = sorted.reduce((sum, [, amount]) => sum + amount, 0);

    let result = `Revenue by Customer:\n\n`;
    for (const [customer, amount] of sorted) {
      const percentage = total > 0 ? Math.round((amount / total) * 100) : 0;
      result += `${customer}: $${amount.toFixed(2)} (${percentage}%)\n`;
    }
    result += `\nTotal: $${total.toFixed(2)}`;

    return {
      success: true,
      result,
      data: { by_customer: Object.fromEntries(sorted), total },
    };
  }
);

/**
 * Get business metrics / KPIs
 */
export const getBusinessMetricsTool = defineTool(
  "get_business_metrics",
  "Get key business metrics and KPIs including DSO, collection rate, etc.",
  "report",
  {
    type: "object",
    properties: {},
  },
  async () => {
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const today = now.toISOString().split("T")[0];

    const invoiceSummary = getInvoiceSummary();
    const balance = getBalanceSheet();
    const pl = getProfitLoss(monthStart, today);
    const customers = listCustomers();
    const invoices = listInvoices();

    // Calculate DSO (Days Sales Outstanding)
    const avgDailyRevenue = pl.revenue.total > 0 ? pl.revenue.total / now.getDate() : 1;
    const dso = avgDailyRevenue > 0 ? Math.round(balance.assets.receivables / avgDailyRevenue) : 0;

    // Calculate collection rate (payments received / invoiced this month)
    const invoicedThisMonth = invoices
      .filter((i) => i.date >= monthStart)
      .reduce((sum, i) => sum + i.total, 0);
    const collectionRate = invoicedThisMonth > 0 ? Math.round((pl.revenue.total / invoicedThisMonth) * 100) : 0;

    // Gross margin
    const grossMargin = pl.revenue.total > 0 ? Math.round(((pl.revenue.total - pl.expenses.total) / pl.revenue.total) * 100) : 0;

    // Customer concentration (top customer % of revenue)
    const paymentsByCustomer: Record<string, number> = {};
    const payments = listPayments({ type: "received", from_date: monthStart });
    for (const p of payments) {
      const cust = p.customer_name || "Unknown";
      paymentsByCustomer[cust] = (paymentsByCustomer[cust] || 0) + p.amount;
    }
    const topCustomerRevenue = Math.max(...Object.values(paymentsByCustomer), 0);
    const customerConcentration =
      pl.revenue.total > 0 ? Math.round((topCustomerRevenue / pl.revenue.total) * 100) : 0;

    const metrics = {
      dso,
      collectionRate,
      grossMargin,
      customerConcentration,
      totalCustomers: customers.length,
      totalOutstanding: invoiceSummary.total_outstanding,
      totalOverdue: invoiceSummary.total_overdue,
      currentCash: balance.assets.cash,
    };

    let result = `Business Metrics & KPIs:\n\n`;
    result += `Cash Position: $${metrics.currentCash.toFixed(2)}\n`;
    result += `Days Sales Outstanding (DSO): ${metrics.dso} days\n`;
    result += `Collection Rate: ${metrics.collectionRate}%\n`;
    result += `Gross Margin: ${metrics.grossMargin}%\n`;
    result += `Customer Concentration: ${metrics.customerConcentration}% (top customer)\n`;
    result += `Total Customers: ${metrics.totalCustomers}\n`;
    result += `Outstanding Receivables: $${metrics.totalOutstanding.toFixed(2)}\n`;
    result += `Overdue Amount: $${metrics.totalOverdue.toFixed(2)}`;

    return {
      success: true,
      result,
      data: metrics,
    };
  }
);

/**
 * All reporting tools
 */
export const reportingTools: AgentTool[] = [
  getBalanceSheetTool,
  getProfitLossTool,
  getReceivablesAgingTool,
  getCashFlowTool,
  getExpensesByCategoryTool,
  getInvoiceSummaryTool,
  getOverdueInvoicesTool,
  getPaymentSummaryTool,
  getRevenueByCustomerTool,
  getBusinessMetricsTool,
];
