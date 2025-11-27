/**
 * RowHeader component - Displays 1, 2, 3... row headers
 */

import React from "react";
import { Box, Text } from "ink";

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
        color={isActive ? "#89b4fa" : "#9399b2"}
        bold={isActive}
        backgroundColor={isActive ? "#313244" : undefined}
      >
        {padded}
      </Text>
    </Box>
  );
}
