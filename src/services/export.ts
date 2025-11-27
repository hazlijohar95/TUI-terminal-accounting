/**
 * Data Export Module
 *
 * Exports accounting data to CSV and Excel formats for reporting,
 * backup, and integration with external tools.
 */

import Papa from "papaparse";
import ExcelJS from "exceljs";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { listInvoices, type Invoice } from "../domain/invoices.js";
import { listJournalEntries, type JournalEntry, type JournalLine } from "../domain/journal.js";
import { listCustomers, type Customer } from "../domain/customers.js";
import { listVendors, type Vendor } from "../domain/vendors.js";
import { listExpenses, type ExpenseWithDetails } from "../domain/expenses.js";
import { listPayments, type Payment } from "../domain/payments.js";
import {
  getBalanceSheet,
  getProfitLoss,
  getReceivablesAging,
  getCashFlow,
  getSSTReturn,
} from "../domain/reports.js";
import { formatCurrency } from "../core/localization.js";

export interface ExportOptions {
  format: "csv" | "xlsx";
  outputPath?: string;
  dateFrom?: string;
  dateTo?: string;
  includeHeaders?: boolean;
}

export interface ExportResult {
  success: boolean;
  filePath?: string;
  data?: string | Buffer;
  error?: string;
  rowCount?: number;
}

/**
 * Export invoices to CSV or Excel
 */
export async function exportInvoices(options: ExportOptions): Promise<ExportResult> {
  try {
    const invoices = listInvoices({
      from_date: options.dateFrom,
      to_date: options.dateTo,
    });

    const rows = invoices.map((inv) => ({
      "Invoice #": inv.number,
      "Date": inv.date,
      "Due Date": inv.due_date,
      "Customer": inv.customer_name || "",
      "Subtotal": inv.subtotal,
      "Tax": inv.tax_amount,
      "Total": inv.total,
      "Amount Paid": inv.amount_paid,
      "Balance Due": inv.total - inv.amount_paid,
      "Status": inv.status,
      "E-Invoice Status": inv.einvoice_status || "",
      "E-Invoice UUID": inv.einvoice_uuid || "",
      "Notes": inv.notes || "",
    }));

    return await exportData(rows, "invoices", options);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Export failed" };
  }
}

/**
 * Export journal entries to CSV or Excel
 */
export async function exportJournalEntries(options: ExportOptions): Promise<ExportResult> {
  try {
    const entries = listJournalEntries({
      start_date: options.dateFrom,
      end_date: options.dateTo,
    });

    // Flatten journal entries with their lines
    const rows: Record<string, unknown>[] = [];

    for (const entry of entries) {
      for (const line of entry.lines || []) {
        rows.push({
          "Entry ID": entry.id,
          "Date": entry.date,
          "Description": entry.description,
          "Reference": entry.reference || "",
          "Entry Type": entry.entry_type,
          "Account Code": line.account?.code || "",
          "Account Name": line.account?.name || "",
          "Debit": line.debit || 0,
          "Credit": line.credit || 0,
          "Line Description": line.description || "",
        });
      }
    }

    return await exportData(rows, "journal_entries", options);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Export failed" };
  }
}

/**
 * Export customers to CSV or Excel
 */
export async function exportCustomers(options: ExportOptions): Promise<ExportResult> {
  try {
    const customers = listCustomers();

    const rows = customers.map((cust) => ({
      "ID": cust.id,
      "Name": cust.name,
      "Email": cust.email || "",
      "Phone": cust.phone || "",
      "Address": cust.address || "",
      "TIN": cust.tin || "",
      "ID Type": cust.id_type || "",
      "ID Number": cust.id_number || "",
      "SST Registration": cust.sst_registration || "",
      "Notes": cust.notes || "",
      "Created": cust.created_at,
    }));

    return await exportData(rows, "customers", options);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Export failed" };
  }
}

/**
 * Export vendors to CSV or Excel
 */
export async function exportVendors(options: ExportOptions): Promise<ExportResult> {
  try {
    const vendors = listVendors();

    const rows = vendors.map((v) => ({
      "ID": v.id,
      "Name": v.name,
      "Email": v.email || "",
      "Phone": v.phone || "",
      "Address": v.address || "",
      "Tax ID": v.tax_id || "",
      "Default Category": v.default_category || "",
      "Notes": v.notes || "",
      "Created": v.created_at,
    }));

    return await exportData(rows, "vendors", options);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Export failed" };
  }
}

/**
 * Export expenses to CSV or Excel
 */
export async function exportExpenses(options: ExportOptions): Promise<ExportResult> {
  try {
    const expenses = listExpenses({
      start_date: options.dateFrom,
      end_date: options.dateTo,
    });

    const rows = expenses.map((exp) => ({
      "ID": exp.id,
      "Date": exp.date,
      "Vendor": exp.vendor_name || "",
      "Category": exp.account_name,
      "Amount": exp.amount,
      "Description": exp.description || "",
      "Reference": exp.reference || "",
      "Notes": exp.notes || "",
    }));

    return await exportData(rows, "expenses", options);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Export failed" };
  }
}

/**
 * Export payments to CSV or Excel
 */
export async function exportPayments(options: ExportOptions): Promise<ExportResult> {
  try {
    const payments = listPayments({
      from_date: options.dateFrom,
      to_date: options.dateTo,
    });

    const rows = payments.map((p) => ({
      "ID": p.id,
      "Date": p.date,
      "Type": p.type,
      "Amount": p.amount,
      "Method": p.method,
      "Customer": p.customer_name || "",
      "Vendor": p.vendor_name || "",
      "Invoice #": p.invoice_number || "",
      "Reference": p.reference || "",
      "Bank Reference": p.bank_reference || "",
      "Reconciled": p.reconciled ? "Yes" : "No",
      "Notes": p.notes || "",
    }));

    return await exportData(rows, "payments", options);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Export failed" };
  }
}

/**
 * Export Balance Sheet report
 */
export async function exportBalanceSheet(options: ExportOptions & { asOfDate?: string }): Promise<ExportResult> {
  try {
    const report = getBalanceSheet(options.asOfDate);
    const rows: Record<string, unknown>[] = [];

    // Assets
    for (const item of report.assets.items) {
      rows.push({
        "Section": "Assets",
        "Account Code": item.code,
        "Account Name": item.name,
        "Balance": item.amount,
      });
    }
    rows.push({
      "Section": "Assets",
      "Account Code": "",
      "Account Name": "TOTAL ASSETS",
      "Balance": report.assets.total,
    });

    // Liabilities
    for (const item of report.liabilities.items) {
      rows.push({
        "Section": "Liabilities",
        "Account Code": item.code,
        "Account Name": item.name,
        "Balance": item.amount,
      });
    }
    rows.push({
      "Section": "Liabilities",
      "Account Code": "",
      "Account Name": "TOTAL LIABILITIES",
      "Balance": report.liabilities.total,
    });

    // Equity
    for (const item of report.equity.items) {
      rows.push({
        "Section": "Equity",
        "Account Code": item.code,
        "Account Name": item.name,
        "Balance": item.amount,
      });
    }
    rows.push({
      "Section": "Equity",
      "Account Code": "",
      "Account Name": "TOTAL EQUITY",
      "Balance": report.equity.total,
    });

    return await exportData(rows, `balance_sheet_${report.date}`, options);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Export failed" };
  }
}

/**
 * Export Profit & Loss report
 */
export async function exportProfitLoss(options: ExportOptions): Promise<ExportResult> {
  try {
    const fromDate = options.dateFrom || getMonthStart();
    const toDate = options.dateTo || getToday();
    const report = getProfitLoss(fromDate, toDate);
    const rows: Record<string, unknown>[] = [];

    // Revenue
    for (const item of report.revenue.items) {
      rows.push({
        "Section": "Revenue",
        "Account Name": item.name,
        "Amount": item.amount,
      });
    }
    rows.push({
      "Section": "Revenue",
      "Account Name": "TOTAL REVENUE",
      "Amount": report.revenue.total,
    });

    // Expenses
    for (const item of report.expenses.items) {
      rows.push({
        "Section": "Expenses",
        "Account Name": item.name,
        "Amount": item.amount,
      });
    }
    rows.push({
      "Section": "Expenses",
      "Account Name": "TOTAL EXPENSES",
      "Amount": report.expenses.total,
    });

    // Net Income
    rows.push({
      "Section": "Summary",
      "Account Name": "NET INCOME",
      "Amount": report.net_income,
    });

    return await exportData(rows, `profit_loss_${fromDate}_${toDate}`, options);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Export failed" };
  }
}

/**
 * Export AR Aging report
 */
export async function exportARaging(options: ExportOptions): Promise<ExportResult> {
  try {
    const report = getReceivablesAging();
    const rows: Record<string, unknown>[] = [];

    // Current
    for (const item of report.current) {
      rows.push({
        "Age": "Current",
        "Customer": item.customer,
        "Invoice #": item.invoice,
        "Amount": item.amount,
        "Due Date": item.due_date,
        "Days Overdue": 0,
      });
    }

    // 1-30 Days
    for (const item of report.days_1_30) {
      rows.push({
        "Age": "1-30 Days",
        "Customer": item.customer,
        "Invoice #": item.invoice,
        "Amount": item.amount,
        "Due Date": item.due_date,
        "Days Overdue": item.days_overdue,
      });
    }

    // 31-60 Days
    for (const item of report.days_31_60) {
      rows.push({
        "Age": "31-60 Days",
        "Customer": item.customer,
        "Invoice #": item.invoice,
        "Amount": item.amount,
        "Due Date": item.due_date,
        "Days Overdue": item.days_overdue,
      });
    }

    // 61-90 Days
    for (const item of report.days_61_90) {
      rows.push({
        "Age": "61-90 Days",
        "Customer": item.customer,
        "Invoice #": item.invoice,
        "Amount": item.amount,
        "Due Date": item.due_date,
        "Days Overdue": item.days_overdue,
      });
    }

    // 90+ Days
    for (const item of report.days_90_plus) {
      rows.push({
        "Age": "90+ Days",
        "Customer": item.customer,
        "Invoice #": item.invoice,
        "Amount": item.amount,
        "Due Date": item.due_date,
        "Days Overdue": item.days_overdue,
      });
    }

    // Totals
    rows.push({
      "Age": "TOTALS",
      "Customer": "",
      "Invoice #": "",
      "Amount": report.totals.total,
      "Due Date": "",
      "Days Overdue": "",
    });

    return await exportData(rows, `ar_aging_${getToday()}`, options);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Export failed" };
  }
}

/**
 * Export Cash Flow report
 */
export async function exportCashFlow(options: ExportOptions): Promise<ExportResult> {
  try {
    const fromDate = options.dateFrom || getMonthStart();
    const toDate = options.dateTo || getToday();
    const report = getCashFlow(fromDate, toDate);
    const rows: Record<string, unknown>[] = [];

    rows.push({
      "Section": "Opening",
      "Description": "Opening Balance",
      "Amount": report.opening_balance,
    });

    // Inflows
    for (const item of report.inflows.items) {
      rows.push({
        "Section": "Inflows",
        "Description": item.description,
        "Amount": item.amount,
      });
    }
    rows.push({
      "Section": "Inflows",
      "Description": "TOTAL INFLOWS",
      "Amount": report.inflows.total,
    });

    // Outflows
    for (const item of report.outflows.items) {
      rows.push({
        "Section": "Outflows",
        "Description": item.description,
        "Amount": -item.amount,
      });
    }
    rows.push({
      "Section": "Outflows",
      "Description": "TOTAL OUTFLOWS",
      "Amount": -report.outflows.total,
    });

    // Summary
    rows.push({
      "Section": "Summary",
      "Description": "Net Change",
      "Amount": report.net_change,
    });
    rows.push({
      "Section": "Summary",
      "Description": "Closing Balance",
      "Amount": report.closing_balance,
    });

    return await exportData(rows, `cash_flow_${fromDate}_${toDate}`, options);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Export failed" };
  }
}

/**
 * Export SST Return report (Malaysia)
 */
export async function exportSSTReturn(options: ExportOptions): Promise<ExportResult> {
  try {
    const fromDate = options.dateFrom || getMonthStart();
    const toDate = options.dateTo || getToday();
    const report = getSSTReturn(fromDate, toDate);
    const rows: Record<string, unknown>[] = [];

    // Summary section
    rows.push({
      "Section": "Part A: Sales Tax",
      "Item": "Taxable Sales @ 5%",
      "Amount": report.sales_tax.taxable_sales_5,
      "Tax": report.sales_tax.tax_output_5,
    });
    rows.push({
      "Section": "Part A: Sales Tax",
      "Item": "Taxable Sales @ 10%",
      "Amount": report.sales_tax.taxable_sales_10,
      "Tax": report.sales_tax.tax_output_10,
    });
    rows.push({
      "Section": "Part A: Sales Tax",
      "Item": "Exempt Sales",
      "Amount": report.sales_tax.exempt_sales,
      "Tax": 0,
    });
    rows.push({
      "Section": "Part A: Sales Tax",
      "Item": "TOTAL SALES TAX",
      "Amount": report.sales_tax.total_sales,
      "Tax": report.sales_tax.total_sales_tax,
    });

    rows.push({
      "Section": "Part B: Service Tax",
      "Item": "Taxable Services @ 6%",
      "Amount": report.service_tax.taxable_services,
      "Tax": report.service_tax.tax_output,
    });
    rows.push({
      "Section": "Part B: Service Tax",
      "Item": "Exempt Services",
      "Amount": report.service_tax.exempt_services,
      "Tax": 0,
    });

    rows.push({
      "Section": "Summary",
      "Item": "Total Tax Payable",
      "Amount": "",
      "Tax": report.summary.total_tax_payable,
    });
    rows.push({
      "Section": "Summary",
      "Item": "Less: Credit B/F",
      "Amount": "",
      "Tax": -report.summary.less_credit_brought_forward,
    });
    rows.push({
      "Section": "Summary",
      "Item": "NET TAX PAYABLE",
      "Amount": "",
      "Tax": report.summary.net_tax_payable,
    });

    return await exportData(rows, `sst_return_${fromDate}_${toDate}`, options);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Export failed" };
  }
}

/**
 * Export all data to a comprehensive Excel workbook
 */
export async function exportAllData(options: ExportOptions): Promise<ExportResult> {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "OpenAccounting";
    workbook.created = new Date();

    // Add Invoices sheet
    const invoices = listInvoices({ from_date: options.dateFrom, to_date: options.dateTo });
    addSheet(workbook, "Invoices", invoices.map((inv) => ({
      "Invoice #": inv.number,
      "Date": inv.date,
      "Due Date": inv.due_date,
      "Customer": inv.customer_name || "",
      "Total": inv.total,
      "Paid": inv.amount_paid,
      "Status": inv.status,
    })));

    // Add Expenses sheet
    const expenses = listExpenses({ start_date: options.dateFrom, end_date: options.dateTo });
    addSheet(workbook, "Expenses", expenses.map((exp) => ({
      "Date": exp.date,
      "Vendor": exp.vendor_name || "",
      "Category": exp.account_name,
      "Amount": exp.amount,
      "Description": exp.description || "",
    })));

    // Add Payments sheet
    const payments = listPayments({ from_date: options.dateFrom, to_date: options.dateTo });
    addSheet(workbook, "Payments", payments.map((p) => ({
      "Date": p.date,
      "Type": p.type,
      "Amount": p.amount,
      "Method": p.method,
      "Reference": p.reference || "",
    })));

    // Add Customers sheet
    const customers = listCustomers();
    addSheet(workbook, "Customers", customers.map((c) => ({
      "Name": c.name,
      "Email": c.email || "",
      "Phone": c.phone || "",
      "Address": c.address || "",
    })));

    // Add Vendors sheet
    const vendors = listVendors();
    addSheet(workbook, "Vendors", vendors.map((v) => ({
      "Name": v.name,
      "Email": v.email || "",
      "Phone": v.phone || "",
      "Address": v.address || "",
    })));

    // Write to file or return buffer
    const buffer = await workbook.xlsx.writeBuffer();

    if (options.outputPath) {
      const filePath = options.outputPath.endsWith(".xlsx")
        ? options.outputPath
        : `${options.outputPath}/all_data_${getToday()}.xlsx`;
      ensureDir(dirname(filePath));
      writeFileSync(filePath, Buffer.from(buffer));
      return { success: true, filePath, rowCount: invoices.length + expenses.length + payments.length };
    }

    return { success: true, data: Buffer.from(buffer), rowCount: invoices.length + expenses.length + payments.length };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Export failed" };
  }
}

// Helper functions

function addSheet(workbook: ExcelJS.Workbook, name: string, data: Record<string, unknown>[]) {
  if (data.length === 0) return;

  const worksheet = workbook.addWorksheet(name);
  const headers = Object.keys(data[0]);

  // Add headers
  worksheet.columns = headers.map((header) => ({
    header,
    key: header,
    width: Math.max(header.length + 2, 15),
  }));

  // Style headers
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };

  // Add data
  for (const row of data) {
    worksheet.addRow(row);
  }

  // Auto-filter
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: data.length + 1, column: headers.length },
  };
}

async function exportData(
  rows: Record<string, unknown>[],
  baseName: string,
  options: ExportOptions
): Promise<ExportResult> {
  if (rows.length === 0) {
    return { success: true, rowCount: 0, data: "" };
  }

  if (options.format === "csv") {
    const csv = Papa.unparse(rows);

    if (options.outputPath) {
      const filePath = options.outputPath.endsWith(".csv")
        ? options.outputPath
        : `${options.outputPath}/${baseName}.csv`;
      ensureDir(dirname(filePath));
      writeFileSync(filePath, csv);
      return { success: true, filePath, rowCount: rows.length };
    }

    return { success: true, data: csv, rowCount: rows.length };
  }

  // Excel format
  const workbook = new ExcelJS.Workbook();
  addSheet(workbook, baseName, rows);

  const buffer = await workbook.xlsx.writeBuffer();

  if (options.outputPath) {
    const filePath = options.outputPath.endsWith(".xlsx")
      ? options.outputPath
      : `${options.outputPath}/${baseName}.xlsx`;
    ensureDir(dirname(filePath));
    writeFileSync(filePath, Buffer.from(buffer));
    return { success: true, filePath, rowCount: rows.length };
  }

  return { success: true, data: Buffer.from(buffer), rowCount: rows.length };
}

function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

function getMonthStart(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}
