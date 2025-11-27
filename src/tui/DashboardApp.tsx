/**
 * DashboardApp - Main Application Shell
 *
 * A visually rich, btop/lazygit-inspired dashboard with
 * sparklines, charts, and polished data visualization.
 */

import React, { useState, useEffect, useMemo } from "react";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import { getSetting, setSetting } from "../db/index.js";
import {
  getBalanceSheet,
  getProfitLoss,
  getReceivablesAging,
  type BalanceSheetReport,
  type ProfitLossReport,
  type ReceivablesAgingReport,
} from "../domain/reports.js";
import { listInvoices, type Invoice } from "../domain/invoices.js";
import { listExpenses, type ExpenseWithDetails } from "../domain/expenses.js";
import {
  formatCurrency,
  formatDate,
  getLocaleConfig,
} from "../core/localization.js";

// Views
import { ChatView } from "./components/ChatView.js";
import { InvoiceList } from "./components/InvoiceList.js";
import { ReportView } from "./components/ReportView.js";
import { ContactsView } from "./components/ContactsView.js";
import { ExpensesView } from "./components/ExpensesView.js";
import { DocumentsView } from "./components/DocumentsView.js";
import { SettingsView } from "./components/SettingsView.js";
import { AccountingMenu } from "./components/AccountingMenu.js";
import { LHDNSettingsView } from "./components/LHDNSettingsView.js";
import { SpreadsheetView } from "../spreadsheet/components/SpreadsheetView.js";

// Design system
import { getEnhancedTheme } from "./design/theme.js";
import { indicators, borderStyles } from "./design/tokens.js";
import {
  KeyboardHelp,
  dashboardShortcuts,
  Sparkline,
  HorizontalBarChart,
  TrendIndicator,
  HealthIndicator,
  BigNumber,
  Gauge,
} from "./components/ui/index.js";
import { FocusProvider } from "./context/FocusContext.js";
import { useDelayedRender, useSpinner, SPINNERS } from "./animations.js";

type View =
  | "dashboard"
  | "chat"
  | "invoices"
  | "expenses"
  | "reports"
  | "contacts"
  | "vault"
  | "accounting"
  | "help"
  | "settings"
  | "lhdn"
  | "spreadsheet";

const VIEW_LABELS: Record<View, string> = {
  dashboard: "Dashboard",
  chat: "AI Chat",
  invoices: "Invoices",
  expenses: "Expenses",
  reports: "Reports",
  contacts: "Contacts",
  vault: "Vault",
  accounting: "Accounting",
  help: "Help",
  settings: "Settings",
  lhdn: "LHDN e-Invoice",
  spreadsheet: "Spreadsheet",
};

interface DashboardData {
  balance: ReturnType<typeof getBalanceSheet>;
  pl: ReturnType<typeof getProfitLoss>;
  lastPl: ReturnType<typeof getProfitLoss>;
  ar: ReturnType<typeof getReceivablesAging>;
  revenueHistory: number[];
  expenseHistory: number[];
  invoices: Invoice[];
  expenses: ExpenseWithDetails[];
}

export function DashboardApp() {
  const [currentView, setCurrentView] = useState<View>("dashboard");
  const [showHelp, setShowHelp] = useState(false);
  const { exit } = useApp();
  const { stdout } = useStdout();
  const theme = getEnhancedTheme();

  // Terminal dimensions
  const [dimensions, setDimensions] = useState({
    width: stdout?.columns || 80,
    height: stdout?.rows || 24,
  });

  // Dashboard data
  const [data, setData] = useState<DashboardData | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [loading, setLoading] = useState(true);

  // Theme toggle
  const [, setThemeKey] = useState(0);
  const toggleTheme = () => {
    const current = getSetting("theme") || "dark";
    setSetting("theme", current === "dark" ? "light" : "dark");
    setThemeKey((k) => k + 1);
  };

  // Handle terminal resize
  useEffect(() => {
    const handleResize = () => {
      if (stdout) {
        setDimensions({ width: stdout.columns, height: stdout.rows });
      }
    };
    stdout?.on("resize", handleResize);
    return () => { stdout?.off("resize", handleResize); };
  }, [stdout]);

  // Load dashboard data
  const loadData = () => {
    setLoading(true);
    try {
      const balance = getBalanceSheet();
      const now = new Date();
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const today = now.toISOString().split("T")[0];
      const pl = getProfitLoss(monthStart, today);
      const ar = getReceivablesAging();

      // Last month for trends
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      const lastMonthStart = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}-01`;
      const lastMonthEndStr = lastMonthEnd.toISOString().split("T")[0];
      const lastPl = getProfitLoss(lastMonthStart, lastMonthEndStr);

      // Historical data for sparklines (mock last 12 data points)
      const revenueHistory = generateHistoricalData(pl.revenue.total, 12);
      const expenseHistory = generateHistoricalData(pl.expenses.total, 12);

      const invoices = listInvoices({});
      const expenses = listExpenses({ limit: 100 });

      setData({ balance, pl, lastPl, ar, revenueHistory, expenseHistory, invoices, expenses });
      setLastRefresh(new Date());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Keyboard input
  useInput((input, key) => {
    if (showHelp) { setShowHelp(false); return; }
    if (input === "c" && key.ctrl) { exit(); return; }

    // Views that handle their own input - we just pass through
    const inputHandlingViews: View[] = ["chat", "contacts", "invoices", "expenses", "vault", "settings", "lhdn", "spreadsheet"];
    if (inputHandlingViews.includes(currentView)) {
      // Spreadsheet handles its own Escape with confirmation dialog
      // Don't intercept Escape for spreadsheet - let it handle exit confirmation
      if (currentView === "spreadsheet") {
        return; // Let SpreadsheetView handle ALL input including Escape
      }
      // Other views: Escape returns to dashboard immediately
      if (key.escape) setCurrentView("dashboard");
      return;
    }

    if (input === "q") { exit(); return; }
    if (key.escape) { setCurrentView("dashboard"); return; }

    const viewMap: Record<string, View> = {
      d: "dashboard", c: "chat", i: "invoices", e: "expenses",
      r: "reports", p: "contacts", v: "vault", a: "accounting",
      s: "settings", l: "lhdn", x: "spreadsheet",
    };

    if (viewMap[input]) {
      if (input === "d") loadData();
      setCurrentView(viewMap[input]);
      return;
    }

    if (input === "R") loadData();
    if (input === "?") setShowHelp(true);
    if (input === "t") toggleTheme();
    if (input === "n" && currentView === "dashboard") setCurrentView("invoices");
  });

  // Business info
  const businessName = getSetting("business_name") || "OpenAccounting";
  const entityType = getSetting("entity_type") || "";
  const displayName = entityType ? `${businessName} ${entityType}` : businessName;

  const contentHeight = dimensions.height - 4;

  return (
    <FocusProvider initialFocus="main">
      <Box width="100%" height="100%" flexDirection="column">
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* Header Bar */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <Box
          width="100%"
          height={1}
          backgroundColor={theme.semantic.surfaceSubtle}
          justifyContent="space-between"
          paddingX={1}
        >
          <Box>
            <Text bold color={theme.semantic.accent}> ◆ </Text>
            <Text bold color={theme.semantic.textPrimary}>{displayName}</Text>
            <Text color={theme.semantic.border}> │ </Text>
            <Text inverse color={theme.semantic.primary}> {VIEW_LABELS[currentView]} </Text>
          </Box>
          <Box>
            <Text color={theme.semantic.textMuted}>
              {formatDate(new Date(), "long").split(",").slice(0, 2).join(",")}
            </Text>
            <Text color={theme.semantic.border}> │ </Text>
            <Text color={theme.semantic.textMuted}>
              {lastRefresh.toLocaleTimeString(getLocaleConfig().locale, { hour: "2-digit", minute: "2-digit" })}
            </Text>
          </Box>
        </Box>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* Main Content */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <Box width="100%" height={contentHeight} flexDirection="column">
          {currentView === "chat" && <ChatView width={dimensions.width} height={contentHeight} />}
          {currentView === "invoices" && <InvoiceList width={dimensions.width} height={contentHeight} />}
          {currentView === "expenses" && <ExpensesView width={dimensions.width} height={contentHeight} />}
          {currentView === "reports" && <ReportView width={dimensions.width} height={contentHeight} />}
          {currentView === "contacts" && <ContactsView width={dimensions.width} height={contentHeight} />}
          {currentView === "vault" && <DocumentsView width={dimensions.width} height={contentHeight} />}
          {currentView === "accounting" && <AccountingMenu width={dimensions.width} height={contentHeight} onExit={() => setCurrentView("dashboard")} />}
          {currentView === "settings" && <SettingsView width={dimensions.width} height={contentHeight} />}
          {currentView === "lhdn" && <LHDNSettingsView width={dimensions.width} height={contentHeight} />}
          {currentView === "spreadsheet" && (
            <SpreadsheetView
              onExit={() => setCurrentView("dashboard")}
              isActive={currentView === "spreadsheet"}
              title="Financial Spreadsheet"
            />
          )}
          {currentView === "dashboard" && (
            <NewDashboard
              data={data}
              loading={loading}
              width={dimensions.width}
              height={contentHeight}
            />
          )}
        </Box>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* Footer Bar - Minimalist with contextual actions */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <Box
          width="100%"
          flexDirection="column"
        >
          {/* Contextual Quick Actions */}
          <QuickActionsBar currentView={currentView} />

          {/* Navigation - Minimalist single line with separators */}
          <Box justifyContent="center" paddingY={0}>
            <NavItem k="d" label="Home" active={currentView === "dashboard"} />
            <NavItem k="i" label="Invoices" active={currentView === "invoices"} />
            <NavItem k="e" label="Expenses" active={currentView === "expenses"} />
            <NavItem k="r" label="Reports" active={currentView === "reports"} />
            <NavItem k="p" label="People" active={currentView === "contacts"} />
            <NavItem k="v" label="Vault" active={currentView === "vault"} />
            <NavItem k="c" label="Chat" active={currentView === "chat"} />
            <NavItem k="x" label="Sheet" active={currentView === "spreadsheet"} />
            <NavItem k="?" label="?" isLast />
          </Box>
        </Box>

        {/* Help Overlay */}
        {showHelp && (
          <Box
            position="absolute"
            marginLeft={Math.floor((dimensions.width - 55) / 2)}
            marginTop={Math.floor((dimensions.height - 20) / 2)}
          >
            <KeyboardHelp
              visible={showHelp}
              onDismiss={() => setShowHelp(false)}
              shortcuts={dashboardShortcuts}
              title="Keyboard Shortcuts"
              width={55}
            />
          </Box>
        )}
      </Box>
    </FocusProvider>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Navigation Item - Minimalist design with vertical separators
// ═══════════════════════════════════════════════════════════════════════════════

function NavItem({ k, label, active, isLast }: { k: string; label: string; active?: boolean; isLast?: boolean }) {
  const theme = getEnhancedTheme();
  const indicator = active ? "◆ " : "";
  const color = active ? theme.semantic.primary : theme.semantic.textMuted;

  return (
    <Box alignItems="center">
      <Box flexDirection="column" alignItems="center" marginX={1}>
        <Text color={color}>
          {indicator}{label}
        </Text>
        <Text color={theme.semantic.textDisabled} dimColor>{k}</Text>
      </Box>
      {!isLast && <Text color={theme.semantic.border}>│</Text>}
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Contextual Quick Actions Bar
// ═══════════════════════════════════════════════════════════════════════════════

function getContextualActions(view: View): Array<{ key: string; label: string; icon: string }> {
  const actions: Partial<Record<View, Array<{ key: string; label: string; icon: string }>>> = {
    dashboard: [
      { key: "n", label: "Invoice", icon: "+" },
      { key: "e", label: "Expense", icon: "+" },
      { key: "c", label: "AI", icon: "◇" },
      { key: "R", label: "Refresh", icon: "↻" },
    ],
    invoices: [
      { key: "n", label: "New Invoice", icon: "+" },
      { key: "Enter", label: "View", icon: "→" },
      { key: "R", label: "Refresh", icon: "↻" },
    ],
    expenses: [
      { key: "n", label: "Add Expense", icon: "+" },
      { key: "c", label: "Categorize", icon: "◈" },
      { key: "R", label: "Refresh", icon: "↻" },
    ],
    reports: [
      { key: "b", label: "Balance Sheet", icon: "◊" },
      { key: "p", label: "P&L", icon: "◊" },
      { key: "f", label: "Cash Flow", icon: "◊" },
    ],
    contacts: [
      { key: "n", label: "New Contact", icon: "+" },
      { key: "Enter", label: "View", icon: "→" },
    ],
    chat: [
      { key: "Enter", label: "Send", icon: "→" },
      { key: "Esc", label: "Back", icon: "←" },
    ],
    vault: [
      { key: "u", label: "Upload", icon: "↑" },
      { key: "Enter", label: "Open", icon: "→" },
    ],
    spreadsheet: [
      { key: "↑↓←→", label: "Navigate", icon: "◈" },
      { key: "Enter", label: "Edit", icon: "→" },
      { key: "Tab", label: "Next Cell", icon: "→" },
      { key: "Esc", label: "Back", icon: "←" },
    ],
  };
  return actions[view] || actions.dashboard || [];
}

function QuickActionsBar({ currentView }: { currentView: View }) {
  const theme = getEnhancedTheme();
  const actions = getContextualActions(currentView);

  return (
    <Box justifyContent="center" width="100%">
      <Text color={theme.semantic.border}>────────</Text>
      {actions.map((action, i) => (
        <React.Fragment key={action.key}>
          <Text color={theme.semantic.textMuted}> {action.icon} </Text>
          <Text color={theme.semantic.textPrimary}>{action.label}</Text>
          <Text color={theme.semantic.textDisabled} dimColor> ({action.key})</Text>
          {i < actions.length - 1 && (
            <Text color={theme.semantic.textMuted}>  •  </Text>
          )}
        </React.Fragment>
      ))}
      <Text color={theme.semantic.border}> ────────</Text>
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEW DASHBOARD - Visual Data Dashboard
// ═══════════════════════════════════════════════════════════════════════════════

interface NewDashboardProps {
  data: DashboardData | null;
  loading: boolean;
  width: number;
  height: number;
}

function NewDashboard({ data, loading, width, height }: NewDashboardProps) {
  const theme = getEnhancedTheme();
  const spinner = useSpinner("pulse", 120);

  // Staggered render for smooth appearance
  const showRow1 = useDelayedRender(0);
  const showRow2 = useDelayedRender(50);
  const showRow3 = useDelayedRender(100);

  if (loading || !data) {
    return (
      <Box width="100%" height="100%" alignItems="center" justifyContent="center" flexDirection="column">
        <Text color={theme.semantic.primary}>{spinner}</Text>
        <Text color={theme.semantic.textMuted}> Loading dashboard...</Text>
      </Box>
    );
  }

  const { balance, pl, lastPl, ar, revenueHistory, expenseHistory, invoices, expenses } = data;

  // Calculate metrics
  const totalOutstanding = ar.totals.current + ar.totals.days_1_30 + ar.totals.days_31_60 + ar.totals.days_61_90 + ar.totals.days_90_plus;
  const overdueAmount = ar.totals.days_31_60 + ar.totals.days_61_90 + ar.totals.days_90_plus;
  const overdueCount = ar.days_31_60.length + ar.days_61_90.length + ar.days_90_plus.length;

  // Financial health score (simple calculation)
  const healthScore = calculateHealthScore(balance, pl, ar);

  // Expense breakdown for chart
  const expensesByCategory = getExpensesByCategory(expenses);

  // Layout calculations - ensure clean thirds with proper spacing
  const usableWidth = width - 4; // Account for outer padding
  const col1Width = Math.floor(usableWidth / 3);
  const col2Width = Math.floor(usableWidth / 3);
  const col3Width = usableWidth - col1Width - col2Width;
  const sparklineWidth = col2Width - 6; // Account for border (2) + padding (2*2)

  return (
    <Box width="100%" height={height} paddingX={1} paddingY={1} flexDirection="column">
      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* Row 1: Big Numbers (staggered fade-in) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {showRow1 && <Box width="100%" height={5} marginBottom={1}>
        {/* Cash */}
        <Box
          width={col1Width}
          height={5}
          borderStyle={borderStyles.panel}
          borderColor={theme.semantic.border}
          flexDirection="column"
          paddingX={1}
        >
          <Text color={theme.semantic.textMuted}>Cash Balance</Text>
          <Text bold color={theme.semantic.success}>
            {formatCurrency(balance.assets.cash, { decimals: 0 })}
          </Text>
          <Text color={theme.semantic.textMuted}>
            AR: {formatCurrency(balance.assets.receivables, { decimals: 0 })}
          </Text>
        </Box>

        {/* Revenue */}
        <Box
          width={col2Width}
          height={5}
          borderStyle={borderStyles.panel}
          borderColor={theme.semantic.border}
          flexDirection="column"
          paddingX={1}
          marginLeft={1}
        >
          <Box justifyContent="space-between">
            <Text color={theme.semantic.textMuted}>Revenue (MTD)</Text>
            <TrendIndicator current={pl.revenue.total} previous={lastPl.revenue.total} />
          </Box>
          <Text bold color={theme.semantic.income}>
            {formatCurrency(pl.revenue.total, { decimals: 0 })}
          </Text>
          <Sparkline data={revenueHistory} width={sparklineWidth} color={theme.semantic.income} />
        </Box>

        {/* Expenses */}
        <Box
          width={col3Width}
          height={5}
          borderStyle={borderStyles.panel}
          borderColor={theme.semantic.border}
          flexDirection="column"
          paddingX={1}
          marginLeft={1}
        >
          <Box justifyContent="space-between">
            <Text color={theme.semantic.textMuted}>Expenses (MTD)</Text>
            <TrendIndicator current={pl.expenses.total} previous={lastPl.expenses.total} invertColors />
          </Box>
          <Text bold color={theme.semantic.expense}>
            {formatCurrency(pl.expenses.total, { decimals: 0 })}
          </Text>
          <Sparkline data={expenseHistory} width={sparklineWidth} color={theme.semantic.expense} />
        </Box>
      </Box>}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* Row 2: Charts & Details (staggered fade-in) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {showRow2 && <Box width="100%" flexGrow={1}>
        {/* Column 1: Health & P/L */}
        <Box
          width={col1Width}
          borderStyle={borderStyles.panel}
          borderColor={theme.semantic.border}
          flexDirection="column"
          paddingX={1}
        >
          <Text bold color={theme.semantic.primary}>Financial Health</Text>
          <Box height={1} />
          <HealthIndicator score={healthScore} />
          <Box height={1} />

          <Text color={theme.semantic.textMuted}>Profit/Loss</Text>
          <Box justifyContent="space-between">
            <Text>Net Income</Text>
            <Text bold color={pl.net_income >= 0 ? theme.semantic.income : theme.semantic.expense}>
              {formatCurrency(pl.net_income, { decimals: 0 })}
            </Text>
          </Box>
          <Box height={1} />

          <Gauge
            value={pl.revenue.total > 0 ? (pl.net_income / pl.revenue.total) * 100 : 0}
            max={100}
            label="Margin"
            size="sm"
            thresholds={{ warn: 10, danger: 5 }}
          />
        </Box>

        {/* Column 2: Outstanding & Alerts */}
        <Box
          width={col2Width}
          borderStyle={borderStyles.panel}
          borderColor={overdueCount > 0 ? theme.semantic.error : theme.semantic.border}
          flexDirection="column"
          paddingX={1}
          marginLeft={1}
        >
          <Text bold color={overdueCount > 0 ? theme.semantic.error : theme.semantic.warning}>
            {overdueCount > 0 ? "⚠ Attention Required" : "Receivables"}
          </Text>
          <Box height={1} />

          <Box justifyContent="space-between">
            <Text color={theme.semantic.textMuted}>Outstanding</Text>
            <Text color={theme.semantic.warning}>{formatCurrency(totalOutstanding, { decimals: 0 })}</Text>
          </Box>

          {overdueCount > 0 && (
            <>
              <Box justifyContent="space-between">
                <Text color={theme.semantic.error}>Overdue ({overdueCount})</Text>
                <Text color={theme.semantic.error}>{formatCurrency(overdueAmount, { decimals: 0 })}</Text>
              </Box>
              <Box height={1} />
              <Text color={theme.semantic.error}>
                {indicators.warning} {ar.days_90_plus.length > 0 && `${ar.days_90_plus.length} over 90 days`}
                {ar.days_61_90.length > 0 && ` • ${ar.days_61_90.length} 60-90d`}
                {ar.days_31_60.length > 0 && ` • ${ar.days_31_60.length} 30-60d`}
              </Text>
            </>
          )}

          {overdueCount === 0 && (
            <Text color={theme.semantic.success}>{indicators.check} All invoices current</Text>
          )}
        </Box>

        {/* Column 3: Expense Breakdown */}
        <Box
          width={col3Width}
          borderStyle={borderStyles.panel}
          borderColor={theme.semantic.border}
          flexDirection="column"
          paddingX={1}
          marginLeft={1}
        >
          <Text bold color={theme.semantic.warning}>Expense Breakdown</Text>
          <Box height={1} />
          {expensesByCategory.length > 0 ? (
            <>
              <HorizontalBarChart
                items={expensesByCategory.slice(0, 4)}
                width={col3Width - 6}
                labelWidth={10}
              />
              {/* Top Vendors */}
              <Box marginTop={1}>
                <Text color={theme.semantic.textMuted}>Top Vendors:</Text>
              </Box>
              {getExpensesByVendor(expenses).slice(0, 2).map((v, i) => (
                <Box key={i} justifyContent="space-between">
                  <Text color={theme.semantic.textSecondary}>{v.label.slice(0, 12)}</Text>
                  <Text color={theme.semantic.expense}>{formatCurrency(v.value, { decimals: 0 })} ({v.count})</Text>
                </Box>
              ))}
              {/* Recurring indicator */}
              {getRecurringExpenses(expenses).length > 0 && (
                <Box marginTop={1}>
                  <Text color={theme.semantic.warning}>↻ {getRecurringExpenses(expenses).length} recurring</Text>
                </Box>
              )}
            </>
          ) : (
            <Text color={theme.semantic.textMuted}>No expenses recorded</Text>
          )}
        </Box>
      </Box>}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* Row 3: Recent Activity (staggered fade-in) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {showRow3 && <Box
        width="100%"
        height={6}
        marginTop={1}
        borderStyle={borderStyles.panel}
        borderColor={theme.semantic.border}
        flexDirection="column"
        paddingX={1}
      >
        <Text bold color={theme.semantic.info}>Recent Activity</Text>
        <Box height={1} />
        <Box flexDirection="row">
          {/* Recent Invoices */}
          <Box width={Math.floor(usableWidth / 2) - 2} flexDirection="column">
            <Text color={theme.semantic.textMuted}>Latest Invoices</Text>
            {invoices.slice(0, 3).map((inv) => (
              <Box key={inv.id} justifyContent="space-between">
                <Text>
                  <Text color={theme.semantic.income}>{indicators.income}</Text> {inv.number} {inv.customer_name?.slice(0, 10)}
                </Text>
                <Text color={getStatusColor(inv.status, theme)}>
                  {formatCurrency(inv.total, { decimals: 0 })} {inv.status}
                </Text>
              </Box>
            ))}
            {invoices.length === 0 && <Text color={theme.semantic.textMuted}>No invoices</Text>}
          </Box>

          {/* Spacer */}
          <Box width={4} />

          {/* Recent Expenses */}
          <Box width={Math.floor(usableWidth / 2) - 2} flexDirection="column">
            <Text color={theme.semantic.textMuted}>Latest Expenses</Text>
            {expenses.slice(0, 3).map((exp) => (
              <Box key={exp.id} justifyContent="space-between">
                <Text>
                  <Text color={theme.semantic.expense}>{indicators.expense}</Text>
                  {" "}{exp.vendor_name?.slice(0, 10) || exp.category?.slice(0, 10) || "Expense"}
                  {exp.is_recurring ? <Text color={theme.semantic.warning}> ↻</Text> : null}
                </Text>
                <Text color={theme.semantic.expense}>{formatCurrency(-exp.amount, { decimals: 0 })}</Text>
              </Box>
            ))}
            {expenses.length === 0 && <Text color={theme.semantic.textMuted}>No expenses</Text>}
          </Box>
        </Box>
      </Box>}

    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════════

function generateHistoricalData(currentValue: number, points: number): number[] {
  // Generate realistic-looking historical data trending toward current
  const data: number[] = [];
  const volatility = currentValue * 0.2;
  let value = currentValue * 0.7;

  for (let i = 0; i < points - 1; i++) {
    value += (Math.random() - 0.4) * volatility * 0.3;
    value = Math.max(0, value);
    data.push(value);
  }
  data.push(currentValue);
  return data;
}

function calculateHealthScore(
  balance: BalanceSheetReport,
  pl: ProfitLossReport,
  ar: ReceivablesAgingReport
): number {
  let score = 50; // Base score

  // Positive cash flow
  if (balance.assets.cash > 0) score += 15;
  if (balance.assets.cash > balance.liabilities.total) score += 10;

  // Profitable
  if (pl.net_income > 0) score += 15;

  // Low overdue
  const overdueRatio = (ar.totals.days_31_60 + ar.totals.days_61_90 + ar.totals.days_90_plus) /
    Math.max(1, ar.totals.current + ar.totals.days_1_30 + ar.totals.days_31_60 + ar.totals.days_61_90 + ar.totals.days_90_plus);
  if (overdueRatio < 0.1) score += 10;
  else if (overdueRatio > 0.3) score -= 15;

  return Math.max(0, Math.min(100, score));
}

function getExpensesByCategory(expenses: ExpenseWithDetails[]): { label: string; value: number }[] {
  const byCategory: Record<string, number> = {};
  expenses.forEach((exp) => {
    const cat = exp.category || "Other";
    byCategory[cat] = (byCategory[cat] || 0) + exp.amount;
  });

  return Object.entries(byCategory)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

function getExpensesByVendor(expenses: ExpenseWithDetails[]): { label: string; value: number; count: number }[] {
  const byVendor: Record<string, { total: number; count: number }> = {};
  expenses.forEach((exp) => {
    const vendor = exp.vendor_name || "Unknown";
    if (!byVendor[vendor]) {
      byVendor[vendor] = { total: 0, count: 0 };
    }
    byVendor[vendor].total += exp.amount;
    byVendor[vendor].count += 1;
  });

  return Object.entries(byVendor)
    .map(([label, { total, count }]) => ({ label, value: total, count }))
    .sort((a, b) => b.value - a.value);
}

function getRecurringExpenses(expenses: ExpenseWithDetails[]): ExpenseWithDetails[] {
  return expenses.filter(e => e.is_recurring === 1);
}

function getStatusColor(status: string, theme: ReturnType<typeof getEnhancedTheme>): string {
  switch (status) {
    case "paid": return theme.semantic.success;
    case "sent": return theme.semantic.info;
    case "overdue": return theme.semantic.error;
    case "partial": return theme.semantic.warning;
    default: return theme.semantic.textMuted;
  }
}
