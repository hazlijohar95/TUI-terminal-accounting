/**
 * SpreadsheetEngine - HyperFormula wrapper for calculation
 *
 * This is the core calculation engine that handles all formula
 * parsing, evaluation, and dependency tracking.
 */

import { HyperFormula, SimpleCellAddress, CellValue as HFCellValue } from "hyperformula";
import {
  CellAddress,
  CellData,
  CellValue,
  CellFormat,
  addressToRef,
  formatCellValue,
} from "./types.js";

export interface SheetData {
  name: string;
  sheetId: string;
}

export class SpreadsheetEngine {
  private hf: HyperFormula;
  private sheets: Map<string, SheetData> = new Map();
  private activeSheetId: string = "";
  private cellFormats: Map<string, CellFormat> = new Map();

  constructor() {
    this.hf = HyperFormula.buildEmpty({
      licenseKey: "gpl-v3",
    });

    // Create default sheet
    const sheetId = this.hf.addSheet("Sheet1");
    if (sheetId !== undefined) {
      this.activeSheetId = sheetId;
      this.sheets.set(sheetId, { name: "Sheet1", sheetId });
    }
  }

  /**
   * Get the active sheet ID
   */
  getActiveSheetId(): string {
    return this.activeSheetId;
  }

  /**
   * Get active sheet index (for HyperFormula operations)
   */
  private getActiveSheetIndex(): number {
    return this.hf.getSheetId(this.activeSheetId) ?? 0;
  }

  /**
   * Set cell contents (value or formula)
   */
  setCellContents(addr: CellAddress, contents: string): void {
    const cellAddr = this.toSimpleCellAddress(addr);
    this.hf.setCellContents(cellAddr, contents);
  }

  /**
   * Get raw cell contents (formula if exists, otherwise value)
   */
  getCellContents(addr: CellAddress): string {
    const cellAddr = this.toSimpleCellAddress(addr);
    const serialized = this.hf.getCellSerialized(cellAddr);
    if (serialized === undefined || serialized === null) return "";
    return String(serialized);
  }

  /**
   * Get calculated cell value
   */
  getCellValue(addr: CellAddress): CellValue {
    const cellAddr = this.toSimpleCellAddress(addr);
    const value = this.hf.getCellValue(cellAddr);
    return this.convertHFValue(value);
  }

  /**
   * Get cell data including display value
   */
  getCellData(addr: CellAddress): CellData {
    const contents = this.getCellContents(addr);
    const value = this.getCellValue(addr);
    const isFormula = contents.startsWith("=");
    const ref = addressToRef(addr);
    const format = this.cellFormats.get(ref);

    return {
      value,
      formula: isFormula ? contents : undefined,
      format,
      displayValue: formatCellValue(value, format),
    };
  }

  /**
   * Check if a cell has a formula
   */
  hasFormula(addr: CellAddress): boolean {
    const cellAddr = this.toSimpleCellAddress(addr);
    return this.hf.doesCellHaveFormula(cellAddr);
  }

  /**
   * Clear a cell
   */
  clearCell(addr: CellAddress): void {
    const cellAddr = this.toSimpleCellAddress(addr);
    this.hf.setCellContents(cellAddr, null);
    const ref = addressToRef(addr);
    this.cellFormats.delete(ref);
  }

  /**
   * Set cell format
   */
  setCellFormat(addr: CellAddress, format: CellFormat): void {
    const ref = addressToRef(addr);
    this.cellFormats.set(ref, format);
  }

  /**
   * Get cell format
   */
  getCellFormat(addr: CellAddress): CellFormat | undefined {
    const ref = addressToRef(addr);
    return this.cellFormats.get(ref);
  }

  /**
   * Batch set multiple cells (more efficient)
   */
  batchSetCells(cells: Array<{ addr: CellAddress; contents: string }>): void {
    this.hf.batch(() => {
      for (const { addr, contents } of cells) {
        const cellAddr = this.toSimpleCellAddress(addr);
        this.hf.setCellContents(cellAddr, contents);
      }
    });
  }

  /**
   * Get all non-empty cells in a range
   */
  getCellsInRange(
    startRow: number,
    endRow: number,
    startCol: number,
    endCol: number
  ): Map<string, CellData> {
    const cells = new Map<string, CellData>();

    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const addr = { row, col };
        const data = this.getCellData(addr);
        if (data.value !== null || data.formula) {
          cells.set(addressToRef(addr), data);
        }
      }
    }

    return cells;
  }

  /**
   * Get all non-empty cells in the sheet
   */
  getAllCells(): Map<string, CellData> {
    const cells = new Map<string, CellData>();
    const dimensions = this.hf.getSheetDimensions(this.getActiveSheetIndex());

    if (dimensions.width === 0 || dimensions.height === 0) {
      return cells;
    }

    for (let row = 0; row < dimensions.height; row++) {
      for (let col = 0; col < dimensions.width; col++) {
        const addr = { row, col };
        const cellAddr = this.toSimpleCellAddress(addr);
        const value = this.hf.getCellValue(cellAddr);

        if (value !== null && value !== undefined) {
          cells.set(addressToRef(addr), this.getCellData(addr));
        }
      }
    }

    return cells;
  }

  /**
   * Get sheet dimensions (max row and column with data)
   */
  getSheetDimensions(): { rows: number; cols: number } {
    const dims = this.hf.getSheetDimensions(this.getActiveSheetIndex());
    return {
      rows: Math.max(dims.height, 1),
      cols: Math.max(dims.width, 1),
    };
  }

  /**
   * Undo last operation
   */
  undo(): boolean {
    if (this.hf.isThereSomethingToUndo()) {
      this.hf.undo();
      return true;
    }
    return false;
  }

  /**
   * Redo last undone operation
   */
  redo(): boolean {
    if (this.hf.isThereSomethingToRedo()) {
      this.hf.redo();
      return true;
    }
    return false;
  }

  /**
   * Export sheet data to JSON format
   */
  exportToJSON(): { cells: Record<string, { value: string; format?: CellFormat }> } {
    const result: Record<string, { value: string; format?: CellFormat }> = {};
    const dimensions = this.hf.getSheetDimensions(this.getActiveSheetIndex());

    for (let row = 0; row < dimensions.height; row++) {
      for (let col = 0; col < dimensions.width; col++) {
        const addr = { row, col };
        const contents = this.getCellContents(addr);
        if (contents) {
          const ref = addressToRef(addr);
          const format = this.cellFormats.get(ref);
          result[ref] = { value: contents, format };
        }
      }
    }

    return { cells: result };
  }

  /**
   * Import sheet data from JSON format
   */
  importFromJSON(data: { cells: Record<string, { value: string; format?: CellFormat }> }): void {
    // Clear existing data
    this.hf.clearSheet(this.getActiveSheetIndex());
    this.cellFormats.clear();

    // Import cells
    const imports: Array<{ addr: CellAddress; contents: string }> = [];
    for (const [ref, cellData] of Object.entries(data.cells)) {
      const match = ref.match(/^([A-Z]+)(\d+)$/i);
      if (match) {
        const col = this.letterToCol(match[1].toUpperCase());
        const row = parseInt(match[2], 10) - 1;
        imports.push({ addr: { row, col }, contents: cellData.value });
        if (cellData.format) {
          this.cellFormats.set(ref, cellData.format);
        }
      }
    }

    this.batchSetCells(imports);
  }

  /**
   * Destroy the engine and free resources
   */
  destroy(): void {
    this.hf.destroy();
  }

  // Private helper methods

  private toSimpleCellAddress(addr: CellAddress): SimpleCellAddress {
    return { sheet: this.getActiveSheetIndex(), row: addr.row, col: addr.col };
  }

  private convertHFValue(value: HFCellValue): CellValue {
    if (value === undefined || value === null) return null;
    if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") {
      return value;
    }
    // Handle errors and other special values
    if (typeof value === "object" && "type" in value) {
      return `#${value.type}`;
    }
    return String(value);
  }

  private letterToCol(letter: string): number {
    let result = 0;
    for (let i = 0; i < letter.length; i++) {
      result = result * 26 + (letter.charCodeAt(i) - 64);
    }
    return result - 1;
  }
}
