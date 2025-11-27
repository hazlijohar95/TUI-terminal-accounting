/**
 * ExportMenu component - Export spreadsheet to CSV/Excel
 */

import React from "react";
import { Box, Text, useInput } from "ink";

export interface ExportMenuProps {
  visible: boolean;
  onClose: () => void;
  onExportCSV: () => void;
  onExportExcel: () => void;
  width?: number;
}

export function ExportMenu({
  visible,
  onClose,
  onExportCSV,
  onExportExcel,
  width = 35,
}: ExportMenuProps) {
  useInput((input, key) => {
    if (!visible) return;

    if (key.escape) {
      onClose();
      return;
    }

    if (input === "c" || input === "C") {
      onExportCSV();
      onClose();
      return;
    }

    if (input === "x" || input === "X") {
      onExportExcel();
      onClose();
      return;
    }
  }, { isActive: visible });

  if (!visible) return null;

  return (
    <Box
      flexDirection="column"
      width={width}
      borderStyle="round"
      borderColor="#a6e3a1"
      paddingX={1}
      paddingY={1}
    >
      {/* Title */}
      <Box marginBottom={1}>
        <Text color="#cdd6f4" bold>◆ Export Spreadsheet</Text>
      </Box>

      {/* Options */}
      <Box flexDirection="column">
        <Box>
          <Text color="#a6e3a1">c</Text>
          <Text color="#6c7086"> → </Text>
          <Text color="#cdd6f4">Export to CSV</Text>
        </Box>
        <Box>
          <Text color="#6c7086" dimColor>    Comma-separated values</Text>
        </Box>

        <Box marginTop={1}>
          <Text color="#a6e3a1">x</Text>
          <Text color="#6c7086"> → </Text>
          <Text color="#cdd6f4">Export to Excel (.xlsx)</Text>
        </Box>
        <Box>
          <Text color="#6c7086" dimColor>    With formulas preserved</Text>
        </Box>
      </Box>

      {/* Instructions */}
      <Box marginTop={1} borderStyle="single" borderColor="#313244" paddingX={1}>
        <Text color="#6c7086" dimColor>
          Press key to export │ Esc: Cancel
        </Text>
      </Box>
    </Box>
  );
}
