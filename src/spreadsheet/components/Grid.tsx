/**
 * Grid component - Main spreadsheet grid with visible borders
 * Enhanced with cell reference highlighting and Excel-like grid lines
 */

import React, { useMemo } from "react";
import { Box, Text } from "ink";
import { Cell } from "./Cell.js";
import { ColumnHeader } from "./ColumnHeader.js";
import { RowHeader } from "./RowHeader.js";
import { CellAddress, CellData, Viewport, addressToRef } from "../core/types.js";
import { extractCellReferences, getCellReferenceColor, ParsedReference } from "../core/FormulaParser.js";

// Grid line colors
const GRID_COLOR = "#585b70";
const HEADER_BG = "#313244";

export interface GridProps {
  viewport: Viewport;
  getCellData: (addr: CellAddress) => CellData;
  getColumnWidth: (col: number) => number;
  activeCell: CellAddress;
  isSelectedCell: (addr: CellAddress) => boolean;
  isEditing: boolean;
  editValue: string;
  rowHeaderWidth: number;
}

export function Grid({
  viewport,
  getCellData,
  getColumnWidth,
  activeCell,
  isSelectedCell,
  isEditing,
  editValue,
  rowHeaderWidth,
}: GridProps) {
  // Parse cell references from current edit value for highlighting
  const cellReferences = useMemo((): ParsedReference[] => {
    if (!isEditing || !editValue.startsWith("=")) {
      return [];
    }
    return extractCellReferences(editValue);
  }, [isEditing, editValue]);

  // Get reference color for a cell
  const getReferenceColor = (addr: CellAddress): string | null => {
    if (cellReferences.length === 0) return null;
    return getCellReferenceColor(addr, cellReferences);
  };

  // Calculate total columns
  const colCount = viewport.endCol - viewport.startCol + 1;

  // Build horizontal border line
  const buildHorizontalBorder = (left: string, mid: string, right: string) => {
    const parts: React.ReactNode[] = [];

    // Left corner + row header section
    parts.push(
      <Text key="left" color={GRID_COLOR}>
        {left}{"─".repeat(rowHeaderWidth - 1)}
      </Text>
    );

    // Column sections
    for (let i = 0; i < colCount; i++) {
      const width = getColumnWidth(viewport.startCol + i);
      const connector = i < colCount - 1 ? mid : right;
      parts.push(
        <Text key={`col-${i}`} color={GRID_COLOR}>
          {"─".repeat(width)}{connector}
        </Text>
      );
    }

    return <Box key="border">{parts}</Box>;
  };

  const rows: React.ReactNode[] = [];

  // Top border: ┌───┬───┬───┐
  rows.push(
    <Box key="top-border">
      {buildHorizontalBorder("┌", "┬", "┐")}
    </Box>
  );

  // Header row with vertical borders
  rows.push(
    <Box key="header">
      <Text color={GRID_COLOR}>│</Text>
      <ColumnHeader
        startCol={viewport.startCol}
        endCol={viewport.endCol}
        columnWidths={getColumnWidth}
        activeCol={activeCell.col}
        rowHeaderWidth={rowHeaderWidth - 1}
      />
      <Text color={GRID_COLOR}>│</Text>
    </Box>
  );

  // Header separator: ├───┼───┼───┤
  rows.push(
    <Box key="header-separator">
      {buildHorizontalBorder("├", "┼", "┤")}
    </Box>
  );

  // Render data rows
  for (let row = viewport.startRow; row <= viewport.endRow; row++) {
    const isActiveRow = row === activeCell.row;
    const cells: React.ReactNode[] = [];

    // Left border
    cells.push(<Text key="left-border" color={GRID_COLOR}>│</Text>);

    // Row header
    cells.push(
      <RowHeader
        key={`row-header-${row}`}
        row={row}
        width={rowHeaderWidth - 1}
        isActive={isActiveRow}
      />
    );

    // Separator after row header
    cells.push(<Text key="row-sep" color={GRID_COLOR}>│</Text>);

    // Cells with borders
    for (let col = viewport.startCol; col <= viewport.endCol; col++) {
      const addr = { row, col };
      const isActive = row === activeCell.row && col === activeCell.col;
      const cellData = getCellData(addr);
      const width = getColumnWidth(col);
      const referenceColor = getReferenceColor(addr);

      cells.push(
        <Cell
          key={addressToRef(addr)}
          data={cellData}
          width={width}
          isActive={isActive}
          isSelected={isSelectedCell(addr)}
          isEditing={isEditing && isActive}
          editValue={isActive ? editValue : undefined}
          referenceColor={referenceColor}
        />
      );

      // Right border after each cell
      cells.push(
        <Text key={`border-${col}`} color={GRID_COLOR}>│</Text>
      );
    }

    rows.push(
      <Box key={`row-${row}`} flexDirection="row">
        {cells}
      </Box>
    );
  }

  // Bottom border: └───┴───┴───┘
  rows.push(
    <Box key="bottom-border">
      {buildHorizontalBorder("└", "┴", "┘")}
    </Box>
  );

  return (
    <Box flexDirection="column">
      {rows}
    </Box>
  );
}
