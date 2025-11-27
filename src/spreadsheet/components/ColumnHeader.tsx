/**
 * ColumnHeader component - Displays A, B, C... column headers
 * Enhanced with bold styling and background for better visibility
 */

import React from "react";
import { Box, Text } from "ink";
import { colToLetter } from "../core/types.js";

// Header styling colors
const HEADER_BG = "#313244";
const HEADER_TEXT = "#cdd6f4";
const ACTIVE_COLOR = "#89b4fa";
const GRID_COLOR = "#585b70";

export interface ColumnHeaderProps {
  startCol: number;
  endCol: number;
  columnWidths: (col: number) => number;
  activeCol: number;
  rowHeaderWidth: number;
}

export function ColumnHeader({
  startCol,
  endCol,
  columnWidths,
  activeCol,
  rowHeaderWidth,
}: ColumnHeaderProps) {
  const elements: React.ReactNode[] = [];

  // Empty corner cell with background
  elements.push(
    <Box key="corner" width={rowHeaderWidth}>
      <Text backgroundColor={HEADER_BG} color={HEADER_TEXT}>
        {" ".repeat(rowHeaderWidth)}
      </Text>
    </Box>
  );

  // Column headers with separators
  for (let col = startCol; col <= endCol; col++) {
    const letter = colToLetter(col);
    const width = columnWidths(col);
    const isActive = col === activeCol;

    // Separator before each column
    elements.push(
      <Text key={`sep-${col}`} color={GRID_COLOR}>│</Text>
    );

    // Center the letter in the column
    const padding = Math.floor((width - letter.length) / 2);
    const displayLetter = " ".repeat(Math.max(0, padding)) + letter;

    elements.push(
      <Box key={col} width={width}>
        <Text
          color={isActive ? ACTIVE_COLOR : HEADER_TEXT}
          bold
          backgroundColor={HEADER_BG}
        >
          {displayLetter.padEnd(width)}
        </Text>
      </Box>
    );
  }

  return <Box>{elements}</Box>;
}
