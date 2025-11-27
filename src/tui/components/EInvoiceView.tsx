/**
 * E-Invoice View
 *
 * View for managing e-invoice submissions to LHDN MyInvois.
 * Shows submission status, allows submission, and displays validation results.
 */

import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { getEnhancedTheme } from "../design/theme.js";
import { indicators, borderStyles } from "../design/tokens.js";
import {
  EINVOICE_STATUS_LABELS,
  EINVOICE_STATUS_COLORS,
  DOCUMENT_TYPE_LABELS,
} from "../../services/myinvois/constants.js";
import type { EInvoiceStatus } from "../../services/myinvois/types.js";

interface EInvoiceViewProps {
  width: number;
  height: number;
  invoiceId: string;
  invoiceNumber: string;
  invoiceTotal: number;
  customerId: string;
  customerName: string;
  status: EInvoiceStatus;
  uuid?: string;
  longId?: string;
  submittedAt?: Date;
  validatedAt?: Date;
  errorMessage?: string;
  errorDetails?: string[];
  onSubmit?: () => Promise<void>;
  onCancel?: () => Promise<void>;
  onRefresh?: () => Promise<void>;
  onBack?: () => void;
}

export function EInvoiceView({
  width,
  height,
  invoiceNumber,
  invoiceTotal,
  customerName,
  status,
  uuid,
  longId,
  submittedAt,
  validatedAt,
  errorMessage,
  errorDetails,
  onSubmit,
  onCancel,
  onRefresh,
  onBack,
}: EInvoiceViewProps) {
  const theme = getEnhancedTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [selectedAction, setSelectedAction] = useState(0);

  // Available actions based on status
  const getAvailableActions = () => {
    const actions: Array<{ key: string; label: string; action: () => void }> = [];

    if (status === "none" || status === "invalid" || status === "rejected") {
      actions.push({
        key: "s",
        label: "Submit to LHDN",
        action: async () => {
          if (onSubmit) {
            setIsLoading(true);
            try {
              await onSubmit();
              setMessage({ type: "success", text: "Submitted successfully!" });
            } catch {
              setMessage({ type: "error", text: "Submission failed" });
            }
            setIsLoading(false);
          }
        },
      });
    }

    if (status === "valid") {
      actions.push({
        key: "c",
        label: "Cancel e-Invoice",
        action: async () => {
          if (onCancel) {
            setIsLoading(true);
            try {
              await onCancel();
              setMessage({ type: "success", text: "Cancelled successfully!" });
            } catch {
              setMessage({ type: "error", text: "Cancellation failed" });
            }
            setIsLoading(false);
          }
        },
      });
    }

    if (status === "pending" || status === "submitted") {
      actions.push({
        key: "r",
        label: "Refresh Status",
        action: async () => {
          if (onRefresh) {
            setIsLoading(true);
            try {
              await onRefresh();
              setMessage({ type: "info", text: "Status refreshed" });
            } catch {
              setMessage({ type: "error", text: "Refresh failed" });
            }
            setIsLoading(false);
          }
        },
      });
    }

    actions.push({
      key: "q",
      label: "Back",
      action: () => onBack?.(),
    });

    return actions;
  };

  const actions = getAvailableActions();

  useInput((input, key) => {
    if (isLoading) return;

    // Quick key shortcuts
    const action = actions.find((a) => a.key === input);
    if (action) {
      action.action();
      return;
    }

    // Navigation
    if (key.upArrow || input === "k") {
      setSelectedAction((prev) => Math.max(0, prev - 1));
    }
    if (key.downArrow || input === "j") {
      setSelectedAction((prev) => Math.min(actions.length - 1, prev + 1));
    }
    if (key.return) {
      actions[selectedAction]?.action();
    }
    if (key.escape) {
      onBack?.();
    }
  });

  const formatCurrency = (cents: number): string => {
    return `RM ${(cents / 100).toFixed(2)}`;
  };

  const formatDate = (date: Date | undefined): string => {
    if (!date) return "-";
    return date.toLocaleDateString("en-MY", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (s: EInvoiceStatus): string => {
    const colorMap: Record<string, string> = {
      none: theme.semantic.textMuted,
      pending: theme.semantic.warning,
      submitted: theme.semantic.info,
      valid: theme.semantic.success,
      invalid: theme.semantic.error,
      cancelled: theme.semantic.expense,
      rejected: theme.semantic.error,
    };
    return colorMap[s] || theme.semantic.textPrimary;
  };

  const leftWidth = Math.floor(width * 0.6);
  const rightWidth = width - leftWidth - 3;

  return (
    <Box flexDirection="row" width={width} height={height}>
      {/* Left Panel - Invoice & Status Details */}
      <Box
        flexDirection="column"
        width={leftWidth}
        height={height}
        borderStyle={borderStyles.panel}
        borderColor={theme.semantic.focusBorder}
        paddingX={1}
      >
        <Text bold color={theme.semantic.info}>◪ e-Invoice Details</Text>
        <Text color={theme.semantic.textMuted}>LHDN MyInvois Integration</Text>
        <Box height={1} />

        {/* Invoice Info */}
        <Box flexDirection="column" marginBottom={1}>
          <Box justifyContent="space-between">
            <Text color={theme.semantic.textMuted}>Invoice:</Text>
            <Text bold color={theme.semantic.textPrimary}>{invoiceNumber}</Text>
          </Box>
          <Box justifyContent="space-between">
            <Text color={theme.semantic.textMuted}>Customer:</Text>
            <Text color={theme.semantic.textPrimary}>{customerName}</Text>
          </Box>
          <Box justifyContent="space-between">
            <Text color={theme.semantic.textMuted}>Total:</Text>
            <Text bold color={theme.semantic.success}>{formatCurrency(invoiceTotal)}</Text>
          </Box>
        </Box>

        {/* Status */}
        <Box
          borderStyle={borderStyles.input}
          borderColor={getStatusColor(status)}
          paddingX={1}
          marginBottom={1}
          flexDirection="column"
        >
          <Box justifyContent="space-between">
            <Text color={theme.semantic.textMuted}>Status:</Text>
            <Text bold color={getStatusColor(status)}>
              {EINVOICE_STATUS_LABELS[status] || status}
            </Text>
          </Box>
          {uuid && (
            <Box justifyContent="space-between">
              <Text color={theme.semantic.textMuted}>UUID:</Text>
              <Text color={theme.semantic.textSecondary}>{uuid.slice(0, 20)}...</Text>
            </Box>
          )}
          {longId && (
            <Box justifyContent="space-between">
              <Text color={theme.semantic.textMuted}>Long ID:</Text>
              <Text color={theme.semantic.info}>{longId.slice(0, 18)}...</Text>
            </Box>
          )}
        </Box>

        {/* Timestamps */}
        <Box flexDirection="column" marginBottom={1}>
          {submittedAt && (
            <Box justifyContent="space-between">
              <Text color={theme.semantic.textMuted}>Submitted:</Text>
              <Text color={theme.semantic.textPrimary}>{formatDate(submittedAt)}</Text>
            </Box>
          )}
          {validatedAt && (
            <Box justifyContent="space-between">
              <Text color={theme.semantic.textMuted}>Validated:</Text>
              <Text color={theme.semantic.success}>{formatDate(validatedAt)}</Text>
            </Box>
          )}
        </Box>

        {/* Error Details */}
        {(errorMessage || (errorDetails && errorDetails.length > 0)) && (
          <Box
            flexDirection="column"
            borderStyle={borderStyles.input}
            borderColor={theme.semantic.error}
            paddingX={1}
            marginBottom={1}
          >
            <Text bold color={theme.semantic.error}>{indicators.cross} Validation Errors</Text>
            {errorMessage && (
              <Text color={theme.semantic.textPrimary}>{errorMessage}</Text>
            )}
            {errorDetails?.map((detail, idx) => (
              <Text key={idx} color={theme.semantic.textMuted}>{indicators.bullet} {detail}</Text>
            ))}
          </Box>
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <Box marginTop={1}>
            <Text color={theme.semantic.warning}>{indicators.loading} Processing...</Text>
          </Box>
        )}

        <Box flexGrow={1} />

        {/* Message */}
        {message && (
          <Text
            color={
              message.type === "success"
                ? theme.semantic.success
                : message.type === "error"
                  ? theme.semantic.error
                  : theme.semantic.info
            }
          >
            {message.type === "success" ? indicators.check : message.type === "error" ? indicators.cross : indicators.info} {message.text}
          </Text>
        )}
      </Box>

      <Box width={1} />

      {/* Right Panel - Actions & Info */}
      <Box
        flexDirection="column"
        width={rightWidth}
        height={height}
        borderStyle={borderStyles.panel}
        borderColor={theme.semantic.border}
        paddingX={1}
      >
        <Text bold color={theme.semantic.warning}>{indicators.pointer} Actions</Text>
        <Text color={theme.semantic.textMuted}>j/k nav • Enter select</Text>
        <Box height={1} />

        {/* Action List */}
        {actions.map((action, idx) => {
          if (idx === selectedAction) {
            return (
              <Box key={action.key}>
                <Box backgroundColor={theme.semantic.focusBorder}>
                  <Text color={theme.base} bold>
                    {" ▶ "}[{action.key}] {action.label}
                  </Text>
                </Box>
              </Box>
            );
          }
          return (
            <Box key={action.key}>
              <Text color={theme.semantic.textSecondary}>
                {"   "}[{action.key}] {action.label}
              </Text>
            </Box>
          );
        })}

        <Box height={1} />

        {/* Status Legend */}
        <Box flexDirection="column" marginTop={1}>
          <Text bold color={theme.semantic.textSecondary}>{indicators.info} Status Legend</Text>
          <Text color={theme.semantic.textMuted}>{indicators.pending} Not Submitted</Text>
          <Text color={theme.semantic.warning}>{indicators.partial} Pending</Text>
          <Text color={theme.semantic.info}>{indicators.partial} Submitted</Text>
          <Text color={theme.semantic.success}>{indicators.complete} Validated</Text>
          <Text color={theme.semantic.error}>{indicators.cross} Invalid/Rejected</Text>
          <Text color={theme.semantic.expense}>{indicators.pending} Cancelled</Text>
        </Box>

        <Box flexGrow={1} />

        {/* Help */}
        <Box borderStyle={borderStyles.input} borderColor={theme.semantic.border} paddingX={1}>
          <Text color={theme.semantic.textMuted}>
            Valid invoices can be cancelled within 72 hours.
          </Text>
        </Box>
      </Box>
    </Box>
  );
}

/**
 * E-Invoice Status Badge Component
 * Compact status indicator for list views
 */
interface EInvoiceStatusBadgeProps {
  status: EInvoiceStatus;
}

export function EInvoiceStatusBadge({ status }: EInvoiceStatusBadgeProps) {
  const theme = getEnhancedTheme();

  const getIcon = (s: EInvoiceStatus): string => {
    const icons: Record<EInvoiceStatus, string> = {
      none: indicators.pending,
      pending: indicators.partial,
      submitted: indicators.partial,
      valid: indicators.complete,
      invalid: indicators.cross,
      cancelled: indicators.pending,
      rejected: indicators.cross,
    };
    return icons[s] || indicators.question;
  };

  const getColor = (s: EInvoiceStatus): string => {
    const colorMap: Record<EInvoiceStatus, string> = {
      none: theme.semantic.textMuted,
      pending: theme.semantic.warning,
      submitted: theme.semantic.info,
      valid: theme.semantic.success,
      invalid: theme.semantic.error,
      cancelled: theme.semantic.expense,
      rejected: theme.semantic.error,
    };
    return colorMap[s] || theme.semantic.textPrimary;
  };

  return (
    <Text color={getColor(status)}>
      {getIcon(status)}
    </Text>
  );
}

/**
 * E-Invoice Summary Stats Component
 */
interface EInvoiceSummaryProps {
  stats: {
    total: number;
    pending: number;
    submitted: number;
    valid: number;
    invalid: number;
    cancelled: number;
    rejected: number;
  };
}

export function EInvoiceSummary({ stats }: EInvoiceSummaryProps) {
  const theme = getEnhancedTheme();

  return (
    <Box flexDirection="row" gap={1}>
      <Text color={theme.semantic.success}>{indicators.check}{stats.valid}</Text>
      <Text color={theme.semantic.warning}>{indicators.partial}{stats.pending + stats.submitted}</Text>
      <Text color={theme.semantic.error}>{indicators.cross}{stats.invalid + stats.rejected}</Text>
      <Text color={theme.semantic.expense}>{indicators.pending}{stats.cancelled}</Text>
    </Box>
  );
}
