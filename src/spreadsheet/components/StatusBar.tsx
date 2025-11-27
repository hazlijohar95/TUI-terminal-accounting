/**
 * StatusBar component - Shows selection info, mode, and shortcuts
 */

import React from "react";
import { Box, Text } from "ink";

export interface StatusBarProps {
  cellRef: string;
  mode: "ready" | "edit" | "select";
  viewportInfo: string;
  hasFormula: boolean;
  calculatedValue?: string;
}

export function StatusBar({
  cellRef,
  mode,
  viewportInfo,
  hasFormula,
  calculatedValue,
}: StatusBarProps) {
  const modeColors: Record<string, string> = {
    ready: "#a6e3a1",
    edit: "#f9e2af",
    select: "#89b4fa",
  };

  return (
    <Box justifyContent="space-between" paddingX={1}>
      <Box gap={2}>
        {/* Mode indicator */}
        <Text color={modeColors[mode]} bold>
          {mode.toUpperCase()}
        </Text>

        {/* Cell info */}
        <Text color="#9399b2">
          Cell: <Text color="#cdd6f4">{cellRef}</Text>
        </Text>

        {/* Calculated value if formula */}
        {hasFormula && calculatedValue && (
          <Text color="#9399b2">
            = <Text color="#a6e3a1">{calculatedValue}</Text>
          </Text>
        )}
      </Box>

      <Box gap={2}>
        {/* Viewport info */}
        <Text color="#6c7086">{viewportInfo}</Text>

        {/* Keyboard hints */}
        <Text color="#6c7086" dimColor>
          ↑↓←→:Nav │ Enter:Edit │ Esc:Back │ Tab:Next │ Del:Clear
        </Text>
      </Box>
    </Box>
  );
}
