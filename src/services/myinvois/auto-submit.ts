/**
 * E-Invoice Auto-Submit Workflow
 *
 * Handles automatic submission of invoices to LHDN MyInvois
 * when they transition to 'sent' status and auto-submit is enabled.
 */

import { listInvoices, getInvoice, updateEInvoiceStatus, Invoice } from "../../domain/invoices.js";
import { getCustomer, Customer } from "../../domain/customers.js";
import { getLHDNSettings, LHDNSettings } from "../../db/index.js";
import { validateForSubmission, getValidationSummary } from "./validation.js";
import { createMyInvoisService } from "./myinvois-service.js";
import type { EInvoiceStatus, EInvoiceDocument, DocumentType, TaxType, LHDNLineItem, IdType, PaymentMode } from "./types.js";
import { DOCUMENT_TYPES, TAX_TYPES } from "./constants.js";

/**
 * Convert an Invoice to EInvoiceDocument format for LHDN submission
 */
function convertInvoiceToEInvoiceDocument(
  invoice: Invoice,
  customer: Customer,
  settings: LHDNSettings
): EInvoiceDocument {
  // Map invoice items to e-invoice line items
  const items: LHDNLineItem[] = (invoice.items || []).map((item, index) => ({
    id: index + 1,
    classificationCode: item.classification_code || "002", // Default: Services
    description: item.description || "Services",
    unitPrice: Math.round(item.unit_price * 100), // Convert to smallest unit (sen)
    quantity: item.quantity,
    taxType: (item.tax_type as TaxType) || TAX_TYPES.EXEMPT,
    taxRate: invoice.tax_rate || 0,
    taxAmount: Math.round(item.quantity * item.unit_price * ((invoice.tax_rate || 0) / 100) * 100),
    subtotal: Math.round(item.quantity * item.unit_price * 100),
    totalExclTax: Math.round(item.quantity * item.unit_price * 100),
    totalInclTax: Math.round(item.quantity * item.unit_price * (1 + (invoice.tax_rate || 0) / 100) * 100),
    unitCode: item.unit_code || "EA",
  }));

  // Parse customer address (simple approach - can be enhanced)
  const addressParts = (customer.address || "").split(",").map(p => p.trim());

  // Map id_type string to IdType if valid
  const validIdTypes: IdType[] = ["NRIC", "PASSPORT", "BRN", "ARMY"];
  const buyerIdType = validIdTypes.includes(customer.id_type as IdType)
    ? (customer.id_type as IdType)
    : undefined;

  // Map payment_mode to PaymentMode
  const validPaymentModes: PaymentMode[] = ["01", "02", "03", "04", "05", "06", "07", "08"];
  const paymentMode = validPaymentModes.includes(invoice.payment_mode as PaymentMode)
    ? (invoice.payment_mode as PaymentMode)
    : "03"; // Default: Bank Transfer

  return {
    id: invoice.number,
    documentType: DOCUMENT_TYPES.INVOICE as DocumentType,
    issueDate: invoice.date,
    issueTime: new Date().toISOString().split("T")[1].slice(0, 8) + "Z",
    documentCurrencyCode: invoice.currency_code || "MYR",
    supplier: {
      tin: settings.tin,
      brn: settings.brn,
      name: settings.businessActivityDescription,
      email: settings.supplierEmail,
      phone: settings.supplierPhone,
      msicCode: settings.msicCode,
      businessActivityDescription: settings.businessActivityDescription,
      address: {
        addressLine1: settings.addressLine1,
        addressLine2: settings.addressLine2,
        addressLine3: settings.addressLine3,
        postalCode: settings.postalCode,
        city: settings.city,
        state: settings.state,
        country: settings.country,
      },
    },
    buyer: {
      tin: customer.tin,
      brn: undefined,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      idType: buyerIdType,
      idValue: customer.id_number,
      address: {
        addressLine1: addressParts[0] || customer.address || "",
        addressLine2: addressParts[1],
        addressLine3: addressParts[2],
        postalCode: addressParts[addressParts.length - 2] || "00000",
        city: addressParts[addressParts.length - 1] || "Unknown",
        state: "14", // Default to KUL - should be parsed/stored
        country: "MYS",
      },
    },
    items,
    subtotal: Math.round(invoice.subtotal * 100),
    totalDiscount: 0,
    totalTaxAmount: Math.round(invoice.tax_amount * 100),
    totalExclTax: Math.round(invoice.subtotal * 100),
    totalInclTax: Math.round(invoice.total * 100),
    totalPayableAmount: Math.round(invoice.total * 100),
    paymentMode,
  };
}

export interface AutoSubmitResult {
  invoiceId: number;
  invoiceNumber: string;
  success: boolean;
  status: EInvoiceStatus;
  uuid?: string;
  longId?: string;
  error?: string;
}

export interface AutoSubmitBatchResult {
  processed: number;
  successful: number;
  failed: number;
  results: AutoSubmitResult[];
}

/**
 * Get invoices that are ready for auto-submission
 * Criteria:
 * - Invoice status is 'sent' (not draft, paid, cancelled)
 * - E-invoice status is 'none' (not yet submitted)
 * - Settings have auto_submit enabled
 */
export function getInvoicesReadyForAutoSubmit(): ReturnType<typeof listInvoices> {
  const settings = getLHDNSettings();
  if (!settings || !settings.autoSubmit) {
    return [];
  }

  // Get all invoices that are sent but not yet submitted to LHDN
  const allInvoices = listInvoices({});
  return allInvoices.filter(inv => {
    const fullInvoice = getInvoice(inv.id);
    return (
      fullInvoice &&
      fullInvoice.status === "sent" &&
      (!fullInvoice.einvoice_status || fullInvoice.einvoice_status === "none")
    );
  });
}

/**
 * Submit a single invoice to LHDN
 */
export async function submitInvoiceToLHDN(invoiceId: number): Promise<AutoSubmitResult> {
  const invoice = getInvoice(invoiceId);
  if (!invoice) {
    return {
      invoiceId,
      invoiceNumber: "Unknown",
      success: false,
      status: "none",
      error: "Invoice not found",
    };
  }

  const customer = getCustomer(invoice.customer_id);
  const settings = getLHDNSettings();

  // Validate before submission
  const validation = validateForSubmission(invoice, customer || null, settings);
  if (!validation.valid) {
    const summary = getValidationSummary(validation);
    return {
      invoiceId,
      invoiceNumber: invoice.number,
      success: false,
      status: "invalid",
      error: summary,
    };
  }

  if (!customer) {
    return {
      invoiceId,
      invoiceNumber: invoice.number,
      success: false,
      status: "invalid",
      error: "Customer not found",
    };
  }

  try {
    // Mark as pending
    updateEInvoiceStatus(invoiceId, { status: "pending" });

    // Create service
    const service = await createMyInvoisService({
      settings: settings!,
      onStatusChange: (invId, status) => {
        // Update status when we get callbacks
        updateEInvoiceStatus(parseInt(invId), { status });
      },
    });

    // Convert invoice to e-invoice document format
    const eInvoiceDoc = convertInvoiceToEInvoiceDocument(invoice, customer, settings!);

    // Submit the document
    const result = await service.submitDocument(eInvoiceDoc);

    if (result.success) {
      updateEInvoiceStatus(invoiceId, {
        status: "submitted",
        uuid: result.uuid,
        longId: result.longId,
        submissionUid: result.submissionUid,
      });

      return {
        invoiceId,
        invoiceNumber: invoice.number,
        success: true,
        status: "submitted",
        uuid: result.uuid,
        longId: result.longId,
      };
    } else {
      const errorMessage = result.error
        ? `${result.error.code}: ${result.error.message}`
        : "Submission failed";

      updateEInvoiceStatus(invoiceId, {
        status: "invalid",
        error: errorMessage,
      });

      return {
        invoiceId,
        invoiceNumber: invoice.number,
        success: false,
        status: "invalid",
        error: errorMessage,
      };
    }
  } catch (error) {
    const errorMsg = (error as Error).message;
    updateEInvoiceStatus(invoiceId, {
      status: "none",
      error: errorMsg,
    });

    return {
      invoiceId,
      invoiceNumber: invoice.number,
      success: false,
      status: "none",
      error: errorMsg,
    };
  }
}

/**
 * Process all invoices ready for auto-submission
 * This should be called periodically or after invoice status changes
 */
export async function processAutoSubmitQueue(): Promise<AutoSubmitBatchResult> {
  const invoices = getInvoicesReadyForAutoSubmit();
  const results: AutoSubmitResult[] = [];
  let successful = 0;
  let failed = 0;

  for (const invoice of invoices) {
    const result = await submitInvoiceToLHDN(invoice.id);
    results.push(result);
    if (result.success) {
      successful++;
    } else {
      failed++;
    }
    // Add small delay between submissions to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return {
    processed: invoices.length,
    successful,
    failed,
    results,
  };
}

/**
 * Check if auto-submit is enabled in settings
 */
export function isAutoSubmitEnabled(): boolean {
  const settings = getLHDNSettings();
  return settings?.autoSubmit === true;
}

/**
 * Get count of invoices pending auto-submission
 */
export function getPendingAutoSubmitCount(): number {
  return getInvoicesReadyForAutoSubmit().length;
}
