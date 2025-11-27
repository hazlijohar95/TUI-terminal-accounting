/**
 * AccountingMenu Component
 *
 * Central hub for accounting features with visual status
 * indicators and btop-inspired navigation.
 */

import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { getEnhancedTheme } from "../design/theme.js";
import { indicators, borderStyles } from "../design/tokens.js";
import { ChartOfAccountsView } from "./ChartOfAccountsView.js";
import { JournalEntryView } from "./JournalEntryView.js";
import { GeneralLedgerView } from "./GeneralLedgerView.js";
import { TrialBalanceView } from "./TrialBalanceView.js";
import { listAccounts } from "../../domain/accounts.js";
import { listJournalEntries, verifyTrialBalance } from "../../domain/journal.js";

interface AccountingMenuProps {
  width: number;
  height: number;
  onExit: () => void;
}

type AccountingView = "menu" | "chart-of-accounts" | "journal-entry" | "general-ledger" | "trial-balance" | "bank-reconciliation";

interface MenuItem {
  key: string;
  icon: string;
  label: string;
  description: string;
  status: string;
  available: boolean;
}

export function AccountingMenu({ width, height, onExit }: AccountingMenuProps) {
  const theme = getEnhancedTheme();
  const [currentView, setCurrentView] = useState<AccountingView>("menu");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Unicode icons for accounting features
  const icons = {
    accounts: "◧",
    journal: "◨",
    ledger: "◩",
    trial: "◪",
    bank: "◫",
  };

  const menuItems: MenuItem[] = [
    {
      key: "1",
      icon: icons.accounts,
      label: "Chart of Accounts",
      description: "Manage your account structure",
      status: getChartOfAccountsStatus(),
      available: true,
    },
    {
      key: "2",
      icon: icons.journal,
      label: "Journal Entry",
      description: "Manual journal entries",
      status: getJournalEntriesStatus(),
      available: true,
    },
    {
      key: "3",
      icon: icons.ledger,
      label: "General Ledger",
      description: "View account transaction history",
      status: "View transactions by account",
      available: true,
    },
    {
      key: "4",
      icon: icons.trial,
      label: "Trial Balance",
      description: "Verify debits = credits",
      status: getTrialBalanceStatus(),
      available: true,
    },
    {
      key: "5",
      icon: icons.bank,
      label: "Bank Reconciliation",
      description: "Reconcile bank statements",
      status: "Coming soon",
      available: false,
    },
  ];

  function getChartOfAccountsStatus(): string {
    try {
      const accounts = listAccounts({ is_active: true });
      return `${accounts.length} accounts • Active`;
    } catch {
      return "Ready to use";
    }
  }

  function getJournalEntriesStatus(): string {
    try {
      const entries = listJournalEntries();
      return entries.length === 0
        ? "Ready to create entries"
        : `${entries.length} entries • Active`;
    } catch {
      return "Ready to use";
    }
  }

  function getTrialBalanceStatus(): string {
    try {
      const verification = verifyTrialBalance();
      return verification.is_balanced
        ? "✓ Balanced"
        : "✗ Out of balance";
    } catch {
      return "Ready to use";
    }
  }

  useInput((char, key) => {
    if (key.escape) {
      if (currentView === "menu") {
        onExit();
      } else {
        setCurrentView("menu");
      }
      return;
    }

    if (currentView === "menu") {
      // Number shortcuts
      if (char === "1" && menuItems[0].available) {
        setCurrentView("chart-of-accounts");
        return;
      }
      if (char === "2" && menuItems[1].available) {
        setCurrentView("journal-entry");
        return;
      }
      if (char === "3" && menuItems[2].available) {
        setCurrentView("general-ledger");
        return;
      }
      if (char === "4" && menuItems[3].available) {
        setCurrentView("trial-balance");
        return;
      }
      if (char === "5" && menuItems[4].available) {
        setCurrentView("bank-reconciliation");
        return;
      }

      // Arrow key navigation
      if (key.upArrow || char === "k") {
        setSelectedIndex(prev => Math.max(0, prev - 1));
        return;
      }
      if (key.downArrow || char === "j") {
        setSelectedIndex(prev => Math.min(menuItems.length - 1, prev + 1));
        return;
      }

      // Enter to select
      if (key.return) {
        const selected = menuItems[selectedIndex];
        if (selected.available) {
          switch (selected.key) {
            case "1":
              setCurrentView("chart-of-accounts");
              break;
            case "2":
              setCurrentView("journal-entry");
              break;
            case "3":
              setCurrentView("general-ledger");
              break;
            case "4":
              setCurrentView("trial-balance");
              break;
            case "5":
              setCurrentView("bank-reconciliation");
              break;
          }
        }
      }
    }
  });

  // Render sub-views
  if (currentView === "chart-of-accounts") {
    return <ChartOfAccountsView width={width} height={height} />;
  }

  if (currentView === "journal-entry") {
    return <JournalEntryView width={width} height={height} />;
  }

  if (currentView === "general-ledger") {
    return <GeneralLedgerView width={width} height={height} />;
  }

  if (currentView === "trial-balance") {
    return <TrialBalanceView width={width} height={height} />;
  }

  if (currentView === "bank-reconciliation") {
    return (
      <Box flexDirection="column" padding={2}>
        <Text bold color={theme.semantic.warning}>◫ Bank Reconciliation</Text>
        <Text color={theme.semantic.textMuted}>Coming soon...</Text>
        <Box marginTop={1} />
        <Text color={theme.semantic.textSecondary}>This feature will allow you to:</Text>
        <Box paddingLeft={1} flexDirection="column" marginTop={1}>
          <Text color={theme.semantic.textMuted}>{indicators.bullet} Match bank transactions to entries</Text>
          <Text color={theme.semantic.textMuted}>{indicators.bullet} Mark items as reconciled</Text>
          <Text color={theme.semantic.textMuted}>{indicators.bullet} Import bank statements</Text>
          <Text color={theme.semantic.textMuted}>{indicators.bullet} Identify discrepancies</Text>
        </Box>
        <Box marginTop={2} />
        <Text color={theme.semantic.textMuted}>Press Esc to go back</Text>
      </Box>
    );
  }

  // Calculate stats for header
  const availableCount = menuItems.filter(m => m.available).length;
  const totalCount = menuItems.length;

  // Main menu
  return (
    <Box flexDirection="column" width={width} height={height} paddingX={2}>
      {/* Header */}
      <Box marginTop={1} marginBottom={1} justifyContent="space-between">
        <Text bold color={theme.semantic.warning}>◆ Accounting</Text>
        <Text color={theme.semantic.textMuted}>
          {availableCount}/{totalCount} features
        </Text>
      </Box>

      {/* Divider */}
      <Text color={theme.semantic.border}>{"─".repeat(width - 6)}</Text>

      {/* Hints */}
      <Box marginY={1}>
        <Text color={theme.semantic.textMuted}>1-5 quick • j/k ↕ • Enter open • Esc back</Text>
      </Box>

      {/* Menu Items */}
      <Box
        flexDirection="column"
        borderStyle={borderStyles.panel}
        borderColor={theme.semantic.border}
        paddingX={2}
        paddingY={1}
      >
        {menuItems.map((item, index) => {
          const isSelected = index === selectedIndex;
          const isAvailable = item.available;

          // Status indicator
          const statusIcon = !isAvailable
            ? indicators.pending
            : item.status.includes("✓") || item.status.includes("Active")
              ? indicators.check
              : indicators.info;

          const statusColor = !isAvailable
            ? theme.semantic.textMuted
            : item.status.includes("✓") || item.status.includes("Active")
              ? theme.semantic.success
              : theme.semantic.info;

          if (isSelected) {
            return (
              <Box key={item.key} flexDirection="column" marginBottom={index < menuItems.length - 1 ? 1 : 0}>
                <Box backgroundColor={theme.semantic.focusBorder}>
                  <Text color={theme.base} bold>
                    {" ▶ "}{item.key}. {item.icon} {item.label}{" "}
                  </Text>
                </Box>
                <Box paddingLeft={4}>
                  <Text color={theme.semantic.textSecondary}>{item.description}</Text>
                </Box>
                <Box paddingLeft={4}>
                  <Text color={statusColor}>
                    {statusIcon} {item.status}
                  </Text>
                </Box>
              </Box>
            );
          }

          return (
            <Box key={item.key} flexDirection="column" marginBottom={index < menuItems.length - 1 ? 1 : 0}>
              <Box>
                <Text color={isAvailable ? theme.semantic.textPrimary : theme.semantic.textMuted}>
                  {"   "}{item.key}. {item.icon} {item.label}
                </Text>
              </Box>
              <Box paddingLeft={4}>
                <Text color={theme.semantic.textMuted}>{item.description}</Text>
              </Box>
              <Box paddingLeft={4}>
                <Text color={statusColor}>
                  {statusIcon} {item.status}
                </Text>
              </Box>
            </Box>
          );
        })}
      </Box>

      <Box flexGrow={1} />

      {/* Footer status */}
      <Box paddingX={1} justifyContent="space-between">
        <Text color={theme.semantic.textMuted}>
          {indicators.pointer} Select a feature to begin
        </Text>
      </Box>
    </Box>
  );
}
