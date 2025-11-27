import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { getEnhancedTheme } from "../design/theme.js";
import { indicators, borderStyles } from "../design/tokens.js";
import { getTrialBalance, verifyTrialBalance } from "../../domain/journal.js";
import { type Account } from "../../domain/accounts.js";

interface TrialBalanceViewProps {
  width: number;
  height: number;
}

export function TrialBalanceView({ width, height }: TrialBalanceViewProps) {
  const theme = getEnhancedTheme();
  const [trialBalance, setTrialBalance] = useState<
    Array<{
      account_id: number;
      account_code: string;
      account_name: string;
      account_type: Account["type"];
      debit_balance: number;
      credit_balance: number;
    }>
  >([]);
  const [verification, setVerification] = useState<{
    is_balanced: boolean;
    total_debits: number;
    total_credits: number;
    difference: number;
  } | null>(null);
  const [asOfDate, setAsOfDate] = useState<string>("");
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [groupBy, setGroupBy] = useState<"type" | "none">("type");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    loadTrialBalance();
  }, []);

  const loadTrialBalance = (date?: string) => {
    try {
      const tb = getTrialBalance(date);
      const verification = verifyTrialBalance(date);
      setTrialBalance(tb);
      setVerification(verification);

      if (verification.is_balanced) {
        showMessage("success", "Trial balance is balanced ✓");
      } else {
        showMessage("error", `Out of balance by $${verification.difference.toFixed(2)}`);
      }
    } catch (err) {
      showMessage("error", `Failed to load trial balance: ${(err as Error).message}`);
    }
  };

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  useInput((char, key) => {
    // Date editing
    if (isEditingDate) {
      if (key.return) {
        setIsEditingDate(false);
        loadTrialBalance(asOfDate || undefined);
        return;
      }
      if (key.escape) {
        setIsEditingDate(false);
        setAsOfDate("");
        return;
      }
      if (key.backspace || key.delete) {
        setAsOfDate((prev) => prev.slice(0, -1));
        return;
      }
      if (char && char.match(/[0-9-]/)) {
        setAsOfDate((prev) => prev + char);
      }
      return;
    }

    // Global shortcuts
    if (char === "d") {
      setIsEditingDate(true);
      return;
    }
    if (char === "r") {
      loadTrialBalance(asOfDate || undefined);
      return;
    }
    if (char === "g") {
      setGroupBy((prev) => (prev === "type" ? "none" : "type"));
      return;
    }
  });

  const formatBalance = (balance: number): string => {
    if (balance === 0) return "-";
    return `$${balance.toFixed(2)}`;
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

  const getTypeLabel = (type: Account["type"]): string => {
    return type.charAt(0).toUpperCase() + type.slice(1) + "s";
  };

  // Group accounts by type if enabled
  const groupedData: Record<string, typeof trialBalance> = {};
  if (groupBy === "type") {
    trialBalance.forEach((row) => {
      const typeKey = row.account_type;
      if (!groupedData[typeKey]) {
        groupedData[typeKey] = [];
      }
      groupedData[typeKey].push(row);
    });
  } else {
    groupedData["all"] = trialBalance;
  }

  // Calculate subtotals for each group
  const groupTotals: Record<
    string,
    { debit_total: number; credit_total: number }
  > = {};
  Object.keys(groupedData).forEach((key) => {
    const debit_total = groupedData[key].reduce(
      (sum, row) => sum + row.debit_balance,
      0
    );
    const credit_total = groupedData[key].reduce(
      (sum, row) => sum + row.credit_balance,
      0
    );
    groupTotals[key] = { debit_total, credit_total };
  });

  return (
    <Box flexDirection="column" width={width} height={height} paddingX={1}>
      {/* Header */}
      <Box justifyContent="space-between" marginBottom={1} marginTop={1}>
        <Box>
          <Text bold color={theme.semantic.warning}>
            ◧ Trial Balance
          </Text>
          {asOfDate && <Text color={theme.semantic.textMuted}> as of {asOfDate}</Text>}
        </Box>
        <Box>
          {message && (
            <Text color={message.type === "success" ? theme.semantic.success : theme.semantic.error}>
              {message.text}
            </Text>
          )}
          {verification && (
            <Text
              color={verification.is_balanced ? theme.semantic.success : theme.semantic.error}
              bold
            >
              {verification.is_balanced ? `${indicators.check} BALANCED` : `${indicators.cross} OUT OF BALANCE`}
            </Text>
          )}
        </Box>
      </Box>

      {/* Divider */}
      <Text color={theme.semantic.border}>{"─".repeat(width - 4)}</Text>

      {/* Hints */}
      <Box marginY={1}>
        <Text color={theme.semantic.textMuted}>d:date • r:refresh • g:group • Esc:back</Text>
      </Box>

      {/* Date filter */}
      {isEditingDate && (
        <Box marginBottom={1}>
          <Text color={theme.semantic.focusBorder}>As of Date (YYYY-MM-DD): </Text>
          <Box borderStyle={borderStyles.input} borderColor={theme.semantic.focusBorder} paddingX={1}>
            <Text color={theme.semantic.textPrimary}>
              {asOfDate}
              <Text backgroundColor={theme.semantic.focusBorder}> </Text>
            </Text>
          </Box>
          <Text color={theme.semantic.textMuted}> (Enter apply, Esc cancel)</Text>
        </Box>
      )}

      {/* Main content */}
      <Box
        width="100%"
        height={height - 10}
        flexDirection="column"
        borderStyle={borderStyles.panel}
        borderColor={theme.semantic.focusBorder}
        paddingX={1}
      >
        {/* Table header */}
        <Box justifyContent="space-between">
          <Box width="50%">
            <Text bold color={theme.semantic.textMuted}>
              Code • Account Name
            </Text>
          </Box>
          <Box width="50%" justifyContent="flex-end">
            <Text bold color={theme.semantic.textMuted}>
              Debit {"           "}Credit
            </Text>
          </Box>
        </Box>

        <Box height={1} />

        {/* Table rows */}
        <Box flexDirection="column" flexGrow={1}>
          {trialBalance.length === 0 ? (
            <Text color={theme.semantic.textMuted}>
              {indicators.info} No transactions found. Journal entries are needed to generate a trial balance.
            </Text>
          ) : groupBy === "type" ? (
            // Grouped by type
            Object.keys(groupedData)
              .sort()
              .map((typeKey) => {
                const rows = groupedData[typeKey];
                const typeColor = getAccountColor(typeKey as Account["type"]);
                const totals = groupTotals[typeKey];

                return (
                  <Box key={typeKey} flexDirection="column" marginBottom={1}>
                    {/* Type header */}
                    <Text bold color={typeColor}>
                      {getTypeLabel(typeKey as Account["type"])}
                    </Text>

                    {/* Accounts in this type */}
                    {rows.map((row) => (
                      <Box key={row.account_id} justifyContent="space-between">
                        <Box width="50%">
                          <Text color={theme.semantic.textPrimary}>
                            {"  "}
                            {row.account_code} • {row.account_name.slice(0, 25)}
                          </Text>
                        </Box>
                        <Box width="50%" justifyContent="flex-end">
                          <Text color={row.debit_balance > 0 ? theme.semantic.success : theme.semantic.textMuted}>
                            {formatBalance(row.debit_balance).padStart(12)}
                          </Text>
                          <Text> {"  "} </Text>
                          <Text color={row.credit_balance > 0 ? theme.semantic.error : theme.semantic.textMuted}>
                            {formatBalance(row.credit_balance).padStart(12)}
                          </Text>
                        </Box>
                      </Box>
                    ))}

                    {/* Subtotal */}
                    <Box justifyContent="space-between" paddingTop={1}>
                      <Box width="50%">
                        <Text bold color={typeColor}>
                          {"  "}Total {getTypeLabel(typeKey as Account["type"])}
                        </Text>
                      </Box>
                      <Box width="50%" justifyContent="flex-end">
                        <Text bold color={theme.semantic.success}>
                          {formatBalance(totals.debit_total).padStart(12)}
                        </Text>
                        <Text> {"  "} </Text>
                        <Text bold color={theme.semantic.error}>
                          {formatBalance(totals.credit_total).padStart(12)}
                        </Text>
                      </Box>
                    </Box>
                  </Box>
                );
              })
          ) : (
            // Not grouped - flat list
            trialBalance.map((row) => (
              <Box key={row.account_id} justifyContent="space-between">
                <Box width="50%">
                  <Text color={getAccountColor(row.account_type)}>
                    {row.account_code} • {row.account_name.slice(0, 30)}
                  </Text>
                </Box>
                <Box width="50%" justifyContent="flex-end">
                  <Text color={row.debit_balance > 0 ? theme.semantic.success : theme.semantic.textMuted}>
                    {formatBalance(row.debit_balance).padStart(12)}
                  </Text>
                  <Text> {"  "} </Text>
                  <Text color={row.credit_balance > 0 ? theme.semantic.error : theme.semantic.textMuted}>
                    {formatBalance(row.credit_balance).padStart(12)}
                  </Text>
                </Box>
              </Box>
            ))
          )}
        </Box>

        <Box height={1} />

        {/* Grand totals */}
        {verification && (
          <Box borderStyle={borderStyles.input} borderColor={theme.semantic.border} paddingX={1} flexDirection="column">
            <Box justifyContent="space-between">
              <Text bold color={theme.semantic.textPrimary}>TOTAL</Text>
              <Box>
                <Text bold color={theme.semantic.success}>
                  {formatBalance(verification.total_debits).padStart(12)}
                </Text>
                <Text> {"  "} </Text>
                <Text bold color={theme.semantic.error}>
                  {formatBalance(verification.total_credits).padStart(12)}
                </Text>
              </Box>
            </Box>
            {!verification.is_balanced && (
              <Box justifyContent="space-between">
                <Text bold color={theme.semantic.error}>
                  DIFFERENCE
                </Text>
                <Text bold color={theme.semantic.error}>
                  {formatBalance(verification.difference).padStart(12)}
                </Text>
              </Box>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}
