/**
 * ReportView Component
 *
 * Visually rich financial reports with charts, gauges,
 * and btop/lazygit-inspired data visualization.
 */

import React, { useState, useMemo } from "react";
import { Box, Text, useInput } from "ink";
import {
  getBalanceSheet,
  getProfitLoss,
  getReceivablesAging,
  getCashFlow,
  getExpensesByCategory,
  getSSTReturn,
  type ProfitLossReport,
  type CashFlowReport,
  type SSTReturnReport,
} from "../../domain/reports.js";
import { formatCurrency, formatDate, isMalaysianLocale, getTaxName } from "../../core/localization.js";
import { getEnhancedTheme } from "../design/theme.js";
import { indicators, borderStyles } from "../design/tokens.js";
import {
  BigNumber,
  HorizontalBarChart,
  Gauge,
  TrendIndicator,
  Sparkline,
} from "./ui/index.js";

interface ReportViewProps {
  width: number;
  height: number;
}

type ReportType = "balance" | "pl" | "ar" | "cashflow" | "expenses" | "sst";

const reportLabels: Record<ReportType, string> = {
  balance: "Balance Sheet",
  pl: "Profit & Loss",
  ar: "AR Aging",
  cashflow: "Cash Flow",
  expenses: "Expenses",
  sst: "SST Return",
};

export function ReportView({ width, height }: ReportViewProps) {
  const [selectedReport, setSelectedReport] = useState<ReportType>("balance");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const theme = getEnhancedTheme();

  // Show SST only for Malaysian locale
  const showSST = isMalaysianLocale();
  const reports: ReportType[] = showSST
    ? ["balance", "pl", "ar", "cashflow", "expenses", "sst"]
    : ["balance", "pl", "ar", "cashflow", "expenses"];
  const listWidth = Math.floor(width * 0.22);
  const detailWidth = width - listWidth - 3;

  // Report icons for visual hierarchy
  const reportIcons: Record<ReportType, string> = {
    balance: "◧",
    pl: "◨",
    ar: "◩",
    cashflow: "◪",
    expenses: "◫",
    sst: "◬",
  };

  useInput((input, key) => {
    // Number keys for quick select
    if (input === "1") { setSelectedReport("balance"); setSelectedIndex(0); }
    if (input === "2") { setSelectedReport("pl"); setSelectedIndex(1); }
    if (input === "3") { setSelectedReport("ar"); setSelectedIndex(2); }
    if (input === "4") { setSelectedReport("cashflow"); setSelectedIndex(3); }
    if (input === "5") { setSelectedReport("expenses"); setSelectedIndex(4); }
    if (input === "6" && showSST) { setSelectedReport("sst"); setSelectedIndex(5); }

    // Arrow navigation
    if (key.upArrow || input === "k") {
      const newIndex = Math.max(0, selectedIndex - 1);
      setSelectedIndex(newIndex);
      setSelectedReport(reports[newIndex]);
    }
    if (key.downArrow || input === "j") {
      const newIndex = Math.min(reports.length - 1, selectedIndex + 1);
      setSelectedIndex(newIndex);
      setSelectedReport(reports[newIndex]);
    }
  });

  return (
    <Box flexDirection="row" width={width} height={height}>
      {/* Left Panel - Report List */}
      <Box
        flexDirection="column"
        width={listWidth}
        height={height}
        borderStyle={borderStyles.panel}
        borderColor={theme.semantic.focusBorder}
        paddingX={1}
      >
        {/* Header */}
        <Box justifyContent="space-between" marginBottom={1}>
          <Text bold color={theme.semantic.warning}>◆ Reports</Text>
        </Box>

        {/* Divider */}
        <Text color={theme.semantic.border}>{"─".repeat(listWidth - 4)}</Text>

        {/* Hints */}
        <Box marginY={1}>
          <Text color={theme.semantic.textMuted}>j/k ↕ • 1-5 quick</Text>
        </Box>

        {/* Report List */}
        {reports.map((report, i) => {
          const isSelected = i === selectedIndex;
          if (isSelected) {
            return (
              <Box key={report} flexDirection="column" marginBottom={1}>
                <Box backgroundColor={theme.semantic.focusBorder}>
                  <Text color={theme.base} bold>
                    {" ▶ "}{reportIcons[report]} {reportLabels[report]}{" "}
                  </Text>
                </Box>
              </Box>
            );
          }
          return (
            <Box key={report}>
              <Text color={theme.semantic.textMuted}>{"   "}</Text>
              <Text color={theme.semantic.textSecondary}>
                {i + 1}. {reportLabels[report]}
              </Text>
            </Box>
          );
        })}
      </Box>

      <Box width={1} />

      {/* Right Panel - Report Detail */}
      <Box
        flexDirection="column"
        width={detailWidth}
        height={height}
        borderStyle={borderStyles.panel}
        borderColor={theme.semantic.border}
        paddingX={1}
      >
        {selectedReport === "balance" && <BalanceSheetReport width={detailWidth - 4} />}
        {selectedReport === "pl" && <ProfitLossReport width={detailWidth - 4} />}
        {selectedReport === "ar" && <ARReport width={detailWidth - 4} />}
        {selectedReport === "cashflow" && <CashFlowReport width={detailWidth - 4} />}
        {selectedReport === "expenses" && <ExpensesReport width={detailWidth - 4} />}
        {selectedReport === "sst" && <SSTReport width={detailWidth - 4} />}
      </Box>
    </Box>
  );
}

function BalanceSheetReport({ width }: { width: number }) {
  const report = getBalanceSheet();
  const theme = getEnhancedTheme();

  // Calculate asset composition for visual
  const cashPercent = report.assets.total > 0 ? Math.round((report.assets.cash / report.assets.total) * 100) : 0;

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Text bold color={theme.semantic.info}>◧ Balance Sheet</Text>
        <Text color={theme.semantic.textMuted}>{report.date}</Text>
      </Box>

      {/* Key Metrics Row */}
      <Box marginBottom={1}>
        <Box width={Math.floor(width / 2)}>
          <BigNumber
            value={report.assets.total}
            label="Total Assets"
            color={theme.semantic.success}
          />
        </Box>
        <Box width={Math.floor(width / 2)}>
          <Gauge
            value={cashPercent}
            max={100}
            label="Cash %"
            size="sm"
            thresholds={{ warn: 30, danger: 15 }}
          />
        </Box>
      </Box>

      {/* Divider */}
      <Text color={theme.semantic.border}>{"─".repeat(width)}</Text>

      {/* Assets Section */}
      <Box marginTop={1} flexDirection="column">
        <Text bold color={theme.semantic.warning}>Assets</Text>
        <Box justifyContent="space-between" paddingLeft={1}>
          <Text color={theme.semantic.textSecondary}>Cash</Text>
          <Text color={theme.semantic.success}>${report.assets.cash.toLocaleString()}</Text>
        </Box>
        <Box justifyContent="space-between" paddingLeft={1}>
          <Text color={theme.semantic.textSecondary}>Accounts Receivable</Text>
          <Text color={theme.semantic.income}>${report.assets.receivables.toLocaleString()}</Text>
        </Box>
        <Box justifyContent="space-between" paddingLeft={1} marginTop={1}>
          <Text bold color={theme.semantic.textPrimary}>Total</Text>
          <Text bold color={theme.semantic.success}>${report.assets.total.toLocaleString()}</Text>
        </Box>
      </Box>

      {/* Divider */}
      <Box marginY={1}>
        <Text color={theme.semantic.border}>{"─".repeat(width)}</Text>
      </Box>

      {/* Equity Section */}
      <Box flexDirection="column">
        <Text bold color={theme.semantic.warning}>Equity</Text>
        <Box justifyContent="space-between" paddingLeft={1}>
          <Text color={theme.semantic.textSecondary}>Retained Earnings</Text>
          <Text color={theme.semantic.textPrimary}>${report.equity.retained_earnings.toLocaleString()}</Text>
        </Box>
      </Box>
    </Box>
  );
}

function ProfitLossReport({ width }: { width: number }) {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const today = now.toISOString().split("T")[0];
  const report = getProfitLoss(monthStart, today);
  const theme = getEnhancedTheme();

  // Calculate margin percentage
  const margin = report.revenue.total > 0
    ? Math.round((report.net_income / report.revenue.total) * 100)
    : 0;

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Text bold color={theme.semantic.info}>◨ Profit & Loss</Text>
        <Text color={theme.semantic.textMuted}>{report.from_date} → {report.to_date}</Text>
      </Box>

      {/* Key Metrics Row with BigNumbers */}
      <Box marginBottom={1}>
        <Box width={Math.floor(width / 3)}>
          <BigNumber value={report.revenue.total} label="Revenue" color={theme.semantic.success} />
        </Box>
        <Box width={Math.floor(width / 3)}>
          <BigNumber value={report.expenses.total} label="Expenses" color={theme.semantic.expense} />
        </Box>
        <Box width={Math.floor(width / 3)}>
          <BigNumber
            value={report.net_income}
            label="Net Income"
            color={report.net_income >= 0 ? theme.semantic.success : theme.semantic.error}
          />
        </Box>
      </Box>

      {/* Margin Gauge */}
      <Box marginBottom={1}>
        <Gauge
          value={Math.abs(margin)}
          max={100}
          label={`Margin: ${margin}%`}
          size="sm"
          thresholds={{ warn: 20, danger: 10 }}
        />
      </Box>

      {/* Divider */}
      <Text color={theme.semantic.border}>{"─".repeat(width)}</Text>

      {/* Revenue Section */}
      <Box marginTop={1} flexDirection="column">
        <Text bold color={theme.semantic.income}>Revenue</Text>
        {report.revenue.items.map((item, i) => (
          <Box key={i} justifyContent="space-between" paddingLeft={1}>
            <Text color={theme.semantic.textSecondary}>{item.name}</Text>
            <Text color={theme.semantic.success}>+${item.amount.toLocaleString()}</Text>
          </Box>
        ))}
      </Box>

      {/* Divider */}
      <Box marginY={1}>
        <Text color={theme.semantic.border}>{"─".repeat(width)}</Text>
      </Box>

      {/* Expenses Section */}
      <Box flexDirection="column">
        <Text bold color={theme.semantic.expense}>Expenses</Text>
        {report.expenses.items.slice(0, 5).map((item, i) => (
          <Box key={i} justifyContent="space-between" paddingLeft={1}>
            <Text color={theme.semantic.textSecondary}>{item.name}</Text>
            <Text color={theme.semantic.expense}>-${item.amount.toLocaleString()}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function ARReport({ width }: { width: number }) {
  const report = getReceivablesAging();
  const theme = getEnhancedTheme();
  const total = report.totals.total || 1;

  // Calculate overdue percentage for gauge
  const overdueAmount = report.totals.days_61_90 + report.totals.days_90_plus;
  const overduePercent = total > 0 ? Math.round((overdueAmount / total) * 100) : 0;

  // Prepare data for horizontal bar chart
  const agingData = [
    { label: "Current", value: report.totals.current, color: theme.semantic.success },
    { label: "1-30 Days", value: report.totals.days_1_30, color: theme.semantic.warning },
    { label: "31-60 Days", value: report.totals.days_31_60, color: theme.semantic.warning },
    { label: "61-90 Days", value: report.totals.days_61_90, color: theme.semantic.error },
    { label: "90+ Days", value: report.totals.days_90_plus, color: theme.semantic.error },
  ].filter((d) => d.value > 0);

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Text bold color={theme.semantic.info}>◩ AR Aging</Text>
        <Text color={theme.semantic.textMuted}>Outstanding invoices</Text>
      </Box>

      {/* Key Metrics */}
      <Box marginBottom={1}>
        <Box width={Math.floor(width / 2)}>
          <BigNumber value={total} label="Total Outstanding" color={theme.semantic.warning} />
        </Box>
        <Box width={Math.floor(width / 2)}>
          <Gauge
            value={overduePercent}
            max={100}
            label="Overdue %"
            size="sm"
            thresholds={{ warn: 20, danger: 40 }}
          />
        </Box>
      </Box>

      {/* Divider */}
      <Text color={theme.semantic.border}>{"─".repeat(width)}</Text>

      {/* Aging Breakdown Chart */}
      <Box marginTop={1} flexDirection="column">
        <Text bold color={theme.semantic.warning}>Aging Breakdown</Text>
        <Box marginTop={1}>
          <HorizontalBarChart items={agingData} width={width - 2} labelWidth={10} />
        </Box>
      </Box>

      {/* Alert for 90+ days */}
      {report.totals.days_90_plus > 0 && (
        <Box marginTop={1}>
          <Text color={theme.semantic.error}>
            {indicators.warning} ${report.totals.days_90_plus.toLocaleString()} severely overdue (90+ days)
          </Text>
        </Box>
      )}
    </Box>
  );
}

function CashFlowReport({ width }: { width: number }) {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const today = now.toISOString().split("T")[0];
  const report = getCashFlow(monthStart, today);
  const theme = getEnhancedTheme();

  // Calculate flow ratio for gauge (inflows vs outflows)
  const totalInflows = report.inflows.total || 0;
  const totalOutflows = Math.abs(report.outflows.total || 0);
  const flowRatio = totalInflows + totalOutflows > 0
    ? Math.round((totalInflows / (totalInflows + totalOutflows)) * 100)
    : 50;

  // Prepare data for flow visualization
  const flowData = [
    { label: "Inflows", value: totalInflows, color: theme.semantic.success },
    { label: "Outflows", value: totalOutflows, color: theme.semantic.expense },
  ];

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Text bold color={theme.semantic.info}>◪ Cash Flow</Text>
        <Text color={theme.semantic.textMuted}>{report.from_date} → {report.to_date}</Text>
      </Box>

      {/* Key Metrics Row */}
      <Box marginBottom={1}>
        <Box width={Math.floor(width / 3)}>
          <BigNumber value={report.opening_balance} label="Opening" color={theme.semantic.textSecondary} />
        </Box>
        <Box width={Math.floor(width / 3)}>
          <BigNumber
            value={report.net_change}
            label="Net Change"
            color={report.net_change >= 0 ? theme.semantic.success : theme.semantic.error}
            prefix={report.net_change >= 0 ? "+" : ""}
          />
        </Box>
        <Box width={Math.floor(width / 3)}>
          <BigNumber value={report.closing_balance} label="Closing" color={theme.semantic.success} />
        </Box>
      </Box>

      {/* Flow Ratio Gauge */}
      <Box marginBottom={1}>
        <Gauge
          value={flowRatio}
          max={100}
          label={`Inflow Ratio: ${flowRatio}%`}
          size="sm"
          thresholds={{ warn: 40, danger: 30 }}
        />
      </Box>

      {/* Divider */}
      <Text color={theme.semantic.border}>{"─".repeat(width)}</Text>

      {/* Flow Comparison Chart */}
      <Box marginTop={1} flexDirection="column">
        <Text bold color={theme.semantic.warning}>Cash Flow Breakdown</Text>
        <Box marginTop={1}>
          <HorizontalBarChart items={flowData} width={width - 2} labelWidth={10} />
        </Box>
      </Box>

      {/* Divider */}
      <Box marginY={1}>
        <Text color={theme.semantic.border}>{"─".repeat(width)}</Text>
      </Box>

      {/* Inflows Section */}
      <Box flexDirection="column">
        <Text bold color={theme.semantic.income}>{indicators.income} Inflows</Text>
        {report.inflows.items.slice(0, 3).map((item, i) => (
          <Box key={i} justifyContent="space-between" paddingLeft={1}>
            <Text color={theme.semantic.textSecondary}>{item.description.slice(0, 25)}</Text>
            <Text color={theme.semantic.success}>+${item.amount.toLocaleString()}</Text>
          </Box>
        ))}
      </Box>

      {/* Outflows Section */}
      <Box marginTop={1} flexDirection="column">
        <Text bold color={theme.semantic.expense}>{indicators.expense} Outflows</Text>
        {report.outflows.items.slice(0, 3).map((item, i) => (
          <Box key={i} justifyContent="space-between" paddingLeft={1}>
            <Text color={theme.semantic.textSecondary}>{item.description.slice(0, 25)}</Text>
            <Text color={theme.semantic.expense}>-${item.amount.toLocaleString()}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function ExpensesReport({ width }: { width: number }) {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const today = now.toISOString().split("T")[0];
  const expenses = getExpensesByCategory(monthStart, today);
  const theme = getEnhancedTheme();
  const total = expenses.reduce((s, e) => s + e.amount, 0) || 0;

  // Get top category for highlight
  const topCategory = expenses.length > 0 ? expenses[0] : null;
  const topPercent = topCategory ? topCategory.percentage : 0;

  // Color scale for categories (gradient from warning to error based on amount)
  const categoryColors = [
    theme.semantic.expense,
    theme.semantic.warning,
    theme.semantic.info,
    theme.semantic.success,
    theme.semantic.textSecondary,
  ];

  // Prepare data for horizontal bar chart
  const chartData = expenses.slice(0, 6).map((exp, i) => ({
    label: exp.category.slice(0, 12),
    value: exp.amount,
    color: categoryColors[i % categoryColors.length],
  }));

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Text bold color={theme.semantic.info}>◫ Expenses</Text>
        <Text color={theme.semantic.textMuted}>{monthStart} → {today}</Text>
      </Box>

      {/* Key Metrics */}
      <Box marginBottom={1}>
        <Box width={Math.floor(width / 2)}>
          <BigNumber value={total} label="Total Expenses" color={theme.semantic.expense} />
        </Box>
        <Box width={Math.floor(width / 2)}>
          <Gauge
            value={topPercent}
            max={100}
            label={topCategory ? `Top: ${topCategory.category}` : "No data"}
            size="sm"
            thresholds={{ warn: 40, danger: 60 }}
          />
        </Box>
      </Box>

      {/* Divider */}
      <Text color={theme.semantic.border}>{"─".repeat(width)}</Text>

      {/* Category Breakdown */}
      {expenses.length === 0 ? (
        <Box marginTop={1}>
          <Text color={theme.semantic.textMuted}>{indicators.info} No expenses this period</Text>
        </Box>
      ) : (
        <>
          <Box marginTop={1} flexDirection="column">
            <Text bold color={theme.semantic.warning}>Category Breakdown</Text>
            <Box marginTop={1}>
              <HorizontalBarChart items={chartData} width={width - 2} labelWidth={12} />
            </Box>
          </Box>

          {/* Divider */}
          <Box marginY={1}>
            <Text color={theme.semantic.border}>{"─".repeat(width)}</Text>
          </Box>

          {/* Category Details */}
          <Box flexDirection="column">
            <Text bold color={theme.semantic.textSecondary}>Details</Text>
            {expenses.slice(0, 5).map((exp, i) => (
              <Box key={i} justifyContent="space-between" paddingLeft={1}>
                <Text color={theme.semantic.textSecondary}>{exp.category}</Text>
                <Box>
                  <Text color={theme.semantic.expense}>{formatCurrency(exp.amount, { decimals: 0 })}</Text>
                  <Text color={theme.semantic.textMuted}> ({exp.percentage}%)</Text>
                </Box>
              </Box>
            ))}
          </Box>
        </>
      )}
    </Box>
  );
}

/**
 * SST Return Report - Malaysian Sales and Service Tax
 */
function SSTReport({ width }: { width: number }) {
  const now = new Date();
  // Default to current 2-month taxable period
  const periodStart = `${now.getFullYear()}-${String(now.getMonth()).padStart(2, "0")}-01`;
  const periodEnd = now.toISOString().split("T")[0];
  const report = getSSTReturn(periodStart, periodEnd);
  const theme = getEnhancedTheme();

  // Calculate total tax ratio
  const salesTaxPercent = report.summary.total_tax_payable > 0
    ? Math.round((report.sales_tax.total_sales_tax / report.summary.total_tax_payable) * 100)
    : 0;

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Text bold color={theme.semantic.info}>◬ SST Return (SST-02)</Text>
        <Text color={theme.semantic.textMuted}>{formatDate(report.period_start)} → {formatDate(report.period_end)}</Text>
      </Box>

      {/* Business Info */}
      {report.business_info.sst_registration && (
        <Box marginBottom={1}>
          <Text color={theme.semantic.textMuted}>SST Reg: </Text>
          <Text color={theme.semantic.textPrimary}>{report.business_info.sst_registration}</Text>
        </Box>
      )}

      {/* Key Metrics Row */}
      <Box marginBottom={1}>
        <Box width={Math.floor(width / 3)}>
          <BigNumber
            value={report.summary.net_tax_payable}
            label="Tax Payable"
            color={report.summary.net_tax_payable > 0 ? theme.semantic.error : theme.semantic.success}
          />
        </Box>
        <Box width={Math.floor(width / 3)}>
          <BigNumber
            value={report.sales_tax.total_sales}
            label="Total Sales"
            color={theme.semantic.income}
          />
        </Box>
        <Box width={Math.floor(width / 3)}>
          <BigNumber
            value={report.service_tax.total_services}
            label="Total Services"
            color={theme.semantic.info}
          />
        </Box>
      </Box>

      {/* Nil Return Alert */}
      {report.is_nil_return && (
        <Box marginBottom={1}>
          <Text color={theme.semantic.warning}>{indicators.info} NIL Return - No taxable transactions</Text>
        </Box>
      )}

      {/* Divider */}
      <Text color={theme.semantic.border}>{"─".repeat(width)}</Text>

      {/* Part A: Sales Tax */}
      <Box marginTop={1} flexDirection="column">
        <Text bold color={theme.semantic.warning}>Part A: Sales Tax</Text>
        <Box justifyContent="space-between" paddingLeft={1}>
          <Text color={theme.semantic.textSecondary}>Taxable @ 5%</Text>
          <Text color={theme.semantic.textPrimary}>{formatCurrency(report.sales_tax.taxable_sales_5)}</Text>
        </Box>
        <Box justifyContent="space-between" paddingLeft={1}>
          <Text color={theme.semantic.textSecondary}>Tax Output @ 5%</Text>
          <Text color={theme.semantic.expense}>{formatCurrency(report.sales_tax.tax_output_5)}</Text>
        </Box>
        <Box justifyContent="space-between" paddingLeft={1}>
          <Text color={theme.semantic.textSecondary}>Taxable @ 10%</Text>
          <Text color={theme.semantic.textPrimary}>{formatCurrency(report.sales_tax.taxable_sales_10)}</Text>
        </Box>
        <Box justifyContent="space-between" paddingLeft={1}>
          <Text color={theme.semantic.textSecondary}>Tax Output @ 10%</Text>
          <Text color={theme.semantic.expense}>{formatCurrency(report.sales_tax.tax_output_10)}</Text>
        </Box>
        <Box justifyContent="space-between" paddingLeft={1}>
          <Text color={theme.semantic.textSecondary}>Exempt Sales</Text>
          <Text color={theme.semantic.textMuted}>{formatCurrency(report.sales_tax.exempt_sales)}</Text>
        </Box>
        <Box justifyContent="space-between" paddingLeft={1} marginTop={1}>
          <Text bold color={theme.semantic.textPrimary}>Total Sales Tax</Text>
          <Text bold color={theme.semantic.expense}>{formatCurrency(report.sales_tax.total_sales_tax)}</Text>
        </Box>
      </Box>

      {/* Divider */}
      <Box marginY={1}>
        <Text color={theme.semantic.border}>{"─".repeat(width)}</Text>
      </Box>

      {/* Part B: Service Tax */}
      <Box flexDirection="column">
        <Text bold color={theme.semantic.warning}>Part B: Service Tax (6%)</Text>
        <Box justifyContent="space-between" paddingLeft={1}>
          <Text color={theme.semantic.textSecondary}>Taxable Services</Text>
          <Text color={theme.semantic.textPrimary}>{formatCurrency(report.service_tax.taxable_services)}</Text>
        </Box>
        <Box justifyContent="space-between" paddingLeft={1}>
          <Text color={theme.semantic.textSecondary}>Tax Output @ 6%</Text>
          <Text color={theme.semantic.expense}>{formatCurrency(report.service_tax.tax_output)}</Text>
        </Box>
        <Box justifyContent="space-between" paddingLeft={1}>
          <Text color={theme.semantic.textSecondary}>Exempt Services</Text>
          <Text color={theme.semantic.textMuted}>{formatCurrency(report.service_tax.exempt_services)}</Text>
        </Box>
      </Box>

      {/* Divider */}
      <Box marginY={1}>
        <Text color={theme.semantic.border}>{"─".repeat(width)}</Text>
      </Box>

      {/* Summary */}
      <Box flexDirection="column">
        <Text bold color={theme.semantic.error}>Summary</Text>
        <Box justifyContent="space-between" paddingLeft={1}>
          <Text color={theme.semantic.textSecondary}>Total Tax Payable</Text>
          <Text bold color={theme.semantic.expense}>{formatCurrency(report.summary.total_tax_payable)}</Text>
        </Box>
        <Box justifyContent="space-between" paddingLeft={1}>
          <Text color={theme.semantic.textSecondary}>Less: Credit B/F</Text>
          <Text color={theme.semantic.success}>{formatCurrency(report.summary.less_credit_brought_forward)}</Text>
        </Box>
        <Box justifyContent="space-between" paddingLeft={1} marginTop={1}>
          <Text bold color={theme.semantic.textPrimary}>Net Tax Payable</Text>
          <Text bold color={report.summary.net_tax_payable > 0 ? theme.semantic.error : theme.semantic.success}>
            {formatCurrency(report.summary.net_tax_payable)}
          </Text>
        </Box>
      </Box>

      {/* Filing Info */}
      <Box marginTop={1}>
        <Text color={theme.semantic.info}>
          {indicators.info} Due: {formatDate(report.filing_due_date)} • {report.transactions.length} transactions
        </Text>
      </Box>
    </Box>
  );
}
