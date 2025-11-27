/**
 * ColumnHeader component - Displays A, B, C... column headers
 */

import React from "react";
import { Box, Text } from "ink";
import { colToLetter } from "../core/types.js";

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
  const columns: React.ReactNode[] = [];

  for (let col = startCol; col <= endCol; col++) {
    const letter = colToLetter(col);
    const width = columnWidths(col);
    const isActive = col === activeCol;

    // Center the letter in the column
    const padding = Math.floor((width - letter.length) / 2);
    const displayLetter = " ".repeat(Math.max(0, padding)) + letter;

    columns.push(
      <Box key={col} width={width}>
        <Text
          color={isActive ? "#89b4fa" : "#9399b2"}
          bold={isActive}
          backgroundColor={isActive ? "#313244" : undefined}
        >
          {displayLetter.padEnd(width)}
        </Text>
      </Box>
    );
  }

  return (
    <Box>
      {/* Empty corner cell */}
      <Box width={rowHeaderWidth}>
        <Text color="#6c7086"> </Text>
      </Box>
      {/* Column headers */}
      {columns}
    </Box>
  );
}
