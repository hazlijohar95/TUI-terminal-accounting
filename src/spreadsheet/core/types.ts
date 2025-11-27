/**
 * Core types for the TUI Spreadsheet Engine
 */

export type CellValue = string | number | boolean | null;

export interface CellFormat {
  numberFormat?: "general" | "currency" | "percent" | "date";
  decimals?: number;
  alignment?: "left" | "center" | "right";
}

export interface CellStyle {
  bold?: boolean;
  italic?: boolean;
  color?: string;
  backgroundColor?: string;
}

export interface CellData {
  value: CellValue;
  formula?: string;
  format?: CellFormat;
  style?: CellStyle;
  displayValue?: string;
}

export interface CellAddress {
  row: number;
  col: number;
}

export interface CellRange {
  start: CellAddress;
  end: CellAddress;
}

export interface Selection {
  active: CellAddress;
  range?: CellRange;
}

export interface Viewport {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

export interface ColumnConfig {
  width: number;
  frozen?: boolean;
  hidden?: boolean;
}

export interface RowConfig {
  height: number;
  frozen?: boolean;
  hidden?: boolean;
}

export interface SpreadsheetConfig {
  defaultColumnWidth: number;
  defaultRowHeight: number;
  maxRows: number;
  maxCols: number;
}

export const DEFAULT_CONFIG: SpreadsheetConfig = {
  defaultColumnWidth: 10,
  defaultRowHeight: 1,
  maxRows: 10000,
  maxCols: 702, // A-ZZ
};

/**
 * Convert column index to letter (0 = A, 1 = B, ..., 26 = AA)
 */
export function colToLetter(col: number): string {
  let result = "";
  let n = col;
  while (n >= 0) {
    result = String.fromCharCode((n % 26) + 65) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}

/**
 * Convert column letter to index (A = 0, B = 1, ..., AA = 26)
 */
export function letterToCol(letter: string): number {
  let result = 0;
  for (let i = 0; i < letter.length; i++) {
    result = result * 26 + (letter.charCodeAt(i) - 64);
  }
  return result - 1;
}

/**
 * Convert cell reference string to address (A1 -> {row: 0, col: 0})
 */
export function refToAddress(ref: string): CellAddress {
  const match = ref.match(/^([A-Z]+)(\d+)$/i);
  if (!match) throw new Error(`Invalid cell reference: ${ref}`);
  return {
    col: letterToCol(match[1].toUpperCase()),
    row: parseInt(match[2], 10) - 1,
  };
}

/**
 * Convert address to cell reference string ({row: 0, col: 0} -> A1)
 */
export function addressToRef(addr: CellAddress): string {
  return `${colToLetter(addr.col)}${addr.row + 1}`;
}

/**
 * Format cell value for display
 */
export function formatCellValue(
  value: CellValue,
  format?: CellFormat
): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "string") return value;

  const num = value as number;

  switch (format?.numberFormat) {
    case "currency":
      return num.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: format.decimals ?? 2,
        maximumFractionDigits: format.decimals ?? 2,
      });
    case "percent":
      return (num * 100).toFixed(format.decimals ?? 1) + "%";
    case "date":
      return new Date(num).toLocaleDateString();
    default:
      if (format?.decimals !== undefined) {
        return num.toFixed(format.decimals);
      }
      return String(num);
  }
}
