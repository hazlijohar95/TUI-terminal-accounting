/**
 * useSpreadsheet - Main state management hook for the spreadsheet
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { SpreadsheetEngine } from "../core/SpreadsheetEngine.js";
import { SelectionManager } from "../core/Selection.js";
import { ViewportManager } from "../core/Viewport.js";
import { CellAddress, CellData, CellFormat, CellRange, Viewport, addressToRef, refToAddress } from "../core/types.js";
import { SpreadsheetTemplate } from "../templates/index.js";
import { useClipboard } from "./useClipboard.js";

export type SpreadsheetMode = "ready" | "edit" | "select";

export interface SpreadsheetState {
  mode: SpreadsheetMode;
  activeCell: CellAddress;
  activeCellRef: string;
  activeCellData: CellData;
  viewport: Viewport;
  isEditing: boolean;
  editValue: string;
  hasSelection: boolean;
  selectionRange: CellRange | null;
  clipboardInfo: string | null;
}

export interface SpreadsheetActions {
  // Navigation
  moveUp: (extend?: boolean) => void;
  moveDown: (extend?: boolean) => void;
  moveLeft: (extend?: boolean) => void;
  moveRight: (extend?: boolean) => void;
  moveToCell: (addr: CellAddress) => void;
  pageUp: () => void;
  pageDown: () => void;

  // Editing
  startEdit: (clearContent?: boolean) => void;
  updateEditValue: (value: string) => void;
  confirmEdit: () => void;
  cancelEdit: () => void;
  clearCell: () => void;

  // Cell operations
  setCellValue: (addr: CellAddress, value: string) => void;
  getCellData: (addr: CellAddress) => CellData;
  getColumnWidth: (col: number) => number;

  // Selection
  isSelectedCell: (addr: CellAddress) => boolean;

  // Undo/Redo
  undo: () => boolean;
  redo: () => boolean;

  // Export/Import
  exportToJSON: () => ReturnType<SpreadsheetEngine["exportToJSON"]>;
  importFromJSON: (data: Parameters<SpreadsheetEngine["importFromJSON"]>[0]) => void;

  // Templates
  loadTemplate: (template: SpreadsheetTemplate) => void;
  clearAll: () => void;

  // Clipboard
  copy: () => void;
  cut: () => void;
  paste: () => void;

  // Formatting
  setCellFormat: (format: Partial<CellFormat>) => void;

  // Data bounds
  getDataBounds: () => { maxRow: number; maxCol: number };
}

export interface UseSpreadsheetOptions {
  terminalWidth?: number;
  terminalHeight?: number;
  defaultColumnWidth?: number;
  rowHeaderWidth?: number;
}

export function useSpreadsheet(options: UseSpreadsheetOptions = {}): [SpreadsheetState, SpreadsheetActions] {
  const {
    terminalWidth = 80,
    terminalHeight = 24,
    defaultColumnWidth = 12,
    rowHeaderWidth = 5,
  } = options;

  // Core managers (refs to avoid recreation)
  const engineRef = useRef<SpreadsheetEngine | null>(null);
  const selectionRef = useRef<SelectionManager | null>(null);
  const viewportRef = useRef<ViewportManager | null>(null);

  // Initialize managers
  if (!engineRef.current) {
    engineRef.current = new SpreadsheetEngine();
  }
  if (!selectionRef.current) {
    selectionRef.current = new SelectionManager();
  }
  if (!viewportRef.current) {
    viewportRef.current = new ViewportManager({
      terminalWidth,
      terminalHeight,
      columnWidth: defaultColumnWidth,
      rowHeaderWidth,
    });
  }

  const engine = engineRef.current;
  const selection = selectionRef.current;
  const viewport = viewportRef.current;

  // State
  const [mode, setMode] = useState<SpreadsheetMode>("ready");
  const [editValue, setEditValue] = useState("");
  const [updateTrigger, setUpdateTrigger] = useState(0);

  // Force re-render
  const forceUpdate = useCallback(() => {
    setUpdateTrigger((n) => n + 1);
  }, []);

  // Update viewport on terminal resize
  useEffect(() => {
    viewport.updateDimensions(terminalWidth, terminalHeight);
    forceUpdate();
  }, [terminalWidth, terminalHeight, viewport, forceUpdate]);

  // Get current state
  const activeCell = selection.getActiveCell();
  const activeCellRef = selection.getActiveCellRef();
  const activeCellData = engine.getCellData(activeCell);

  // Navigation actions
  const moveUp = useCallback((extend = false) => {
    selection.moveUp(extend);
    viewport.scrollToCell(selection.getActiveCell());
    forceUpdate();
  }, [selection, viewport, forceUpdate]);

  const moveDown = useCallback((extend = false) => {
    selection.moveDown(extend);
    viewport.scrollToCell(selection.getActiveCell());
    forceUpdate();
  }, [selection, viewport, forceUpdate]);

  const moveLeft = useCallback((extend = false) => {
    selection.moveLeft(extend);
    viewport.scrollToCell(selection.getActiveCell());
    forceUpdate();
  }, [selection, viewport, forceUpdate]);

  const moveRight = useCallback((extend = false) => {
    selection.moveRight(extend);
    viewport.scrollToCell(selection.getActiveCell());
    forceUpdate();
  }, [selection, viewport, forceUpdate]);

  const moveToCell = useCallback((addr: CellAddress) => {
    selection.goToCell(addr);
    viewport.scrollToCell(addr);
    forceUpdate();
  }, [selection, viewport, forceUpdate]);

  const pageUp = useCallback(() => {
    viewport.pageUp();
    const vp = viewport.getViewport();
    selection.setActiveCell({ row: vp.startRow, col: selection.getActiveCell().col });
    forceUpdate();
  }, [viewport, selection, forceUpdate]);

  const pageDown = useCallback(() => {
    viewport.pageDown();
    const vp = viewport.getViewport();
    selection.setActiveCell({ row: vp.startRow, col: selection.getActiveCell().col });
    forceUpdate();
  }, [viewport, selection, forceUpdate]);

  // Editing actions
  const startEdit = useCallback((clearContent = false) => {
    setMode("edit");
    if (clearContent) {
      setEditValue("");
    } else {
      const contents = engine.getCellContents(activeCell);
      setEditValue(contents);
    }
  }, [engine, activeCell]);

  const updateEditValue = useCallback((value: string) => {
    setEditValue(value);
  }, []);

  const confirmEdit = useCallback(() => {
    if (mode === "edit") {
      engine.setCellContents(activeCell, editValue);
      setMode("ready");
      setEditValue("");
      forceUpdate();
    }
  }, [mode, engine, activeCell, editValue, forceUpdate]);

  const cancelEdit = useCallback(() => {
    setMode("ready");
    setEditValue("");
  }, []);

  const clearCell = useCallback(() => {
    engine.clearCell(activeCell);
    forceUpdate();
  }, [engine, activeCell, forceUpdate]);

  // Cell operations
  const setCellValue = useCallback((addr: CellAddress, value: string) => {
    engine.setCellContents(addr, value);
    forceUpdate();
  }, [engine, forceUpdate]);

  const getCellData = useCallback((addr: CellAddress): CellData => {
    return engine.getCellData(addr);
  }, [engine]);

  const getColumnWidth = useCallback((col: number): number => {
    return viewport.getColumnWidth(col);
  }, [viewport]);

  // Selection
  const isSelectedCell = useCallback((addr: CellAddress): boolean => {
    return selection.isCellSelected(addr);
  }, [selection]);

  // Undo/Redo
  const undo = useCallback((): boolean => {
    const result = engine.undo();
    if (result) forceUpdate();
    return result;
  }, [engine, forceUpdate]);

  const redo = useCallback((): boolean => {
    const result = engine.redo();
    if (result) forceUpdate();
    return result;
  }, [engine, forceUpdate]);

  // Export/Import
  const exportToJSON = useCallback(() => {
    return engine.exportToJSON();
  }, [engine]);

  const importFromJSON = useCallback((data: Parameters<SpreadsheetEngine["importFromJSON"]>[0]) => {
    engine.importFromJSON(data);
    selection.moveToStart();
    viewport.scrollToCell({ row: 0, col: 0 });
    forceUpdate();
  }, [engine, selection, viewport, forceUpdate]);

  // Template loading
  const loadTemplate = useCallback((template: SpreadsheetTemplate) => {
    // Clear existing data first
    engine.importFromJSON({ cells: {} });

    // Set column widths if specified
    if (template.columnWidths) {
      for (const [col, width] of Object.entries(template.columnWidths)) {
        viewport.setColumnWidth(parseInt(col, 10), width);
      }
    }

    // Load all cells from template
    const cellsToSet: Array<{ addr: CellAddress; contents: string }> = [];
    for (const [ref, cell] of Object.entries(template.cells)) {
      try {
        const addr = refToAddress(ref);
        cellsToSet.push({ addr, contents: cell.value });

        // Set format if specified
        if (cell.format) {
          engine.setCellFormat(addr, cell.format);
        }
      } catch {
        // Invalid cell reference, skip
      }
    }

    // Batch set cells for performance
    engine.batchSetCells(cellsToSet);

    // Reset view
    selection.moveToStart();
    viewport.scrollToCell({ row: 0, col: 0 });
    forceUpdate();
  }, [engine, selection, viewport, forceUpdate]);

  const clearAll = useCallback(() => {
    engine.importFromJSON({ cells: {} });
    selection.moveToStart();
    viewport.scrollToCell({ row: 0, col: 0 });
    forceUpdate();
  }, [engine, selection, viewport, forceUpdate]);

  // Clipboard operations
  const clipboard = useClipboard({
    getCellData,
    setCellValue,
    clearCell: (addr: CellAddress) => engine.clearCell(addr),
  });

  const copy = useCallback(() => {
    const range = selection.getNormalizedRange();
    if (range) {
      clipboard.copyRange(range);
    } else {
      clipboard.copyCell(activeCell);
    }
    forceUpdate();
  }, [selection, clipboard, activeCell, forceUpdate]);

  const cut = useCallback(() => {
    const range = selection.getNormalizedRange();
    if (range) {
      clipboard.cutRange(range);
    } else {
      clipboard.cutCell(activeCell);
    }
    forceUpdate();
  }, [selection, clipboard, activeCell, forceUpdate]);

  const paste = useCallback(() => {
    clipboard.paste(activeCell);
    forceUpdate();
  }, [clipboard, activeCell, forceUpdate]);

  // Format cell
  const setCellFormat = useCallback((format: Partial<CellFormat>) => {
    const currentFormat = engine.getCellFormat(activeCell) || {};
    const newFormat: CellFormat = { ...currentFormat, ...format };
    engine.setCellFormat(activeCell, newFormat);
    forceUpdate();
  }, [engine, activeCell, forceUpdate]);

  // Get data bounds
  const getDataBounds = useCallback(() => {
    const dims = engine.getSheetDimensions();
    return { maxRow: dims.rows - 1, maxCol: dims.cols - 1 };
  }, [engine]);

  // Construct state object
  const selectionRange = selection.getNormalizedRange();
  const state: SpreadsheetState = {
    mode,
    activeCell,
    activeCellRef,
    activeCellData,
    viewport: viewport.getViewport(),
    isEditing: mode === "edit",
    editValue,
    hasSelection: selectionRange !== null,
    selectionRange,
    clipboardInfo: clipboard.getClipboardInfo(),
  };

  // Construct actions object
  const actions: SpreadsheetActions = {
    moveUp,
    moveDown,
    moveLeft,
    moveRight,
    moveToCell,
    pageUp,
    pageDown,
    startEdit,
    updateEditValue,
    confirmEdit,
    cancelEdit,
    clearCell,
    setCellValue,
    getCellData,
    getColumnWidth,
    isSelectedCell,
    undo,
    redo,
    exportToJSON,
    importFromJSON,
    loadTemplate,
    clearAll,
    copy,
    cut,
    paste,
    setCellFormat,
    getDataBounds,
  };

  return [state, actions];
}
