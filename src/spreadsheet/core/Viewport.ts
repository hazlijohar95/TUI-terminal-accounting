/**
 * Viewport management for virtual scrolling
 *
 * Only renders visible cells for performance
 */

import { CellAddress, Viewport, ColumnConfig, DEFAULT_CONFIG } from "./types.js";

export interface ViewportConfig {
  terminalWidth: number;
  terminalHeight: number;
  rowHeaderWidth: number;
  columnWidth: number;
  headerHeight: number;
  formulaBarHeight: number;
  statusBarHeight: number;
}

const DEFAULT_VIEWPORT_CONFIG: ViewportConfig = {
  terminalWidth: 80,
  terminalHeight: 24,
  rowHeaderWidth: 4,
  columnWidth: DEFAULT_CONFIG.defaultColumnWidth,
  headerHeight: 1,
  formulaBarHeight: 2,
  statusBarHeight: 1,
};

export class ViewportManager {
  private config: ViewportConfig;
  private viewport: Viewport;
  private columnWidths: Map<number, number> = new Map();

  constructor(config: Partial<ViewportConfig> = {}) {
    this.config = { ...DEFAULT_VIEWPORT_CONFIG, ...config };
    this.viewport = this.calculateInitialViewport();
  }

  /**
   * Get current viewport
   */
  getViewport(): Viewport {
    return { ...this.viewport };
  }

  /**
   * Update terminal dimensions
   */
  updateDimensions(width: number, height: number): void {
    this.config.terminalWidth = width;
    this.config.terminalHeight = height;
    this.recalculateViewport();
  }

  /**
   * Get visible columns count
   */
  getVisibleColumns(): number {
    const availableWidth = this.config.terminalWidth - this.config.rowHeaderWidth;
    return Math.floor(availableWidth / this.config.columnWidth);
  }

  /**
   * Get visible rows count
   */
  getVisibleRows(): number {
    const usedHeight = this.config.headerHeight +
                       this.config.formulaBarHeight +
                       this.config.statusBarHeight;
    return Math.max(1, this.config.terminalHeight - usedHeight - 2); // -2 for borders
  }

  /**
   * Scroll to ensure cell is visible
   */
  scrollToCell(addr: CellAddress): boolean {
    let changed = false;

    // Check horizontal scroll
    if (addr.col < this.viewport.startCol) {
      this.viewport.startCol = addr.col;
      changed = true;
    } else if (addr.col > this.viewport.endCol) {
      const visibleCols = this.getVisibleColumns();
      this.viewport.startCol = Math.max(0, addr.col - visibleCols + 1);
      changed = true;
    }

    // Check vertical scroll
    if (addr.row < this.viewport.startRow) {
      this.viewport.startRow = addr.row;
      changed = true;
    } else if (addr.row > this.viewport.endRow) {
      const visibleRows = this.getVisibleRows();
      this.viewport.startRow = Math.max(0, addr.row - visibleRows + 1);
      changed = true;
    }

    if (changed) {
      this.recalculateViewport();
    }

    return changed;
  }

  /**
   * Scroll by delta
   */
  scroll(deltaRows: number, deltaCols: number): void {
    this.viewport.startRow = Math.max(0, this.viewport.startRow + deltaRows);
    this.viewport.startCol = Math.max(0, this.viewport.startCol + deltaCols);
    this.recalculateViewport();
  }

  /**
   * Page up
   */
  pageUp(): void {
    const visibleRows = this.getVisibleRows();
    this.scroll(-visibleRows, 0);
  }

  /**
   * Page down
   */
  pageDown(): void {
    const visibleRows = this.getVisibleRows();
    this.scroll(visibleRows, 0);
  }

  /**
   * Set column width
   */
  setColumnWidth(col: number, width: number): void {
    this.columnWidths.set(col, Math.max(3, width));
  }

  /**
   * Get column width
   */
  getColumnWidth(col: number): number {
    return this.columnWidths.get(col) ?? this.config.columnWidth;
  }

  /**
   * Get all visible cell addresses
   */
  getVisibleCells(): CellAddress[] {
    const cells: CellAddress[] = [];
    for (let row = this.viewport.startRow; row <= this.viewport.endRow; row++) {
      for (let col = this.viewport.startCol; col <= this.viewport.endCol; col++) {
        cells.push({ row, col });
      }
    }
    return cells;
  }

  /**
   * Check if cell is visible
   */
  isCellVisible(addr: CellAddress): boolean {
    return (
      addr.row >= this.viewport.startRow &&
      addr.row <= this.viewport.endRow &&
      addr.col >= this.viewport.startCol &&
      addr.col <= this.viewport.endCol
    );
  }

  /**
   * Get cell position in screen coordinates
   */
  getCellScreenPosition(addr: CellAddress): { x: number; y: number } | null {
    if (!this.isCellVisible(addr)) return null;

    let x = this.config.rowHeaderWidth;
    for (let col = this.viewport.startCol; col < addr.col; col++) {
      x += this.getColumnWidth(col);
    }

    const y =
      this.config.formulaBarHeight +
      this.config.headerHeight +
      (addr.row - this.viewport.startRow);

    return { x, y };
  }

  /**
   * Get viewport info for display
   */
  getViewportInfo(): string {
    const { startRow, endRow, startCol, endCol } = this.viewport;
    return `Rows ${startRow + 1}-${endRow + 1}, Cols ${startCol + 1}-${endCol + 1}`;
  }

  private calculateInitialViewport(): Viewport {
    const visibleRows = this.getVisibleRows();
    const visibleCols = this.getVisibleColumns();

    return {
      startRow: 0,
      endRow: visibleRows - 1,
      startCol: 0,
      endCol: visibleCols - 1,
    };
  }

  private recalculateViewport(): void {
    const visibleRows = this.getVisibleRows();
    const visibleCols = this.getVisibleColumns();

    this.viewport.endRow = this.viewport.startRow + visibleRows - 1;
    this.viewport.endCol = this.viewport.startCol + visibleCols - 1;
  }
}
