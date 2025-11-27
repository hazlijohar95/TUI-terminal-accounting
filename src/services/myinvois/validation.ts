/**
 * E-Invoice Validation Module
 *
 * Strict validation rules for Malaysia LHDN e-invoicing.
 * Validates TIN, BRN, SST, MSIC codes and all required fields before submission.
 */

import type { Invoice } from "../../domain/invoices.js";
import type { Customer } from "../../domain/customers.js";
import type { LHDNSettings } from "./types.js";
import { COMMON_MSIC_CODES, MALAYSIA_STATES, CLASSIFICATION_CODES, TAX_TYPES } from "./constants.js";

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface FieldError {
  field: string;
  message: string;
  category: "supplier" | "buyer" | "invoice" | "item";
}

export interface SubmissionValidationResult {
  valid: boolean;
  errors: FieldError[];
}

/**
 * Validate Malaysia Tax Identification Number (TIN)
 * Format: 12 digits OR C followed by 10 digits (for companies)
 */
export function validateTIN(tin: string | undefined | null): ValidationResult {
  if (!tin || tin.trim() === "") {
    return { valid: false, error: "TIN is required" };
  }

  const cleaned = tin.trim().toUpperCase();

  // Company TIN: C followed by 10 digits
  if (cleaned.startsWith("C")) {
    const digits = cleaned.slice(1);
    if (digits.length !== 10 || !/^\d{10}$/.test(digits)) {
      return { valid: false, error: "Company TIN must be C followed by 10 digits (e.g., C1234567890)" };
    }
    return { valid: true };
  }

  // Individual TIN: 12 digits
  if (!/^\d{12}$/.test(cleaned)) {
    return { valid: false, error: "Individual TIN must be 12 digits" };
  }

  return { valid: true };
}

/**
 * Validate Business Registration Number (BRN)
 * Formats:
 * - Old format: 123456-A (digits + letter)
 * - New format (SSM): 201901012345 (12 digits) or 202401012345 (company)
 * - LLP: LLP0012345-LGN
 */
export function validateBRN(brn: string | undefined | null): ValidationResult {
  if (!brn || brn.trim() === "") {
    return { valid: true }; // BRN is optional
  }

  const cleaned = brn.trim().toUpperCase();

  // Old format: digits followed by hyphen and letter(s)
  if (/^\d{5,7}-[A-Z]{1,3}$/.test(cleaned)) {
    return { valid: true };
  }

  // New SSM format: 12 digits starting with year
  if (/^(19|20)\d{10}$/.test(cleaned)) {
    return { valid: true };
  }

  // LLP format
  if (/^LLP\d{7}-[A-Z]{3}$/.test(cleaned)) {
    return { valid: true };
  }

  // Simple format: just digits (some older registrations)
  if (/^\d{6,12}$/.test(cleaned)) {
    return { valid: true };
  }

  return { valid: false, error: "Invalid BRN format. Expected: 123456-A, 201901012345, or LLP0012345-LGN" };
}

/**
 * Validate SST Registration Number
 * Format: W10-1234-56789012 (W followed by 2 digits, hyphen, 4 digits, hyphen, 8 digits)
 * Total: 17 characters
 */
export function validateSST(sst: string | undefined | null): ValidationResult {
  if (!sst || sst.trim() === "") {
    return { valid: true }; // SST is optional
  }

  const cleaned = sst.trim().toUpperCase();

  // SST format: W followed by registration number
  if (!/^[A-Z]\d{2}-\d{4}-\d{8}$/.test(cleaned)) {
    return { valid: false, error: "Invalid SST format. Expected: W10-1234-56789012" };
  }

  return { valid: true };
}

/**
 * Validate MSIC Code (Malaysia Standard Industrial Classification)
 * Format: 5 digits
 * Should exist in the official MSIC 2008 v1.3 list
 */
export function validateMSIC(code: string | undefined | null): ValidationResult {
  if (!code || code.trim() === "") {
    return { valid: false, error: "MSIC code is required" };
  }

  const cleaned = code.trim();

  // Must be 5 digits
  if (!/^\d{5}$/.test(cleaned)) {
    return { valid: false, error: "MSIC code must be 5 digits" };
  }

  // Check if it exists in our known codes
  const isKnown = cleaned in COMMON_MSIC_CODES;

  if (!isKnown) {
    // Find similar codes for suggestion
    const prefix = cleaned.substring(0, 2);
    const suggestions = Object.entries(COMMON_MSIC_CODES)
      .filter(([c]) => c.startsWith(prefix))
      .slice(0, 3)
      .map(([c, desc]) => `${c} (${desc})`)
      .join(", ");

    const suggestionText = suggestions
      ? ` Similar codes: ${suggestions}`
      : " Check MSIC 2008 list for valid codes.";

    return {
      valid: false,
      error: `MSIC code "${cleaned}" not found in known codes.${suggestionText}`
    };
  }

  return { valid: true };
}

/**
 * Get MSIC code description
 */
export function getMSICDescription(code: string): string | undefined {
  return COMMON_MSIC_CODES[code];
}

/**
 * Validate Malaysia State Code
 */
export function validateState(state: string | undefined | null): ValidationResult {
  if (!state || state.trim() === "") {
    return { valid: false, error: "State is required" };
  }

  const cleaned = state.trim().toUpperCase();

  if (!(cleaned in MALAYSIA_STATES)) {
    return { valid: false, error: `Invalid state code. Valid codes: ${Object.keys(MALAYSIA_STATES).join(", ")}` };
  }

  return { valid: true };
}

/**
 * Validate Classification Code
 */
export function validateClassificationCode(code: string | undefined | null): ValidationResult {
  if (!code || code.trim() === "") {
    return { valid: false, error: "Classification code is required" };
  }

  const cleaned = code.trim();

  if (!(cleaned in CLASSIFICATION_CODES)) {
    return { valid: false, error: `Invalid classification code. Valid codes: ${Object.keys(CLASSIFICATION_CODES).join(", ")}` };
  }

  return { valid: true };
}

/**
 * Validate Tax Type
 */
export function validateTaxType(taxType: string | undefined | null): ValidationResult {
  if (!taxType || taxType.trim() === "") {
    return { valid: false, error: "Tax type is required" };
  }

  const cleaned = taxType.trim().toUpperCase();
  const validTypes = Object.values(TAX_TYPES);

  if (!validTypes.includes(cleaned as any)) {
    return { valid: false, error: `Invalid tax type. Valid types: ${validTypes.join(", ")}` };
  }

  return { valid: true };
}

/**
 * Validate Email Format
 */
export function validateEmail(email: string | undefined | null): ValidationResult {
  if (!email || email.trim() === "") {
    return { valid: false, error: "Email is required" };
  }

  const cleaned = email.trim().toLowerCase();

  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleaned)) {
    return { valid: false, error: "Invalid email format" };
  }

  return { valid: true };
}

/**
 * Validate Phone Number
 */
export function validatePhone(phone: string | undefined | null): ValidationResult {
  if (!phone || phone.trim() === "") {
    return { valid: false, error: "Phone number is required" };
  }

  const cleaned = phone.trim().replace(/[\s\-\(\)]/g, "");

  // Malaysia phone: starts with 0 or +60, 9-12 digits
  if (!/^(\+?60|0)\d{8,10}$/.test(cleaned)) {
    return { valid: false, error: "Invalid phone format. Expected: 0123456789 or +60123456789" };
  }

  return { valid: true };
}

/**
 * Validate Postal Code
 */
export function validatePostalCode(postalCode: string | undefined | null): ValidationResult {
  if (!postalCode || postalCode.trim() === "") {
    return { valid: false, error: "Postal code is required" };
  }

  const cleaned = postalCode.trim();

  // Malaysia postal code: 5 digits
  if (!/^\d{5}$/.test(cleaned)) {
    return { valid: false, error: "Postal code must be 5 digits" };
  }

  return { valid: true };
}

/**
 * Validate complete submission data before sending to LHDN
 */
export function validateForSubmission(
  invoice: Invoice,
  customer: Customer | null,
  settings: LHDNSettings | null
): SubmissionValidationResult {
  const errors: FieldError[] = [];

  // === SUPPLIER VALIDATION (from settings) ===
  if (!settings) {
    errors.push({ field: "settings", message: "LHDN settings not configured", category: "supplier" });
    return { valid: false, errors };
  }

  // Required supplier fields
  const tinResult = validateTIN(settings.tin);
  if (!tinResult.valid) {
    errors.push({ field: "tin", message: tinResult.error!, category: "supplier" });
  }

  const brnResult = validateBRN(settings.brn);
  if (!brnResult.valid) {
    errors.push({ field: "brn", message: brnResult.error!, category: "supplier" });
  }

  const msicResult = validateMSIC(settings.msicCode);
  if (!msicResult.valid) {
    errors.push({ field: "msicCode", message: msicResult.error!, category: "supplier" });
  }

  if (!settings.businessActivityDescription || settings.businessActivityDescription.trim() === "") {
    errors.push({ field: "businessActivityDescription", message: "Business activity description is required", category: "supplier" });
  }

  const emailResult = validateEmail(settings.supplierEmail);
  if (!emailResult.valid) {
    errors.push({ field: "supplierEmail", message: emailResult.error!, category: "supplier" });
  }

  const phoneResult = validatePhone(settings.supplierPhone);
  if (!phoneResult.valid) {
    errors.push({ field: "supplierPhone", message: phoneResult.error!, category: "supplier" });
  }

  // Supplier address
  if (!settings.addressLine1 || settings.addressLine1.trim() === "") {
    errors.push({ field: "addressLine1", message: "Address line 1 is required", category: "supplier" });
  }

  const postalResult = validatePostalCode(settings.postalCode);
  if (!postalResult.valid) {
    errors.push({ field: "postalCode", message: postalResult.error!, category: "supplier" });
  }

  if (!settings.city || settings.city.trim() === "") {
    errors.push({ field: "city", message: "City is required", category: "supplier" });
  }

  const stateResult = validateState(settings.state);
  if (!stateResult.valid) {
    errors.push({ field: "state", message: stateResult.error!, category: "supplier" });
  }

  // === BUYER/CUSTOMER VALIDATION ===
  if (!customer) {
    errors.push({ field: "customer", message: "Customer not found", category: "buyer" });
  } else {
    if (!customer.name || customer.name.trim() === "") {
      errors.push({ field: "customerName", message: "Customer name is required", category: "buyer" });
    }

    // For B2B, TIN is required
    if (customer.tin) {
      const customerTinResult = validateTIN(customer.tin);
      if (!customerTinResult.valid) {
        errors.push({ field: "customerTin", message: customerTinResult.error!, category: "buyer" });
      }
    } else if (!customer.id_type || !customer.id_number) {
      // For B2C, ID type and number are required
      errors.push({ field: "customerIdentification", message: "Customer TIN or ID type/number is required", category: "buyer" });
    }

    // Customer address validation - require address field to be populated
    // Note: For LHDN submission, address needs to be parsed into components
    if (!customer.address || customer.address.trim() === "") {
      errors.push({ field: "customerAddress", message: "Customer address is required for e-invoice submission", category: "buyer" });
    }
  }

  // === INVOICE VALIDATION ===
  if (!invoice.number || invoice.number.trim() === "") {
    errors.push({ field: "invoiceNumber", message: "Invoice number is required", category: "invoice" });
  }

  if (!invoice.date) {
    errors.push({ field: "invoiceDate", message: "Invoice date is required", category: "invoice" });
  }

  if (!invoice.items || invoice.items.length === 0) {
    errors.push({ field: "items", message: "At least one line item is required", category: "invoice" });
  }

  // === LINE ITEM VALIDATION ===
  if (invoice.items && invoice.items.length > 0) {
    invoice.items.forEach((item, index) => {
      if (!item.description || item.description.trim() === "") {
        errors.push({ field: `item[${index}].description`, message: `Item ${index + 1}: Description is required`, category: "item" });
      }

      if (item.quantity <= 0) {
        errors.push({ field: `item[${index}].quantity`, message: `Item ${index + 1}: Quantity must be greater than 0`, category: "item" });
      }

      if (item.unit_price < 0) {
        errors.push({ field: `item[${index}].unit_price`, message: `Item ${index + 1}: Unit price cannot be negative`, category: "item" });
      }

      if (item.classification_code) {
        const classResult = validateClassificationCode(item.classification_code);
        if (!classResult.valid) {
          errors.push({ field: `item[${index}].classification_code`, message: `Item ${index + 1}: ${classResult.error}`, category: "item" });
        }
      }

      if (item.tax_type) {
        const taxResult = validateTaxType(item.tax_type);
        if (!taxResult.valid) {
          errors.push({ field: `item[${index}].tax_type`, message: `Item ${index + 1}: ${taxResult.error}`, category: "item" });
        }
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get human-readable validation summary
 */
export function getValidationSummary(result: SubmissionValidationResult): string {
  if (result.valid) {
    return "All validation checks passed";
  }

  const byCategory = {
    supplier: result.errors.filter(e => e.category === "supplier"),
    buyer: result.errors.filter(e => e.category === "buyer"),
    invoice: result.errors.filter(e => e.category === "invoice"),
    item: result.errors.filter(e => e.category === "item"),
  };

  const lines: string[] = [];

  if (byCategory.supplier.length > 0) {
    lines.push(`Supplier Issues (${byCategory.supplier.length}):`);
    byCategory.supplier.forEach(e => lines.push(`  - ${e.message}`));
  }

  if (byCategory.buyer.length > 0) {
    lines.push(`Customer Issues (${byCategory.buyer.length}):`);
    byCategory.buyer.forEach(e => lines.push(`  - ${e.message}`));
  }

  if (byCategory.invoice.length > 0) {
    lines.push(`Invoice Issues (${byCategory.invoice.length}):`);
    byCategory.invoice.forEach(e => lines.push(`  - ${e.message}`));
  }

  if (byCategory.item.length > 0) {
    lines.push(`Line Item Issues (${byCategory.item.length}):`);
    byCategory.item.forEach(e => lines.push(`  - ${e.message}`));
  }

  return lines.join("\n");
}
