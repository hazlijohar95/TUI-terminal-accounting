/**
 * GeneralLedgerView Component
 *
 * Account transaction history with polished three-panel layout
 * and btop-inspired design elements.
 */

import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { getEnhancedTheme } from "../design/theme.js";
import { indicators, borderStyles } from "../design/tokens.js";
import {
  getGeneralLedger,
  getJournalEntry,
  type JournalEntry,
} from "../../domain/journal.js";
import { listAccounts, type Account } from "../../domain/accounts.js";

interface GeneralLedgerViewProps {
  width: number;
  height: number;
}

type FocusArea = "accounts" | "transactions" | "entry";

export function GeneralLedgerView({ width, height }: GeneralLedgerViewProps) {
  const theme = getEnhancedTheme();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountIndex, setSelectedAccountIndex] = useState(0);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<
    Array<{
      date: string;
      entry_id: number;
      description: string;
      reference: string | null;
      debit: number;
      credit: number;
      balance: number;
    }>
  >([]);
  const [selectedTxIndex, setSelectedTxIndex] = useState(0);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [focusArea, setFocusArea] = useState<FocusArea>("accounts");
  const [accountSearch, setAccountSearch] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const accountListWidth = Math.floor(width * 0.25);
  const transactionsWidth = Math.floor(width * 0.40);
  const entryDetailWidth = width - accountListWidth - transactionsWidth - 6;

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = () => {
    try {
      const allAccounts = listAccounts({ is_active: true });
      const filteredAccounts = accountSearch
        ? allAccounts.filter(
            (a) =>
              a.code.includes(accountSearch) ||
              a.name.toLowerCase().includes(accountSearch.toLowerCase())
          )
        : allAccounts;
      setAccounts(filteredAccounts);

      if (filteredAccounts.length > 0 && selectedAccountIndex < filteredAccounts.length) {
        setSelectedAccount(filteredAccounts[selectedAccountIndex]);
        loadTransactions(filteredAccounts[selectedAccountIndex].id);
      }
    } catch (err) {
      showMessage("error", `Failed to load accounts: ${(err as Error).message}`);
    }
  };

  const loadTransactions = (accountId: number) => {
    try {
      const txs = getGeneralLedger(accountId, startDate || undefined, endDate || undefined, 100);
      setTransactions(txs);
      setSelectedTxIndex(0);

      if (txs.length > 0) {
        loadEntryDetail(txs[0].entry_id);
      } else {
        setSelectedEntry(null);
      }
    } catch (err) {
      showMessage("error", `Failed to load transactions: ${(err as Error).message}`);
    }
  };

  const loadEntryDetail = (entryId: number) => {
    try {
      const entry = getJournalEntry(entryId);
      setSelectedEntry(entry);
    } catch (err) {
      showMessage("error", `Failed to load entry: ${(err as Error).message}`);
    }
  };

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  useInput((char, key) => {
    // Global shortcuts
    if (key.escape) {
      if (isSearching) {
        setIsSearching(false);
        return;
      }
      return;
    }

    // Search mode
    if (isSearching) {
      if (key.return) {
        setIsSearching(false);
        loadAccounts();
        return;
      }
      if (key.backspace || key.delete) {
        setAccountSearch((prev) => prev.slice(0, -1));
        return;
      }
      if (char && !key.ctrl && !key.meta) {
        setAccountSearch((prev) => prev + char);
      }
      return;
    }

    // Tab to switch focus
    if (key.tab) {
      if (focusArea === "accounts") {
        setFocusArea("transactions");
      } else if (focusArea === "transactions") {
        setFocusArea("entry");
      } else {
        setFocusArea("accounts");
      }
      return;
    }

    // Search
    if (char === "/") {
      setIsSearching(true);
      setAccountSearch("");
      return;
    }

    // Navigation based on focus
    if (focusArea === "accounts") {
      if (key.upArrow || char === "k") {
        setSelectedAccountIndex((prev) => {
          const newIndex = Math.max(0, prev - 1);
          if (accounts[newIndex]) {
            setSelectedAccount(accounts[newIndex]);
            loadTransactions(accounts[newIndex].id);
          }
          return newIndex;
        });
        return;
      }
      if (key.downArrow || char === "j") {
        setSelectedAccountIndex((prev) => {
          const newIndex = Math.min(accounts.length - 1, prev + 1);
          if (accounts[newIndex]) {
            setSelectedAccount(accounts[newIndex]);
            loadTransactions(accounts[newIndex].id);
          }
          return newIndex;
        });
        return;
      }
    } else if (focusArea === "transactions") {
      if (key.upArrow || char === "k") {
        setSelectedTxIndex((prev) => {
          const newIndex = Math.max(0, prev - 1);
          if (transactions[newIndex]) {
            loadEntryDetail(transactions[newIndex].entry_id);
          }
          return newIndex;
        });
        return;
      }
      if (key.downArrow || char === "j") {
        setSelectedTxIndex((prev) => {
          const newIndex = Math.min(transactions.length - 1, prev + 1);
          if (transactions[newIndex]) {
            loadEntryDetail(transactions[newIndex].entry_id);
          }
          return newIndex;
        });
        return;
      }
    }
  });

  const formatBalance = (balance: number): string => {
    return balance < 0 ? `($${Math.abs(balance).toFixed(2)})` : `$${balance.toFixed(2)}`;
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
  };

  const getAccountColor = (type: Account["type"]): string => {
    switch (type) {
      case "asset":
        return theme.semantic.success;
      case "liability":
        return theme.semantic.error;
      case "equity":
        return theme.semantic.info;
      case "income":
        return theme.semantic.income;
      case "expense":
        return theme.semantic.expense;
      default:
        return theme.semantic.textPrimary;
    }
  };

  return (
    <Box flexDirection="column" width={width} height={height} paddingX={1}>
      {/* Header */}
      <Box justifyContent="space-between" marginBottom={1} marginTop={1}>
        <Box>
          <Text bold color={theme.semantic.warning}>◩ General Ledger</Text>
          {selectedAccount && (
            <Text color={theme.semantic.textMuted}>
              {" "}• {selectedAccount.code} - {selectedAccount.name}
            </Text>
          )}
        </Box>
        {message && (
          <Text color={message.type === "success" ? theme.semantic.success : theme.semantic.error}>
            {message.type === "success" ? indicators.check : indicators.cross} {message.text}
          </Text>
        )}
      </Box>

      {/* Divider */}
      <Text color={theme.semantic.border}>{"─".repeat(width - 4)}</Text>

      {/* Hints */}
      <Box marginY={1}>
        <Text color={theme.semantic.textMuted}>/:search • j/k ↕ • Tab switch • Esc back</Text>
      </Box>

      {/* Main panels */}
      <Box height={height - 8}>
        {/* Left panel - Accounts list */}
        <Box
          width={accountListWidth}
          height="100%"
          flexDirection="column"
          borderStyle={borderStyles.panel}
          borderColor={focusArea === "accounts" ? theme.semantic.focusBorder : theme.semantic.border}
          paddingX={1}
        >
          <Text bold color={theme.semantic.info}>{indicators.pointer} Accounts</Text>
          {isSearching && (
            <Text color={theme.semantic.warning}>
              Search: {accountSearch}
              <Text backgroundColor={theme.semantic.focusBorder}> </Text>
            </Text>
          )}
          <Box marginTop={1} />

          <Box flexDirection="column" flexGrow={1}>
            {accounts.slice(0, height - 12).map((account, index) => {
              const isSelected = index === selectedAccountIndex;
              if (isSelected) {
                return (
                  <Box key={account.id}>
                    <Box backgroundColor={theme.semantic.focusBorder}>
                      <Text color={theme.base} bold>
                        {" ▶ "}{account.code}{" "}
                      </Text>
                    </Box>
                  </Box>
                );
              }
              return (
                <Box key={account.id}>
                  <Text color={getAccountColor(account.type)}>
                    {"   "}{account.code}
                  </Text>
                </Box>
              );
            })}
          </Box>
        </Box>

        <Box width={1} />

        {/* Middle panel - Transactions */}
        <Box
          width={transactionsWidth}
          height="100%"
          flexDirection="column"
          borderStyle={borderStyles.panel}
          borderColor={focusArea === "transactions" ? theme.semantic.focusBorder : theme.semantic.border}
          paddingX={1}
        >
          <Text bold color={theme.semantic.info}>{indicators.pointer} Transactions</Text>
          <Box marginTop={1} />

          <Box flexDirection="column" flexGrow={1}>
            {transactions.length === 0 ? (
              <Text color={theme.semantic.textMuted}>{indicators.info} No transactions found</Text>
            ) : (
              transactions.slice(0, height - 12).map((tx, index) => {
                const isSelected = index === selectedTxIndex;
                const amount = tx.debit > 0 ? tx.debit : -tx.credit;
                if (isSelected) {
                  return (
                    <Box key={`${tx.entry_id}-${index}`} flexDirection="column" marginBottom={1}>
                      <Box>
                        <Box backgroundColor={theme.semantic.focusBorder}>
                          <Text color={theme.base} bold>
                            {" ▶ "}{formatDate(tx.date)}{" "}
                          </Text>
                        </Box>
                      </Box>
                      <Box paddingLeft={4}>
                        <Text color={theme.semantic.textMuted}>{tx.description.slice(0, 30)}</Text>
                      </Box>
                      <Box paddingLeft={4} justifyContent="space-between">
                        <Text color={amount >= 0 ? theme.semantic.success : theme.semantic.error}>
                          {amount >= 0 ? `Dr: ` : `Cr: `}
                          {formatBalance(Math.abs(amount))}
                        </Text>
                        <Text color={theme.semantic.textMuted}>Bal: {formatBalance(tx.balance)}</Text>
                      </Box>
                    </Box>
                  );
                }
                return (
                  <Box key={`${tx.entry_id}-${index}`}>
                    <Text color={theme.semantic.textSecondary}>
                      {"   "}{formatDate(tx.date)}
                    </Text>
                  </Box>
                );
              })
            )}
          </Box>

          {transactions.length > 0 && (
            <Box
              borderStyle={borderStyles.input}
              borderColor={theme.semantic.border}
              paddingX={1}
              marginTop={1}
            >
              <Box justifyContent="space-between" width="100%">
                <Text color={theme.semantic.textMuted}>Balance:</Text>
                <Text bold color={transactions[transactions.length - 1].balance >= 0 ? theme.semantic.success : theme.semantic.error}>
                  {formatBalance(transactions[transactions.length - 1].balance)}
                </Text>
              </Box>
            </Box>
          )}
        </Box>

        <Box width={1} />

        {/* Right panel - Entry detail */}
        <Box
          width={entryDetailWidth}
          height="100%"
          flexDirection="column"
          borderStyle={borderStyles.panel}
          borderColor={focusArea === "entry" ? theme.semantic.focusBorder : theme.semantic.border}
          paddingX={1}
        >
          {selectedEntry ? (
            <Box flexDirection="column">
              <Text bold color={theme.semantic.warning}>
                {indicators.pointer} Entry #{selectedEntry.id}
              </Text>
              <Box marginTop={1} />
              <Box justifyContent="space-between">
                <Text color={theme.semantic.textMuted}>Date:</Text>
                <Text color={theme.semantic.textPrimary}>{selectedEntry.date}</Text>
              </Box>
              <Box justifyContent="space-between">
                <Text color={theme.semantic.textMuted}>Description:</Text>
                <Text color={theme.semantic.textPrimary}>{selectedEntry.description.slice(0, 20)}</Text>
              </Box>
              {selectedEntry.reference && (
                <Box justifyContent="space-between">
                  <Text color={theme.semantic.textMuted}>Ref:</Text>
                  <Text color={theme.semantic.textPrimary}>{selectedEntry.reference}</Text>
                </Box>
              )}
              <Box marginTop={1} />
              <Text bold color={theme.semantic.info}>Lines:</Text>
              {selectedEntry.lines.slice(0, 5).map((line, idx) => {
                const isCurrentAccount = selectedAccount ? line.account_id === selectedAccount.id : false;
                return (
                  <Box key={idx} flexDirection="column" marginBottom={1}>
                    <Text
                      bold={isCurrentAccount}
                      color={isCurrentAccount ? theme.semantic.focusBorder : theme.semantic.textSecondary}
                    >
                      {line.account?.code} - {line.account?.name?.slice(0, 12)}
                    </Text>
                    <Box paddingLeft={2}>
                      <Text color={line.debit > 0 ? theme.semantic.success : theme.semantic.error}>
                        {line.debit > 0 ? `Dr: ${formatBalance(line.debit)}` : `Cr: ${formatBalance(line.credit)}`}
                      </Text>
                    </Box>
                  </Box>
                );
              })}
              <Box flexGrow={1} />
              <Box
                borderStyle={borderStyles.input}
                borderColor={theme.semantic.border}
                paddingX={1}
                flexDirection="column"
              >
                <Box justifyContent="space-between">
                  <Text color={theme.semantic.textMuted}>Debits:</Text>
                  <Text color={theme.semantic.success}>{formatBalance(selectedEntry.total_debits || 0)}</Text>
                </Box>
                <Box justifyContent="space-between">
                  <Text color={theme.semantic.textMuted}>Credits:</Text>
                  <Text color={theme.semantic.error}>{formatBalance(selectedEntry.total_credits || 0)}</Text>
                </Box>
              </Box>
            </Box>
          ) : (
            <Box flexDirection="column" marginTop={1}>
              <Text color={theme.semantic.textMuted}>{indicators.info} Select a transaction</Text>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
