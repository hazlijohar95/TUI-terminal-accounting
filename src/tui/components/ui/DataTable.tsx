/**
 * DataTable Component
 *
 * Sortable, styled table for displaying data with keyboard navigation.
 */

import React from "react";
import { Box, Text, useInput } from "ink";
import { getEnhancedTheme } from "../../design/theme.js";
import { indicators } from "../../design/tokens.js";

export interface Column<T> {
  /** Unique key for the column (matches data property) */
  key: keyof T | string;
  /** Display label for header */
  label: string;
  /** Column width (characters) */
  width?: number;
  /** Minimum width */
  minWidth?: number;
  /** Text alignment */
  align?: "left" | "center" | "right";
  /** Custom render function */
  render?: (value: unknown, row: T, index: number) => React.ReactNode;
  /** Whether column is sortable */
  sortable?: boolean;
}

export interface DataTableProps<T extends Record<string, unknown>> {
  /** Column definitions */
  columns: Column<T>[];
  /** Data rows */
  data: T[];
  /** Currently selected row index */
  selectedIndex?: number;
  /** Called when selection changes */
  onSelect?: (index: number) => void;
  /** Called when Enter is pressed on selected row */
  onActivate?: (row: T, index: number) => void;
  /** Whether table is focused */
  focused?: boolean;
  /** Show header row */
  showHeader?: boolean;
  /** Maximum visible rows (enables scrolling) */
  maxRows?: number;
  /** Row key extractor */
  keyExtractor?: (row: T, index: number) => string;
  /** Empty state message */
  emptyMessage?: string;
  /** Striped rows */
  striped?: boolean;
  /** Compact mode (less padding) */
  compact?: boolean;
  /** Table width */
  width?: number;
  /** Sort column */
  sortColumn?: string;
  /** Sort direction */
  sortDirection?: "asc" | "desc";
  /** Called when sort changes */
  onSort?: (column: string) => void;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  selectedIndex = -1,
  onSelect,
  onActivate,
  focused = false,
  showHeader = true,
  maxRows,
  keyExtractor,
  emptyMessage = "No data",
  striped = false,
  compact = false,
  width,
  sortColumn,
  sortDirection,
  onSort,
}: DataTableProps<T>) {
  const theme = getEnhancedTheme();

  // Calculate scroll offset
  const visibleCount = maxRows || data.length;
  const scrollOffset = Math.max(
    0,
    Math.min(
      selectedIndex - Math.floor(visibleCount / 2),
      data.length - visibleCount
    )
  );

  const visibleData = maxRows
    ? data.slice(scrollOffset, scrollOffset + visibleCount)
    : data;

  // Calculate column widths
  const calculateWidths = () => {
    return columns.map((col) => {
      if (col.width) return col.width;
      if (col.minWidth) return col.minWidth;
      // Auto-calculate based on label and sample data
      const headerWidth = col.label.length;
      const maxDataWidth = data.reduce((max, row) => {
        const value = String(row[col.key as keyof T] ?? "");
        return Math.max(max, value.length);
      }, 0);
      return Math.max(headerWidth, maxDataWidth, col.minWidth || 5);
    });
  };

  const colWidths = calculateWidths();

  // Handle keyboard navigation
  useInput(
    (input, key) => {
      if (!focused || !onSelect) return;

      if (key.upArrow || input === "k") {
        onSelect(Math.max(0, selectedIndex - 1));
      }

      if (key.downArrow || input === "j") {
        onSelect(Math.min(data.length - 1, selectedIndex + 1));
      }

      if (key.return && onActivate && data[selectedIndex]) {
        onActivate(data[selectedIndex], selectedIndex);
      }

      // Page navigation
      if (key.pageUp) {
        onSelect(Math.max(0, selectedIndex - visibleCount));
      }
      if (key.pageDown) {
        onSelect(Math.min(data.length - 1, selectedIndex + visibleCount));
      }
    },
    { isActive: focused }
  );

  // Render cell value
  const renderCell = (col: Column<T>, row: T, rowIndex: number) => {
    const value = row[col.key as keyof T];

    if (col.render) {
      return col.render(value, row, rowIndex);
    }

    return String(value ?? "—");
  };

  // Padding for cells
  const cellPadding = compact ? 1 : 2;

  // Empty state
  if (data.length === 0) {
    return (
      <Box
        width={width}
        justifyContent="center"
        alignItems="center"
        paddingY={2}
      >
        <Text color={theme.semantic.textMuted}>{emptyMessage}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width={width}>
      {/* Scroll indicator (top) */}
      {maxRows && scrollOffset > 0 && (
        <Box justifyContent="center">
          <Text color={theme.semantic.textMuted}>{indicators.arrowUp} more</Text>
        </Box>
      )}

      {/* Header */}
      {showHeader && (
        <Box borderStyle="single" borderBottom borderColor={theme.semantic.border}>
          {columns.map((col, colIndex) => (
            <Box
              key={String(col.key)}
              width={colWidths[colIndex]}
              paddingX={cellPadding}
              justifyContent={
                col.align === "right"
                  ? "flex-end"
                  : col.align === "center"
                  ? "center"
                  : "flex-start"
              }
            >
              <Text bold color={theme.semantic.textSecondary}>
                {col.label}
                {sortColumn === col.key && (
                  <Text>
                    {" "}
                    {sortDirection === "asc" ? indicators.arrowUp : indicators.arrowDown}
                  </Text>
                )}
              </Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Data rows */}
      {visibleData.map((row, visibleIndex) => {
        const actualIndex = maxRows ? scrollOffset + visibleIndex : visibleIndex;
        const isSelected = actualIndex === selectedIndex;
        const key = keyExtractor
          ? keyExtractor(row, actualIndex)
          : `row-${actualIndex}`;

        const rowBg =
          isSelected && focused
            ? theme.semantic.selectedBg
            : striped && actualIndex % 2 === 1
            ? theme.semantic.surfaceSubtle
            : undefined;

        return (
          <Box
            key={key}
            backgroundColor={rowBg}
          >
            {/* Selection indicator */}
            {onSelect && (
              <Text color={isSelected && focused ? theme.semantic.selected : undefined}>
                {isSelected && focused ? indicators.pointer : " "}
              </Text>
            )}

            {/* Cells */}
            {columns.map((col, colIndex) => (
              <Box
                key={String(col.key)}
                width={colWidths[colIndex]}
                paddingX={cellPadding}
                justifyContent={
                  col.align === "right"
                    ? "flex-end"
                    : col.align === "center"
                    ? "center"
                    : "flex-start"
                }
              >
                <Text
                  color={isSelected && focused ? theme.semantic.selected : theme.semantic.textPrimary}
                  bold={isSelected}
                  wrap="truncate"
                >
                  {renderCell(col, row, actualIndex)}
                </Text>
              </Box>
            ))}
          </Box>
        );
      })}

      {/* Scroll indicator (bottom) */}
      {maxRows && scrollOffset + visibleCount < data.length && (
        <Box justifyContent="center">
          <Text color={theme.semantic.textMuted}>{indicators.arrowDown} more</Text>
        </Box>
      )}
    </Box>
  );
}

/**
 * Simple table for static data display (no selection)
 */
export interface SimpleTableProps {
  headers: string[];
  rows: string[][];
  columnWidths?: number[];
  alignments?: ("left" | "center" | "right")[];
}

export function SimpleTable({
  headers,
  rows,
  columnWidths,
  alignments,
}: SimpleTableProps) {
  const theme = getEnhancedTheme();

  const widths = columnWidths || headers.map((h) => h.length + 4);

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box>
        {headers.map((header, i) => (
          <Box
            key={i}
            width={widths[i]}
            justifyContent={
              alignments?.[i] === "right"
                ? "flex-end"
                : alignments?.[i] === "center"
                ? "center"
                : "flex-start"
            }
            paddingX={1}
          >
            <Text bold color={theme.semantic.textSecondary}>
              {header}
            </Text>
          </Box>
        ))}
      </Box>

      {/* Separator */}
      <Box>
        {widths.map((w, i) => (
          <Box key={i} width={w} paddingX={1}>
            <Text color={theme.semantic.border}>
              {indicators.dividerH.repeat(w - 2)}
            </Text>
          </Box>
        ))}
      </Box>

      {/* Rows */}
      {rows.map((row, rowIndex) => (
        <Box key={rowIndex}>
          {row.map((cell, cellIndex) => (
            <Box
              key={cellIndex}
              width={widths[cellIndex]}
              justifyContent={
                alignments?.[cellIndex] === "right"
                  ? "flex-end"
                  : alignments?.[cellIndex] === "center"
                  ? "center"
                  : "flex-start"
              }
              paddingX={1}
            >
              <Text>{cell}</Text>
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
}
