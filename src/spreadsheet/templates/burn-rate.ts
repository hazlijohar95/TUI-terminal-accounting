/**
 * Burn Rate Calculator Template
 *
 * Calculates monthly burn rate and runway based on expenses and cash balance.
 */

import { SpreadsheetTemplate } from "./types.js";

export const burnRateTemplate: SpreadsheetTemplate = {
  id: "burn-rate",
  name: "Burn Rate Calculator",
  description: "Calculate monthly burn rate and cash runway",
  icon: "🔥",
  category: "financial",
  columnWidths: {
    0: 20,  // A - Labels
    1: 15,  // B - Values
    2: 15,  // C - Monthly amounts
    3: 20,  // D - Notes
  },
  cells: {
    // Title
    "A1": { value: "BURN RATE CALCULATOR" },
    "A2": { value: "─────────────────────" },

    // Cash Position Section
    "A4": { value: "CASH POSITION" },
    "A5": { value: "Current Cash Balance" },
    "B5": { value: "100000", format: { numberFormat: "currency" } },
    "D5": { value: "← Enter your cash" },

    // Monthly Expenses Section
    "A7": { value: "MONTHLY EXPENSES" },

    "A8": { value: "Salaries & Wages" },
    "B8": { value: "25000", format: { numberFormat: "currency" } },

    "A9": { value: "Rent & Utilities" },
    "B9": { value: "5000", format: { numberFormat: "currency" } },

    "A10": { value: "Software & Tools" },
    "B10": { value: "2000", format: { numberFormat: "currency" } },

    "A11": { value: "Marketing" },
    "B11": { value: "3000", format: { numberFormat: "currency" } },

    "A12": { value: "Professional Services" },
    "B12": { value: "1500", format: { numberFormat: "currency" } },

    "A13": { value: "Insurance" },
    "B13": { value: "800", format: { numberFormat: "currency" } },

    "A14": { value: "Other Expenses" },
    "B14": { value: "1200", format: { numberFormat: "currency" } },

    // Total Expenses
    "A16": { value: "─────────────────────" },
    "A17": { value: "TOTAL MONTHLY BURN" },
    "B17": { value: "=SUM(B8:B14)", format: { numberFormat: "currency" } },

    // Revenue Section
    "A19": { value: "MONTHLY REVENUE" },
    "A20": { value: "Recurring Revenue" },
    "B20": { value: "15000", format: { numberFormat: "currency" } },

    "A21": { value: "Other Revenue" },
    "B21": { value: "2000", format: { numberFormat: "currency" } },

    "A22": { value: "Total Revenue" },
    "B22": { value: "=SUM(B20:B21)", format: { numberFormat: "currency" } },

    // Net Burn
    "A24": { value: "─────────────────────" },
    "A25": { value: "NET MONTHLY BURN" },
    "B25": { value: "=B17-B22", format: { numberFormat: "currency" } },
    "D25": { value: "← Expenses minus Revenue" },

    // Runway Calculation
    "A27": { value: "RUNWAY ANALYSIS" },
    "A28": { value: "Runway (Months)" },
    "B28": { value: "=IF(B25>0,B5/B25,999)", format: { decimals: 1 } },
    "D28": { value: "← Months until cash runs out" },

    "A29": { value: "Runway (Date)" },
    "B29": { value: "=IF(B25>0,TODAY()+B28*30,\"Profitable!\")" },

    // Break-even Analysis
    "A31": { value: "BREAK-EVEN ANALYSIS" },
    "A32": { value: "Revenue Needed" },
    "B32": { value: "=B17", format: { numberFormat: "currency" } },
    "D32": { value: "← Revenue to break even" },

    "A33": { value: "Gap to Break-even" },
    "B33": { value: "=B17-B22", format: { numberFormat: "currency" } },

    "A34": { value: "Break-even %" },
    "B34": { value: "=IF(B17>0,B22/B17*100,0)", format: { decimals: 1 } },
    "C34": { value: "%" },

    // Scenarios
    "A36": { value: "SCENARIO PLANNING" },
    "A37": { value: "If burn increases 20%" },
    "B37": { value: "=IF(B25*1.2>0,B5/(B25*1.2),999)", format: { decimals: 1 } },
    "C37": { value: "months" },

    "A38": { value: "If burn decreases 20%" },
    "B38": { value: "=IF(B25*0.8>0,B5/(B25*0.8),999)", format: { decimals: 1 } },
    "C38": { value: "months" },

    "A39": { value: "If revenue doubles" },
    "B39": { value: "=IF(B17-B22*2>0,B5/(B17-B22*2),999)", format: { decimals: 1 } },
    "C39": { value: "months" },
  },
};
