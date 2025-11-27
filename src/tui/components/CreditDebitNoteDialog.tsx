/**
 * Credit/Debit Note Dialog Component
 *
 * Modal dialog for creating credit notes or debit notes
 * against an existing invoice.
 */

import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { getEnhancedTheme } from "../design/theme.js";
import { indicators, borderStyles } from "../design/tokens.js";
import { useBlinkingCursor } from "../animations.js";
import type { Invoice } from "../../domain/invoices.js";

export interface CreditDebitNoteDialogProps {
  width: number;
  height: number;
  invoice: Invoice;
  type: "credit" | "debit";
  onSubmit: (data: {
    reason: string;
    fullCredit?: boolean;
    items?: Array<{ description: string; quantity: number; unit_price: number }>;
  }) => void;
  onCancel: () => void;
}

type DialogField = "type" | "reason" | "amount_type" | "custom_amount" | "confirm";

export function CreditDebitNoteDialog({
  width,
  height,
  invoice,
  type,
  onSubmit,
  onCancel,
}: CreditDebitNoteDialogProps) {
  const theme = getEnhancedTheme();
  const cursor = useBlinkingCursor();

  const [activeField, setActiveField] = useState<DialogField>("reason");
  const [reason, setReason] = useState("");
  const [amountType, setAmountType] = useState<"full" | "partial">("full");
  const [customAmount, setCustomAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const typeLabel = type === "credit" ? "Credit Note" : "Debit Note";
  const typeColor = type === "credit" ? theme.semantic.warning : theme.semantic.info;

  const fields: DialogField[] = type === "credit"
    ? ["reason", "amount_type", ...(amountType === "partial" ? ["custom_amount" as DialogField] : []), "confirm"]
    : ["reason", "custom_amount", "confirm"];

  const currentFieldIndex = fields.indexOf(activeField);

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    // Navigate between fields
    if (key.upArrow || (key.shift && key.tab)) {
      const newIndex = Math.max(0, currentFieldIndex - 1);
      setActiveField(fields[newIndex]);
      return;
    }

    if (key.downArrow || key.tab) {
      const newIndex = Math.min(fields.length - 1, currentFieldIndex + 1);
      setActiveField(fields[newIndex]);
      return;
    }

    // Handle field-specific input
    if (activeField === "reason") {
      if (key.backspace || key.delete) {
        setReason((prev) => prev.slice(0, -1));
      } else if (input && !key.ctrl && !key.meta && input.length === 1) {
        setReason((prev) => prev + input);
      }
    } else if (activeField === "amount_type" && type === "credit") {
      if (input === "f" || input === "1") {
        setAmountType("full");
      } else if (input === "p" || input === "2") {
        setAmountType("partial");
      } else if (key.leftArrow || key.rightArrow) {
        setAmountType((prev) => (prev === "full" ? "partial" : "full"));
      }
    } else if (activeField === "custom_amount") {
      if (key.backspace || key.delete) {
        setCustomAmount((prev) => prev.slice(0, -1));
      } else if (/^[0-9.]$/.test(input)) {
        setCustomAmount((prev) => prev + input);
      }
    } else if (activeField === "confirm") {
      if (key.return || input === "y" || input === "Y") {
        handleSubmit();
      } else if (input === "n" || input === "N") {
        onCancel();
      }
    }

    // Enter to move to next field
    if (key.return && activeField !== "confirm") {
      const newIndex = Math.min(fields.length - 1, currentFieldIndex + 1);
      setActiveField(fields[newIndex]);
    }
  });

  const handleSubmit = () => {
    if (!reason.trim()) {
      setError("Reason is required");
      setActiveField("reason");
      return;
    }

    if (type === "debit" && !customAmount) {
      setError("Amount is required for debit notes");
      setActiveField("custom_amount");
      return;
    }

    if (type === "credit" && amountType === "partial" && !customAmount) {
      setError("Amount is required for partial credit");
      setActiveField("custom_amount");
      return;
    }

    const amount = parseFloat(customAmount) || 0;

    if (type === "credit") {
      onSubmit({
        reason: reason.trim(),
        fullCredit: amountType === "full",
        items: amountType === "partial" && amount > 0 ? [
          { description: `Partial credit: ${reason}`, quantity: 1, unit_price: amount }
        ] : undefined,
      });
    } else {
      onSubmit({
        reason: reason.trim(),
        items: [
          { description: reason.trim(), quantity: 1, unit_price: amount }
        ],
      });
    }
  };

  const formatCurrency = (value: number) => `RM ${value.toFixed(2)}`;

  const dialogWidth = Math.min(width - 4, 60);
  const dialogHeight = Math.min(height - 4, 18);

  return (
    <Box
      flexDirection="column"
      width={dialogWidth}
      height={dialogHeight}
      borderStyle={borderStyles.panel}
      borderColor={typeColor}
      paddingX={2}
      paddingY={1}
    >
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color={typeColor}>
          {indicators.pointer} Create {typeLabel}
        </Text>
      </Box>

      {/* Invoice Reference */}
      <Box marginBottom={1}>
        <Text color={theme.semantic.textMuted}>
          For Invoice: <Text bold color={theme.semantic.textPrimary}>{invoice.number}</Text>
          {" "}({formatCurrency(invoice.total)})
        </Text>
      </Box>

      {/* Error Message */}
      {error && (
        <Box marginBottom={1}>
          <Text color={theme.semantic.error}>{indicators.cross} {error}</Text>
        </Box>
      )}

      {/* Reason Field */}
      <Box flexDirection="column" marginBottom={1}>
        <Text color={activeField === "reason" ? theme.semantic.focusBorder : theme.semantic.textMuted}>
          Reason:
        </Text>
        <Box
          borderStyle={borderStyles.input}
          borderColor={activeField === "reason" ? theme.semantic.focusBorder : theme.semantic.border}
          paddingX={1}
        >
          <Text color={theme.semantic.textPrimary}>
            {reason || (activeField === "reason" ? "" : "Enter reason...")}
            {activeField === "reason" && cursor}
          </Text>
        </Box>
      </Box>

      {/* Amount Type (Credit Note only) */}
      {type === "credit" && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color={activeField === "amount_type" ? theme.semantic.focusBorder : theme.semantic.textMuted}>
            Amount Type:
          </Text>
          <Box gap={2}>
            <Text
              color={amountType === "full" ? theme.semantic.success : theme.semantic.textMuted}
              bold={amountType === "full"}
            >
              {amountType === "full" ? "[*]" : "[ ]"} Full Credit ({formatCurrency(invoice.total)})
            </Text>
            <Text
              color={amountType === "partial" ? theme.semantic.warning : theme.semantic.textMuted}
              bold={amountType === "partial"}
            >
              {amountType === "partial" ? "[*]" : "[ ]"} Partial
            </Text>
          </Box>
        </Box>
      )}

      {/* Custom Amount */}
      {(type === "debit" || (type === "credit" && amountType === "partial")) && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color={activeField === "custom_amount" ? theme.semantic.focusBorder : theme.semantic.textMuted}>
            {type === "debit" ? "Additional Charge:" : "Credit Amount:"}
          </Text>
          <Box
            borderStyle={borderStyles.input}
            borderColor={activeField === "custom_amount" ? theme.semantic.focusBorder : theme.semantic.border}
            paddingX={1}
          >
            <Text color={theme.semantic.textPrimary}>
              RM {customAmount || "0.00"}
              {activeField === "custom_amount" && cursor}
            </Text>
          </Box>
        </Box>
      )}

      <Box flexGrow={1} />

      {/* Confirmation */}
      <Box
        borderStyle={borderStyles.input}
        borderColor={activeField === "confirm" ? theme.semantic.focusBorder : theme.semantic.border}
        paddingX={1}
        paddingY={1}
        flexDirection="column"
      >
        <Text color={theme.semantic.textPrimary}>
          {type === "credit"
            ? amountType === "full"
              ? `Create credit note for ${formatCurrency(invoice.total)}?`
              : `Create credit note for ${formatCurrency(parseFloat(customAmount) || 0)}?`
            : `Create debit note for ${formatCurrency(parseFloat(customAmount) || 0)}?`}
        </Text>
        <Box marginTop={1}>
          <Text color={activeField === "confirm" ? theme.semantic.success : theme.semantic.textMuted}>
            [Y] Confirm
          </Text>
          <Text color={theme.semantic.textMuted}> / </Text>
          <Text color={activeField === "confirm" ? theme.semantic.error : theme.semantic.textMuted}>
            [N] Cancel
          </Text>
        </Box>
      </Box>

      {/* Hints */}
      <Box marginTop={1}>
        <Text color={theme.semantic.textMuted} dimColor>
          Tab/Arrow: navigate {indicators.bullet} Enter: next {indicators.bullet} Esc: cancel
        </Text>
      </Box>
    </Box>
  );
}
