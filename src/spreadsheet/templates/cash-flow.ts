/**
 * Cash Flow Forecast Template
 *
 * 12-month cash flow projection with multiple scenarios.
 */

import { SpreadsheetTemplate, TemplateCell } from "./types.js";
import { CellFormat } from "../core/types.js";

// Generate month headers
function getMonthName(offset: number): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const now = new Date();
  const monthIndex = (now.getMonth() + offset) % 12;
  return months[monthIndex];
}

// Build the template dynamically
function buildCashFlowTemplate(): SpreadsheetTemplate {
  const cells: Record<string, TemplateCell> = {};

  // Column widths: A=labels (25), B-M=months (12 each), N=total (14)
  const columnWidths: Record<number, number> = { 0: 25 };
  for (let i = 1; i <= 13; i++) {
    columnWidths[i] = i === 13 ? 14 : 11;
  }

  // Title
  cells["A1"] = { value: "12-MONTH CASH FLOW FORECAST" };
  cells["A2"] = { value: "════════════════════════════════════════════════════════════════════════════════" };

  // Month headers (B-M)
  const colLetters = ["B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M"];
  colLetters.forEach((col, i) => {
    cells[`${col}3`] = { value: getMonthName(i) };
  });
  cells["N3"] = { value: "TOTAL" };

  // Opening Balance
  cells["A4"] = { value: "Opening Cash Balance" };
  cells["B4"] = { value: "50000", format: { numberFormat: "currency" } };
  // Each month's opening = previous month's closing
  for (let i = 1; i < 12; i++) {
    const col = colLetters[i];
    const prevCol = colLetters[i - 1];
    cells[`${col}4`] = { value: `=${prevCol}24`, format: { numberFormat: "currency" } };
  }

  // Cash Inflows Section
  cells["A6"] = { value: "CASH INFLOWS" };

  cells["A7"] = { value: "Sales Revenue" };
  colLetters.forEach((col, i) => {
    // Growing revenue assumption: base + 5% growth per month
    const baseValue = 30000;
    const growth = Math.pow(1.05, i);
    cells[`${col}7`] = { value: String(Math.round(baseValue * growth)), format: { numberFormat: "currency" } };
  });
  cells["N7"] = { value: "=SUM(B7:M7)", format: { numberFormat: "currency" } };

  cells["A8"] = { value: "Service Income" };
  colLetters.forEach((col) => {
    cells[`${col}8`] = { value: "5000", format: { numberFormat: "currency" } };
  });
  cells["N8"] = { value: "=SUM(B8:M8)", format: { numberFormat: "currency" } };

  cells["A9"] = { value: "Other Income" };
  colLetters.forEach((col) => {
    cells[`${col}9`] = { value: "1000", format: { numberFormat: "currency" } };
  });
  cells["N9"] = { value: "=SUM(B9:M9)", format: { numberFormat: "currency" } };

  cells["A10"] = { value: "────────────────────────" };
  cells["A11"] = { value: "Total Inflows" };
  colLetters.forEach((col) => {
    cells[`${col}11`] = { value: `=SUM(${col}7:${col}9)`, format: { numberFormat: "currency" } };
  });
  cells["N11"] = { value: "=SUM(B11:M11)", format: { numberFormat: "currency" } };

  // Cash Outflows Section
  cells["A13"] = { value: "CASH OUTFLOWS" };

  cells["A14"] = { value: "Payroll" };
  colLetters.forEach((col) => {
    cells[`${col}14`] = { value: "18000", format: { numberFormat: "currency" } };
  });
  cells["N14"] = { value: "=SUM(B14:M14)", format: { numberFormat: "currency" } };

  cells["A15"] = { value: "Rent" };
  colLetters.forEach((col) => {
    cells[`${col}15`] = { value: "4000", format: { numberFormat: "currency" } };
  });
  cells["N15"] = { value: "=SUM(B15:M15)", format: { numberFormat: "currency" } };

  cells["A16"] = { value: "Utilities" };
  colLetters.forEach((col) => {
    cells[`${col}16`] = { value: "800", format: { numberFormat: "currency" } };
  });
  cells["N16"] = { value: "=SUM(B16:M16)", format: { numberFormat: "currency" } };

  cells["A17"] = { value: "Marketing" };
  colLetters.forEach((col) => {
    cells[`${col}17`] = { value: "3000", format: { numberFormat: "currency" } };
  });
  cells["N17"] = { value: "=SUM(B17:M17)", format: { numberFormat: "currency" } };

  cells["A18"] = { value: "Software & Tools" };
  colLetters.forEach((col) => {
    cells[`${col}18`] = { value: "1500", format: { numberFormat: "currency" } };
  });
  cells["N18"] = { value: "=SUM(B18:M18)", format: { numberFormat: "currency" } };

  cells["A19"] = { value: "Other Expenses" };
  colLetters.forEach((col) => {
    cells[`${col}19`] = { value: "2000", format: { numberFormat: "currency" } };
  });
  cells["N19"] = { value: "=SUM(B19:M19)", format: { numberFormat: "currency" } };

  cells["A20"] = { value: "────────────────────────" };
  cells["A21"] = { value: "Total Outflows" };
  colLetters.forEach((col) => {
    cells[`${col}21`] = { value: `=SUM(${col}14:${col}19)`, format: { numberFormat: "currency" } };
  });
  cells["N21"] = { value: "=SUM(B21:M21)", format: { numberFormat: "currency" } };

  // Net Cash Flow
  cells["A22"] = { value: "════════════════════════" };
  cells["A23"] = { value: "Net Cash Flow" };
  colLetters.forEach((col) => {
    cells[`${col}23`] = { value: `=${col}11-${col}21`, format: { numberFormat: "currency" } };
  });
  cells["N23"] = { value: "=SUM(B23:M23)", format: { numberFormat: "currency" } };

  // Closing Balance
  cells["A24"] = { value: "Closing Cash Balance" };
  colLetters.forEach((col) => {
    cells[`${col}24`] = { value: `=${col}4+${col}23`, format: { numberFormat: "currency" } };
  });

  // Summary Section
  cells["A26"] = { value: "════════════════════════════════════════════════════════════════════════════════" };
  cells["A27"] = { value: "SUMMARY METRICS" };

  cells["A28"] = { value: "Total Revenue (12mo)" };
  cells["B28"] = { value: "=N11", format: { numberFormat: "currency" } };

  cells["A29"] = { value: "Total Expenses (12mo)" };
  cells["B29"] = { value: "=N21", format: { numberFormat: "currency" } };

  cells["A30"] = { value: "Net Cash Change" };
  cells["B30"] = { value: "=N23", format: { numberFormat: "currency" } };

  cells["A31"] = { value: "Ending Cash Position" };
  cells["B31"] = { value: "=M24", format: { numberFormat: "currency" } };

  cells["A32"] = { value: "Avg Monthly Burn" };
  cells["B32"] = { value: "=N21/12", format: { numberFormat: "currency" } };

  cells["A33"] = { value: "Lowest Cash Point" };
  cells["B33"] = { value: "=MIN(B24:M24)", format: { numberFormat: "currency" } };

  // Scenario Analysis
  cells["A35"] = { value: "SCENARIO ANALYSIS" };

  cells["A36"] = { value: "If revenue -20%" };
  cells["B36"] = { value: "=B4+N23*0.8-N21*0.2", format: { numberFormat: "currency" } };
  cells["C36"] = { value: "← Year-end cash" };

  cells["A37"] = { value: "If expenses +20%" };
  cells["B37"] = { value: "=B4+N11-N21*1.2", format: { numberFormat: "currency" } };
  cells["C37"] = { value: "← Year-end cash" };

  cells["A38"] = { value: "Best case (+20% rev)" };
  cells["B38"] = { value: "=B4+N11*1.2-N21", format: { numberFormat: "currency" } };
  cells["C38"] = { value: "← Year-end cash" };

  return {
    id: "cash-flow",
    name: "Cash Flow Forecast",
    description: "12-month cash flow projection with scenarios",
    icon: "💰",
    category: "planning",
    columnWidths,
    cells,
  };
}

export const cashFlowTemplate = buildCashFlowTemplate();
