/**
 * useClipboard - Clipboard management for copy/paste operations
 */

import { useState, useCallback } from "react";
import { CellAddress, CellData, CellRange, addressToRef, refToAddress } from "../core/types.js";

export interface ClipboardData {
  type: "cell" | "range";
  origin: CellAddress;
  range?: CellRange;
  cells: Map<string, CellData>;
  isCut: boolean;
}

export interface UseClipboardOptions {
  getCellData: (addr: CellAddress) => CellData;
  setCellValue: (addr: CellAddress, value: string) => void;
  clearCell: (addr: CellAddress) => void;
}

export function useClipboard(options: UseClipboardOptions) {
  const { getCellData, setCellValue, clearCell } = options;
  const [clipboard, setClipboard] = useState<ClipboardData | null>(null);

  /**
   * Copy a single cell
   */
  const copyCell = useCallback((addr: CellAddress) => {
    const data = getCellData(addr);
    const cells = new Map<string, CellData>();
    cells.set(addressToRef(addr), data);

    setClipboard({
      type: "cell",
      origin: addr,
      cells,
      isCut: false,
    });

    return true;
  }, [getCellData]);

  /**
   * Copy a range of cells
   */
  const copyRange = useCallback((range: CellRange) => {
    const cells = new Map<string, CellData>();
    const minRow = Math.min(range.start.row, range.end.row);
    const maxRow = Math.max(range.start.row, range.end.row);
    const minCol = Math.min(range.start.col, range.end.col);
    const maxCol = Math.max(range.start.col, range.end.col);

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const addr = { row, col };
        const data = getCellData(addr);
        if (data.value !== null || data.formula) {
          cells.set(addressToRef(addr), data);
        }
      }
    }

    setClipboard({
      type: "range",
      origin: { row: minRow, col: minCol },
      range: { start: { row: minRow, col: minCol }, end: { row: maxRow, col: maxCol } },
      cells,
      isCut: false,
    });

    return true;
  }, [getCellData]);

  /**
   * Cut cells (copy + mark for deletion on paste)
   */
  const cutCell = useCallback((addr: CellAddress) => {
    copyCell(addr);
    setClipboard((prev) => prev ? { ...prev, isCut: true } : null);
    return true;
  }, [copyCell]);

  const cutRange = useCallback((range: CellRange) => {
    copyRange(range);
    setClipboard((prev) => prev ? { ...prev, isCut: true } : null);
    return true;
  }, [copyRange]);

  /**
   * Paste at target location
   */
  const paste = useCallback((targetAddr: CellAddress): boolean => {
    if (!clipboard) return false;

    const { origin, cells, isCut, range } = clipboard;

    // Calculate offset from original position
    const rowOffset = targetAddr.row - origin.row;
    const colOffset = targetAddr.col - origin.col;

    // Paste each cell with offset
    for (const [ref, data] of cells) {
      const originalAddr = refToAddress(ref);
      const newAddr = {
        row: originalAddr.row + rowOffset,
        col: originalAddr.col + colOffset,
      };

      // Determine what to paste
      let valueToSet: string;
      if (data.formula) {
        // Adjust formula references for relative paste
        valueToSet = adjustFormulaReferences(data.formula, rowOffset, colOffset);
      } else {
        valueToSet = String(data.value ?? "");
      }

      setCellValue(newAddr, valueToSet);
    }

    // If cut, clear original cells
    if (isCut) {
      for (const [ref] of cells) {
        const addr = refToAddress(ref);
        clearCell(addr);
      }
      // Clear clipboard after cut-paste
      setClipboard(null);
    }

    return true;
  }, [clipboard, setCellValue, clearCell]);

  /**
   * Check if clipboard has data
   */
  const hasClipboardData = useCallback(() => {
    return clipboard !== null;
  }, [clipboard]);

  /**
   * Get clipboard info for display
   */
  const getClipboardInfo = useCallback((): string | null => {
    if (!clipboard) return null;

    const cellCount = clipboard.cells.size;
    const action = clipboard.isCut ? "Cut" : "Copied";

    if (clipboard.type === "cell") {
      return `${action}: 1 cell`;
    } else if (clipboard.range) {
      const rows = Math.abs(clipboard.range.end.row - clipboard.range.start.row) + 1;
      const cols = Math.abs(clipboard.range.end.col - clipboard.range.start.col) + 1;
      return `${action}: ${rows}×${cols} (${cellCount} cells)`;
    }

    return `${action}: ${cellCount} cells`;
  }, [clipboard]);

  /**
   * Clear clipboard
   */
  const clearClipboard = useCallback(() => {
    setClipboard(null);
  }, []);

  return {
    copyCell,
    copyRange,
    cutCell,
    cutRange,
    paste,
    hasClipboardData,
    getClipboardInfo,
    clearClipboard,
    clipboard,
  };
}

/**
 * Adjust formula cell references when pasting
 * Handles relative references (A1) but preserves absolute ($A$1)
 */
function adjustFormulaReferences(
  formula: string,
  rowOffset: number,
  colOffset: number
): string {
  // Match cell references, capturing $ signs for absolute references
  const refPattern = /(\$?)([A-Z]+)(\$?)(\d+)/gi;

  return formula.replace(refPattern, (match, colAbs, colLetter, rowAbs, rowNum) => {
    let newCol = colLetter;
    let newRow = rowNum;

    // Adjust column if not absolute
    if (!colAbs) {
      const colIndex = letterToCol(colLetter) + colOffset;
      if (colIndex < 0) return match; // Can't go negative
      newCol = colToLetter(colIndex);
    }

    // Adjust row if not absolute
    if (!rowAbs) {
      const newRowNum = parseInt(rowNum, 10) + rowOffset;
      if (newRowNum < 1) return match; // Can't go below row 1
      newRow = String(newRowNum);
    }

    return `${colAbs}${newCol}${rowAbs}${newRow}`;
  });
}

function colToLetter(col: number): string {
  let result = "";
  let n = col;
  while (n >= 0) {
    result = String.fromCharCode((n % 26) + 65) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}

function letterToCol(letter: string): number {
  let result = 0;
  for (let i = 0; i < letter.length; i++) {
    result = result * 26 + (letter.charCodeAt(i) - 64);
  }
  return result - 1;
}
