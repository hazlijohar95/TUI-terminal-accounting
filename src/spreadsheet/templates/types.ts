/**
 * Template types for financial spreadsheet templates
 */

import { CellFormat } from "../core/types.js";

export interface TemplateCell {
  value: string;
  format?: CellFormat;
}

export interface SpreadsheetTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: "financial" | "planning" | "analysis";
  cells: Record<string, TemplateCell>;
  columnWidths?: Record<number, number>;
}

/**
 * Apply a template to the spreadsheet engine
 */
export function applyTemplate(
  template: SpreadsheetTemplate,
  setCellValue: (ref: string, value: string) => void,
  setCellFormat?: (ref: string, format: CellFormat) => void
): void {
  for (const [ref, cell] of Object.entries(template.cells)) {
    setCellValue(ref, cell.value);
    if (cell.format && setCellFormat) {
      setCellFormat(ref, cell.format);
    }
  }
}
