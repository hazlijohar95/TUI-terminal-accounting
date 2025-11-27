/**
 * LHDN Compliance Check Component
 *
 * Pre-submission validation checklist for Malaysia e-Invoice compliance.
 * Shows visual pass/fail indicators for all required fields before LHDN submission.
 */

import React, { useMemo } from "react";
import { Box, Text } from "ink";
import { getEnhancedTheme } from "../design/theme.js";
import { indicators, borderStyles } from "../design/tokens.js";
import {
  validateForSubmission,
  validateTIN,
  validateBRN,
  validateSST,
  validateMSIC,
  validateState,
  validateEmail,
  validatePhone,
  validatePostalCode,
  type SubmissionValidationResult,
} from "../../services/myinvois/validation.js";
import type { Invoice } from "../../domain/invoices.js";
import type { Customer } from "../../domain/customers.js";
import type { LHDNSettings } from "../../services/myinvois/types.js";
import { formatCurrency, formatDate } from "../../core/localization.js";

interface LHDNComplianceCheckProps {
  invoice: Invoice;
  customer: Customer | null;
  settings: LHDNSettings | null;
  width?: number;
}

interface CheckItem {
  label: string;
  status: "pass" | "fail" | "warn" | "skip";
  message?: string;
  category: "supplier" | "buyer" | "invoice" | "item";
}

export function LHDNComplianceCheck({ invoice, customer, settings, width = 60 }: LHDNComplianceCheckProps) {
  const theme = getEnhancedTheme();

  // Run full validation
  const validationResult = useMemo(() => {
    return validateForSubmission(invoice, customer, settings);
  }, [invoice, customer, settings]);

  // Build checklist items
  const checkItems = useMemo((): CheckItem[] => {
    const items: CheckItem[] = [];

    // === SUPPLIER CHECKS ===
    if (!settings) {
      items.push({ label: "LHDN Settings", status: "fail", message: "Not configured", category: "supplier" });
    } else {
      // TIN
      const tinResult = validateTIN(settings.tin);
      items.push({
        label: "Supplier TIN",
        status: tinResult.valid ? "pass" : "fail",
        message: tinResult.valid ? settings.tin : tinResult.error,
        category: "supplier",
      });

      // BRN
      const brnResult = validateBRN(settings.brn);
      items.push({
        label: "Business Reg No (SSM)",
        status: settings.brn ? (brnResult.valid ? "pass" : "fail") : "skip",
        message: settings.brn ? (brnResult.valid ? settings.brn : brnResult.error) : "Optional",
        category: "supplier",
      });

      // MSIC
      const msicResult = validateMSIC(settings.msicCode);
      items.push({
        label: "MSIC Code",
        status: msicResult.valid ? "pass" : "fail",
        message: msicResult.valid ? settings.msicCode : msicResult.error,
        category: "supplier",
      });

      // Business Activity
      items.push({
        label: "Business Activity",
        status: settings.businessActivityDescription ? "pass" : "fail",
        message: settings.businessActivityDescription || "Required",
        category: "supplier",
      });

      // Email
      const emailResult = validateEmail(settings.supplierEmail);
      items.push({
        label: "Contact Email",
        status: emailResult.valid ? "pass" : "fail",
        message: emailResult.valid ? settings.supplierEmail : emailResult.error,
        category: "supplier",
      });

      // Phone
      const phoneResult = validatePhone(settings.supplierPhone);
      items.push({
        label: "Contact Phone",
        status: phoneResult.valid ? "pass" : "fail",
        message: phoneResult.valid ? settings.supplierPhone : phoneResult.error,
        category: "supplier",
      });

      // Address
      items.push({
        label: "Address Line 1",
        status: settings.addressLine1 ? "pass" : "fail",
        message: settings.addressLine1 || "Required",
        category: "supplier",
      });

      const postalResult = validatePostalCode(settings.postalCode);
      items.push({
        label: "Postal Code",
        status: postalResult.valid ? "pass" : "fail",
        message: postalResult.valid ? settings.postalCode : postalResult.error,
        category: "supplier",
      });

      items.push({
        label: "City",
        status: settings.city ? "pass" : "fail",
        message: settings.city || "Required",
        category: "supplier",
      });

      const stateResult = validateState(settings.state);
      items.push({
        label: "State",
        status: stateResult.valid ? "pass" : "fail",
        message: stateResult.valid ? settings.state : stateResult.error,
        category: "supplier",
      });
    }

    // === BUYER CHECKS ===
    if (!customer) {
      items.push({ label: "Customer", status: "fail", message: "Not found", category: "buyer" });
    } else {
      items.push({
        label: "Customer Name",
        status: customer.name ? "pass" : "fail",
        message: customer.name || "Required",
        category: "buyer",
      });

      // TIN or ID
      if (customer.tin) {
        const customerTinResult = validateTIN(customer.tin);
        items.push({
          label: "Customer TIN",
          status: customerTinResult.valid ? "pass" : "fail",
          message: customerTinResult.valid ? customer.tin : customerTinResult.error,
          category: "buyer",
        });
      } else if (customer.id_type && customer.id_number) {
        items.push({
          label: "Customer ID",
          status: "pass",
          message: `${customer.id_type}: ${customer.id_number}`,
          category: "buyer",
        });
      } else {
        items.push({
          label: "Customer Identification",
          status: "fail",
          message: "TIN or ID required",
          category: "buyer",
        });
      }

      items.push({
        label: "Customer Address",
        status: customer.address ? "pass" : "fail",
        message: customer.address ? customer.address.slice(0, 30) : "Required",
        category: "buyer",
      });
    }

    // === INVOICE CHECKS ===
    items.push({
      label: "Invoice Number",
      status: invoice.number ? "pass" : "fail",
      message: invoice.number || "Required",
      category: "invoice",
    });

    items.push({
      label: "Invoice Date",
      status: invoice.date ? "pass" : "fail",
      message: invoice.date ? formatDate(invoice.date) : "Required",
      category: "invoice",
    });

    items.push({
      label: "Line Items",
      status: invoice.items && invoice.items.length > 0 ? "pass" : "fail",
      message: invoice.items ? `${invoice.items.length} item(s)` : "At least 1 required",
      category: "invoice",
    });

    items.push({
      label: "Total Amount",
      status: invoice.total > 0 ? "pass" : "warn",
      message: formatCurrency(invoice.total),
      category: "invoice",
    });

    // === LINE ITEM CHECKS ===
    if (invoice.items && invoice.items.length > 0) {
      invoice.items.forEach((item, index) => {
        const hasDescription = item.description && item.description.trim() !== "";
        const validQuantity = item.quantity > 0;
        const validPrice = item.unit_price >= 0;

        if (!hasDescription || !validQuantity || !validPrice) {
          items.push({
            label: `Item ${index + 1}`,
            status: "fail",
            message: !hasDescription ? "No description" : !validQuantity ? "Invalid qty" : "Invalid price",
            category: "item",
          });
        }
      });
    }

    return items;
  }, [invoice, customer, settings]);

  // Count by status
  const passCount = checkItems.filter((i) => i.status === "pass").length;
  const failCount = checkItems.filter((i) => i.status === "fail").length;
  const warnCount = checkItems.filter((i) => i.status === "warn").length;
  const totalChecks = checkItems.filter((i) => i.status !== "skip").length;

  const isReady = failCount === 0;

  // Group by category
  const supplierItems = checkItems.filter((i) => i.category === "supplier");
  const buyerItems = checkItems.filter((i) => i.category === "buyer");
  const invoiceItems = checkItems.filter((i) => i.category === "invoice");
  const itemItems = checkItems.filter((i) => i.category === "item");

  const renderItem = (item: CheckItem) => {
    const icon = item.status === "pass" ? indicators.check :
                 item.status === "fail" ? indicators.cross :
                 item.status === "warn" ? indicators.warning :
                 indicators.pending;
    const color = item.status === "pass" ? theme.semantic.success :
                  item.status === "fail" ? theme.semantic.error :
                  item.status === "warn" ? theme.semantic.warning :
                  theme.semantic.textMuted;

    return (
      <Box key={item.label} justifyContent="space-between" paddingLeft={1}>
        <Box>
          <Text color={color}>{icon} </Text>
          <Text color={theme.semantic.textSecondary}>{item.label}</Text>
        </Box>
        <Text color={item.status === "fail" ? theme.semantic.error : theme.semantic.textMuted}>
          {item.message?.slice(0, 25)}
        </Text>
      </Box>
    );
  };

  return (
    <Box flexDirection="column" width={width}>
      {/* Header */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Text bold color={theme.semantic.info}>LHDN e-Invoice Compliance Check</Text>
        <Text color={isReady ? theme.semantic.success : theme.semantic.error}>
          {isReady ? "Ready to Submit" : "Issues Found"}
        </Text>
      </Box>

      {/* Progress Summary */}
      <Box marginBottom={1}>
        <Text color={theme.semantic.success}>{indicators.check} {passCount}</Text>
        <Text color={theme.semantic.textMuted}> | </Text>
        <Text color={theme.semantic.error}>{indicators.cross} {failCount}</Text>
        <Text color={theme.semantic.textMuted}> | </Text>
        <Text color={theme.semantic.warning}>{indicators.warning} {warnCount}</Text>
        <Text color={theme.semantic.textMuted}> of {totalChecks} checks</Text>
      </Box>

      {/* Divider */}
      <Text color={theme.semantic.border}>{"─".repeat(width - 2)}</Text>

      {/* Supplier Section */}
      {supplierItems.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color={theme.semantic.warning}>Supplier (Your Business)</Text>
          {supplierItems.map(renderItem)}
        </Box>
      )}

      {/* Buyer Section */}
      {buyerItems.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color={theme.semantic.warning}>Buyer (Customer)</Text>
          {buyerItems.map(renderItem)}
        </Box>
      )}

      {/* Invoice Section */}
      {invoiceItems.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color={theme.semantic.warning}>Invoice Details</Text>
          {invoiceItems.map(renderItem)}
        </Box>
      )}

      {/* Item Issues Section */}
      {itemItems.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color={theme.semantic.error}>Line Item Issues</Text>
          {itemItems.map(renderItem)}
        </Box>
      )}

      {/* Final Status */}
      <Box marginTop={1}>
        <Text color={theme.semantic.border}>{"─".repeat(width - 2)}</Text>
      </Box>
      <Box
        borderStyle={borderStyles.input}
        borderColor={isReady ? theme.semantic.success : theme.semantic.error}
        paddingX={1}
        marginTop={1}
      >
        {isReady ? (
          <Text color={theme.semantic.success}>
            {indicators.check} All checks passed. Ready for LHDN submission.
          </Text>
        ) : (
          <Text color={theme.semantic.error}>
            {indicators.cross} {failCount} issue(s) must be resolved before submission.
          </Text>
        )}
      </Box>
    </Box>
  );
}

/**
 * Quick compliance check function for programmatic use
 */
export function checkLHDNCompliance(
  invoice: Invoice,
  customer: Customer | null,
  settings: LHDNSettings | null
): { ready: boolean; errors: string[]; warnings: string[] } {
  const result = validateForSubmission(invoice, customer, settings);

  const errors = result.errors.map((e) => `${e.category}: ${e.message}`);
  const warnings: string[] = [];

  // Add warnings for optional but recommended fields
  if (settings && !settings.brn) {
    warnings.push("SSM Business Registration Number not set");
  }
  if (settings && !settings.sstRegistration) {
    warnings.push("SST Registration not set (required if SST registered)");
  }

  return {
    ready: result.valid,
    errors,
    warnings,
  };
}
