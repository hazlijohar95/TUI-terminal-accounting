/**
 * ExportImport - CSV and Excel export/import functionality
 */

import Papa from "papaparse";
import ExcelJS from "exceljs";
import { CellAddress, CellData, addressToRef } from "../core/types.js";

export interface ExportOptions {
  filename?: string;
  includeFormulas?: boolean;
  sheetName?: string;
}

export interface ImportResult {
  success: boolean;
  cells: Map<string, string>;
  error?: string;
}

/**
 * Export spreadsheet data to CSV string
 */
export function exportToCSV(
  getCellData: (addr: CellAddress) => CellData,
  maxRow: number,
  maxCol: number,
  options: ExportOptions = {}
): string {
  const { includeFormulas = false } = options;
  const rows: string[][] = [];

  for (let row = 0; row <= maxRow; row++) {
    const rowData: string[] = [];
    for (let col = 0; col <= maxCol; col++) {
      const data = getCellData({ row, col });
      let value: string;

      if (includeFormulas && data.formula) {
        value = data.formula;
      } else if (data.displayValue) {
        value = data.displayValue;
      } else if (data.value !== null && data.value !== undefined) {
        value = String(data.value);
      } else {
        value = "";
      }

      rowData.push(value);
    }
    rows.push(rowData);
  }

  // Use PapaParse to generate CSV
  return Papa.unparse(rows);
}

/**
 * Export spreadsheet data to Excel workbook
 */
export function exportToExcel(
  getCellData: (addr: CellAddress) => CellData,
  maxRow: number,
  maxCol: number,
  options: ExportOptions = {}
): ExcelJS.Workbook {
  const { sheetName = "Sheet1", includeFormulas = true } = options;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  for (let row = 0; row <= maxRow; row++) {
    for (let col = 0; col <= maxCol; col++) {
      const data = getCellData({ row, col });
      // ExcelJS uses 1-based indexing
      const cell = worksheet.getCell(row + 1, col + 1);

      if (includeFormulas && data.formula) {
        // Remove leading '=' for exceljs formula
        cell.value = { formula: data.formula.substring(1) };
      } else if (data.value !== null && data.value !== undefined) {
        cell.value = data.value;
      }
    }
  }

  return workbook;
}

/**
 * Get Excel file as base64 string (for download)
 */
export async function getExcelBase64(workbook: ExcelJS.Workbook): Promise<string> {
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer).toString("base64");
}

/**
 * Get Excel file as buffer (for file system write)
 */
export async function getExcelBuffer(workbook: ExcelJS.Workbook): Promise<Buffer> {
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Import data from CSV string
 */
export function importFromCSV(csvData: string): ImportResult {
  try {
    const result = Papa.parse<string[]>(csvData, {
      header: false,
      skipEmptyLines: true,
    });

    if (result.errors.length > 0) {
      return {
        success: false,
        cells: new Map(),
        error: result.errors[0].message,
      };
    }

    const cells = new Map<string, string>();

    result.data.forEach((row, rowIndex) => {
      row.forEach((value, colIndex) => {
        if (value && value.trim() !== "") {
          const ref = addressToRef({ row: rowIndex, col: colIndex });
          cells.set(ref, value);
        }
      });
    });

    return { success: true, cells };
  } catch (error) {
    return {
      success: false,
      cells: new Map(),
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Import data from Excel file buffer
 */
export async function importFromExcel(data: Buffer | ArrayBuffer): Promise<ImportResult> {
  try {
    const workbook = new ExcelJS.Workbook();
    // exceljs.load() accepts ArrayBuffer, so convert Node Buffer if needed
    const buffer = data instanceof ArrayBuffer ? data : new Uint8Array(data).buffer;
    await workbook.xlsx.load(buffer as ArrayBuffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return {
        success: false,
        cells: new Map(),
        error: "No worksheet found",
      };
    }

    const cells = new Map<string, string>();

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        let value: string;
        const cellValue = cell.value;

        // Handle formula cells
        if (cellValue && typeof cellValue === "object" && "formula" in cellValue) {
          value = "=" + cellValue.formula;
        } else if (cellValue !== undefined && cellValue !== null) {
          value = String(cellValue);
        } else {
          return;
        }

        // ExcelJS uses 1-based indexing, convert to 0-based
        const ref = addressToRef({ row: rowNumber - 1, col: colNumber - 1 });
        cells.set(ref, value);
      });
    });

    return { success: true, cells };
  } catch (error) {
    return {
      success: false,
      cells: new Map(),
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Detect data bounds (max row and column with data)
 */
export function detectDataBounds(
  getCellData: (addr: CellAddress) => CellData,
  maxCheck: number = 1000
): { maxRow: number; maxCol: number } {
  let maxRow = 0;
  let maxCol = 0;

  for (let row = 0; row < maxCheck; row++) {
    for (let col = 0; col < maxCheck; col++) {
      const data = getCellData({ row, col });
      if (data.value !== null || data.formula) {
        maxRow = Math.max(maxRow, row);
        maxCol = Math.max(maxCol, col);
      }
    }
  }

  return { maxRow, maxCol };
}
