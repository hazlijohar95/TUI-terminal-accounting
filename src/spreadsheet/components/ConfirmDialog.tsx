/**
 * ConfirmDialog - Generic confirmation dialog
 *
 * Reusable dialog for confirming destructive actions
 */

import React from "react";
import { Box, Text, useInput } from "ink";

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  warning?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmColor?: string;
  width?: number;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  warning,
  confirmLabel = "Yes",
  cancelLabel = "No",
  onConfirm,
  onCancel,
  confirmColor = "#f38ba8",
  width = 40,
}: ConfirmDialogProps) {
  useInput((input, key) => {
    if (!visible) return;

    // Escape or N - Cancel
    if (key.escape || input.toLowerCase() === "n") {
      onCancel();
      return;
    }

    // Y - Confirm
    if (input.toLowerCase() === "y") {
      onConfirm();
      return;
    }
  }, { isActive: visible });

  if (!visible) return null;

  return (
    <Box
      flexDirection="column"
      width={width}
      borderStyle="round"
      borderColor={warning ? "#f9e2af" : "#89b4fa"}
      paddingX={2}
      paddingY={1}
    >
      {/* Title */}
      <Box marginBottom={1}>
        <Text color="#cdd6f4" bold>{title}</Text>
      </Box>

      {/* Message */}
      <Box flexDirection="column" marginBottom={1}>
        <Text color="#cdd6f4">{message}</Text>
        {warning && (
          <Box marginTop={1}>
            <Text color="#f9e2af">{warning}</Text>
          </Box>
        )}
      </Box>

      {/* Options */}
      <Box flexDirection="column" marginTop={1}>
        <Box>
          <Text color={confirmColor} bold>y</Text>
          <Text color="#6c7086"> → </Text>
          <Text color="#cdd6f4">{confirmLabel}</Text>
        </Box>

        <Box>
          <Text color="#89b4fa" bold>n</Text>
          <Text color="#6c7086"> → </Text>
          <Text color="#cdd6f4">{cancelLabel}</Text>
        </Box>
      </Box>

      {/* Hint */}
      <Box marginTop={1} borderStyle="single" borderColor="#313244" paddingX={1}>
        <Text color="#6c7086" dimColor>
          Press Esc or N to cancel
        </Text>
      </Box>
    </Box>
  );
}
