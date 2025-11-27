/**
 * E-Invoice Status Sync Module
 *
 * Polls LHDN MyInvois to check and update the status of submitted invoices.
 * Handles the transition from 'submitted' -> 'valid' or 'invalid/rejected'.
 */

import { listInvoices, getInvoice, updateEInvoiceStatus } from "../../domain/invoices.js";
import { getLHDNSettings } from "../../db/index.js";
import { createMyInvoisService } from "./myinvois-service.js";
import type { EInvoiceStatus } from "./types.js";

export interface StatusSyncResult {
  invoiceId: number;
  invoiceNumber: string;
  previousStatus: EInvoiceStatus;
  newStatus: EInvoiceStatus;
  changed: boolean;
  error?: string;
}

export interface StatusSyncBatchResult {
  checked: number;
  updated: number;
  errors: number;
  results: StatusSyncResult[];
}

/**
 * Get invoices that need status sync
 * Criteria:
 * - E-invoice status is 'pending' or 'submitted' (waiting for LHDN response)
 * - Has a UUID (was submitted)
 */
export function getInvoicesNeedingSync(): ReturnType<typeof listInvoices> {
  const allInvoices = listInvoices({});
  return allInvoices.filter(inv => {
    const fullInvoice = getInvoice(inv.id);
    return (
      fullInvoice &&
      fullInvoice.einvoice_uuid &&
      (fullInvoice.einvoice_status === "pending" || fullInvoice.einvoice_status === "submitted")
    );
  });
}

/**
 * Sync status for a single invoice from LHDN
 */
export async function syncInvoiceStatus(invoiceId: number): Promise<StatusSyncResult> {
  const invoice = getInvoice(invoiceId);
  if (!invoice) {
    return {
      invoiceId,
      invoiceNumber: "Unknown",
      previousStatus: "none",
      newStatus: "none",
      changed: false,
      error: "Invoice not found",
    };
  }

  if (!invoice.einvoice_uuid) {
    return {
      invoiceId,
      invoiceNumber: invoice.number,
      previousStatus: (invoice.einvoice_status as EInvoiceStatus) || "none",
      newStatus: (invoice.einvoice_status as EInvoiceStatus) || "none",
      changed: false,
      error: "No e-invoice UUID - invoice not submitted",
    };
  }

  const settings = getLHDNSettings();
  if (!settings) {
    return {
      invoiceId,
      invoiceNumber: invoice.number,
      previousStatus: (invoice.einvoice_status as EInvoiceStatus) || "none",
      newStatus: (invoice.einvoice_status as EInvoiceStatus) || "none",
      changed: false,
      error: "LHDN settings not configured",
    };
  }

  const previousStatus = (invoice.einvoice_status as EInvoiceStatus) || "none";

  try {
    const service = await createMyInvoisService({ settings });
    const statusResult = await service.getDocumentStatus(invoice.einvoice_uuid);

    if (!statusResult) {
      return {
        invoiceId,
        invoiceNumber: invoice.number,
        previousStatus,
        newStatus: previousStatus,
        changed: false,
        error: "Failed to get status from LHDN",
      };
    }

    const newStatus = mapLHDNStatus(statusResult.status);
    const changed = newStatus !== previousStatus;

    if (changed) {
      const updateData: Parameters<typeof updateEInvoiceStatus>[1] = {
        status: newStatus,
      };

      // Note: DocumentStatusResponse doesn't have detailed error info
      // We can only infer rejection from status
      if (newStatus === "rejected" || newStatus === "invalid") {
        updateData.error = `Document ${newStatus} by LHDN`;
      }

      updateEInvoiceStatus(invoiceId, updateData);
    }

    return {
      invoiceId,
      invoiceNumber: invoice.number,
      previousStatus,
      newStatus,
      changed,
    };
  } catch (error) {
    return {
      invoiceId,
      invoiceNumber: invoice.number,
      previousStatus,
      newStatus: previousStatus,
      changed: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Map LHDN status strings to our EInvoiceStatus type
 */
function mapLHDNStatus(lhdnStatus: string): EInvoiceStatus {
  const statusMap: Record<string, EInvoiceStatus> = {
    // LHDN statuses
    "Submitted": "submitted",
    "Valid": "valid",
    "Invalid": "invalid",
    "Cancelled": "cancelled",
    "Rejected": "rejected",
    // Lowercase variants
    "submitted": "submitted",
    "valid": "valid",
    "invalid": "invalid",
    "cancelled": "cancelled",
    "rejected": "rejected",
    // Pending/In Progress
    "InProgress": "pending",
    "Pending": "pending",
    "pending": "pending",
  };

  return statusMap[lhdnStatus] || "submitted";
}

/**
 * Sync status for all pending invoices
 */
export async function syncAllPendingStatuses(): Promise<StatusSyncBatchResult> {
  const invoices = getInvoicesNeedingSync();
  const results: StatusSyncResult[] = [];
  let updated = 0;
  let errors = 0;

  for (const invoice of invoices) {
    const result = await syncInvoiceStatus(invoice.id);
    results.push(result);
    if (result.changed) {
      updated++;
    }
    if (result.error) {
      errors++;
    }
    // Add small delay between API calls to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  return {
    checked: invoices.length,
    updated,
    errors,
    results,
  };
}

/**
 * Start a polling interval to sync statuses
 * Returns a function to stop the polling
 */
let syncInterval: NodeJS.Timeout | null = null;

export function startStatusSyncPolling(intervalMs: number = 60000): () => void {
  if (syncInterval) {
    clearInterval(syncInterval);
  }

  const poll = async () => {
    try {
      const settings = getLHDNSettings();
      if (!settings) return;

      const result = await syncAllPendingStatuses();
      if (result.updated > 0) {
        console.log(`[E-Invoice Sync] Updated ${result.updated} invoice(s)`);
      }
    } catch (error) {
      console.error("[E-Invoice Sync] Error:", (error as Error).message);
    }
  };

  // Run immediately, then on interval
  poll();
  syncInterval = setInterval(poll, intervalMs);

  return () => {
    if (syncInterval) {
      clearInterval(syncInterval);
      syncInterval = null;
    }
  };
}

/**
 * Stop any active polling
 */
export function stopStatusSyncPolling(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

/**
 * Check if polling is active
 */
export function isPollingActive(): boolean {
  return syncInterval !== null;
}

/**
 * Get count of invoices needing sync
 */
export function getPendingSyncCount(): number {
  return getInvoicesNeedingSync().length;
}
