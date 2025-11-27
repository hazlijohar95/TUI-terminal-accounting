/**
 * OpenAccounting TUI Spreadsheet Engine
 *
 * A full-featured spreadsheet with formula support, built on HyperFormula.
 */

// Core exports
export * from "./core/types.js";
export { SpreadsheetEngine } from "./core/SpreadsheetEngine.js";
export { SelectionManager } from "./core/Selection.js";
export { ViewportManager } from "./core/Viewport.js";
export { extractCellReferences, getCellReferenceColor } from "./core/FormulaParser.js";
export type { ParsedReference } from "./core/FormulaParser.js";

// Component exports
export { SpreadsheetView } from "./components/SpreadsheetView.js";
export { Grid } from "./components/Grid.js";
export { Cell } from "./components/Cell.js";
export { FormulaBar } from "./components/FormulaBar.js";
export { FormulaHelper, getFormulaSuggestions } from "./components/FormulaHelper.js";
export { TemplatePicker } from "./components/TemplatePicker.js";
export { FormatMenu } from "./components/FormatMenu.js";
export { ExportMenu } from "./components/ExportMenu.js";
export { ExitConfirmDialog } from "./components/ExitConfirmDialog.js";
export { ConfirmDialog } from "./components/ConfirmDialog.js";
export { ColumnHeader } from "./components/ColumnHeader.js";
export { RowHeader } from "./components/RowHeader.js";
export { StatusBar } from "./components/StatusBar.js";

// Hook exports
export { useSpreadsheet } from "./hooks/useSpreadsheet.js";
export { useNavigation } from "./hooks/useNavigation.js";
export { useClipboard } from "./hooks/useClipboard.js";
export type { SpreadsheetState, SpreadsheetActions } from "./hooks/useSpreadsheet.js";

// Persistence exports
export {
  exportToCSV,
  exportToExcel,
  getExcelBase64,
  getExcelBuffer,
  importFromCSV,
  importFromExcel,
  detectDataBounds,
} from "./persistence/ExportImport.js";

// Template exports
export {
  ALL_TEMPLATES,
  getTemplateById,
  burnRateTemplate,
  marginCalcTemplate,
  cashFlowTemplate,
  applyTemplate,
} from "./templates/index.js";
export type { SpreadsheetTemplate, TemplateCell } from "./templates/index.js";
