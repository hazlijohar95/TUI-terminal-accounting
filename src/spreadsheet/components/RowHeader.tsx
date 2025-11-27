/**
 * RowHeader component - Displays 1, 2, 3... row headers
 * Enhanced with bold styling and background for better visibility
 */

import React from "react";
import { Box, Text } from "ink";

// Header styling colors
const HEADER_BG = "#313244";
const HEADER_TEXT = "#cdd6f4";
const ACTIVE_COLOR = "#89b4fa";

export interface RowHeaderProps {
  row: number;
  width: number;
  isActive: boolean;
}

export function RowHeader({ row, width, isActive }: RowHeaderProps) {
  const rowNum = String(row + 1);
  // Right-align the row number
  const padded = rowNum.padStart(width - 1) + " ";

  return (
    <Box width={width}>
      <Text
        color={isActive ? ACTIVE_COLOR : HEADER_TEXT}
        bold
        backgroundColor={HEADER_BG}
      >
        {padded}
      </Text>
    </Box>
  );
}
