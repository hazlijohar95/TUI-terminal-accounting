/**
 * Selection management for the spreadsheet
 */

import { CellAddress, CellRange, Selection, addressToRef } from "./types.js";

export class SelectionManager {
  private selection: Selection;
  private maxRow: number;
  private maxCol: number;

  constructor(maxRow: number = 9999, maxCol: number = 701) {
    this.selection = {
      active: { row: 0, col: 0 },
    };
    this.maxRow = maxRow;
    this.maxCol = maxCol;
  }

  /**
   * Get current selection
   */
  getSelection(): Selection {
    return { ...this.selection };
  }

  /**
   * Get active cell address
   */
  getActiveCell(): CellAddress {
    return { ...this.selection.active };
  }

  /**
   * Get active cell reference string
   */
  getActiveCellRef(): string {
    return addressToRef(this.selection.active);
  }

  /**
   * Set active cell
   */
  setActiveCell(addr: CellAddress, extendSelection: boolean = false): void {
    const boundedAddr = this.boundAddress(addr);

    if (extendSelection && !this.selection.range) {
      // Start a new range from current active cell
      this.selection.range = {
        start: { ...this.selection.active },
        end: boundedAddr,
      };
    } else if (extendSelection && this.selection.range) {
      // Extend existing range
      this.selection.range.end = boundedAddr;
    } else {
      // Clear range and set new active cell
      this.selection.range = undefined;
    }

    this.selection.active = boundedAddr;
  }

  /**
   * Move active cell by delta
   */
  move(deltaRow: number, deltaCol: number, extendSelection: boolean = false): void {
    const newAddr = {
      row: this.selection.active.row + deltaRow,
      col: this.selection.active.col + deltaCol,
    };
    this.setActiveCell(newAddr, extendSelection);
  }

  /**
   * Move up
   */
  moveUp(extendSelection: boolean = false): void {
    this.move(-1, 0, extendSelection);
  }

  /**
   * Move down
   */
  moveDown(extendSelection: boolean = false): void {
    this.move(1, 0, extendSelection);
  }

  /**
   * Move left
   */
  moveLeft(extendSelection: boolean = false): void {
    this.move(0, -1, extendSelection);
  }

  /**
   * Move right
   */
  moveRight(extendSelection: boolean = false): void {
    this.move(0, 1, extendSelection);
  }

  /**
   * Move to beginning of row
   */
  moveToRowStart(): void {
    this.setActiveCell({ row: this.selection.active.row, col: 0 });
  }

  /**
   * Move to beginning (A1)
   */
  moveToStart(): void {
    this.setActiveCell({ row: 0, col: 0 });
  }

  /**
   * Move to specific cell
   */
  goToCell(addr: CellAddress): void {
    this.setActiveCell(addr);
  }

  /**
   * Select a range
   */
  selectRange(range: CellRange): void {
    this.selection.range = {
      start: this.boundAddress(range.start),
      end: this.boundAddress(range.end),
    };
    this.selection.active = this.boundAddress(range.end);
  }

  /**
   * Clear selection (keep active cell)
   */
  clearRange(): void {
    this.selection.range = undefined;
  }

  /**
   * Check if cell is in current selection
   */
  isCellSelected(addr: CellAddress): boolean {
    if (!this.selection.range) {
      return (
        addr.row === this.selection.active.row &&
        addr.col === this.selection.active.col
      );
    }

    const minRow = Math.min(this.selection.range.start.row, this.selection.range.end.row);
    const maxRow = Math.max(this.selection.range.start.row, this.selection.range.end.row);
    const minCol = Math.min(this.selection.range.start.col, this.selection.range.end.col);
    const maxCol = Math.max(this.selection.range.start.col, this.selection.range.end.col);

    return (
      addr.row >= minRow &&
      addr.row <= maxRow &&
      addr.col >= minCol &&
      addr.col <= maxCol
    );
  }

  /**
   * Check if cell is the active cell
   */
  isActiveCell(addr: CellAddress): boolean {
    return (
      addr.row === this.selection.active.row &&
      addr.col === this.selection.active.col
    );
  }

  /**
   * Get normalized range (start is always top-left)
   */
  getNormalizedRange(): CellRange | null {
    if (!this.selection.range) return null;

    return {
      start: {
        row: Math.min(this.selection.range.start.row, this.selection.range.end.row),
        col: Math.min(this.selection.range.start.col, this.selection.range.end.col),
      },
      end: {
        row: Math.max(this.selection.range.start.row, this.selection.range.end.row),
        col: Math.max(this.selection.range.start.col, this.selection.range.end.col),
      },
    };
  }

  /**
   * Get all cells in selection
   */
  getSelectedCells(): CellAddress[] {
    const cells: CellAddress[] = [];
    const range = this.getNormalizedRange();

    if (!range) {
      cells.push(this.selection.active);
    } else {
      for (let row = range.start.row; row <= range.end.row; row++) {
        for (let col = range.start.col; col <= range.end.col; col++) {
          cells.push({ row, col });
        }
      }
    }

    return cells;
  }

  /**
   * Update boundaries
   */
  setBounds(maxRow: number, maxCol: number): void {
    this.maxRow = maxRow;
    this.maxCol = maxCol;
  }

  private boundAddress(addr: CellAddress): CellAddress {
    return {
      row: Math.max(0, Math.min(addr.row, this.maxRow)),
      col: Math.max(0, Math.min(addr.col, this.maxCol)),
    };
  }
}
