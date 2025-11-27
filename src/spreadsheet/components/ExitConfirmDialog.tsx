/**
 * ExitConfirmDialog - Confirmation dialog before exiting spreadsheet
 *
 * Prevents accidental data loss from pressing Escape
 */

import React from "react";
import { Box, Text, useInput } from "ink";

export interface ExitConfirmDialogProps {
  visible: boolean;
  hasUnsavedChanges: boolean;
  onConfirmExit: () => void;
  onCancel: () => void;
  onSaveAndExit?: () => void;
  width?: number;
}

export function ExitConfirmDialog({
  visible,
  hasUnsavedChanges,
  onConfirmExit,
  onCancel,
  onSaveAndExit,
  width = 45,
}: ExitConfirmDialogProps) {
  useInput((input, key) => {
    if (!visible) return;

    // Escape or N - Cancel and go back
    if (key.escape || input.toLowerCase() === "n") {
      onCancel();
      return;
    }

    // Y - Confirm exit without saving
    if (input.toLowerCase() === "y") {
      onConfirmExit();
      return;
    }

    // S - Save and exit (if available)
    if (input.toLowerCase() === "s" && onSaveAndExit) {
      onSaveAndExit();
      return;
    }
  }, { isActive: visible });

  if (!visible) return null;

  return (
    <Box
      flexDirection="column"
      width={width}
      borderStyle="round"
      borderColor={hasUnsavedChanges ? "#f9e2af" : "#89b4fa"}
      paddingX={2}
      paddingY={1}
    >
      {/* Title */}
      <Box marginBottom={1}>
        <Text color="#cdd6f4" bold>
          {hasUnsavedChanges ? "⚠ Unsaved Changes" : "◆ Exit Spreadsheet?"}
        </Text>
      </Box>

      {/* Message */}
      <Box flexDirection="column" marginBottom={1}>
        {hasUnsavedChanges ? (
          <>
            <Text color="#cdd6f4">You have unsaved changes.</Text>
            <Text color="#6c7086">Are you sure you want to exit?</Text>
          </>
        ) : (
          <Text color="#cdd6f4">Are you sure you want to exit?</Text>
        )}
      </Box>

      {/* Options */}
      <Box flexDirection="column" marginTop={1}>
        <Box>
          <Text color="#f38ba8" bold>y</Text>
          <Text color="#6c7086"> → </Text>
          <Text color="#cdd6f4">Exit {hasUnsavedChanges ? "without saving" : ""}</Text>
        </Box>

        {hasUnsavedChanges && onSaveAndExit && (
          <Box>
            <Text color="#a6e3a1" bold>s</Text>
            <Text color="#6c7086"> → </Text>
            <Text color="#cdd6f4">Save and exit</Text>
          </Box>
        )}

        <Box>
          <Text color="#89b4fa" bold>n</Text>
          <Text color="#6c7086"> → </Text>
          <Text color="#cdd6f4">Cancel (stay in spreadsheet)</Text>
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
