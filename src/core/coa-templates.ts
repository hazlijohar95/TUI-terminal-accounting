/**
 * Chart of Accounts Templates
 *
 * Country-specific Chart of Accounts templates for different jurisdictions.
 * These templates follow local accounting standards and best practices.
 */

import { getDb } from "../db/index.js";
import { getSetting, setSetting } from "../db/index.js";

export interface COAAccount {
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "income" | "expense";
  description?: string;
}

export interface COATemplate {
  name: string;
  country: string;
  currency: string;
  description: string;
  accounts: COAAccount[];
}

/**
 * Malaysian Chart of Accounts
 *
 * Based on Malaysian Financial Reporting Standards (MFRS)
 * and common practices for Malaysian SMEs.
 *
 * Includes:
 * - SST-related accounts (Sales Tax, Service Tax)
 * - Malaysia-specific expense categories
 * - E-Invoice compliance accounts
 */
export const MALAYSIAN_COA: COATemplate = {
  name: "Malaysian SME",
  country: "MY",
  currency: "MYR",
  description: "Standard Chart of Accounts for Malaysian small and medium enterprises",
  accounts: [
    // === ASSETS (1000-1999) ===
    { code: "1000", name: "Petty Cash", type: "asset", description: "Small cash fund for minor expenses" },
    { code: "1010", name: "Cash in Hand", type: "asset" },
    { code: "1100", name: "Bank Account - Current", type: "asset", description: "Main operating bank account" },
    { code: "1110", name: "Bank Account - Savings", type: "asset" },
    { code: "1120", name: "Fixed Deposit", type: "asset" },
    { code: "1200", name: "Accounts Receivable", type: "asset", description: "Trade debtors" },
    { code: "1210", name: "Allowance for Doubtful Debts", type: "asset", description: "Provision for bad debts" },
    { code: "1300", name: "Prepaid Expenses", type: "asset" },
    { code: "1310", name: "Prepaid Insurance", type: "asset" },
    { code: "1320", name: "Prepaid Rent", type: "asset" },
    { code: "1400", name: "Inventory", type: "asset", description: "Stock on hand" },
    { code: "1500", name: "SST Input Tax Recoverable", type: "asset", description: "SST paid on purchases" },
    { code: "1600", name: "Property, Plant & Equipment", type: "asset" },
    { code: "1610", name: "Office Equipment", type: "asset" },
    { code: "1620", name: "Computer Equipment", type: "asset" },
    { code: "1630", name: "Furniture & Fittings", type: "asset" },
    { code: "1640", name: "Motor Vehicles", type: "asset" },
    { code: "1650", name: "Accumulated Depreciation", type: "asset", description: "Contra account" },
    { code: "1700", name: "Intangible Assets", type: "asset" },
    { code: "1710", name: "Software & Licenses", type: "asset" },

    // === LIABILITIES (2000-2999) ===
    { code: "2000", name: "Accounts Payable", type: "liability", description: "Trade creditors" },
    { code: "2100", name: "Credit Card Payable", type: "liability" },
    { code: "2200", name: "Accrued Expenses", type: "liability" },
    { code: "2210", name: "Accrued Salaries", type: "liability" },
    { code: "2220", name: "Accrued EPF Payable", type: "liability", description: "Employees Provident Fund" },
    { code: "2230", name: "Accrued SOCSO Payable", type: "liability", description: "Social Security Organization" },
    { code: "2240", name: "Accrued EIS Payable", type: "liability", description: "Employment Insurance System" },
    { code: "2250", name: "PCB Payable", type: "liability", description: "Monthly Tax Deduction (MTD/PCB)" },
    { code: "2300", name: "Sales Tax Payable", type: "liability", description: "SST - Sales Tax collected" },
    { code: "2310", name: "Service Tax Payable", type: "liability", description: "SST - Service Tax collected" },
    { code: "2400", name: "Deposits Received", type: "liability" },
    { code: "2500", name: "Unearned Revenue", type: "liability", description: "Advance payments from customers" },
    { code: "2600", name: "Short-term Loans", type: "liability" },
    { code: "2700", name: "Long-term Loans", type: "liability" },
    { code: "2800", name: "Hire Purchase Payable", type: "liability" },
    { code: "2900", name: "Director's Loan", type: "liability" },

    // === EQUITY (3000-3999) ===
    { code: "3000", name: "Paid-up Capital", type: "equity", description: "Share capital" },
    { code: "3100", name: "Retained Earnings", type: "equity" },
    { code: "3200", name: "Current Year Profit/Loss", type: "equity" },
    { code: "3300", name: "Drawings", type: "equity", description: "Owner withdrawals (for sole props)" },
    { code: "3400", name: "Dividends", type: "equity" },

    // === REVENUE/INCOME (4000-4999) ===
    { code: "4000", name: "Sales Revenue", type: "income", description: "Revenue from goods sold" },
    { code: "4100", name: "Service Revenue", type: "income", description: "Revenue from services rendered" },
    { code: "4200", name: "Rental Income", type: "income" },
    { code: "4300", name: "Interest Income", type: "income" },
    { code: "4400", name: "Commission Income", type: "income" },
    { code: "4500", name: "Foreign Exchange Gain", type: "income" },
    { code: "4600", name: "Discount Received", type: "income" },
    { code: "4900", name: "Other Income", type: "income" },

    // === COST OF SALES (5000-5499) ===
    { code: "5000", name: "Cost of Goods Sold", type: "expense" },
    { code: "5100", name: "Purchases", type: "expense" },
    { code: "5110", name: "Purchase Returns", type: "expense", description: "Contra account" },
    { code: "5120", name: "Purchase Discounts", type: "expense", description: "Contra account" },
    { code: "5200", name: "Direct Labour", type: "expense" },
    { code: "5300", name: "Direct Materials", type: "expense" },
    { code: "5400", name: "Manufacturing Overhead", type: "expense" },

    // === OPERATING EXPENSES (5500-6999) ===
    // Staff & Payroll
    { code: "5500", name: "Salaries & Wages", type: "expense" },
    { code: "5510", name: "EPF - Employer Contribution", type: "expense", description: "13% statutory contribution" },
    { code: "5520", name: "SOCSO - Employer Contribution", type: "expense" },
    { code: "5530", name: "EIS - Employer Contribution", type: "expense" },
    { code: "5540", name: "HRDF Levy", type: "expense", description: "Human Resource Development Fund" },
    { code: "5550", name: "Staff Benefits", type: "expense" },
    { code: "5560", name: "Staff Training", type: "expense" },
    { code: "5570", name: "Staff Medical", type: "expense" },
    { code: "5580", name: "Director Fees", type: "expense" },

    // Office & Administrative
    { code: "5600", name: "Rent", type: "expense" },
    { code: "5610", name: "Utilities", type: "expense", description: "TNB, Water, Internet" },
    { code: "5620", name: "Office Supplies", type: "expense" },
    { code: "5630", name: "Printing & Stationery", type: "expense" },
    { code: "5640", name: "Postage & Courier", type: "expense" },
    { code: "5650", name: "Telephone & Internet", type: "expense" },
    { code: "5660", name: "Cleaning & Maintenance", type: "expense" },

    // Professional Fees
    { code: "5700", name: "Accounting & Audit Fees", type: "expense" },
    { code: "5710", name: "Legal Fees", type: "expense" },
    { code: "5720", name: "Secretarial Fees", type: "expense" },
    { code: "5730", name: "Professional Consultancy", type: "expense" },

    // Financial
    { code: "5800", name: "Bank Charges", type: "expense" },
    { code: "5810", name: "Interest Expense", type: "expense" },
    { code: "5820", name: "Foreign Exchange Loss", type: "expense" },
    { code: "5830", name: "Bad Debts", type: "expense" },

    // Marketing & Sales
    { code: "5900", name: "Advertising & Marketing", type: "expense" },
    { code: "5910", name: "Website & Online Marketing", type: "expense" },
    { code: "5920", name: "Entertainment", type: "expense" },
    { code: "5930", name: "Sales Commission", type: "expense" },
    { code: "5940", name: "Trade Fair & Exhibition", type: "expense" },

    // Travel & Transport
    { code: "6000", name: "Travel - Local", type: "expense" },
    { code: "6010", name: "Travel - Overseas", type: "expense" },
    { code: "6020", name: "Mileage Claims", type: "expense" },
    { code: "6030", name: "Parking & Tolls", type: "expense" },
    { code: "6040", name: "Motor Vehicle Expenses", type: "expense" },

    // Technology
    { code: "6100", name: "Software & Subscriptions", type: "expense" },
    { code: "6110", name: "Cloud Services", type: "expense" },
    { code: "6120", name: "IT Support & Maintenance", type: "expense" },

    // Insurance & Depreciation
    { code: "6200", name: "Insurance - General", type: "expense" },
    { code: "6210", name: "Insurance - Motor", type: "expense" },
    { code: "6220", name: "Insurance - Professional Indemnity", type: "expense" },
    { code: "6300", name: "Depreciation", type: "expense" },
    { code: "6310", name: "Amortization", type: "expense" },

    // Regulatory & Compliance
    { code: "6400", name: "License & Permits", type: "expense" },
    { code: "6410", name: "SSM Fees", type: "expense", description: "Company registration fees" },
    { code: "6420", name: "Government Fees & Penalties", type: "expense" },
    { code: "6430", name: "Stamp Duty", type: "expense" },

    // Other
    { code: "6500", name: "Donations", type: "expense", description: "Approved donations under S44" },
    { code: "6510", name: "Zakat", type: "expense", description: "Islamic tithe (deductible)" },
    { code: "6600", name: "Sundry Expenses", type: "expense" },
    { code: "6900", name: "Other Expenses", type: "expense" },
  ],
};

/**
 * Apply a COA template to the database
 * This adds any missing accounts from the template without duplicating
 */
export function applyCoaTemplate(template: COATemplate): { added: number; skipped: number } {
  const db = getDb();
  let added = 0;
  let skipped = 0;

  // Get existing account codes
  const existingCodes = new Set(
    (db.prepare("SELECT code FROM accounts").all() as { code: string }[]).map((a) => a.code)
  );

  // Insert missing accounts
  const insertStmt = db.prepare(`
    INSERT INTO accounts (code, name, type, description, is_active)
    VALUES (?, ?, ?, ?, 1)
  `);

  for (const account of template.accounts) {
    if (existingCodes.has(account.code)) {
      skipped++;
      continue;
    }

    insertStmt.run(account.code, account.name, account.type, account.description || null);
    added++;
  }

  // Update settings for the country
  if (template.currency) {
    const currentCurrency = getSetting("currency");
    if (!currentCurrency || currentCurrency === "USD") {
      setSetting("currency", template.currency);
    }
  }

  if (template.country) {
    const currentCountry = getSetting("business_country");
    if (!currentCountry) {
      setSetting("business_country", template.country === "MY" ? "Malaysia" : template.country);
    }
  }

  return { added, skipped };
}

/**
 * Get available COA templates
 */
export function getAvailableTemplates(): { id: string; name: string; country: string; description: string }[] {
  return [
    {
      id: "my-sme",
      name: MALAYSIAN_COA.name,
      country: MALAYSIAN_COA.country,
      description: MALAYSIAN_COA.description,
    },
    // Future templates can be added here
    // { id: "us-basic", name: "US Basic", country: "US", description: "..." },
    // { id: "sg-sme", name: "Singapore SME", country: "SG", description: "..." },
  ];
}

/**
 * Get a COA template by ID
 */
export function getCoaTemplate(templateId: string): COATemplate | null {
  switch (templateId) {
    case "my-sme":
      return MALAYSIAN_COA;
    default:
      return null;
  }
}

/**
 * Check if Malaysian COA is applied
 */
export function isMalaysianCoaApplied(): boolean {
  const db = getDb();

  // Check for Malaysia-specific accounts
  const malaysianAccounts = ["2220", "2230", "2240", "2250", "5510", "5520", "6410"];
  const existingCodes = new Set(
    (db.prepare("SELECT code FROM accounts").all() as { code: string }[]).map((a) => a.code)
  );

  // If at least 5 of these Malaysian-specific accounts exist, consider it applied
  let count = 0;
  for (const code of malaysianAccounts) {
    if (existingCodes.has(code)) count++;
  }

  return count >= 5;
}
