/**
 * ChartOfAccountsView Component
 *
 * Comprehensive account management with visual type indicators,
 * balance summaries, and btop-inspired design.
 */

import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { getEnhancedTheme } from "../design/theme.js";
import { indicators, borderStyles } from "../design/tokens.js";
import {
  listAccounts,
  getAccount,
  createAccount,
  updateAccount,
  deleteAccount,
  deactivateAccount,
  activateAccount,
  getAccountsGrouped,
  searchAccounts,
  type Account,
  type CreateAccountData,
} from "../../domain/accounts.js";

interface ChartOfAccountsViewProps {
  width: number;
  height: number;
}

type FocusArea = "list" | "form";
type FormMode = "add" | "edit" | null;
type FormField = "code" | "name" | "type" | "parent" | "description" | "balance";

const accountTypes: Array<Account["type"]> = ["asset", "liability", "equity", "income", "expense"];

export function ChartOfAccountsView({ width, height }: ChartOfAccountsViewProps) {
  const theme = getEnhancedTheme();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [groupedAccounts, setGroupedAccounts] = useState<Record<string, { label: string; type: Account["type"]; accounts: Account[] }>>({});
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [focusArea, setFocusArea] = useState<FocusArea>("list");
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Form state
  const [activeField, setActiveField] = useState<FormField>("code");
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formTypeIndex, setFormTypeIndex] = useState(0);
  const [formParentId, setFormParentId] = useState<number | null>(null);
  const [formDescription, setFormDescription] = useState("");
  const [formBalance, setFormBalance] = useState("");

  // Expanded groups state
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(["1000s", "2000s", "3000s", "4000s", "5000s"])
  );

  const listWidth = Math.floor(width * 0.55);
  const detailWidth = width - listWidth - 3;
  const formFields: FormField[] = ["code", "name", "type", "parent", "description", "balance"];

  // Account type icons
  const typeIcons: Record<Account["type"], string> = {
    asset: "◧",
    liability: "◨",
    equity: "◩",
    income: "◪",
    expense: "◫",
  };

  const loadData = () => {
    try {
      const allAccounts = listAccounts({ is_active: true });
      setAccounts(allAccounts);
      setGroupedAccounts(getAccountsGrouped());

      if (selectedAccount) {
        const updated = getAccount(selectedAccount.id);
        setSelectedAccount(updated);
      } else if (allAccounts.length > 0 && selectedIndex === 0) {
        setSelectedAccount(allAccounts[0]);
      }
    } catch (err) {
      showMessage("error", `Failed to load accounts: ${(err as Error).message}`);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const resetForm = () => {
    setFormCode("");
    setFormName("");
    setFormTypeIndex(0);
    setFormParentId(null);
    setFormDescription("");
    setFormBalance("");
    setActiveField("code");
  };

  const handleSubmitForm = () => {
    try {
      if (!formCode.trim()) {
        showMessage("error", "Account code is required");
        return;
      }
      if (!formName.trim()) {
        showMessage("error", "Account name is required");
        return;
      }

      if (formMode === "add") {
        const data: CreateAccountData = {
          code: formCode.trim(),
          name: formName.trim(),
          type: accountTypes[formTypeIndex],
          parent_id: formParentId,
          description: formDescription.trim() || undefined,
          opening_balance: formBalance ? parseFloat(formBalance) : 0,
        };
        createAccount(data);
        showMessage("success", "Account created successfully!");
      } else if (formMode === "edit" && selectedAccount) {
        updateAccount(selectedAccount.id, {
          code: formCode.trim(),
          name: formName.trim(),
          type: accountTypes[formTypeIndex],
          parent_id: formParentId,
          description: formDescription.trim() || undefined,
        });
        showMessage("success", "Account updated successfully!");
      }

      resetForm();
      setFormMode(null);
      setFocusArea("list");
      loadData();
    } catch (err) {
      showMessage("error", (err as Error).message);
    }
  };

  const handleDeleteRequest = () => {
    if (!selectedAccount) return;
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = () => {
    if (!selectedAccount) return;

    try {
      deleteAccount(selectedAccount.id);
      showMessage("success", "Account deleted successfully!");
      setShowDeleteConfirm(false);
      loadData();
      setSelectedIndex(Math.max(0, selectedIndex - 1));
    } catch (err) {
      showMessage("error", (err as Error).message);
      setShowDeleteConfirm(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
  };

  const handleToggleActive = () => {
    if (!selectedAccount) return;

    try {
      if (selectedAccount.is_active) {
        deactivateAccount(selectedAccount.id);
        showMessage("success", "Account deactivated");
      } else {
        activateAccount(selectedAccount.id);
        showMessage("success", "Account reactivated");
      }
      loadData();
    } catch (err) {
      showMessage("error", (err as Error).message);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.length >= 2) {
      const results = searchAccounts(query);
      setAccounts(results);
    } else {
      loadData();
    }
  };

  const getAccountColor = (type: Account["type"]): string => {
    switch (type) {
      case "asset": return theme.semantic.success;
      case "liability": return theme.semantic.error;
      case "equity": return theme.semantic.info;
      case "income": return theme.semantic.income;
      case "expense": return theme.semantic.expense;
      default: return theme.semantic.textPrimary;
    }
  };

  const formatBalance = (balance: number | undefined): string => {
    if (balance === undefined) return "$0.00";
    const formatted = Math.abs(balance).toFixed(2);
    return balance < 0 ? `-$${formatted}` : `$${formatted}`;
  };

  const toggleGroup = (groupKey: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupKey)) {
      newExpanded.delete(groupKey);
    } else {
      newExpanded.add(groupKey);
    }
    setExpandedGroups(newExpanded);
  };

  useInput((char, key) => {
    // Handle delete confirmation dialog
    if (showDeleteConfirm) {
      if (char === "y" || char === "Y") {
        handleDeleteConfirm();
      } else if (char === "n" || char === "N" || key.escape) {
        handleDeleteCancel();
      }
      return;
    }

    // Global shortcuts
    if (key.escape) {
      if (isSearching) {
        setIsSearching(false);
        setSearchQuery("");
        loadData();
        return;
      }
      if (formMode) {
        setFormMode(null);
        resetForm();
        setFocusArea("list");
        return;
      }
      return; // Let parent handle
    }

    if (char === "?" && focusArea === "list" && !formMode && !isSearching) {
      // TODO: Show help modal
      return;
    }

    // Search mode
    if (isSearching) {
      if (key.return) {
        setIsSearching(false);
        return;
      }
      if (key.backspace || key.delete) {
        const newQuery = searchQuery.slice(0, -1);
        handleSearch(newQuery);
        return;
      }
      if (char && !key.ctrl && !key.meta) {
        const newQuery = searchQuery + char;
        handleSearch(newQuery);
        return;
      }
      return;
    }

    if (formMode && focusArea === "form") {
      // Form input handling
      if (key.upArrow) {
        const idx = formFields.indexOf(activeField);
        if (idx > 0) setActiveField(formFields[idx - 1]);
        return;
      }
      if (key.downArrow) {
        const idx = formFields.indexOf(activeField);
        if (idx < formFields.length - 1) setActiveField(formFields[idx + 1]);
        return;
      }

      // Type field navigation
      if (activeField === "type") {
        if (key.leftArrow) {
          setFormTypeIndex(Math.max(0, formTypeIndex - 1));
          return;
        }
        if (key.rightArrow) {
          setFormTypeIndex(Math.min(accountTypes.length - 1, formTypeIndex + 1));
          return;
        }
      }

      // Submit form
      if (char === "s" && key.ctrl) {
        handleSubmitForm();
        return;
      }

      if (key.return) {
        const idx = formFields.indexOf(activeField);
        if (idx < formFields.length - 1) {
          setActiveField(formFields[idx + 1]);
        } else {
          handleSubmitForm();
        }
        return;
      }

      // Handle backspace for text fields
      if (key.backspace || key.delete) {
        switch (activeField) {
          case "code":
            setFormCode(prev => prev.slice(0, -1));
            break;
          case "name":
            setFormName(prev => prev.slice(0, -1));
            break;
          case "description":
            setFormDescription(prev => prev.slice(0, -1));
            break;
          case "balance":
            setFormBalance(prev => prev.slice(0, -1));
            break;
        }
        return;
      }

      // Handle character input
      if (char && !key.ctrl && !key.meta) {
        switch (activeField) {
          case "code":
            if (/\d/.test(char) && formCode.length < 4) {
              setFormCode(prev => prev + char);
            }
            break;
          case "name":
            setFormName(prev => prev + char);
            break;
          case "description":
            setFormDescription(prev => prev + char);
            break;
          case "balance":
            if (/[\d.-]/.test(char)) {
              setFormBalance(prev => prev + char);
            }
            break;
        }
      }
      return;
    }

    if (focusArea === "list" && !formMode) {
      // List navigation
      if (key.upArrow || char === "k") {
        setSelectedIndex(prev => {
          const newIndex = Math.max(0, prev - 1);
          if (accounts[newIndex]) {
            setSelectedAccount(accounts[newIndex]);
          }
          return newIndex;
        });
        return;
      }

      if (key.downArrow || char === "j") {
        setSelectedIndex(prev => {
          const newIndex = Math.min(accounts.length - 1, prev + 1);
          if (accounts[newIndex]) {
            setSelectedAccount(accounts[newIndex]);
          }
          return newIndex;
        });
        return;
      }

      // Expand/collapse groups
      if (key.return && selectedAccount) {
        const groupKey = Object.keys(groupedAccounts).find(key =>
          groupedAccounts[key].accounts.some((a: Account) => a.id === selectedAccount.id)
        );
        if (groupKey) {
          toggleGroup(groupKey);
        }
        return;
      }

      // Actions
      if (char === "n") {
        setFormMode("add");
        setFocusArea("form");
        resetForm();
        return;
      }

      if (char === "e" && selectedAccount) {
        setFormMode("edit");
        setFocusArea("form");
        setFormCode(selectedAccount.code);
        setFormName(selectedAccount.name);
        setFormTypeIndex(accountTypes.indexOf(selectedAccount.type));
        setFormParentId(selectedAccount.parent_id);
        setFormDescription(selectedAccount.description || "");
        setFormBalance("");
        return;
      }

      if (char === "d" && selectedAccount) {
        handleToggleActive();
        return;
      }

      if (char === "x" && key.ctrl && selectedAccount) {
        handleDeleteRequest();
        return;
      }

      if (char === "/") {
        setIsSearching(true);
        setSearchQuery("");
        return;
      }

      if (key.tab) {
        setFocusArea("form");
        return;
      }
    }

    if (focusArea === "form" && !formMode) {
      if (key.tab) {
        setFocusArea("list");
        return;
      }
    }
  });

  // Calculate total accounts and total assets
  const totalAccounts = accounts.length;
  const totalAssets = accounts
    .filter(a => a.type === "asset")
    .reduce((sum, a) => sum + (a.balance || 0), 0);
  const totalLiabilities = accounts
    .filter(a => a.type === "liability")
    .reduce((sum, a) => sum + (a.balance || 0), 0);

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Box flexDirection="row" height={height - 2}>
        {/* Left Panel - Account List */}
        <Box
          flexDirection="column"
          width={listWidth}
          height={height - 2}
          borderStyle={borderStyles.panel}
          borderColor={focusArea === "list" ? theme.semantic.focusBorder : theme.semantic.border}
          paddingX={1}
        >
          {/* Header */}
          <Box justifyContent="space-between" marginBottom={1}>
            <Text bold color={theme.semantic.warning}>◆ Chart of Accounts</Text>
            <Text color={theme.semantic.textMuted}>{totalAccounts} accounts</Text>
          </Box>

          {/* Divider */}
          <Text color={theme.semantic.border}>{"─".repeat(listWidth - 4)}</Text>

          {/* Hints */}
          <Box marginY={1}>
            <Text color={theme.semantic.textMuted}>
              {isSearching ? `Search: ${searchQuery}_` : "j/k ↕ • n new • e edit • / search"}
            </Text>
          </Box>

          {accounts.length === 0 ? (
            <Box marginTop={1}>
              <Text color={theme.semantic.textMuted}>{indicators.info} No accounts. Press 'n' to create.</Text>
            </Box>
          ) : (
            <Box flexDirection="column">
              {Object.entries(groupedAccounts).map(([groupKey, group]: [string, { label: string; type: Account["type"]; accounts: Account[] }]) => {
                const isExpanded = expandedGroups.has(groupKey);
                const groupAccounts = group.accounts;
                const groupColor = getAccountColor(group.type);

                return (
                  <Box key={groupKey} flexDirection="column">
                    <Box>
                      <Text bold color={groupColor}>
                        {isExpanded ? indicators.complete : indicators.pending} {typeIcons[group.type]} {groupKey} - {group.label}
                      </Text>
                    </Box>
                    {isExpanded && groupAccounts.map((account) => {
                      const isSelected = selectedAccount?.id === account.id;

                      if (isSelected) {
                        return (
                          <Box key={account.id}>
                            <Box backgroundColor={theme.semantic.focusBorder}>
                              <Text color={theme.base} bold>
                                {" ▶ "}{account.code} {account.name.slice(0, 16)}{" "}
                              </Text>
                            </Box>
                            <Text color={getAccountColor(account.type)}>
                              {" "}{formatBalance(account.balance)}
                            </Text>
                          </Box>
                        );
                      }

                      return (
                        <Box key={account.id}>
                          <Text color={theme.semantic.textSecondary}>
                            {"   "}{account.code} {account.name.slice(0, 16)}
                          </Text>
                          <Text color={getAccountColor(account.type)}>
                            {" "}{formatBalance(account.balance)}
                          </Text>
                        </Box>
                      );
                    })}
                  </Box>
                );
              })}
            </Box>
          )}

          <Box flexGrow={1} />

          {/* Footer Summary */}
          <Box
            flexDirection="column"
            borderStyle={borderStyles.input}
            borderColor={theme.semantic.border}
            paddingX={1}
            marginTop={1}
          >
            <Box justifyContent="space-between">
              <Text color={theme.semantic.textMuted}>Assets:</Text>
              <Text color={theme.semantic.success}>{formatBalance(totalAssets)}</Text>
            </Box>
            <Box justifyContent="space-between">
              <Text color={theme.semantic.textMuted}>Liabilities:</Text>
              <Text color={theme.semantic.error}>{formatBalance(totalLiabilities)}</Text>
            </Box>
          </Box>
        </Box>

        <Box width={1} />

        {/* Right Panel - Details or Form */}
        <Box
          flexDirection="column"
          width={detailWidth}
          height={height - 2}
          borderStyle={borderStyles.panel}
          borderColor={focusArea === "form" || formMode ? theme.semantic.focusBorder : theme.semantic.border}
          paddingX={1}
        >
          {formMode ? (
            // Account Form
            <>
              {/* Header */}
              <Box marginBottom={1}>
                <Text bold color={theme.semantic.info}>
                  {indicators.pointer} {formMode === "add" ? "Add Account" : "Edit Account"}
                </Text>
              </Box>

              {/* Divider */}
              <Text color={theme.semantic.border}>{"─".repeat(detailWidth - 4)}</Text>

              {/* Hints */}
              <Box marginY={1}>
                <Text color={theme.semantic.textMuted}>↑↓ fields • ^S save • Esc cancel</Text>
              </Box>

              {/* Code Field */}
              <Box flexDirection="column" marginBottom={1}>
                <Text color={activeField === "code" ? theme.semantic.info : theme.semantic.textMuted}>
                  {activeField === "code" ? indicators.pointer : indicators.bullet} Account Code:
                </Text>
                <Box
                  borderStyle={borderStyles.input}
                  borderColor={activeField === "code" ? theme.semantic.focusBorder : theme.semantic.border}
                  paddingX={1}
                  marginTop={1}
                >
                  <Text color={formCode ? theme.semantic.textPrimary : theme.semantic.textMuted}>
                    {formCode || "1000"}
                  </Text>
                  {activeField === "code" && focusArea === "form" && (
                    <Text backgroundColor={theme.semantic.focusBorder}> </Text>
                  )}
                </Box>
              </Box>

              {/* Name Field */}
              <Box flexDirection="column" marginBottom={1}>
                <Text color={activeField === "name" ? theme.semantic.info : theme.semantic.textMuted}>
                  {activeField === "name" ? indicators.pointer : indicators.bullet} Account Name:
                </Text>
                <Box
                  borderStyle={borderStyles.input}
                  borderColor={activeField === "name" ? theme.semantic.focusBorder : theme.semantic.border}
                  paddingX={1}
                  marginTop={1}
                >
                  <Text color={formName ? theme.semantic.textPrimary : theme.semantic.textMuted}>
                    {formName || "Enter name"}
                  </Text>
                  {activeField === "name" && focusArea === "form" && (
                    <Text backgroundColor={theme.semantic.focusBorder}> </Text>
                  )}
                </Box>
              </Box>

              {/* Type Field */}
              <Box flexDirection="column" marginBottom={1}>
                <Text color={activeField === "type" ? theme.semantic.info : theme.semantic.textMuted}>
                  {activeField === "type" ? indicators.pointer : indicators.bullet} Account Type:
                </Text>
                <Box marginTop={1}>
                  <Text color={theme.semantic.warning}>
                    {indicators.arrowLeft} {typeIcons[accountTypes[formTypeIndex]]} {accountTypes[formTypeIndex]} {indicators.arrowRight}
                  </Text>
                </Box>
              </Box>

              {/* Description Field */}
              <Box flexDirection="column" marginBottom={1}>
                <Text color={activeField === "description" ? theme.semantic.info : theme.semantic.textMuted}>
                  {activeField === "description" ? indicators.pointer : indicators.bullet} Description:
                </Text>
                <Box
                  borderStyle={borderStyles.input}
                  borderColor={activeField === "description" ? theme.semantic.focusBorder : theme.semantic.border}
                  paddingX={1}
                  marginTop={1}
                >
                  <Text color={formDescription ? theme.semantic.textPrimary : theme.semantic.textMuted}>
                    {formDescription || "(optional)"}
                  </Text>
                  {activeField === "description" && focusArea === "form" && (
                    <Text backgroundColor={theme.semantic.focusBorder}> </Text>
                  )}
                </Box>
              </Box>

              {formMode === "add" && (
                <Box flexDirection="column" marginBottom={1}>
                  <Text color={activeField === "balance" ? theme.semantic.info : theme.semantic.textMuted}>
                    {activeField === "balance" ? indicators.pointer : indicators.bullet} Opening Balance:
                  </Text>
                  <Box
                    borderStyle={borderStyles.input}
                    borderColor={activeField === "balance" ? theme.semantic.focusBorder : theme.semantic.border}
                    paddingX={1}
                    marginTop={1}
                  >
                    <Text color={formBalance ? theme.semantic.textPrimary : theme.semantic.textMuted}>
                      ${formBalance || "0.00"}
                    </Text>
                    {activeField === "balance" && focusArea === "form" && (
                      <Text backgroundColor={theme.semantic.focusBorder}> </Text>
                    )}
                  </Box>
                </Box>
              )}

              <Box flexGrow={1} />

              <Box>
                <Text color={theme.semantic.success}>[^S] Save</Text>
                <Text color={theme.semantic.textMuted}> • </Text>
                <Text color={theme.semantic.textMuted}>[Esc] Cancel</Text>
              </Box>
            </>
          ) : selectedAccount ? (
            // Account Details
            <>
              {/* Header */}
              <Box justifyContent="space-between" marginBottom={1}>
                <Text bold color={theme.semantic.info}>{indicators.pointer} Account Details</Text>
                <Text color={selectedAccount.is_active ? theme.semantic.success : theme.semantic.textMuted}>
                  {selectedAccount.is_active ? indicators.check : indicators.pending}
                </Text>
              </Box>

              {/* Divider */}
              <Text color={theme.semantic.border}>{"─".repeat(detailWidth - 4)}</Text>

              {/* Account Info */}
              <Box
                flexDirection="column"
                borderStyle={borderStyles.input}
                borderColor={theme.semantic.border}
                paddingX={1}
                marginTop={1}
              >
                <Box justifyContent="space-between">
                  <Text color={theme.semantic.warning}>Code:</Text>
                  <Text bold color={theme.semantic.textPrimary}>{selectedAccount.code}</Text>
                </Box>
                <Box justifyContent="space-between">
                  <Text color={theme.semantic.warning}>Name:</Text>
                  <Text bold color={theme.semantic.textPrimary}>{selectedAccount.name}</Text>
                </Box>
                <Box justifyContent="space-between">
                  <Text color={theme.semantic.warning}>Type:</Text>
                  <Text color={getAccountColor(selectedAccount.type)}>
                    {typeIcons[selectedAccount.type]} {selectedAccount.type}
                  </Text>
                </Box>
                <Box justifyContent="space-between">
                  <Text color={theme.semantic.warning}>Balance:</Text>
                  <Text bold color={getAccountColor(selectedAccount.type)}>
                    {formatBalance(selectedAccount.balance)}
                  </Text>
                </Box>
                <Box justifyContent="space-between">
                  <Text color={theme.semantic.warning}>Status:</Text>
                  <Text color={selectedAccount.is_active ? theme.semantic.success : theme.semantic.error}>
                    {selectedAccount.is_active ? `${indicators.check} Active` : `${indicators.cross} Inactive`}
                  </Text>
                </Box>
              </Box>

              {selectedAccount.description && (
                <Box flexDirection="column" marginTop={1}>
                  <Text color={theme.semantic.warning}>Description:</Text>
                  <Box
                    borderStyle={borderStyles.input}
                    borderColor={theme.semantic.border}
                    paddingX={1}
                    marginTop={1}
                  >
                    <Text color={theme.semantic.textMuted}>{selectedAccount.description}</Text>
                  </Box>
                </Box>
              )}

              <Box flexGrow={1} />

              {/* Actions */}
              <Box flexDirection="column">
                <Text bold color={theme.semantic.textSecondary}>{indicators.info} Actions</Text>
                <Box paddingLeft={1} flexDirection="column" marginTop={1}>
                  <Text color={theme.semantic.textMuted}>{indicators.bullet} [e] Edit account</Text>
                  <Text color={theme.semantic.textMuted}>
                    {indicators.bullet} [d] {selectedAccount.is_active ? "Deactivate" : "Activate"}
                  </Text>
                  <Text color={theme.semantic.textMuted}>{indicators.bullet} [^X] Delete</Text>
                </Box>
              </Box>
            </>
          ) : (
            <Box marginTop={1}>
              <Text color={theme.semantic.textMuted}>{indicators.info} Select an account to view details</Text>
            </Box>
          )}
        </Box>
      </Box>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && selectedAccount && (
        <Box
          paddingX={1}
          borderStyle={borderStyles.panel}
          borderColor={theme.semantic.error}
          flexDirection="column"
        >
          <Text bold color={theme.semantic.error}>{indicators.warning} Delete Account?</Text>
          <Text color={theme.semantic.textPrimary}>{selectedAccount.code} - {selectedAccount.name}</Text>
          <Box marginTop={1}>
            <Text color={theme.semantic.success}>[Y] Yes</Text>
            <Text> </Text>
            <Text color={theme.semantic.textMuted}>[N] No</Text>
          </Box>
        </Box>
      )}

      {/* Message Bar */}
      {message && !showDeleteConfirm && (
        <Box
          paddingX={1}
          borderStyle={borderStyles.input}
          borderColor={message.type === "success" ? theme.semantic.success : theme.semantic.error}
        >
          <Text color={message.type === "success" ? theme.semantic.success : theme.semantic.error}>
            {message.type === "success" ? indicators.check : indicators.cross} {message.text}
          </Text>
        </Box>
      )}
    </Box>
  );
}
