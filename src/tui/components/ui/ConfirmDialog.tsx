/**
 * ConfirmDialog Component
 *
 * Modal confirmation dialog for destructive or important actions.
 */

import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { getEnhancedTheme } from "../../design/theme.js";
import { borderStyles, indicators } from "../../design/tokens.js";

export interface ConfirmDialogProps {
  /** Whether dialog is visible */
  visible: boolean;
  /** Dialog title */
  title: string;
  /** Confirmation message */
  message: string;
  /** Confirm button label */
  confirmLabel?: string;
  /** Cancel button label */
  cancelLabel?: string;
  /** Called when confirmed */
  onConfirm: () => void;
  /** Called when cancelled */
  onCancel: () => void;
  /** Destructive action styling */
  destructive?: boolean;
  /** Dialog width */
  width?: number;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  destructive = false,
  width = 50,
}: ConfirmDialogProps) {
  const theme = getEnhancedTheme();
  const [focusedButton, setFocusedButton] = useState<"confirm" | "cancel">(
    destructive ? "cancel" : "confirm"
  );

  // Handle keyboard navigation
  useInput(
    (input, key) => {
      if (!visible) return;

      // Tab or arrow keys to switch buttons
      if (key.tab || key.leftArrow || key.rightArrow || input === "h" || input === "l") {
        setFocusedButton((prev) => (prev === "confirm" ? "cancel" : "confirm"));
      }

      // Enter to activate focused button
      if (key.return) {
        if (focusedButton === "confirm") {
          onConfirm();
        } else {
          onCancel();
        }
      }

      // Escape to cancel
      if (key.escape || input === "n" || input === "N") {
        onCancel();
      }

      // Y for yes/confirm
      if (input === "y" || input === "Y") {
        onConfirm();
      }
    },
    { isActive: visible }
  );

  if (!visible) return null;

  const borderColor = destructive ? theme.semantic.error : theme.semantic.warning;
  const confirmColor = destructive ? theme.semantic.error : theme.semantic.success;

  return (
    <Box
      flexDirection="column"
      width={width}
      borderStyle={borderStyles.modal}
      borderColor={borderColor}
      paddingX={2}
      paddingY={1}
    >
      {/* Title */}
      <Box marginBottom={1}>
        <Text color={borderColor}>
          {destructive ? indicators.warning : indicators.question}{" "}
        </Text>
        <Text bold color={borderColor}>
          {title}
        </Text>
      </Box>

      {/* Message */}
      <Box marginBottom={1} paddingLeft={2}>
        <Text color={theme.semantic.textPrimary}>{message}</Text>
      </Box>

      {/* Buttons */}
      <Box justifyContent="flex-end" marginTop={1}>
        {/* Cancel Button */}
        <Box marginRight={2}>
          <Text
            color={
              focusedButton === "cancel"
                ? theme.semantic.textInverse
                : theme.semantic.textSecondary
            }
            backgroundColor={
              focusedButton === "cancel" ? theme.semantic.textSecondary : undefined
            }
          >
            {focusedButton === "cancel" ? ` ${cancelLabel} ` : `[${cancelLabel}]`}
          </Text>
        </Box>

        {/* Confirm Button */}
        <Box>
          <Text
            color={
              focusedButton === "confirm" ? theme.semantic.textInverse : confirmColor
            }
            backgroundColor={focusedButton === "confirm" ? confirmColor : undefined}
            bold={focusedButton === "confirm"}
          >
            {focusedButton === "confirm" ? ` ${confirmLabel} ` : `[${confirmLabel}]`}
          </Text>
        </Box>
      </Box>

      {/* Hint */}
      <Box justifyContent="center" marginTop={1}>
        <Text color={theme.semantic.textMuted} dimColor>
          Tab to switch • Enter to select • Esc to cancel
        </Text>
      </Box>
    </Box>
  );
}

/**
 * Prompt dialog for text input
 */
export interface PromptDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
  width?: number;
}

export function PromptDialog({
  visible,
  title,
  message,
  placeholder,
  defaultValue = "",
  onSubmit,
  onCancel,
  width = 50,
}: PromptDialogProps) {
  const theme = getEnhancedTheme();
  const [value, setValue] = useState(defaultValue);

  useInput(
    (input, key) => {
      if (!visible) return;

      if (key.escape) {
        onCancel();
      }

      if (key.return) {
        onSubmit(value);
      }

      // Handle text input
      if (key.backspace || key.delete) {
        setValue((prev) => prev.slice(0, -1));
      } else if (input && !key.ctrl && !key.meta) {
        setValue((prev) => prev + input);
      }
    },
    { isActive: visible }
  );

  if (!visible) return null;

  return (
    <Box
      flexDirection="column"
      width={width}
      borderStyle={borderStyles.modal}
      borderColor={theme.semantic.primary}
      paddingX={2}
      paddingY={1}
    >
      {/* Title */}
      <Box marginBottom={1}>
        <Text bold color={theme.semantic.primary}>
          {title}
        </Text>
      </Box>

      {/* Message */}
      {message && (
        <Box marginBottom={1}>
          <Text color={theme.semantic.textMuted}>{message}</Text>
        </Box>
      )}

      {/* Input */}
      <Box
        borderStyle={borderStyles.input}
        borderColor={theme.semantic.inputFocus}
        paddingX={1}
      >
        <Text color={value ? theme.semantic.textPrimary : theme.semantic.inputPlaceholder}>
          {value || placeholder || "Type here..."}
          <Text color={theme.semantic.primary}>│</Text>
        </Text>
      </Box>

      {/* Hint */}
      <Box justifyContent="center" marginTop={1}>
        <Text color={theme.semantic.textMuted} dimColor>
          Enter to submit • Esc to cancel
        </Text>
      </Box>
    </Box>
  );
}

/**
 * Alert dialog (info only, single button)
 */
export interface AlertDialogProps {
  visible: boolean;
  title: string;
  message: string;
  buttonLabel?: string;
  onDismiss: () => void;
  type?: "info" | "success" | "warning" | "error";
  width?: number;
}

export function AlertDialog({
  visible,
  title,
  message,
  buttonLabel = "OK",
  onDismiss,
  type = "info",
  width = 50,
}: AlertDialogProps) {
  const theme = getEnhancedTheme();

  useInput(
    (input, key) => {
      if (!visible) return;
      if (key.return || key.escape || input === " ") {
        onDismiss();
      }
    },
    { isActive: visible }
  );

  if (!visible) return null;

  const typeColors: Record<string, string> = {
    info: theme.semantic.info,
    success: theme.semantic.success,
    warning: theme.semantic.warning,
    error: theme.semantic.error,
  };

  const typeIcons: Record<string, string> = {
    info: indicators.info,
    success: indicators.check,
    warning: indicators.warning,
    error: indicators.cross,
  };

  const color = typeColors[type];
  const icon = typeIcons[type];

  return (
    <Box
      flexDirection="column"
      width={width}
      borderStyle={borderStyles.modal}
      borderColor={color}
      paddingX={2}
      paddingY={1}
    >
      {/* Title */}
      <Box marginBottom={1}>
        <Text color={color}>{icon} </Text>
        <Text bold color={color}>
          {title}
        </Text>
      </Box>

      {/* Message */}
      <Box marginBottom={1} paddingLeft={2}>
        <Text color={theme.semantic.textPrimary}>{message}</Text>
      </Box>

      {/* Button */}
      <Box justifyContent="center" marginTop={1}>
        <Text
          color={theme.semantic.textInverse}
          backgroundColor={color}
          bold
        >
          {` ${buttonLabel} `}
        </Text>
      </Box>
    </Box>
  );
}
