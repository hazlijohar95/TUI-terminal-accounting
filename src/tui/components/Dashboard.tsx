import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import {
  getBalanceSheet,
  getProfitLoss,
  getReceivablesAging,
  type BalanceSheetReport,
  type ProfitLossReport,
  type ReceivablesAgingReport,
} from "../../domain/reports.js";
import { listInvoices, type Invoice } from "../../domain/invoices.js";
import { getEnhancedTheme } from "../design/theme.js";
import { borderStyles } from "../design/tokens.js";

interface DashboardProps {
  width: number;
  height: number;
}

interface DashboardData {
  balance: BalanceSheetReport;
  pl: ProfitLossReport;
  ar: ReceivablesAgingReport;
  recentInvoices: Invoice[];
}

export function Dashboard({ width, height }: DashboardProps) {
  const theme = getEnhancedTheme();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    // Load dashboard data
    const balance = getBalanceSheet();
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const today = now.toISOString().split("T")[0];
    const pl = getProfitLoss(monthStart, today);
    const ar = getReceivablesAging();
    const recentInvoices = listInvoices({}).slice(0, 5);

    setData({ balance, pl, ar, recentInvoices });
  }, []);

  if (!data) {
    return (
      <Box padding={1}>
        <Text color={theme.semantic.textMuted}>Loading...</Text>
      </Box>
    );
  }

  const { balance, pl, ar, recentInvoices } = data;
  const panelWidth = Math.floor((width - 4) / 2);

  return (
    <Box flexDirection="column" padding={1} width={width}>
      {/* Top row - Cash Position and This Month */}
      <Box>
        {/* Cash Position Panel */}
        <Box
          flexDirection="column"
          width={panelWidth}
          borderStyle={borderStyles.panel}
          borderColor={theme.semantic.info}
          paddingX={1}
        >
          <Text bold color={theme.semantic.info}>Cash Position</Text>
          <Box justifyContent="space-between">
            <Text color={theme.semantic.textPrimary}>Cash</Text>
            <Text color={balance.assets.cash >= 0 ? theme.semantic.success : theme.semantic.error}>
              ${balance.assets.cash.toFixed(2)}
            </Text>
          </Box>
          <Box justifyContent="space-between">
            <Text color={theme.semantic.textPrimary}>Receivables</Text>
            <Text color={theme.semantic.textPrimary}>${balance.assets.receivables.toFixed(2)}</Text>
          </Box>
          <Box justifyContent="space-between">
            <Text bold color={theme.semantic.textPrimary}>Total Assets</Text>
            <Text bold color={theme.semantic.textPrimary}>${balance.assets.total.toFixed(2)}</Text>
          </Box>
        </Box>

        <Box width={2} />

        {/* This Month Panel */}
        <Box
          flexDirection="column"
          width={panelWidth}
          borderStyle={borderStyles.panel}
          borderColor={theme.semantic.info}
          paddingX={1}
        >
          <Text bold color={theme.semantic.info}>This Month</Text>
          <Box justifyContent="space-between">
            <Text color={theme.semantic.textPrimary}>Revenue</Text>
            <Text color={theme.semantic.success}>+${pl.revenue.total.toFixed(2)}</Text>
          </Box>
          <Box justifyContent="space-between">
            <Text color={theme.semantic.textPrimary}>Expenses</Text>
            <Text color={theme.semantic.expense}>-${pl.expenses.total.toFixed(2)}</Text>
          </Box>
          <Box justifyContent="space-between">
            <Text bold color={theme.semantic.textPrimary}>Net Income</Text>
            <Text bold color={pl.net_income >= 0 ? theme.semantic.success : theme.semantic.error}>
              ${pl.net_income.toFixed(2)}
            </Text>
          </Box>
        </Box>
      </Box>

      <Box height={1} />

      {/* Alerts */}
      {(ar.totals.days_31_60 > 0 || ar.totals.days_61_90 > 0 || ar.totals.days_90_plus > 0) && (
        <Box
          flexDirection="column"
          width={width - 2}
          borderStyle={borderStyles.panel}
          borderColor={theme.semantic.warning}
          paddingX={1}
        >
          <Text bold color={theme.semantic.warning}>Alerts</Text>
          {ar.days_90_plus.length > 0 && (
            <Text color={theme.semantic.error}>
              {ar.days_90_plus.length} invoice(s) 90+ days overdue (${ar.totals.days_90_plus.toFixed(2)})
            </Text>
          )}
          {(ar.days_31_60.length > 0 || ar.days_61_90.length > 0) && (
            <Text color={theme.semantic.warning}>
              {ar.days_31_60.length + ar.days_61_90.length} invoice(s) 30-90 days overdue
            </Text>
          )}
          {ar.days_1_30.length > 0 && (
            <Text color={theme.semantic.textPrimary}>
              {ar.days_1_30.length} invoice(s) due soon (${ar.totals.days_1_30.toFixed(2)})
            </Text>
          )}
        </Box>
      )}

      <Box height={1} />

      {/* Recent Invoices */}
      <Box
        flexDirection="column"
        width={width - 2}
        borderStyle={borderStyles.panel}
        borderColor={theme.semantic.warning}
        paddingX={1}
      >
        <Text bold color={theme.semantic.warning}>Recent Invoices</Text>
        {recentInvoices.length === 0 ? (
          <Text color={theme.semantic.textMuted}>No invoices yet. Press i to create your first invoice.</Text>
        ) : (
          recentInvoices.map((inv) => (
            <Box key={inv.id} justifyContent="space-between">
              <Text color={theme.semantic.textPrimary}>
                <Text bold>{inv.number}</Text> {inv.customer_name?.slice(0, 20)}
              </Text>
              <Text color={theme.semantic.textPrimary}>
                <Text color={getStatusColor(inv.status, theme)}>{inv.status}</Text>
                {"  "}
                ${inv.total.toFixed(2)}
              </Text>
            </Box>
          ))
        )}
      </Box>

      <Box height={1} />

      {/* Quick Tips */}
      <Box paddingX={1}>
        <Text color={theme.semantic.textMuted}>
          c chat · i invoices · r reports · : commands · ? help · q quit
        </Text>
      </Box>
    </Box>
  );
}

function getStatusColor(status: string, theme: ReturnType<typeof getEnhancedTheme>): string {
  switch (status) {
    case "paid":
      return theme.semantic.success;
    case "sent":
      return theme.semantic.info;
    case "overdue":
      return theme.semantic.error;
    case "draft":
      return theme.semantic.textMuted;
    default:
      return theme.semantic.textPrimary;
  }
}
