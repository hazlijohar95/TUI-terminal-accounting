/**
 * E-Invoice Dashboard Component
 *
 * Overview of e-invoice status across all invoices.
 * Shows submission stats, pending items, and recent activity.
 */

import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { getEnhancedTheme } from "../design/theme.js";
import { indicators, borderStyles } from "../design/tokens.js";
import { listInvoices, getInvoicesPendingEInvoice, Invoice } from "../../domain/invoices.js";
import { getLHDNSettings } from "../../db/index.js";
import { EINVOICE_STATUS_LABELS } from "../../services/myinvois/constants.js";
import type { EInvoiceStatus } from "../../services/myinvois/types.js";
import { EInvoiceStatusBadge } from "./EInvoiceView.js";

interface EInvoiceDashboardProps {
  width: number;
  height: number;
  onSelectInvoice?: (invoiceId: number) => void;
  onBack?: () => void;
}

interface EInvoiceStats {
  total: number;
  none: number;
  pending: number;
  submitted: number;
  valid: number;
  invalid: number;
  cancelled: number;
  rejected: number;
}

export function EInvoiceDashboard({
  width,
  height,
  onSelectInvoice,
  onBack,
}: EInvoiceDashboardProps) {
  const theme = getEnhancedTheme();
  const [stats, setStats] = useState<EInvoiceStats | null>(null);
  const [pendingInvoices, setPendingInvoices] = useState<Invoice[]>([]);
  const [recentActivity, setRecentActivity] = useState<Invoice[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [settingsConfigured, setSettingsConfigured] = useState(false);

  useEffect(() => {
    // Check if LHDN settings are configured
    const settings = getLHDNSettings();
    setSettingsConfigured(!!settings);

    // Get all invoices and calculate stats
    const allInvoices = listInvoices({});
    const statusCounts: EInvoiceStats = {
      total: allInvoices.length,
      none: 0,
      pending: 0,
      submitted: 0,
      valid: 0,
      invalid: 0,
      cancelled: 0,
      rejected: 0,
    };

    allInvoices.forEach((inv) => {
      const status = (inv.einvoice_status as EInvoiceStatus) || "none";
      statusCounts[status]++;
    });

    setStats(statusCounts);

    // Get pending invoices
    const pending = getInvoicesPendingEInvoice().slice(0, 10);
    setPendingInvoices(pending);

    // Get recent activity (invoices with e-invoice status changes)
    const recent = allInvoices
      .filter((inv) => inv.einvoice_status && inv.einvoice_status !== "none")
      .sort((a, b) => {
        const aDate = a.einvoice_submitted_at || a.updated_at;
        const bDate = b.einvoice_submitted_at || b.updated_at;
        return bDate.localeCompare(aDate);
      })
      .slice(0, 5);
    setRecentActivity(recent);
  }, []);

  useInput((input, key) => {
    if (key.escape || input === "q") {
      onBack?.();
      return;
    }

    if (key.upArrow || input === "k") {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    }

    if (key.downArrow || input === "j") {
      setSelectedIndex((prev) => Math.min(pendingInvoices.length - 1, prev + 1));
    }

    if (key.return && pendingInvoices[selectedIndex]) {
      onSelectInvoice?.(pendingInvoices[selectedIndex].id);
    }
  });

  const formatCurrency = (value: number) => `RM ${value.toFixed(2)}`;

  const leftWidth = Math.floor(width * 0.4);
  const rightWidth = width - leftWidth - 3;

  if (!stats) {
    return (
      <Box padding={1}>
        <Text color={theme.semantic.textMuted}>Loading e-invoice dashboard...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="row" width={width} height={height}>
      {/* Left Panel - Stats & Settings */}
      <Box
        flexDirection="column"
        width={leftWidth}
        height={height}
        borderStyle={borderStyles.panel}
        borderColor={theme.semantic.info}
        paddingX={1}
      >
        <Text bold color={theme.semantic.info}>{indicators.info} E-Invoice Dashboard</Text>
        <Text color={theme.semantic.textMuted}>LHDN MyInvois Status</Text>
        <Box height={1} />

        {/* Settings Status */}
        <Box
          borderStyle={borderStyles.input}
          borderColor={settingsConfigured ? theme.semantic.success : theme.semantic.warning}
          paddingX={1}
          marginBottom={1}
        >
          <Text color={settingsConfigured ? theme.semantic.success : theme.semantic.warning}>
            {settingsConfigured ? indicators.check : indicators.warning}{" "}
            {settingsConfigured ? "LHDN Settings Configured" : "LHDN Settings Required"}
          </Text>
        </Box>

        {/* Stats Grid */}
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color={theme.semantic.textSecondary}>{indicators.info} Submission Status</Text>

          <Box justifyContent="space-between">
            <Text color={theme.semantic.textMuted}>Ready to Submit:</Text>
            <Text color={theme.semantic.warning}>{stats.none + stats.invalid + stats.rejected}</Text>
          </Box>

          <Box justifyContent="space-between">
            <Text color={theme.semantic.textMuted}>Pending/Submitted:</Text>
            <Text color={theme.semantic.info}>{stats.pending + stats.submitted}</Text>
          </Box>

          <Box justifyContent="space-between">
            <Text color={theme.semantic.textMuted}>Validated:</Text>
            <Text color={theme.semantic.success}>{stats.valid}</Text>
          </Box>

          <Box justifyContent="space-between">
            <Text color={theme.semantic.textMuted}>Failed:</Text>
            <Text color={theme.semantic.error}>{stats.invalid + stats.rejected}</Text>
          </Box>

          <Box justifyContent="space-between">
            <Text color={theme.semantic.textMuted}>Cancelled:</Text>
            <Text color={theme.semantic.expense}>{stats.cancelled}</Text>
          </Box>
        </Box>

        {/* Completion Rate */}
        <Box
          borderStyle={borderStyles.input}
          borderColor={theme.semantic.border}
          paddingX={1}
          marginBottom={1}
          flexDirection="column"
        >
          <Text color={theme.semantic.textSecondary}>Compliance Rate</Text>
          {stats.total > 0 ? (
            <>
              <Text bold color={theme.semantic.success}>
                {Math.round((stats.valid / stats.total) * 100)}%
              </Text>
              <Text color={theme.semantic.textMuted} dimColor>
                {stats.valid} of {stats.total} invoices validated
              </Text>
            </>
          ) : (
            <Text color={theme.semantic.textMuted}>No invoices yet</Text>
          )}
        </Box>

        <Box flexGrow={1} />

        {/* Help */}
        <Text color={theme.semantic.textMuted} dimColor>
          j/k: navigate {indicators.bullet} Enter: view {indicators.bullet} q: back
        </Text>
      </Box>

      <Box width={1} />

      {/* Right Panel - Pending & Activity */}
      <Box
        flexDirection="column"
        width={rightWidth}
        height={height}
        borderStyle={borderStyles.panel}
        borderColor={theme.semantic.warning}
        paddingX={1}
      >
        <Text bold color={theme.semantic.warning}>{indicators.pending} Pending Submission</Text>
        <Text color={theme.semantic.textMuted}>Invoices ready for e-invoice</Text>
        <Box height={1} />

        {/* Pending List */}
        {pendingInvoices.length === 0 ? (
          <Box paddingY={1}>
            <Text color={theme.semantic.success}>
              {indicators.check} All invoices submitted
            </Text>
          </Box>
        ) : (
          <Box flexDirection="column" marginBottom={1}>
            {pendingInvoices.map((inv, idx) => (
              <Box
                key={inv.id}
                backgroundColor={idx === selectedIndex ? theme.semantic.focusBorder : undefined}
              >
                <Text
                  color={idx === selectedIndex ? theme.base : theme.semantic.textPrimary}
                  bold={idx === selectedIndex}
                >
                  {idx === selectedIndex ? indicators.pointer : " "}{" "}
                  {inv.number} - {inv.customer_name?.slice(0, 15)}
                  {"  "}
                  <Text color={idx === selectedIndex ? theme.base : theme.semantic.textMuted}>
                    {formatCurrency(inv.total)}
                  </Text>
                </Text>
              </Box>
            ))}
          </Box>
        )}

        <Box height={1} />

        {/* Recent Activity */}
        <Text bold color={theme.semantic.info}>{indicators.partial} Recent Activity</Text>
        <Box flexDirection="column" marginTop={1}>
          {recentActivity.length === 0 ? (
            <Text color={theme.semantic.textMuted}>No recent e-invoice activity</Text>
          ) : (
            recentActivity.map((inv) => (
              <Box key={inv.id} justifyContent="space-between">
                <Box>
                  <EInvoiceStatusBadge status={(inv.einvoice_status as EInvoiceStatus) || "none"} />
                  <Text color={theme.semantic.textPrimary}> {inv.number}</Text>
                </Box>
                <Text color={theme.semantic.textMuted} dimColor>
                  {EINVOICE_STATUS_LABELS[(inv.einvoice_status as EInvoiceStatus) || "none"]}
                </Text>
              </Box>
            ))
          )}
        </Box>

        <Box flexGrow={1} />

        {/* Quick Actions */}
        <Box
          borderStyle={borderStyles.input}
          borderColor={theme.semantic.border}
          paddingX={1}
        >
          <Text color={theme.semantic.textMuted}>
            Select invoice and press Enter to view e-invoice details
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
