/**
 * Currency Utility Module
 *
 * Provides safe money calculations to avoid floating-point precision issues.
 * Uses integer cents internally for calculations, converts to dollars for display.
 *
 * Usage:
 *   import { money } from './currency.js';
 *   const total = money.add(10.50, 5.25); // 15.75
 *   const tax = money.multiply(100, 0.06); // 6.00
 */

/**
 * Rounds a number to 2 decimal places using banker's rounding
 */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Converts dollars to cents (integer)
 */
export function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/**
 * Converts cents (integer) to dollars
 */
export function fromCents(cents: number): number {
  return cents / 100;
}

/**
 * Safely adds two monetary values
 */
export function add(a: number, b: number): number {
  return fromCents(toCents(a) + toCents(b));
}

/**
 * Safely subtracts two monetary values
 */
export function subtract(a: number, b: number): number {
  return fromCents(toCents(a) - toCents(b));
}

/**
 * Safely multiplies a monetary value by a factor
 * (e.g., for tax calculation: amount * rate)
 */
export function multiply(amount: number, factor: number): number {
  return round2(amount * factor);
}

/**
 * Safely divides a monetary value
 */
export function divide(amount: number, divisor: number): number {
  if (divisor === 0) throw new Error("Cannot divide by zero");
  return round2(amount / divisor);
}

/**
 * Calculates percentage of an amount
 * @param amount Base amount
 * @param percent Percentage (e.g., 6 for 6%)
 */
export function percent(amount: number, percent: number): number {
  return multiply(amount, percent / 100);
}

/**
 * Sums an array of monetary values
 */
export function sum(values: number[]): number {
  const totalCents = values.reduce((acc, val) => acc + toCents(val), 0);
  return fromCents(totalCents);
}

/**
 * Formats a number as currency string
 * @param amount Amount to format
 * @param currency Currency code (default: from settings or USD)
 * @param locale Locale for formatting (default: en-US)
 */
export function format(
  amount: number,
  currency: string = "USD",
  locale: string = "en-US"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Parses a currency string to number
 * Handles various formats: $1,234.56, 1234.56, RM 100, etc.
 */
export function parse(value: string): number {
  if (!value) return 0;
  // Remove currency symbols and whitespace, keep digits, dots, minus
  const cleaned = value.replace(/[^\d.-]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : round2(parsed);
}

/**
 * Compares two monetary values for equality
 * (handles floating-point comparison safely)
 */
export function equals(a: number, b: number): boolean {
  return toCents(a) === toCents(b);
}

/**
 * Checks if amount is zero (within floating-point tolerance)
 */
export function isZero(amount: number): boolean {
  return Math.abs(amount) < 0.005; // Less than half a cent
}

/**
 * Checks if amount is positive
 */
export function isPositive(amount: number): boolean {
  return amount > 0.005;
}

/**
 * Checks if amount is negative
 */
export function isNegative(amount: number): boolean {
  return amount < -0.005;
}

// Export as namespace for convenient usage
export const money = {
  round2,
  toCents,
  fromCents,
  add,
  subtract,
  multiply,
  divide,
  percent,
  sum,
  format,
  parse,
  equals,
  isZero,
  isPositive,
  isNegative,
};
