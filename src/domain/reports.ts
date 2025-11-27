import { getDb } from "../db/index.js";

export interface BalanceSheetReport {
  date: string;
  assets: {
    cash: number;
    receivables: number;
    other: number;
    total: number;
    items: Array<{ code: string; name: string; amount: number }>;
  };
  liabilities: {
    payables: number;
    other: number;
    total: number;
    items: Array<{ code: string; name: string; amount: number }>;
  };
  equity: {
    retained_earnings: number;
    other: number;
    total: number;
    items: Array<{ code: string; name: string; amount: number }>;
  };
  is_balanced: boolean;
}

export interface ProfitLossReport {
  from_date: string;
  to_date: string;
  revenue: {
    items: Array<{ name: string; amount: number }>;
    total: number;
  };
  expenses: {
    items: Array<{ name: string; amount: number }>;
    total: number;
  };
  net_income: number;
}

export interface ReceivablesAgingReport {
  current: Array<{ customer: string; invoice: string; amount: number; due_date: string }>;
  days_1_30: Array<{ customer: string; invoice: string; amount: number; due_date: string; days_overdue: number }>;
  days_31_60: Array<{ customer: string; invoice: string; amount: number; due_date: string; days_overdue: number }>;
  days_61_90: Array<{ customer: string; invoice: string; amount: number; due_date: string; days_overdue: number }>;
  days_90_plus: Array<{ customer: string; invoice: string; amount: number; due_date: string; days_overdue: number }>;
  totals: {
    current: number;
    days_1_30: number;
    days_31_60: number;
    days_61_90: number;
    days_90_plus: number;
    total: number;
  };
}

export interface CashFlowReport {
  from_date: string;
  to_date: string;
  opening_balance: number;
  inflows: {
    items: Array<{ description: string; amount: number }>;
    total: number;
  };
  outflows: {
    items: Array<{ description: string; amount: number }>;
    total: number;
  };
  net_change: number;
  closing_balance: number;
}

/**
 * Get account balances from journal_lines grouped by account type
 * Uses proper double-entry accounting:
 * - Assets & Expenses: Debit balance (debits - credits)
 * - Liabilities, Equity, Income: Credit balance (credits - debits)
 */
function getAccountBalancesByType(asOfDate: string): Array<{
  account_id: number;
  code: string;
  name: string;
  type: string;
  balance: number;
}> {
  const db = getDb();

  const results = db.prepare(`
    SELECT
      a.id as account_id,
      a.code,
      a.name,
      a.type,
      COALESCE(SUM(jl.debit), 0) as total_debits,
      COALESCE(SUM(jl.credit), 0) as total_credits
    FROM accounts a
    LEFT JOIN journal_lines jl ON a.id = jl.account_id
    LEFT JOIN journal_entries je ON jl.entry_id = je.id AND je.date <= ?
    WHERE a.is_active = 1
    GROUP BY a.id, a.code, a.name, a.type
    ORDER BY a.code
  `).all(asOfDate) as Array<{
    account_id: number;
    code: string;
    name: string;
    type: string;
    total_debits: number;
    total_credits: number;
  }>;

  return results.map((row) => {
    // Calculate balance based on account type normal balance
    let balance: number;
    if (row.type === "asset" || row.type === "expense") {
      // Debit normal balance: debits increase, credits decrease
      balance = row.total_debits - row.total_credits;
    } else {
      // Credit normal balance (liability, equity, income): credits increase, debits decrease
      balance = row.total_credits - row.total_debits;
    }

    return {
      account_id: row.account_id,
      code: row.code,
      name: row.name,
      type: row.type,
      balance,
    };
  });
}

export function getBalanceSheet(asOfDate?: string): BalanceSheetReport {
  const date = asOfDate || new Date().toISOString().split("T")[0];

  const accountBalances = getAccountBalancesByType(date);

  // Group by account type
  const assets = accountBalances.filter((a) => a.type === "asset" && a.balance !== 0);
  const liabilities = accountBalances.filter((a) => a.type === "liability" && a.balance !== 0);
  const equityAccounts = accountBalances.filter((a) => a.type === "equity" && a.balance !== 0);

  // Calculate totals
  const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0);
  const totalLiabilities = liabilities.reduce((sum, a) => sum + a.balance, 0);
  const totalEquityAccounts = equityAccounts.reduce((sum, a) => sum + a.balance, 0);

  // Calculate retained earnings from income - expenses (cumulative P&L)
  const income = accountBalances
    .filter((a) => a.type === "income")
    .reduce((sum, a) => sum + a.balance, 0);
  const expenses = accountBalances
    .filter((a) => a.type === "expense")
    .reduce((sum, a) => sum + a.balance, 0);
  const retainedEarnings = income - expenses;

  const totalEquity = totalEquityAccounts + retainedEarnings;

  // Identify specific account categories
  const cashAccounts = assets.filter((a) => a.code.startsWith("11")); // 1100-1199
  const receivableAccounts = assets.filter((a) => a.code.startsWith("12")); // 1200-1299
  const otherAssets = assets.filter((a) => !a.code.startsWith("11") && !a.code.startsWith("12"));

  const payableAccounts = liabilities.filter((a) => a.code.startsWith("21")); // 2100-2199
  const otherLiabilities = liabilities.filter((a) => !a.code.startsWith("21"));

  return {
    date,
    assets: {
      cash: cashAccounts.reduce((sum, a) => sum + a.balance, 0),
      receivables: receivableAccounts.reduce((sum, a) => sum + a.balance, 0),
      other: otherAssets.reduce((sum, a) => sum + a.balance, 0),
      total: totalAssets,
      items: assets.map((a) => ({ code: a.code, name: a.name, amount: a.balance })),
    },
    liabilities: {
      payables: payableAccounts.reduce((sum, a) => sum + a.balance, 0),
      other: otherLiabilities.reduce((sum, a) => sum + a.balance, 0),
      total: totalLiabilities,
      items: liabilities.map((a) => ({ code: a.code, name: a.name, amount: a.balance })),
    },
    equity: {
      retained_earnings: retainedEarnings,
      other: totalEquityAccounts,
      total: totalEquity,
      items: [
        ...equityAccounts.map((a) => ({ code: a.code, name: a.name, amount: a.balance })),
        { code: "RE", name: "Retained Earnings", amount: retainedEarnings },
      ],
    },
    is_balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
  };
}

export function getProfitLoss(fromDate: string, toDate: string): ProfitLossReport {
  const db = getDb();

  // Revenue from income accounts (credit normal balance: credits - debits)
  const revenueItems = db.prepare(`
    SELECT
      a.name,
      COALESCE(SUM(jl.credit), 0) - COALESCE(SUM(jl.debit), 0) as amount
    FROM accounts a
    LEFT JOIN journal_lines jl ON a.id = jl.account_id
    LEFT JOIN journal_entries je ON jl.entry_id = je.id
      AND je.date >= ? AND je.date <= ?
    WHERE a.type = 'income' AND a.is_active = 1
    GROUP BY a.id, a.name
    HAVING amount != 0
    ORDER BY amount DESC
  `).all(fromDate, toDate) as Array<{ name: string; amount: number }>;

  // Expenses from expense accounts (debit normal balance: debits - credits)
  const expenseItems = db.prepare(`
    SELECT
      a.name,
      COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0) as amount
    FROM accounts a
    LEFT JOIN journal_lines jl ON a.id = jl.account_id
    LEFT JOIN journal_entries je ON jl.entry_id = je.id
      AND je.date >= ? AND je.date <= ?
    WHERE a.type = 'expense' AND a.is_active = 1
    GROUP BY a.id, a.name
    HAVING amount != 0
    ORDER BY amount DESC
  `).all(fromDate, toDate) as Array<{ name: string; amount: number }>;

  const totalRevenue = revenueItems.reduce((sum, item) => sum + item.amount, 0);
  const totalExpenses = expenseItems.reduce((sum, item) => sum + item.amount, 0);

  return {
    from_date: fromDate,
    to_date: toDate,
    revenue: {
      items: revenueItems,
      total: totalRevenue,
    },
    expenses: {
      items: expenseItems,
      total: totalExpenses,
    },
    net_income: totalRevenue - totalExpenses,
  };
}

export function getReceivablesAging(): ReceivablesAgingReport {
  const db = getDb();
  const today = new Date();

  const invoices = db.prepare(`
    SELECT
      i.number as invoice,
      c.name as customer,
      (i.total - i.amount_paid) as amount,
      i.due_date
    FROM invoices i
    JOIN customers c ON i.customer_id = c.id
    WHERE i.status NOT IN ('paid', 'cancelled')
    AND (i.total - i.amount_paid) > 0
    ORDER BY i.due_date
  `).all() as Array<{ invoice: string; customer: string; amount: number; due_date: string }>;

  const current: ReceivablesAgingReport["current"] = [];
  const days_1_30: ReceivablesAgingReport["days_1_30"] = [];
  const days_31_60: ReceivablesAgingReport["days_31_60"] = [];
  const days_61_90: ReceivablesAgingReport["days_61_90"] = [];
  const days_90_plus: ReceivablesAgingReport["days_90_plus"] = [];

  for (const inv of invoices) {
    const dueDate = new Date(inv.due_date);
    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysOverdue <= 0) {
      current.push(inv);
    } else if (daysOverdue <= 30) {
      days_1_30.push({ ...inv, days_overdue: daysOverdue });
    } else if (daysOverdue <= 60) {
      days_31_60.push({ ...inv, days_overdue: daysOverdue });
    } else if (daysOverdue <= 90) {
      days_61_90.push({ ...inv, days_overdue: daysOverdue });
    } else {
      days_90_plus.push({ ...inv, days_overdue: daysOverdue });
    }
  }

  return {
    current,
    days_1_30,
    days_31_60,
    days_61_90,
    days_90_plus,
    totals: {
      current: current.reduce((s, i) => s + i.amount, 0),
      days_1_30: days_1_30.reduce((s, i) => s + i.amount, 0),
      days_31_60: days_31_60.reduce((s, i) => s + i.amount, 0),
      days_61_90: days_61_90.reduce((s, i) => s + i.amount, 0),
      days_90_plus: days_90_plus.reduce((s, i) => s + i.amount, 0),
      total: invoices.reduce((s, i) => s + i.amount, 0),
    },
  };
}

export function getCashFlow(fromDate: string, toDate: string): CashFlowReport {
  const db = getDb();

  // Get cash account (1100 series)
  const cashAccountCodes = db.prepare(`
    SELECT id FROM accounts WHERE code LIKE '11%' AND type = 'asset'
  `).all() as Array<{ id: number }>;
  const cashAccountIds = cashAccountCodes.map((a) => a.id);

  if (cashAccountIds.length === 0) {
    return {
      from_date: fromDate,
      to_date: toDate,
      opening_balance: 0,
      inflows: { items: [], total: 0 },
      outflows: { items: [], total: 0 },
      net_change: 0,
      closing_balance: 0,
    };
  }

  const accountIdList = cashAccountIds.join(",");

  // Opening balance: sum of all cash account movements before fromDate
  const opening = db.prepare(`
    SELECT
      COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0) as balance
    FROM journal_lines jl
    JOIN journal_entries je ON jl.entry_id = je.id
    WHERE jl.account_id IN (${accountIdList})
    AND je.date < ?
  `).get(fromDate) as { balance: number };

  // Inflows: debits to cash accounts (money coming in) grouped by contra account
  const inflows = db.prepare(`
    SELECT
      COALESCE(contra.name, je.description, 'Other') as description,
      SUM(jl.debit) as amount
    FROM journal_lines jl
    JOIN journal_entries je ON jl.entry_id = je.id
    LEFT JOIN journal_lines contra_line ON contra_line.entry_id = je.id
      AND contra_line.account_id != jl.account_id
      AND contra_line.credit > 0
    LEFT JOIN accounts contra ON contra_line.account_id = contra.id
    WHERE jl.account_id IN (${accountIdList})
    AND jl.debit > 0
    AND je.date >= ? AND je.date <= ?
    GROUP BY COALESCE(contra.name, je.description, 'Other')
    ORDER BY amount DESC
  `).all(fromDate, toDate) as Array<{ description: string; amount: number }>;

  // Outflows: credits to cash accounts (money going out) grouped by contra account
  const outflows = db.prepare(`
    SELECT
      COALESCE(contra.name, je.description, 'Other') as description,
      SUM(jl.credit) as amount
    FROM journal_lines jl
    JOIN journal_entries je ON jl.entry_id = je.id
    LEFT JOIN journal_lines contra_line ON contra_line.entry_id = je.id
      AND contra_line.account_id != jl.account_id
      AND contra_line.debit > 0
    LEFT JOIN accounts contra ON contra_line.account_id = contra.id
    WHERE jl.account_id IN (${accountIdList})
    AND jl.credit > 0
    AND je.date >= ? AND je.date <= ?
    GROUP BY COALESCE(contra.name, je.description, 'Other')
    ORDER BY amount DESC
  `).all(fromDate, toDate) as Array<{ description: string; amount: number }>;

  const totalInflows = inflows.reduce((s, i) => s + i.amount, 0);
  const totalOutflows = outflows.reduce((s, i) => s + i.amount, 0);
  const netChange = totalInflows - totalOutflows;

  return {
    from_date: fromDate,
    to_date: toDate,
    opening_balance: opening.balance,
    inflows: {
      items: inflows,
      total: totalInflows,
    },
    outflows: {
      items: outflows,
      total: totalOutflows,
    },
    net_change: netChange,
    closing_balance: opening.balance + netChange,
  };
}

export function getExpensesByCategory(fromDate: string, toDate: string): Array<{ category: string; amount: number; percentage: number }> {
  const db = getDb();

  // Get expense accounts with their balances for the period (debit normal balance)
  const expenses = db.prepare(`
    SELECT
      a.name as category,
      COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0) as amount
    FROM accounts a
    LEFT JOIN journal_lines jl ON a.id = jl.account_id
    LEFT JOIN journal_entries je ON jl.entry_id = je.id
      AND je.date >= ? AND je.date <= ?
    WHERE a.type = 'expense' AND a.is_active = 1
    GROUP BY a.id, a.name
    HAVING amount > 0
    ORDER BY amount DESC
  `).all(fromDate, toDate) as Array<{ category: string; amount: number }>;

  const total = expenses.reduce((s, e) => s + e.amount, 0);

  return expenses.map((e) => ({
    category: e.category,
    amount: e.amount,
    percentage: total > 0 ? Math.round((e.amount / total) * 100) : 0,
  }));
}

/**
 * SST Return Report for Malaysian Sales and Service Tax
 *
 * Malaysia's SST consists of:
 * - Sales Tax: 5% or 10% on manufactured goods
 * - Service Tax: 6% on prescribed services
 *
 * This report generates data needed for SST-02 return filing
 */
export interface SSTReturnReport {
  period_start: string;
  period_end: string;
  business_info: {
    name: string;
    sst_registration?: string;
    tin?: string;
  };
  // Part A: Sales Tax
  sales_tax: {
    taxable_sales_5: number;       // Sales taxable at 5%
    taxable_sales_10: number;      // Sales taxable at 10%
    exempt_sales: number;          // Exempt sales
    total_sales: number;
    tax_output_5: number;          // 5% tax output
    tax_output_10: number;         // 10% tax output
    total_sales_tax: number;
  };
  // Part B: Service Tax
  service_tax: {
    taxable_services: number;      // Services taxable at 6%
    exempt_services: number;       // Exempt services
    total_services: number;
    tax_output: number;            // 6% service tax
  };
  // Part C: Summary
  summary: {
    total_tax_payable: number;
    less_credit_brought_forward: number;
    less_bad_debt_relief: number;
    net_tax_payable: number;
  };
  // Supporting details
  transactions: Array<{
    date: string;
    invoice_number: string;
    customer: string;
    taxable_amount: number;
    tax_rate: number;
    tax_amount: number;
    type: 'sales' | 'service';
  }>;
  // Filing status
  filing_due_date: string;
  is_nil_return: boolean;
}

import { getSetting } from "../db/index.js";

export function getSSTReturn(fromDate: string, toDate: string): SSTReturnReport {
  const db = getDb();

  // Get business info
  const businessName = getSetting("business_name") || "";
  const sstReg = getSetting("sst_registration") || "";
  const tin = getSetting("tax_id") || "";

  // Get invoices with tax for the period
  const invoicesWithTax = db.prepare(`
    SELECT
      i.number as invoice_number,
      i.date,
      c.name as customer,
      il.quantity * il.unit_price as line_total,
      il.tax_amount,
      CASE
        WHEN il.tax_rate = 5 THEN 'sales_5'
        WHEN il.tax_rate = 10 THEN 'sales_10'
        WHEN il.tax_rate = 6 THEN 'service'
        ELSE 'exempt'
      END as tax_type,
      il.tax_rate
    FROM invoices i
    JOIN customers c ON i.customer_id = c.id
    JOIN invoice_lines il ON i.id = il.invoice_id
    WHERE i.date >= ? AND i.date <= ?
    AND i.status NOT IN ('cancelled', 'draft')
    ORDER BY i.date
  `).all(fromDate, toDate) as Array<{
    invoice_number: string;
    date: string;
    customer: string;
    line_total: number;
    tax_amount: number;
    tax_type: string;
    tax_rate: number;
  }>;

  // Aggregate by tax type
  let taxableSales5 = 0;
  let taxableSales10 = 0;
  let exemptSales = 0;
  let taxOutput5 = 0;
  let taxOutput10 = 0;
  let taxableServices = 0;
  let exemptServices = 0;
  let servicesTax = 0;

  const transactions: SSTReturnReport['transactions'] = [];
  const seenInvoices = new Map<string, {
    date: string;
    invoice_number: string;
    customer: string;
    taxable_amount: number;
    tax_rate: number;
    tax_amount: number;
    type: 'sales' | 'service';
  }>();

  for (const row of invoicesWithTax) {
    const lineAmount = row.line_total || 0;
    const taxAmount = row.tax_amount || 0;

    switch (row.tax_type) {
      case 'sales_5':
        taxableSales5 += lineAmount;
        taxOutput5 += taxAmount;
        break;
      case 'sales_10':
        taxableSales10 += lineAmount;
        taxOutput10 += taxAmount;
        break;
      case 'service':
        taxableServices += lineAmount;
        servicesTax += taxAmount;
        break;
      case 'exempt':
      default:
        // Classify as sales or service based on whether it looks like a service
        // For now, assume it's sales unless specified
        exemptSales += lineAmount;
    }

    // Aggregate transactions by invoice
    const key = `${row.invoice_number}-${row.tax_rate}`;
    const existing = seenInvoices.get(key);
    if (existing) {
      existing.taxable_amount += lineAmount;
      existing.tax_amount += taxAmount;
    } else {
      seenInvoices.set(key, {
        date: row.date,
        invoice_number: row.invoice_number,
        customer: row.customer,
        taxable_amount: lineAmount,
        tax_rate: row.tax_rate,
        tax_amount: taxAmount,
        type: row.tax_type === 'service' ? 'service' : 'sales',
      });
    }
  }

  // Convert transactions to array
  for (const tx of seenInvoices.values()) {
    transactions.push(tx);
  }

  // Calculate filing due date (last day of month after period end)
  const periodEnd = new Date(toDate);
  const filingDueDate = new Date(periodEnd.getFullYear(), periodEnd.getMonth() + 2, 0);

  const totalSalesTax = taxOutput5 + taxOutput10;
  const totalTaxPayable = totalSalesTax + servicesTax;

  return {
    period_start: fromDate,
    period_end: toDate,
    business_info: {
      name: businessName,
      sst_registration: sstReg || undefined,
      tin: tin || undefined,
    },
    sales_tax: {
      taxable_sales_5: taxableSales5,
      taxable_sales_10: taxableSales10,
      exempt_sales: exemptSales,
      total_sales: taxableSales5 + taxableSales10 + exemptSales,
      tax_output_5: taxOutput5,
      tax_output_10: taxOutput10,
      total_sales_tax: totalSalesTax,
    },
    service_tax: {
      taxable_services: taxableServices,
      exempt_services: exemptServices,
      total_services: taxableServices + exemptServices,
      tax_output: servicesTax,
    },
    summary: {
      total_tax_payable: totalTaxPayable,
      less_credit_brought_forward: 0, // Would need to track this from previous periods
      less_bad_debt_relief: 0,        // Would need bad debt tracking
      net_tax_payable: totalTaxPayable,
    },
    transactions: transactions.sort((a, b) => a.date.localeCompare(b.date)),
    filing_due_date: filingDueDate.toISOString().split("T")[0],
    is_nil_return: totalTaxPayable === 0 && taxableSales5 + taxableSales10 + taxableServices === 0,
  };
}
