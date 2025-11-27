/**
 * Margin Calculator Template
 *
 * Calculate gross margin, operating margin, and net margin.
 */

import { SpreadsheetTemplate } from "./types.js";

export const marginCalcTemplate: SpreadsheetTemplate = {
  id: "margin-calc",
  name: "Margin Calculator",
  description: "Calculate gross, operating, and net profit margins",
  icon: "📊",
  category: "financial",
  columnWidths: {
    0: 25,  // A - Labels
    1: 15,  // B - Values
    2: 10,  // C - Percentages
    3: 20,  // D - Notes
  },
  cells: {
    // Title
    "A1": { value: "MARGIN CALCULATOR" },
    "A2": { value: "─────────────────────────" },

    // Revenue Section
    "A4": { value: "REVENUE" },
    "A5": { value: "Product Sales" },
    "B5": { value: "150000", format: { numberFormat: "currency" } },

    "A6": { value: "Service Revenue" },
    "B6": { value: "50000", format: { numberFormat: "currency" } },

    "A7": { value: "Other Revenue" },
    "B7": { value: "10000", format: { numberFormat: "currency" } },

    "A8": { value: "─────────────────────────" },
    "A9": { value: "TOTAL REVENUE" },
    "B9": { value: "=SUM(B5:B7)", format: { numberFormat: "currency" } },
    "C9": { value: "100%", format: { alignment: "right" } },

    // Cost of Goods Sold
    "A11": { value: "COST OF GOODS SOLD" },
    "A12": { value: "Direct Materials" },
    "B12": { value: "45000", format: { numberFormat: "currency" } },

    "A13": { value: "Direct Labor" },
    "B13": { value: "30000", format: { numberFormat: "currency" } },

    "A14": { value: "Manufacturing Overhead" },
    "B14": { value: "15000", format: { numberFormat: "currency" } },

    "A15": { value: "─────────────────────────" },
    "A16": { value: "TOTAL COGS" },
    "B16": { value: "=SUM(B12:B14)", format: { numberFormat: "currency" } },
    "C16": { value: "=IF(B9>0,B16/B9*100,0)", format: { decimals: 1 } },
    "D16": { value: "%" },

    // Gross Profit
    "A18": { value: "═══════════════════════════" },
    "A19": { value: "GROSS PROFIT" },
    "B19": { value: "=B9-B16", format: { numberFormat: "currency" } },
    "C19": { value: "=IF(B9>0,B19/B9*100,0)", format: { decimals: 1 } },
    "D19": { value: "% ← Gross Margin" },

    // Operating Expenses
    "A21": { value: "OPERATING EXPENSES" },
    "A22": { value: "Salaries & Benefits" },
    "B22": { value: "35000", format: { numberFormat: "currency" } },

    "A23": { value: "Rent & Utilities" },
    "B23": { value: "8000", format: { numberFormat: "currency" } },

    "A24": { value: "Marketing & Sales" },
    "B24": { value: "12000", format: { numberFormat: "currency" } },

    "A25": { value: "R&D" },
    "B25": { value: "10000", format: { numberFormat: "currency" } },

    "A26": { value: "G&A" },
    "B26": { value: "5000", format: { numberFormat: "currency" } },

    "A27": { value: "─────────────────────────" },
    "A28": { value: "TOTAL OPEX" },
    "B28": { value: "=SUM(B22:B26)", format: { numberFormat: "currency" } },
    "C28": { value: "=IF(B9>0,B28/B9*100,0)", format: { decimals: 1 } },
    "D28": { value: "%" },

    // Operating Income
    "A30": { value: "═══════════════════════════" },
    "A31": { value: "OPERATING INCOME (EBIT)" },
    "B31": { value: "=B19-B28", format: { numberFormat: "currency" } },
    "C31": { value: "=IF(B9>0,B31/B9*100,0)", format: { decimals: 1 } },
    "D31": { value: "% ← Operating Margin" },

    // Other Income/Expenses
    "A33": { value: "OTHER INCOME/EXPENSES" },
    "A34": { value: "Interest Expense" },
    "B34": { value: "2000", format: { numberFormat: "currency" } },

    "A35": { value: "Interest Income" },
    "B35": { value: "500", format: { numberFormat: "currency" } },

    "A36": { value: "Other" },
    "B36": { value: "0", format: { numberFormat: "currency" } },

    "A37": { value: "─────────────────────────" },
    "A38": { value: "NET OTHER" },
    "B38": { value: "=B35-B34+B36", format: { numberFormat: "currency" } },

    // Pre-tax Income
    "A40": { value: "PRE-TAX INCOME" },
    "B40": { value: "=B31+B38", format: { numberFormat: "currency" } },

    // Taxes
    "A42": { value: "Income Tax (25%)" },
    "B42": { value: "=IF(B40>0,B40*0.25,0)", format: { numberFormat: "currency" } },

    // Net Income
    "A44": { value: "═══════════════════════════" },
    "A45": { value: "NET INCOME" },
    "B45": { value: "=B40-B42", format: { numberFormat: "currency" } },
    "C45": { value: "=IF(B9>0,B45/B9*100,0)", format: { decimals: 1 } },
    "D45": { value: "% ← Net Margin" },

    // Summary
    "A47": { value: "═══════════════════════════" },
    "A48": { value: "MARGIN SUMMARY" },
    "A49": { value: "Gross Margin" },
    "B49": { value: "=IF(B9>0,B19/B9*100,0)", format: { decimals: 1 } },
    "C49": { value: "%" },

    "A50": { value: "Operating Margin" },
    "B50": { value: "=IF(B9>0,B31/B9*100,0)", format: { decimals: 1 } },
    "C50": { value: "%" },

    "A51": { value: "Net Margin" },
    "B51": { value: "=IF(B9>0,B45/B9*100,0)", format: { decimals: 1 } },
    "C51": { value: "%" },
  },
};
