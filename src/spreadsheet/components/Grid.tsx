/**
 * Grid component - Main spreadsheet grid with virtual scrolling
 * Enhanced with cell reference highlighting
 */

import React, { useMemo } from "react";
import { Box, Text } from "ink";
import { Cell } from "./Cell.js";
import { ColumnHeader } from "./ColumnHeader.js";
import { RowHeader } from "./RowHeader.js";
import { CellAddress, CellData, Viewport, addressToRef } from "../core/types.js";
import { extractCellReferences, getCellReferenceColor, ParsedReference } from "../core/FormulaParser.js";

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

  const rows: React.ReactNode[] = [];

  // Render header row
  rows.push(
    <ColumnHeader
      key="header"
      startCol={viewport.startCol}
      endCol={viewport.endCol}
      columnWidths={getColumnWidth}
      activeCol={activeCell.col}
      rowHeaderWidth={rowHeaderWidth}
    />
  );

  // Render separator
  rows.push(
    <Box key="separator">
      <Text color="#45475a">{"─".repeat(rowHeaderWidth)}</Text>
      {Array.from(
        { length: viewport.endCol - viewport.startCol + 1 },
        (_, i) => {
          const width = getColumnWidth(viewport.startCol + i);
          return (
            <Text key={i} color="#45475a">
              {"─".repeat(width)}
            </Text>
          );
        }
      )}
    </Box>
  );

  // Render data rows
  for (let row = viewport.startRow; row <= viewport.endRow; row++) {
    const isActiveRow = row === activeCell.row;
    const cells: React.ReactNode[] = [];

    // Row header
    cells.push(
      <RowHeader
        key={`row-${row}`}
        row={row}
        width={rowHeaderWidth}
        isActive={isActiveRow}
      />
    );

    // Cells
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
    }

    rows.push(
      <Box key={`row-${row}`} flexDirection="row">
        {cells}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="#45475a">
      {rows}
    </Box>
  );
}
