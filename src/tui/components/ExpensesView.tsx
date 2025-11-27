/**
 * ExpensesView Component
 *
 * Visually rich expense management with sparklines, category charts,
 * and btop/lazygit-inspired data visualization.
 */

import React, { useState, useEffect, useMemo } from "react";
import { Box, Text, useInput } from "ink";
import { listExpenses, createExpense, getExpenseCategories, type ExpenseWithDetails } from "../../domain/expenses.js";
import { listVendors, createVendor, type Vendor, type VendorWithBalance } from "../../domain/vendors.js";
import { listAccounts, type Account } from "../../domain/accounts.js";
import { getDocumentsForExpense, getUnlinkedDocuments, linkDocumentToExpense } from "../../domain/documents.js";
import { getEnhancedTheme } from "../design/theme.js";
import { formatCurrency, formatDate, getLocaleConfig } from "../../core/localization.js";
import { indicators, borderStyles } from "../design/tokens.js";
import { useBlinkingCursor } from "../animations.js";
import { Sparkline, HorizontalBarChart } from "./ui/index.js";

interface ExpensesViewProps {
  width: number;
  height: number;
}

type FocusArea = "list" | "form" | "attach";
type FormField = "date" | "vendor" | "category" | "amount" | "description" | "reference" | "notes" | "recurring" | "document";
type RecurringType = "none" | "weekly" | "monthly" | "yearly";
const RECURRING_OPTIONS: { value: RecurringType; label: string }[] = [
  { value: "none", label: "None" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

export function ExpensesView({ width, height }: ExpensesViewProps) {
  const theme = getEnhancedTheme();
  const cursorVisible = useBlinkingCursor(500);
  const [expenses, setExpenses] = useState<ExpenseWithDetails[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [focusArea, setFocusArea] = useState<FocusArea>("list");
  const [activeField, setActiveField] = useState<FormField>("date");

  // Form state
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [vendor, setVendor] = useState("");
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [recurringIndex, setRecurringIndex] = useState(0); // Index into RECURRING_OPTIONS
  const [formMessage, setFormMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Document attachment
  const [unlinkedDocs, setUnlinkedDocs] = useState<any[]>([]);
  const [docIndex, setDocIndex] = useState(-1); // -1 = None

  const formFields: FormField[] = ["date", "vendor", "category", "amount", "description", "reference", "notes", "recurring", "document"];
  const listWidth = Math.floor(width * 0.45);
  const formWidth = width - listWidth - 3;

  // Visual data calculations
  const sparklineData = useMemo(() => {
    return expenses.slice(0, 12).map((e) => e.amount).reverse();
  }, [expenses]);

  const categoryBreakdown = useMemo(() => {
    const byCategory: Record<string, number> = {};
    expenses.forEach((exp) => {
      const cat = exp.category || "Other";
      byCategory[cat] = (byCategory[cat] || 0) + exp.amount;
    });
    return Object.entries(byCategory)
      .map(([label, value]) => ({ label: label.slice(0, 10), value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [expenses]);

  const loadData = () => {
    setExpenses(listExpenses({ limit: 100 }));
    const cats = getExpenseCategories();
    setCategories(cats);
    setUnlinkedDocs(getUnlinkedDocuments());
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setDate(new Date().toISOString().split("T")[0]);
    setVendor("");
    setCategoryIndex(0);
    setAmount("");
    setDescription("");
    setReference("");
    setNotes("");
    setRecurringIndex(0);
    setDocIndex(-1);
  };

  const handleSubmit = () => {
    // Validate
    if (!amount.trim() || isNaN(parseFloat(amount))) {
      setFormMessage({ type: "error", text: "Valid amount required" });
      return;
    }

    if (categories.length === 0) {
      setFormMessage({ type: "error", text: "No expense categories found" });
      return;
    }

    try {
      // Find or create vendor if provided
      let vendorId: number | undefined;
      if (vendor.trim()) {
        const vendors = listVendors();
        let existingVendor: VendorWithBalance | Vendor | undefined = vendors.find(
          (v) => v.name.toLowerCase() === vendor.trim().toLowerCase()
        );

        if (!existingVendor) {
          existingVendor = createVendor({ name: vendor.trim() });
        }
        vendorId = existingVendor.id;
      }

      // Create expense
      const isRecurring = RECURRING_OPTIONS[recurringIndex].value !== "none";
      const expense = createExpense({
        date: date,
        vendor_id: vendorId,
        account_id: categories[categoryIndex].id,
        amount: parseFloat(amount),
        description: description || undefined,
        reference: reference || undefined,
        notes: isRecurring ? `${notes ? notes + " | " : ""}Recurring: ${RECURRING_OPTIONS[recurringIndex].label}` : (notes || undefined),
        is_recurring: isRecurring,
      });

      // Link document if selected
      if (docIndex >= 0 && unlinkedDocs[docIndex]) {
        linkDocumentToExpense(unlinkedDocs[docIndex].id, expense.id);
      }

      setFormMessage({ type: "success", text: "Expense recorded!" });
      resetForm();
      loadData();

      setTimeout(() => setFormMessage(null), 2000);
    } catch (err) {
      setFormMessage({ type: "error", text: (err as Error).message });
    }
  };

  useInput((input, key) => {
    // Tab to switch between list and form
    if (key.tab) {
      setFocusArea((prev) => (prev === "list" ? "form" : "list"));
      return;
    }

    if (focusArea === "list") {
      // List navigation
      if (key.upArrow || input === "k") {
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      }
      if (key.downArrow || input === "j") {
        setSelectedIndex((prev) => Math.min(expenses.length - 1, prev + 1));
      }
      if (input === "n" || key.return) {
        setFocusArea("form");
        setActiveField("date");
      }
      // Quick attach document
      if (input === "a" && expenses.length > 0 && unlinkedDocs.length > 0) {
        setFocusArea("attach");
        setDocIndex(0);
      }
    } else if (focusArea === "attach") {
      // Attach mode - select document to link
      if (key.escape) {
        setFocusArea("list");
        return;
      }
      if (key.leftArrow || input === "h") {
        setDocIndex((prev) => Math.max(0, prev - 1));
        return;
      }
      if (key.rightArrow || input === "l") {
        setDocIndex((prev) => Math.min(unlinkedDocs.length - 1, prev + 1));
        return;
      }
      if (key.return && docIndex >= 0) {
        // Link selected document to selected expense
        linkDocumentToExpense(unlinkedDocs[docIndex].id, expenses[selectedIndex].id);
        setFormMessage({ type: "success", text: "Document attached!" });
        loadData();
        setFocusArea("list");
        setTimeout(() => setFormMessage(null), 2000);
        return;
      }
    } else {
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

      // Category selection with left/right arrows
      if (activeField === "category") {
        if (key.leftArrow) {
          setCategoryIndex((prev) => Math.max(0, prev - 1));
          return;
        }
        if (key.rightArrow) {
          setCategoryIndex((prev) => Math.min(categories.length - 1, prev + 1));
          return;
        }
      }

      // Recurring selection with left/right arrows
      if (activeField === "recurring") {
        if (key.leftArrow) {
          setRecurringIndex((prev) => Math.max(0, prev - 1));
          return;
        }
        if (key.rightArrow) {
          setRecurringIndex((prev) => Math.min(RECURRING_OPTIONS.length - 1, prev + 1));
          return;
        }
      }

      // Document selection with left/right arrows
      if (activeField === "document") {
        if (key.leftArrow) {
          setDocIndex((prev) => Math.max(-1, prev - 1));
          return;
        }
        if (key.rightArrow) {
          setDocIndex((prev) => Math.min(unlinkedDocs.length - 1, prev + 1));
          return;
        }
      }

      // Ctrl+S to submit
      if (input === "s" && key.ctrl) {
        handleSubmit();
        return;
      }

      if (key.return) {
        const idx = formFields.indexOf(activeField);
        if (idx < formFields.length - 1) {
          setActiveField(formFields[idx + 1]);
        } else {
          handleSubmit();
        }
        return;
      }

      if (key.backspace || key.delete) {
        switch (activeField) {
          case "date":
            setDate((prev) => prev.slice(0, -1));
            break;
          case "vendor":
            setVendor((prev) => prev.slice(0, -1));
            break;
          case "amount":
            setAmount((prev) => prev.slice(0, -1));
            break;
          case "description":
            setDescription((prev) => prev.slice(0, -1));
            break;
          case "reference":
            setReference((prev) => prev.slice(0, -1));
            break;
          case "notes":
            setNotes((prev) => prev.slice(0, -1));
            break;
        }
        return;
      }

      // Regular character input
      if (input && !key.ctrl && !key.meta && !key.escape) {
        switch (activeField) {
          case "date":
            if (/[\d-]/.test(input)) {
              setDate((prev) => prev + input);
            }
            break;
          case "vendor":
            setVendor((prev) => prev + input);
            break;
          case "amount":
            if (/[\d.]/.test(input)) {
              setAmount((prev) => prev + input);
            }
            break;
          case "description":
            setDescription((prev) => prev + input);
            break;
          case "reference":
            setReference((prev) => prev + input);
            break;
          case "notes":
            setNotes((prev) => prev + input);
            break;
        }
      }
    }
  });

  // Calculate totals
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const thisMonthExpenses = expenses.filter((e) => {
    const expDate = new Date(e.date);
    const now = new Date();
    return expDate.getMonth() === now.getMonth() && expDate.getFullYear() === now.getFullYear();
  });
  const thisMonthTotal = thisMonthExpenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <Box flexDirection="row" width={width} height={height}>
      {/* Left Panel - Expenses List */}
      <Box
        flexDirection="column"
        width={listWidth}
        height={height}
        borderStyle={borderStyles.panel}
        borderColor={focusArea === "list" ? theme.semantic.focusBorder : theme.semantic.border}
        paddingX={1}
      >
        {/* Header with stats */}
        <Box justifyContent="space-between" marginBottom={1}>
          <Text bold color={theme.semantic.expense}>◆ Expenses</Text>
          <Text color={theme.semantic.textMuted}>{expenses.length}</Text>
        </Box>

        {/* Visual Summary */}
        {expenses.length > 0 && (
          <Box flexDirection="column" marginBottom={1}>
            <Box justifyContent="space-between">
              <Text color={theme.semantic.textMuted}>This month:</Text>
              <Text bold color={theme.semantic.expense}>{formatCurrency(thisMonthTotal, { decimals: 0 })}</Text>
            </Box>
            <Box marginTop={1}>
              <Text color={theme.semantic.textMuted}>Trend: </Text>
              <Sparkline data={sparklineData} width={listWidth - 12} color={theme.semantic.expense} showTrend={false} />
            </Box>
          </Box>
        )}

        {/* Divider */}
        <Text color={theme.semantic.border}>{"─".repeat(listWidth - 4)}</Text>

        {/* Hints */}
        <Box marginY={1}>
          <Text color={theme.semantic.textMuted}>
            <Text color={theme.semantic.success}>n</Text> new • j/k ↕ • a attach
          </Text>
        </Box>

        {expenses.length === 0 ? (
          <Box flexDirection="column" paddingY={2} alignItems="center">
            <Text color={theme.semantic.textMuted}>No expenses yet</Text>
            <Box marginTop={1}>
              <Text color={theme.semantic.textMuted}>Press </Text>
              <Text bold color={theme.semantic.success}>n</Text>
              <Text color={theme.semantic.textMuted}> to add one</Text>
            </Box>
          </Box>
        ) : (
          <Box flexDirection="column" overflowY="hidden">
            {expenses.slice(0, height - 16).map((exp, i) => {
              const docs = getDocumentsForExpense(exp.id);
              const isSelected = i === selectedIndex;

              if (isSelected) {
                return (
                  <Box key={exp.id} flexDirection="column" marginBottom={1}>
                    <Box backgroundColor={theme.semantic.focusBorder}>
                      <Text color={theme.base} bold>
                        {" ▶ "}{formatDate(exp.date).slice(0, 5)}{" "}
                      </Text>
                      <Text color={theme.base}>
                        {(exp.vendor_name || "—").slice(0, 12)}
                      </Text>
                      <Box flexGrow={1} />
                      <Text color={theme.base} bold>
                        {" "}{formatCurrency(-exp.amount, { decimals: 0 })}{" "}
                      </Text>
                    </Box>
                    <Box paddingLeft={3}>
                      <Text color={theme.semantic.textMuted}>{exp.category || "Uncategorized"}</Text>
                      {docs.length > 0 && <Text color={theme.semantic.success}> 📎</Text>}
                      {exp.description && (
                        <Text color={theme.semantic.textMuted}> • {exp.description.slice(0, 15)}</Text>
                      )}
                    </Box>
                  </Box>
                );
              }

              return (
                <Box key={exp.id}>
                  <Text color={theme.semantic.textMuted}>{"   "}</Text>
                  <Text color={theme.semantic.textSecondary}>{formatDate(exp.date).slice(0, 5).padEnd(6)}</Text>
                  <Text color={theme.semantic.textPrimary}>{(exp.vendor_name || "—").slice(0, 10).padEnd(11)}</Text>
                  <Text color={theme.semantic.expense}>{formatCurrency(-exp.amount, { decimals: 0 })}</Text>
                  {docs.length > 0 && <Text color={theme.semantic.textMuted}> 📎</Text>}
                </Box>
              );
            })}
          </Box>
        )}

        <Box flexGrow={1} />

        {/* Attach mode overlay */}
        {focusArea === "attach" && (
          <Box
            flexDirection="column"
            borderStyle={borderStyles.panel}
            borderColor={theme.semantic.info}
            paddingX={1}
            marginBottom={1}
          >
            <Text bold color={theme.semantic.info}>Attach Document</Text>
            <Text color={theme.semantic.textPrimary}>
              ← {unlinkedDocs[docIndex]?.original_name.slice(0, 25)} →
            </Text>
            <Text color={theme.semantic.textMuted}>↵ attach • Esc cancel</Text>
          </Box>
        )}

        {/* Footer Stats */}
        <Box
          borderStyle="single"
          borderColor={theme.semantic.border}
          borderTop
          borderBottom={false}
          borderLeft={false}
          borderRight={false}
          paddingTop={1}
          flexDirection="column"
        >
          <Box justifyContent="space-between">
            <Text color={theme.semantic.textMuted}>Total</Text>
            <Text bold color={theme.semantic.expense}>{formatCurrency(totalExpenses, { decimals: 0 })}</Text>
          </Box>
        </Box>
      </Box>

      <Box width={1} />

      {/* Right Panel - Record Expense Form or Category Breakdown */}
      <Box
        flexDirection="column"
        width={formWidth}
        height={height}
        borderStyle={borderStyles.panel}
        borderColor={focusArea === "form" ? theme.semantic.focusBorder : theme.semantic.border}
        paddingX={1}
      >
        <Text bold color={theme.semantic.expense}>◆ Record Expense</Text>
        <Text color={theme.semantic.textMuted}>↑↓ fields • ↵ next • Ctrl+S save</Text>

        {/* Date */}
        <Box marginTop={1}>
          <Text color={activeField === "date" ? theme.semantic.focus : theme.semantic.textMuted}>Date: </Text>
          <Text color={theme.semantic.textPrimary}>{date}</Text>
          {activeField === "date" && focusArea === "form" && cursorVisible && (
            <Text color={theme.semantic.focus}>│</Text>
          )}
        </Box>

        {/* Vendor */}
        <Box marginTop={1}>
          <Text color={activeField === "vendor" ? theme.semantic.focus : theme.semantic.textMuted}>Vendor: </Text>
          <Text color={theme.semantic.textPrimary}>
            {vendor || <Text color={theme.semantic.inputPlaceholder}>(optional)</Text>}
          </Text>
          {activeField === "vendor" && focusArea === "form" && cursorVisible && (
            <Text color={theme.semantic.focus}>│</Text>
          )}
        </Box>

        {/* Category */}
        <Box marginTop={1}>
          <Text color={activeField === "category" ? theme.semantic.focus : theme.semantic.textMuted}>Category: </Text>
          {categories.length > 0 ? (
            <Text color={theme.semantic.primary}>
              {activeField === "category" ? "← " : ""}
              {categories[categoryIndex]?.name || "None"}
              {activeField === "category" ? " →" : ""}
            </Text>
          ) : (
            <Text color={theme.semantic.error}>No categories</Text>
          )}
        </Box>

        {/* Amount */}
        <Box marginTop={1}>
          <Text color={activeField === "amount" ? theme.semantic.focus : theme.semantic.textMuted}>Amount ({getLocaleConfig().currencySymbol}): </Text>
          <Text color={theme.semantic.expense}>{amount}</Text>
          {activeField === "amount" && focusArea === "form" && cursorVisible && (
            <Text color={theme.semantic.focus}>│</Text>
          )}
        </Box>

        {/* Description */}
        <Box marginTop={1}>
          <Text color={activeField === "description" ? theme.semantic.focus : theme.semantic.textMuted}>Description: </Text>
          <Text color={theme.semantic.textPrimary}>{description}</Text>
          {activeField === "description" && focusArea === "form" && cursorVisible && (
            <Text color={theme.semantic.focus}>│</Text>
          )}
        </Box>

        {/* Reference */}
        <Box marginTop={1}>
          <Text color={activeField === "reference" ? theme.semantic.focus : theme.semantic.textMuted}>Reference #: </Text>
          <Text color={theme.semantic.textPrimary}>
            {reference || <Text color={theme.semantic.inputPlaceholder}>(invoice/receipt #)</Text>}
          </Text>
          {activeField === "reference" && focusArea === "form" && cursorVisible && (
            <Text color={theme.semantic.focus}>│</Text>
          )}
        </Box>

        {/* Notes */}
        <Box marginTop={1}>
          <Text color={activeField === "notes" ? theme.semantic.focus : theme.semantic.textMuted}>Notes: </Text>
          <Text color={theme.semantic.textPrimary}>{notes}</Text>
          {activeField === "notes" && focusArea === "form" && cursorVisible && (
            <Text color={theme.semantic.focus}>│</Text>
          )}
        </Box>

        {/* Recurring */}
        <Box marginTop={1}>
          <Text color={activeField === "recurring" ? theme.semantic.focus : theme.semantic.textMuted}>Recurring: </Text>
          <Text color={RECURRING_OPTIONS[recurringIndex].value !== "none" ? theme.semantic.warning : theme.semantic.textPrimary}>
            {activeField === "recurring" ? "← " : ""}
            {RECURRING_OPTIONS[recurringIndex].label}
            {activeField === "recurring" ? " →" : ""}
          </Text>
        </Box>

        {/* Document */}
        <Box marginTop={1}>
          <Text color={activeField === "document" ? theme.semantic.focus : theme.semantic.textMuted}>Document: </Text>
          {unlinkedDocs.length > 0 ? (
            <Text color={theme.semantic.info}>
              {activeField === "document" ? "← " : ""}
              {docIndex === -1 ? "None" : unlinkedDocs[docIndex]?.original_name.slice(0, 20)}
              {activeField === "document" ? " →" : ""}
            </Text>
          ) : (
            <Text color={theme.semantic.textMuted}>No unlinked docs</Text>
          )}
        </Box>

        {/* Category Breakdown Chart */}
        {categoryBreakdown.length > 0 && focusArea !== "form" && (
          <Box flexDirection="column" marginTop={2}>
            <Text color={theme.semantic.border}>{"─".repeat(formWidth - 6)}</Text>
            <Box marginTop={1}>
              <Text bold color={theme.semantic.warning}>By Category</Text>
            </Box>
            <Box marginTop={1}>
              <HorizontalBarChart
                items={categoryBreakdown}
                width={formWidth - 6}
                labelWidth={10}
              />
            </Box>
          </Box>
        )}

        <Box flexGrow={1} />

        {/* Form Message */}
        {formMessage && (
          <Box>
            <Text color={formMessage.type === "success" ? theme.semantic.success : theme.semantic.error}>
              {formMessage.type === "success" ? indicators.check : indicators.warning} {formMessage.text}
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
