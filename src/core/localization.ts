/**
 * Localization Module
 *
 * Provides country-specific formatting for dates, numbers, and currency.
 * Primarily optimized for Malaysia (MY) with US (US) fallback.
 */

import { getSetting } from "../db/index.js";

export type SupportedLocale = "en-MY" | "en-US" | "en-SG" | "en-GB";
export type SupportedCountry = "MY" | "US" | "SG" | "GB";

export interface LocaleConfig {
  locale: SupportedLocale;
  country: SupportedCountry;
  currency: string;
  currencySymbol: string;
  dateFormat: "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
  thousandSeparator: string;
  decimalSeparator: string;
  taxName: string;
  taxRate: number;
  fiscalYearStart: number; // Month (1-12)
}

// Country-specific configurations
const LOCALE_CONFIGS: Record<SupportedCountry, LocaleConfig> = {
  MY: {
    locale: "en-MY",
    country: "MY",
    currency: "MYR",
    currencySymbol: "RM",
    dateFormat: "DD/MM/YYYY",
    thousandSeparator: ",",
    decimalSeparator: ".",
    taxName: "SST",
    taxRate: 6, // Standard SST rate
    fiscalYearStart: 1, // January
  },
  US: {
    locale: "en-US",
    country: "US",
    currency: "USD",
    currencySymbol: "$",
    dateFormat: "MM/DD/YYYY",
    thousandSeparator: ",",
    decimalSeparator: ".",
    taxName: "Sales Tax",
    taxRate: 0, // Varies by state
    fiscalYearStart: 1,
  },
  SG: {
    locale: "en-SG",
    country: "SG",
    currency: "SGD",
    currencySymbol: "S$",
    dateFormat: "DD/MM/YYYY",
    thousandSeparator: ",",
    decimalSeparator: ".",
    taxName: "GST",
    taxRate: 9,
    fiscalYearStart: 1,
  },
  GB: {
    locale: "en-GB",
    country: "GB",
    currency: "GBP",
    currencySymbol: "£",
    dateFormat: "DD/MM/YYYY",
    thousandSeparator: ",",
    decimalSeparator: ".",
    taxName: "VAT",
    taxRate: 20,
    fiscalYearStart: 4, // April
  },
};

// Malaysian state codes for addresses
export const MALAYSIAN_STATES: Record<string, string> = {
  JHR: "Johor",
  KDH: "Kedah",
  KTN: "Kelantan",
  MLK: "Melaka",
  NSN: "Negeri Sembilan",
  PHG: "Pahang",
  PNG: "Pulau Pinang",
  PRK: "Perak",
  PLS: "Perlis",
  SBH: "Sabah",
  SWK: "Sarawak",
  SGR: "Selangor",
  TRG: "Terengganu",
  KUL: "W.P. Kuala Lumpur",
  LBN: "W.P. Labuan",
  PJY: "W.P. Putrajaya",
};

/**
 * Get the current locale configuration based on settings
 */
export function getLocaleConfig(): LocaleConfig {
  const country = (getSetting("business_country") || "Malaysia") as string;

  // Map country names to codes
  const countryMap: Record<string, SupportedCountry> = {
    Malaysia: "MY",
    MY: "MY",
    USA: "US",
    US: "US",
    "United States": "US",
    Singapore: "SG",
    SG: "SG",
    UK: "GB",
    GB: "GB",
    "United Kingdom": "GB",
  };

  const countryCode = countryMap[country] || "MY";
  const config = LOCALE_CONFIGS[countryCode];

  // Override currency if set in settings
  const settingsCurrency = getSetting("currency");
  if (settingsCurrency) {
    config.currency = settingsCurrency;
    // Update symbol based on currency
    const currencySymbols: Record<string, string> = {
      MYR: "RM",
      USD: "$",
      SGD: "S$",
      GBP: "£",
      EUR: "€",
      AUD: "A$",
      CAD: "C$",
    };
    config.currencySymbol = currencySymbols[settingsCurrency] || settingsCurrency;
  }

  // Override tax rate if set
  const settingsTaxRate = getSetting("tax_rate");
  if (settingsTaxRate) {
    config.taxRate = parseFloat(settingsTaxRate) || config.taxRate;
  }

  return config;
}

/**
 * Format a date according to the current locale
 */
export function formatDate(date: string | Date, format?: "short" | "long" | "iso"): string {
  const config = getLocaleConfig();
  const d = typeof date === "string" ? new Date(date) : date;

  if (isNaN(d.getTime())) return String(date);

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();

  if (format === "iso") {
    return `${year}-${month}-${day}`;
  }

  if (format === "long") {
    return d.toLocaleDateString(config.locale, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  // Default short format based on locale
  switch (config.dateFormat) {
    case "DD/MM/YYYY":
      return `${day}/${month}/${year}`;
    case "MM/DD/YYYY":
      return `${month}/${day}/${year}`;
    case "YYYY-MM-DD":
    default:
      return `${year}-${month}-${day}`;
  }
}

/**
 * Parse a date string from locale format to Date object
 */
export function parseDate(dateStr: string): Date | null {
  const config = getLocaleConfig();

  // Try ISO format first (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(dateStr);
  }

  // Try locale-specific formats
  const parts = dateStr.split(/[\/\-\.]/);
  if (parts.length !== 3) return null;

  let day: number, month: number, year: number;

  switch (config.dateFormat) {
    case "DD/MM/YYYY":
      [day, month, year] = parts.map(Number);
      break;
    case "MM/DD/YYYY":
      [month, day, year] = parts.map(Number);
      break;
    default:
      [year, month, day] = parts.map(Number);
  }

  const date = new Date(year, month - 1, day);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Format a number according to the current locale
 */
export function formatNumber(value: number, decimals: number = 2): string {
  const config = getLocaleConfig();
  return value.toLocaleString(config.locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format currency according to the current locale
 */
export function formatCurrency(amount: number, options?: { showSymbol?: boolean; decimals?: number }): string {
  const config = getLocaleConfig();
  const { showSymbol = true, decimals = 2 } = options || {};

  const formatted = Math.abs(amount).toLocaleString(config.locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  const sign = amount < 0 ? "-" : "";

  if (showSymbol) {
    return `${sign}${config.currencySymbol} ${formatted}`;
  }
  return `${sign}${formatted}`;
}

/**
 * Format currency for display in TUI (compact version)
 */
export function formatCurrencyCompact(amount: number): string {
  const config = getLocaleConfig();

  if (Math.abs(amount) >= 1000000) {
    return `${config.currencySymbol}${(amount / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(amount) >= 1000) {
    return `${config.currencySymbol}${(amount / 1000).toFixed(1)}K`;
  }
  return `${config.currencySymbol}${amount.toFixed(0)}`;
}

/**
 * Get the current tax name (SST, GST, VAT, Sales Tax)
 */
export function getTaxName(): string {
  const config = getLocaleConfig();
  return config.taxName;
}

/**
 * Get the default tax rate for the current locale
 */
export function getDefaultTaxRate(): number {
  const config = getLocaleConfig();
  return config.taxRate;
}

/**
 * Format a percentage value
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Get fiscal year date range based on settings
 */
export function getFiscalYearRange(year?: number): { start: string; end: string } {
  const config = getLocaleConfig();
  const fiscalYearEnd = parseInt(getSetting("fiscal_year_end") || "12", 10);
  const currentYear = year || new Date().getFullYear();

  // If fiscal year ends in December (12), it's a calendar year
  if (fiscalYearEnd === 12) {
    return {
      start: `${currentYear}-01-01`,
      end: `${currentYear}-12-31`,
    };
  }

  // Otherwise, fiscal year spans two calendar years
  const startMonth = fiscalYearEnd + 1;
  const startYear = startMonth > fiscalYearEnd ? currentYear - 1 : currentYear;
  const endYear = startMonth > fiscalYearEnd ? currentYear : currentYear + 1;

  const startMonthStr = String(startMonth).padStart(2, "0");
  const endMonthStr = String(fiscalYearEnd).padStart(2, "0");

  // Get last day of end month
  const lastDay = new Date(endYear, fiscalYearEnd, 0).getDate();

  return {
    start: `${startYear}-${startMonthStr}-01`,
    end: `${endYear}-${endMonthStr}-${lastDay}`,
  };
}

/**
 * Get current period (month) date range
 */
export function getCurrentMonthRange(): { start: string; end: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const lastDay = new Date(year, month, 0).getDate();

  const monthStr = String(month).padStart(2, "0");

  return {
    start: `${year}-${monthStr}-01`,
    end: `${year}-${monthStr}-${lastDay}`,
  };
}

/**
 * Get previous period (month) date range
 */
export function getPreviousMonthRange(): { start: string; end: string } {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth(); // Previous month (0-indexed becomes previous)

  if (month === 0) {
    month = 12;
    year -= 1;
  }

  const lastDay = new Date(year, month, 0).getDate();
  const monthStr = String(month).padStart(2, "0");

  return {
    start: `${year}-${monthStr}-01`,
    end: `${year}-${monthStr}-${lastDay}`,
  };
}

/**
 * Malaysia-specific: Format Malaysian phone number
 */
export function formatMalaysianPhone(phone: string): string {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, "");

  // Handle Malaysian numbers
  if (digits.startsWith("60")) {
    // International format: +60 12-345 6789
    const local = digits.slice(2);
    if (local.length === 9 || local.length === 10) {
      const areaCode = local.slice(0, local.length === 10 ? 2 : 1);
      const firstPart = local.slice(areaCode.length, areaCode.length + 4);
      const secondPart = local.slice(areaCode.length + 4);
      return `+60 ${areaCode}-${firstPart} ${secondPart}`;
    }
  } else if (digits.startsWith("0")) {
    // Local format: 012-345 6789
    if (digits.length === 10 || digits.length === 11) {
      const areaCode = digits.slice(0, digits.length === 11 ? 3 : 2);
      const firstPart = digits.slice(areaCode.length, areaCode.length + 4);
      const secondPart = digits.slice(areaCode.length + 4);
      return `${areaCode}-${firstPart} ${secondPart}`;
    }
  }

  return phone; // Return as-is if not recognized
}

/**
 * Malaysia-specific: Validate Malaysian IC number
 */
export function validateMalaysianIC(ic: string): boolean {
  // Remove dashes
  const cleanIC = ic.replace(/-/g, "");

  // Must be 12 digits
  if (!/^\d{12}$/.test(cleanIC)) return false;

  // First 6 digits are birthdate (YYMMDD)
  const year = parseInt(cleanIC.slice(0, 2), 10);
  const month = parseInt(cleanIC.slice(2, 4), 10);
  const day = parseInt(cleanIC.slice(4, 6), 10);

  // Validate month and day
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  // 7-8 digits are birthplace code
  const birthplace = parseInt(cleanIC.slice(6, 8), 10);
  if (birthplace < 1 || birthplace > 99) return false;

  return true;
}

/**
 * Malaysia-specific: Format Malaysian IC number
 */
export function formatMalaysianIC(ic: string): string {
  const cleanIC = ic.replace(/-/g, "");
  if (cleanIC.length !== 12) return ic;

  return `${cleanIC.slice(0, 6)}-${cleanIC.slice(6, 8)}-${cleanIC.slice(8)}`;
}

/**
 * Check if current locale is Malaysia
 */
export function isMalaysianLocale(): boolean {
  const config = getLocaleConfig();
  return config.country === "MY";
}

/**
 * Get locale-specific labels
 */
export function getLocaleLabels(): Record<string, string> {
  const config = getLocaleConfig();

  if (config.country === "MY") {
    return {
      taxId: "Tax ID (TIN)",
      registrationNumber: "SSM Registration",
      postcode: "Poskod",
      state: "Negeri",
      taxName: "SST",
      invoiceTitle: "INVOIS",
      quotationTitle: "SEBUT HARGA",
    };
  }

  return {
    taxId: "Tax ID / EIN",
    registrationNumber: "Business Registration",
    postcode: "Postal Code",
    state: "State",
    taxName: "Tax",
    invoiceTitle: "INVOICE",
    quotationTitle: "QUOTATION",
  };
}
