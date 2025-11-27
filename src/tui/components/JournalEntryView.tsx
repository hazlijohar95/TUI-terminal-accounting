import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { getEnhancedTheme } from "../design/theme.js";
import { indicators, borderStyles } from "../design/tokens.js";
import {
  listJournalEntries,
  getJournalEntry,
  createJournalEntry,
  updateJournalEntry,
  deleteJournalEntry,
  reverseJournalEntry,
  validateBalance,
  type JournalEntry,
  type CreateJournalEntryData,
  type CreateJournalLineData,
} from "../../domain/journal.js";
import { listAccounts, type Account } from "../../domain/accounts.js";

interface JournalEntryViewProps {
  width: number;
  height: number;
}

type FocusArea = "list" | "form";
type FormMode = "add" | "edit" | "view" | null;
type FormField = "date" | "description" | "reference" | "lines";
type LineField = "account" | "debit" | "credit" | "description";

export function JournalEntryView({ width, height }: JournalEntryViewProps) {
  const theme = getEnhancedTheme();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [focusArea, setFocusArea] = useState<FocusArea>("list");
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form state
  const [activeField, setActiveField] = useState<FormField>("date");
  const [activeLine, setActiveLine] = useState(0);
  const [activeLineField, setActiveLineField] = useState<LineField>("account");
  const [formDate, setFormDate] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formReference, setFormReference] = useState("");
  const [formLines, setFormLines] = useState<Array<{
    accountId: number | null;
    accountDisplay: string;
    debit: string;
    credit: string;
    description: string;
  }>>([
    { accountId: null, accountDisplay: "", debit: "0", credit: "0", description: "" },
    { accountId: null, accountDisplay: "", debit: "0", credit: "0", description: "" },
  ]);

  // Account search for line items
  const [accountSearchQuery, setAccountSearchQuery] = useState("");

  const listWidth = Math.floor(width * 0.60);
  const detailWidth = width - listWidth - 3;

  const loadData = () => {
    try {
      const allEntries = listJournalEntries();
      const filteredEntries = searchQuery
        ? allEntries.filter(
            (e) =>
              e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
              (e.reference && e.reference.toLowerCase().includes(searchQuery.toLowerCase()))
          )
        : allEntries;

      setEntries(filteredEntries);
      setAccounts(listAccounts({ is_active: true }));

      if (selectedEntry && formMode !== "add") {
        const updated = getJournalEntry(selectedEntry.id);
        setSelectedEntry(updated);
      } else if (filteredEntries.length > 0 && selectedIndex < filteredEntries.length) {
        setSelectedEntry(filteredEntries[selectedIndex]);
      }
    } catch (err) {
      showMessage("error", `Failed to load entries: ${(err as Error).message}`);
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
    const today = new Date().toISOString().split("T")[0];
    setFormDate(today);
    setFormDescription("");
    setFormReference("");
    setFormLines([
      { accountId: null, accountDisplay: "", debit: "0", credit: "0", description: "" },
      { accountId: null, accountDisplay: "", debit: "0", credit: "0", description: "" },
    ]);
    setActiveLine(0);
    setActiveField("date");
    setActiveLineField("account");
    setAccountSearchQuery("");
  };

  const loadEntryIntoForm = (entry: JournalEntry) => {
    setFormDate(entry.date);
    setFormDescription(entry.description);
    setFormReference(entry.reference || "");
    setFormLines(
      entry.lines.map((line) => ({
        accountId: line.account_id,
        accountDisplay: `${line.account?.code} - ${line.account?.name}`,
        debit: line.debit.toString(),
        credit: line.credit.toString(),
        description: line.description || "",
      }))
    );
  };

  const handleSubmitForm = () => {
    try {
      if (!formDate.trim()) {
        showMessage("error", "Date is required");
        return;
      }
      if (!formDescription.trim()) {
        showMessage("error", "Description is required");
        return;
      }

      // Convert form lines to journal lines
      const lines: CreateJournalLineData[] = formLines
        .filter((line) => line.accountId !== null && (parseFloat(line.debit) > 0 || parseFloat(line.credit) > 0))
        .map((line) => ({
          account_id: line.accountId!,
          debit: parseFloat(line.debit) || 0,
          credit: parseFloat(line.credit) || 0,
          description: line.description || null,
        }));

      if (lines.length < 2) {
        showMessage("error", "At least 2 lines required for double-entry");
        return;
      }

      // Validate balance
      if (!validateBalance(lines)) {
        const totalDebits = lines.reduce((sum, line) => sum + line.debit, 0);
        const totalCredits = lines.reduce((sum, line) => sum + line.credit, 0);
        showMessage(
          "error",
          `Entry not balanced! Debits: $${totalDebits.toFixed(2)}, Credits: $${totalCredits.toFixed(2)}`
        );
        return;
      }

      const data: CreateJournalEntryData = {
        date: formDate,
        description: formDescription,
        reference: formReference || null,
        lines,
      };

      if (formMode === "add") {
        createJournalEntry(data);
        showMessage("success", "Journal entry created successfully");
      } else if (formMode === "edit" && selectedEntry) {
        updateJournalEntry(selectedEntry.id, data);
        showMessage("success", "Journal entry updated successfully");
      }

      setFormMode(null);
      setFocusArea("list");
      resetForm();
      loadData();
    } catch (err) {
      showMessage("error", (err as Error).message);
    }
  };

  const handleDelete = () => {
    if (!selectedEntry) return;
    try {
      deleteJournalEntry(selectedEntry.id);
      showMessage("success", "Journal entry deleted");
      loadData();
      setFormMode(null);
    } catch (err) {
      showMessage("error", (err as Error).message);
    }
  };

  const handleReverse = () => {
    if (!selectedEntry) return;
    try {
      reverseJournalEntry(selectedEntry.id);
      showMessage("success", "Reversing entry created");
      loadData();
      setFormMode(null);
    } catch (err) {
      showMessage("error", (err as Error).message);
    }
  };

  const addLine = () => {
    setFormLines([
      ...formLines,
      { accountId: null, accountDisplay: "", debit: "0", credit: "0", description: "" },
    ]);
    setActiveLine(formLines.length);
  };

  const removeLine = (index: number) => {
    if (formLines.length <= 2) {
      showMessage("error", "Must have at least 2 lines");
      return;
    }
    const newLines = formLines.filter((_, i) => i !== index);
    setFormLines(newLines);
    if (activeLine >= newLines.length) {
      setActiveLine(newLines.length - 1);
    }
  };

  const calculateTotals = () => {
    const totalDebits = formLines.reduce((sum, line) => sum + (parseFloat(line.debit) || 0), 0);
    const totalCredits = formLines.reduce((sum, line) => sum + (parseFloat(line.credit) || 0), 0);
    const difference = Math.abs(totalDebits - totalCredits);
    return { totalDebits, totalCredits, difference, isBalanced: difference < 0.01 };
  };

  useInput((char, key) => {
    // Global shortcuts
    if (key.escape) {
      if (formMode) {
        setFormMode(null);
        setFocusArea("list");
        resetForm();
      }
      return;
    }

    // Search mode
    if (isSearching) {
      if (key.return) {
        setIsSearching(false);
        loadData();
        return;
      }
      if (key.backspace || key.delete) {
        setSearchQuery((prev) => prev.slice(0, -1));
        return;
      }
      if (char && !key.ctrl && !key.meta) {
        setSearchQuery((prev) => prev + char);
      }
      return;
    }

    // List view shortcuts
    if (focusArea === "list" && !formMode) {
      if (char === "/") {
        setIsSearching(true);
        setSearchQuery("");
        return;
      }
      if (char === "n") {
        setFormMode("add");
        setFocusArea("form");
        resetForm();
        return;
      }
      if (char === "v" && selectedEntry) {
        setFormMode("view");
        setFocusArea("form");
        loadEntryIntoForm(selectedEntry);
        return;
      }
      if (char === "e" && selectedEntry && !selectedEntry.is_locked) {
        setFormMode("edit");
        setFocusArea("form");
        loadEntryIntoForm(selectedEntry);
        return;
      }
      if (char === "r" && selectedEntry) {
        handleReverse();
        return;
      }
      if (key.upArrow || char === "k") {
        setSelectedIndex((prev) => {
          const newIndex = Math.max(0, prev - 1);
          if (entries[newIndex]) setSelectedEntry(entries[newIndex]);
          return newIndex;
        });
        return;
      }
      if (key.downArrow || char === "j") {
        setSelectedIndex((prev) => {
          const newIndex = Math.min(entries.length - 1, prev + 1);
          if (entries[newIndex]) setSelectedEntry(entries[newIndex]);
          return newIndex;
        });
        return;
      }
    }

    // Form shortcuts
    if (formMode && formMode !== "view") {
      if (key.tab) {
        // Cycle through fields
        if (activeField === "lines") {
          // In lines, tab cycles through line fields
          const lineFields: LineField[] = ["account", "debit", "credit", "description"];
          const currentIdx = lineFields.indexOf(activeLineField);
          const nextIdx = (currentIdx + 1) % lineFields.length;
          setActiveLineField(lineFields[nextIdx]);
        }
        return;
      }

      // Navigate between fields
      if (key.downArrow && activeField !== "lines") {
        const fields: FormField[] = ["date", "description", "reference", "lines"];
        const currentIdx = fields.indexOf(activeField);
        if (currentIdx < fields.length - 1) {
          setActiveField(fields[currentIdx + 1]);
        }
        return;
      }
      if (key.upArrow && activeField !== "date") {
        const fields: FormField[] = ["date", "description", "reference", "lines"];
        const currentIdx = fields.indexOf(activeField);
        if (currentIdx > 0) {
          setActiveField(fields[currentIdx - 1]);
        }
        return;
      }

      // Line navigation
      if (activeField === "lines") {
        if (char === "j" && activeLine < formLines.length - 1) {
          setActiveLine((prev) => prev + 1);
          return;
        }
        if (char === "k" && activeLine > 0) {
          setActiveLine((prev) => prev - 1);
          return;
        }
        if (char === "a") {
          addLine();
          return;
        }
        if (char === "x") {
          removeLine(activeLine);
          return;
        }
      }

      // Save
      if (key.ctrl && char === "s") {
        handleSubmitForm();
        return;
      }

      // Handle text input for active field
      if (char && !key.ctrl && !key.meta) {
        if (activeField === "date") {
          if (char.match(/[0-9-]/)) setFormDate((prev) => prev + char);
        } else if (activeField === "description") {
          setFormDescription((prev) => prev + char);
        } else if (activeField === "reference") {
          setFormReference((prev) => prev + char);
        } else if (activeField === "lines") {
          const currentLine = formLines[activeLine];
          if (activeLineField === "account") {
            setAccountSearchQuery((prev) => prev + char);
          } else if (activeLineField === "debit") {
            if (char.match(/[0-9.]/)) {
              const newLines = [...formLines];
              newLines[activeLine].debit = currentLine.debit + char;
              newLines[activeLine].credit = "0"; // Clear credit
              setFormLines(newLines);
            }
          } else if (activeLineField === "credit") {
            if (char.match(/[0-9.]/)) {
              const newLines = [...formLines];
              newLines[activeLine].credit = currentLine.credit + char;
              newLines[activeLine].debit = "0"; // Clear debit
              setFormLines(newLines);
            }
          } else if (activeLineField === "description") {
            const newLines = [...formLines];
            newLines[activeLine].description = currentLine.description + char;
            setFormLines(newLines);
          }
        }
      }

      // Handle backspace
      if (key.backspace || key.delete) {
        if (activeField === "date") {
          setFormDate((prev) => prev.slice(0, -1));
        } else if (activeField === "description") {
          setFormDescription((prev) => prev.slice(0, -1));
        } else if (activeField === "reference") {
          setFormReference((prev) => prev.slice(0, -1));
        } else if (activeField === "lines") {
          if (activeLineField === "account") {
            setAccountSearchQuery((prev) => prev.slice(0, -1));
          } else if (activeLineField === "debit") {
            const newLines = [...formLines];
            newLines[activeLine].debit = newLines[activeLine].debit.slice(0, -1) || "0";
            setFormLines(newLines);
          } else if (activeLineField === "credit") {
            const newLines = [...formLines];
            newLines[activeLine].credit = newLines[activeLine].credit.slice(0, -1) || "0";
            setFormLines(newLines);
          } else if (activeLineField === "description") {
            const newLines = [...formLines];
            newLines[activeLine].description = newLines[activeLine].description.slice(0, -1);
            setFormLines(newLines);
          }
        }
      }

      // Select account from search
      if (activeField === "lines" && activeLineField === "account" && key.return) {
        const matchingAccounts = accounts.filter(
          (a) =>
            a.code.includes(accountSearchQuery) ||
            a.name.toLowerCase().includes(accountSearchQuery.toLowerCase())
        );
        if (matchingAccounts.length > 0) {
          const account = matchingAccounts[0];
          const newLines = [...formLines];
          newLines[activeLine].accountId = account.id;
          newLines[activeLine].accountDisplay = `${account.code} - ${account.name}`;
          setFormLines(newLines);
          setAccountSearchQuery("");
          setActiveLineField("debit"); // Move to debit field
        }
      }
    }
  });

  const formatBalance = (balance: number | undefined): string => {
    if (balance === undefined) return "$0.00";
    return balance < 0 ? `($${Math.abs(balance).toFixed(2)})` : `$${balance.toFixed(2)}`;
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const getEntryTypeColor = (type: string): string => {
    switch (type) {
      case "standard":
        return theme.semantic.textPrimary;
      case "adjusting":
        return theme.semantic.warning;
      case "closing":
        return theme.semantic.expense;
      case "reversing":
        return theme.semantic.info;
      default:
        return theme.semantic.textPrimary;
    }
  };

  const totals = calculateTotals();

  return (
    <Box flexDirection="column" width={width} height={height} paddingX={1}>
      {/* Header */}
      <Box justifyContent="space-between" marginBottom={1} marginTop={1}>
        <Box>
          <Text bold color={theme.semantic.warning}>
            ◨ Journal Entries
          </Text>
          <Text color={theme.semantic.textMuted}> {entries.length} entries</Text>
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
        <Text color={theme.semantic.textMuted}>n:new • v:view • e:edit • r:reverse • /:search • Tab:panel</Text>
      </Box>

      {/* Main panels */}
      <Box height={height - 8}>
        {/* Left panel - List */}
        <Box
          width={listWidth}
          height="100%"
          flexDirection="column"
          borderStyle={borderStyles.panel}
          borderColor={focusArea === "list" ? theme.semantic.focusBorder : theme.semantic.border}
          paddingX={1}
        >
          <Box justifyContent="space-between">
            <Text bold color={theme.semantic.info}>{indicators.pointer} Entries</Text>
            {isSearching && (
              <Text color={theme.semantic.warning}>
                Search: {searchQuery}
                <Text backgroundColor={theme.semantic.focusBorder}> </Text>
              </Text>
            )}
          </Box>
          <Box height={1} />

          <Box flexDirection="column" flexGrow={1}>
            {entries.length === 0 ? (
              <Text color={theme.semantic.textMuted}>
                {indicators.info} No journal entries. Press n to create your first entry.
              </Text>
            ) : (
              entries.slice(0, height - 12).map((entry, index) => {
                const isSelected = index === selectedIndex;
                if (isSelected) {
                  return (
                    <Box key={entry.id} flexDirection="column" marginBottom={1}>
                      <Box>
                        <Box backgroundColor={theme.semantic.focusBorder}>
                          <Text color={theme.base} bold>
                            {" ▶ "}{formatDate(entry.date)} • {entry.description.slice(0, 25)}
                            {entry.is_locked ? " 🔒" : ""}
                          </Text>
                        </Box>
                      </Box>
                      <Box paddingLeft={4}>
                        <Text color={theme.semantic.textMuted}>
                          {entry.reference || "No ref"} • Dr: {formatBalance(entry.total_debits)} Cr:{" "}
                          {formatBalance(entry.total_credits)}
                        </Text>
                      </Box>
                    </Box>
                  );
                }
                return (
                  <Box key={entry.id} marginBottom={1}>
                    <Text color={getEntryTypeColor(entry.entry_type)}>
                      {"   "}{formatDate(entry.date)} • {entry.description.slice(0, 28)}
                    </Text>
                  </Box>
                );
              })
            )}
          </Box>
        </Box>

        <Box width={1} />

        {/* Right panel - Form or Details */}
        <Box
          width={detailWidth}
          height="100%"
          flexDirection="column"
          borderStyle={borderStyles.panel}
          borderColor={focusArea === "form" ? theme.semantic.focusBorder : theme.semantic.border}
          paddingX={1}
        >
          {formMode === null ? (
            // No form - show help
            <Box flexDirection="column">
              <Text bold color={theme.semantic.warning}>
                {indicators.pointer} Actions
              </Text>
              <Box height={1} />
              <Text>
                <Text bold color={theme.semantic.success}>n</Text>{" "}
                <Text color={theme.semantic.textSecondary}>New entry</Text>
              </Text>
              <Text>
                <Text bold color={theme.semantic.success}>v</Text>{" "}
                <Text color={theme.semantic.textSecondary}>View selected</Text>
              </Text>
              <Text>
                <Text bold color={theme.semantic.success}>e</Text>{" "}
                <Text color={theme.semantic.textSecondary}>Edit selected</Text>
              </Text>
              <Text>
                <Text bold color={theme.semantic.success}>r</Text>{" "}
                <Text color={theme.semantic.textSecondary}>Reverse selected</Text>
              </Text>
              <Text>
                <Text bold color={theme.semantic.success}>/</Text>{" "}
                <Text color={theme.semantic.textSecondary}>Search</Text>
              </Text>
              <Box height={1} />
              <Text color={theme.semantic.textMuted}>{indicators.info} Select an entry to view details</Text>
            </Box>
          ) : formMode === "view" && selectedEntry ? (
            // View mode
            <Box flexDirection="column">
              <Text bold color={theme.semantic.warning}>
                {indicators.pointer} Entry #{selectedEntry.id}
              </Text>
              <Box height={1} />
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
                  <Text color={theme.semantic.textMuted}>Reference:</Text>
                  <Text color={theme.semantic.textPrimary}>{selectedEntry.reference}</Text>
                </Box>
              )}
              <Box justifyContent="space-between">
                <Text color={theme.semantic.textMuted}>Type:</Text>
                <Text color={theme.semantic.textPrimary}>{selectedEntry.entry_type}</Text>
              </Box>
              <Box height={1} />
              <Text bold color={theme.semantic.info}>Lines:</Text>
              {selectedEntry.lines.slice(0, 5).map((line, idx) => (
                <Box key={idx} flexDirection="column" marginBottom={1}>
                  <Text color={theme.semantic.textSecondary}>
                    {line.account?.code} - {line.account?.name?.slice(0, 12)}
                  </Text>
                  <Box paddingLeft={2}>
                    <Text color={line.debit > 0 ? theme.semantic.success : theme.semantic.error}>
                      {line.debit > 0 ? `Dr: ${formatBalance(line.debit)}` : `Cr: ${formatBalance(line.credit)}`}
                    </Text>
                    {line.description && <Text color={theme.semantic.textMuted}> • {line.description}</Text>}
                  </Box>
                </Box>
              ))}
              <Box flexGrow={1} />
              <Box borderStyle={borderStyles.input} borderColor={theme.semantic.border} paddingX={1} flexDirection="column">
                <Box justifyContent="space-between">
                  <Text color={theme.semantic.textMuted}>Debits:</Text>
                  <Text bold color={theme.semantic.success}>{formatBalance(selectedEntry.total_debits)}</Text>
                </Box>
                <Box justifyContent="space-between">
                  <Text color={theme.semantic.textMuted}>Credits:</Text>
                  <Text bold color={theme.semantic.error}>{formatBalance(selectedEntry.total_credits)}</Text>
                </Box>
              </Box>
            </Box>
          ) : (
            // Add/Edit form
            <Box flexDirection="column">
              <Text bold color={theme.semantic.warning}>
                {indicators.pointer} {formMode === "add" ? "New Entry" : "Edit Entry"}
              </Text>
              <Box height={1} />

              {/* Date field */}
              <Box>
                <Text color={activeField === "date" ? theme.semantic.focusBorder : theme.semantic.textMuted}>Date: </Text>
                <Box borderStyle={activeField === "date" ? borderStyles.input : undefined} borderColor={theme.semantic.focusBorder} paddingX={activeField === "date" ? 1 : 0}>
                  <Text color={activeField === "date" ? theme.semantic.textPrimary : theme.semantic.textSecondary}>
                    {formDate}
                    {activeField === "date" && <Text backgroundColor={theme.semantic.focusBorder}> </Text>}
                  </Text>
                </Box>
              </Box>

              {/* Description field */}
              <Box>
                <Text color={activeField === "description" ? theme.semantic.focusBorder : theme.semantic.textMuted}>Desc: </Text>
                <Box borderStyle={activeField === "description" ? borderStyles.input : undefined} borderColor={theme.semantic.focusBorder} paddingX={activeField === "description" ? 1 : 0}>
                  <Text color={activeField === "description" ? theme.semantic.textPrimary : theme.semantic.textSecondary}>
                    {formDescription || "(required)"}
                    {activeField === "description" && <Text backgroundColor={theme.semantic.focusBorder}> </Text>}
                  </Text>
                </Box>
              </Box>

              {/* Reference field */}
              <Box>
                <Text color={activeField === "reference" ? theme.semantic.focusBorder : theme.semantic.textMuted}>Ref: </Text>
                <Box borderStyle={activeField === "reference" ? borderStyles.input : undefined} borderColor={theme.semantic.focusBorder} paddingX={activeField === "reference" ? 1 : 0}>
                  <Text color={activeField === "reference" ? theme.semantic.textPrimary : theme.semantic.textSecondary}>
                    {formReference || "(optional)"}
                    {activeField === "reference" && <Text backgroundColor={theme.semantic.focusBorder}> </Text>}
                  </Text>
                </Box>
              </Box>

              <Box height={1} />

              {/* Lines */}
              <Text bold color={theme.semantic.info}>
                Lines: {activeField === "lines" && <Text color={theme.semantic.textMuted}>(a:add, x:remove)</Text>}
              </Text>

              <Box flexDirection="column" flexGrow={1}>
                {formLines.map((line, idx) => {
                  const isActiveLine = activeField === "lines" && idx === activeLine;
                  return (
                    <Box key={idx} flexDirection="column" marginBottom={1}>
                      <Box>
                        <Text color={isActiveLine ? theme.semantic.focusBorder : theme.semantic.textMuted}>
                          {idx + 1}.{" "}
                        </Text>
                        <Text
                          backgroundColor={isActiveLine && activeLineField === "account" ? theme.semantic.focusBorder : undefined}
                          color={isActiveLine && activeLineField === "account" ? theme.base : theme.semantic.textPrimary}
                        >
                          {line.accountDisplay || accountSearchQuery || "(search)"}
                        </Text>
                      </Box>
                      <Box paddingLeft={3}>
                        <Text color={theme.semantic.textMuted}>Dr: </Text>
                        <Text
                          backgroundColor={isActiveLine && activeLineField === "debit" ? theme.semantic.focusBorder : undefined}
                          color={
                            isActiveLine && activeLineField === "debit"
                              ? theme.base
                              : parseFloat(line.debit) > 0
                              ? theme.semantic.success
                              : theme.semantic.textMuted
                          }
                        >
                          ${line.debit}
                        </Text>
                        <Text color={theme.semantic.textMuted}> Cr: </Text>
                        <Text
                          backgroundColor={isActiveLine && activeLineField === "credit" ? theme.semantic.focusBorder : undefined}
                          color={
                            isActiveLine && activeLineField === "credit"
                              ? theme.base
                              : parseFloat(line.credit) > 0
                              ? theme.semantic.error
                              : theme.semantic.textMuted
                          }
                        >
                          ${line.credit}
                        </Text>
                      </Box>
                      {line.description && (
                        <Box paddingLeft={3}>
                          <Text color={theme.semantic.textMuted}>{line.description}</Text>
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Box>

              {/* Totals */}
              <Box borderStyle={borderStyles.input} borderColor={theme.semantic.border} paddingX={1} flexDirection="column">
                <Box justifyContent="space-between">
                  <Text color={theme.semantic.textMuted}>Debits:</Text>
                  <Text bold color={theme.semantic.success}>${totals.totalDebits.toFixed(2)}</Text>
                </Box>
                <Box justifyContent="space-between">
                  <Text color={theme.semantic.textMuted}>Credits:</Text>
                  <Text bold color={theme.semantic.error}>${totals.totalCredits.toFixed(2)}</Text>
                </Box>
                <Box justifyContent="space-between">
                  <Text color={theme.semantic.textMuted}>Diff:</Text>
                  <Text bold color={totals.isBalanced ? theme.semantic.success : theme.semantic.error}>
                    ${totals.difference.toFixed(2)} {totals.isBalanced ? indicators.check : indicators.cross}
                  </Text>
                </Box>
              </Box>

              <Box marginTop={1}>
                <Text color={theme.semantic.textMuted}>Ctrl+S save • Esc cancel</Text>
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
