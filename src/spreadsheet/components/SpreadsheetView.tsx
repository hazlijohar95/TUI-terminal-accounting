/**
 * SpreadsheetView - Main spreadsheet component
 *
 * Full-featured spreadsheet with formulas, templates, formatting,
 * clipboard operations, and export functionality.
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import { Box, Text, useStdout, useInput } from "ink";
import * as fs from "fs";
import * as path from "path";
import { Grid } from "./Grid.js";
import { FormulaBar } from "./FormulaBar.js";
import { StatusBar } from "./StatusBar.js";
import { FormulaHelper } from "./FormulaHelper.js";
import { TemplatePicker } from "./TemplatePicker.js";
import { FormatMenu } from "./FormatMenu.js";
import { ExportMenu } from "./ExportMenu.js";
import { ExitConfirmDialog } from "./ExitConfirmDialog.js";
import { ConfirmDialog } from "./ConfirmDialog.js";
import { useSpreadsheet } from "../hooks/useSpreadsheet.js";
import { useNavigation } from "../hooks/useNavigation.js";
import { formatCellValue, CellFormat } from "../core/types.js";
import { SpreadsheetTemplate } from "../templates/index.js";
import { exportToCSV, exportToExcel, getExcelBuffer } from "../persistence/ExportImport.js";

export interface SpreadsheetViewProps {
  onExit?: () => void;
  isActive?: boolean;
  title?: string;
  initialTemplate?: SpreadsheetTemplate;
}

export function SpreadsheetView({
  onExit,
  isActive = true,
  title = "Spreadsheet",
  initialTemplate,
}: SpreadsheetViewProps) {
  // Get terminal dimensions
  const { stdout } = useStdout();
  const width = stdout?.columns ?? 80;
  const height = stdout?.rows ?? 24;

  // UI state
  const [showFormulaHelper, setShowFormulaHelper] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(!initialTemplate);
  const [showFormatMenu, setShowFormatMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [currentTitle, setCurrentTitle] = useState(title);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Track unsaved changes
  const [isDirty, setIsDirty] = useState(false);
  const lastExportTime = useRef<number>(0);

  // Main spreadsheet state and actions
  const [state, actions] = useSpreadsheet({
    terminalWidth: width,
    terminalHeight: height,
    defaultColumnWidth: 12,
    rowHeaderWidth: 5,
  });

  // Clear status message after delay
  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => setStatusMessage(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  // Load initial template if provided
  useEffect(() => {
    if (initialTemplate) {
      actions.loadTemplate(initialTemplate);
      setCurrentTitle(initialTemplate.name);
    }
  }, []);

  // Handle formula helper selection
  const handleSelectFormula = useCallback((formula: string) => {
    actions.startEdit(true);
    actions.updateEditValue(formula);
  }, [actions]);

  // Handle template selection
  const handleSelectTemplate = useCallback((template: SpreadsheetTemplate) => {
    actions.loadTemplate(template);
    setCurrentTitle(template.name);
    setShowTemplatePicker(false);
    setIsDirty(false); // Fresh template, not dirty yet
  }, [actions]);

  // Handle format application
  const handleApplyFormat = useCallback((format: Partial<CellFormat>) => {
    actions.setCellFormat(format);
    setStatusMessage(`Format applied: ${Object.keys(format).join(", ")}`);
  }, [actions]);

  // Handle CSV export
  const handleExportCSV = useCallback(() => {
    try {
      const bounds = actions.getDataBounds();
      const csv = exportToCSV(actions.getCellData, bounds.maxRow, bounds.maxCol);
      const filename = `${currentTitle.replace(/[^a-z0-9]/gi, "_")}_${Date.now()}.csv`;
      fs.writeFileSync(filename, csv);
      setStatusMessage(`Exported: ${filename}`);
      setIsDirty(false);
      lastExportTime.current = Date.now();
    } catch (error) {
      setStatusMessage(`Export failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }, [actions, currentTitle]);

  // Handle Excel export
  const handleExportExcel = useCallback(async () => {
    try {
      const bounds = actions.getDataBounds();
      const workbook = exportToExcel(actions.getCellData, bounds.maxRow, bounds.maxCol, {
        sheetName: currentTitle,
      });
      const buffer = await getExcelBuffer(workbook);
      const filename = `${currentTitle.replace(/[^a-z0-9]/gi, "_")}_${Date.now()}.xlsx`;
      fs.writeFileSync(filename, buffer);
      setStatusMessage(`Exported: ${filename}`);
      setIsDirty(false);
      lastExportTime.current = Date.now();
    } catch (error) {
      setStatusMessage(`Export failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }, [actions, currentTitle]);

  // Handle exit request - show confirmation dialog
  const handleExitRequest = useCallback(() => {
    setShowExitConfirm(true);
  }, []);

  // Handle confirmed exit
  const handleConfirmExit = useCallback(() => {
    setShowExitConfirm(false);
    onExit?.();
  }, [onExit]);

  // Handle save and exit
  const handleSaveAndExit = useCallback(() => {
    handleExportExcel();
    setShowExitConfirm(false);
    onExit?.();
  }, [handleExportExcel, onExit]);

  // Handle clear spreadsheet
  const handleClearSpreadsheet = useCallback(() => {
    actions.clearAll();
    setCurrentTitle("Spreadsheet");
    setStatusMessage("Spreadsheet cleared");
    setIsDirty(false);
    setShowClearConfirm(false);
  }, [actions]);

  // Any overlay showing
  const hasOverlay = showFormulaHelper || showTemplatePicker || showFormatMenu || showExportMenu || showExitConfirm || showClearConfirm;

  // Handle keyboard shortcuts
  useInput((input, key) => {
    if (!isActive) return;
    if (hasOverlay) return;

    // Don't capture when editing
    if (state.isEditing) {
      // Ctrl+C during edit - cancel
      if (key.ctrl && input === "c") {
        actions.cancelEdit();
        return;
      }
      return;
    }

    // f - Formula helper
    if (input === "f") {
      setShowFormulaHelper(true);
      return;
    }

    // t - Template picker
    if (input === "t") {
      setShowTemplatePicker(true);
      return;
    }

    // F - Format menu (Shift+F)
    if (input === "F") {
      setShowFormatMenu(true);
      return;
    }

    // e - Export menu
    if (input === "e") {
      setShowExportMenu(true);
      return;
    }

    // n - New/clear spreadsheet (with confirmation if data exists)
    if (input === "n") {
      if (isDirty) {
        setShowClearConfirm(true);
      } else {
        handleClearSpreadsheet();
      }
      return;
    }

    // Ctrl+C - Copy
    if (key.ctrl && input === "c") {
      actions.copy();
      setStatusMessage(state.hasSelection ? "Range copied" : "Cell copied");
      return;
    }

    // Ctrl+X - Cut
    if (key.ctrl && input === "x") {
      actions.cut();
      setStatusMessage(state.hasSelection ? "Range cut" : "Cell cut");
      return;
    }

    // Ctrl+V - Paste
    if (key.ctrl && input === "v") {
      actions.paste();
      setStatusMessage("Pasted");
      return;
    }

    // Ctrl+Z - Undo
    if (key.ctrl && input === "z") {
      if (actions.undo()) {
        setStatusMessage("Undo");
      }
      return;
    }

    // Ctrl+Y - Redo
    if (key.ctrl && input === "y") {
      if (actions.redo()) {
        setStatusMessage("Redo");
      }
      return;
    }
  }, { isActive: isActive && !hasOverlay });

  // Keyboard navigation (disabled when overlays are shown)
  // Use handleExitRequest to show confirmation instead of direct exit
  useNavigation({
    state,
    actions,
    onExit: handleExitRequest,
    isActive: isActive && !hasOverlay,
  });

  // Track when edits are confirmed (mark as dirty)
  useEffect(() => {
    // When mode changes from edit to ready, an edit was confirmed
    if (state.mode === "ready" && !showTemplatePicker) {
      // Check if any cell has data
      const bounds = actions.getDataBounds();
      if (bounds.maxRow > 0 || bounds.maxCol > 0) {
        setIsDirty(true);
      }
    }
  }, [state.mode, showTemplatePicker, actions]);

  // Calculate calculated value for status bar
  const calculatedValue = state.activeCellData.formula
    ? formatCellValue(state.activeCellData.value, state.activeCellData.format)
    : undefined;

  return (
    <Box flexDirection="column" width={width} height={height - 2}>
      {/* Title bar */}
      <Box
        justifyContent="space-between"
        paddingX={1}
        borderStyle="single"
        borderColor="#313244"
      >
        <Box>
          <Text color="#cdd6f4" bold>◆ {currentTitle}</Text>
          {state.clipboardInfo && (
            <>
              <Text color="#6c7086"> │ </Text>
              <Text color="#89dceb" dimColor>{state.clipboardInfo}</Text>
            </>
          )}
        </Box>
        <Box>
          <Text color="#6c7086" dimColor>
            <Text color="#f9e2af">t</Text>:Templates
            <Text color="#6c7086"> </Text>
            <Text color="#cba6f7">f</Text>:Formulas
            <Text color="#6c7086"> </Text>
            <Text color="#fab387">F</Text>:Format
            <Text color="#6c7086"> </Text>
            <Text color="#a6e3a1">e</Text>:Export
            <Text color="#6c7086"> </Text>
            <Text color="#89b4fa">Esc</Text>:Exit
          </Text>
        </Box>
      </Box>

      {/* Formula bar */}
      <FormulaBar
        cellRef={state.activeCellRef}
        cellData={state.activeCellData}
        isEditing={state.isEditing}
        editValue={state.editValue}
        width={width}
      />

      {/* Main grid */}
      <Box flexGrow={1}>
        <Grid
          viewport={state.viewport}
          getCellData={actions.getCellData}
          getColumnWidth={actions.getColumnWidth}
          activeCell={state.activeCell}
          isSelectedCell={actions.isSelectedCell}
          isEditing={state.isEditing}
          editValue={state.editValue}
          rowHeaderWidth={5}
        />
      </Box>

      {/* Status bar */}
      <Box borderStyle="single" borderColor="#313244">
        {statusMessage ? (
          <Box paddingX={1}>
            <Text color="#a6e3a1">{statusMessage}</Text>
          </Box>
        ) : (
          <StatusBar
            cellRef={state.activeCellRef}
            mode={state.mode}
            viewportInfo={`Row ${state.activeCell.row + 1}, Col ${state.activeCell.col + 1}`}
            hasFormula={!!state.activeCellData.formula}
            calculatedValue={calculatedValue}
          />
        )}
      </Box>

      {/* Formula helper overlay */}
      {showFormulaHelper && (
        <Box
          position="absolute"
          marginLeft={Math.floor((width - 65) / 2)}
          marginTop={Math.floor((height - 16) / 2)}
        >
          <FormulaHelper
            visible={showFormulaHelper}
            onClose={() => setShowFormulaHelper(false)}
            onSelectFormula={handleSelectFormula}
            width={65}
          />
        </Box>
      )}

      {/* Template picker overlay */}
      {showTemplatePicker && (
        <Box
          position="absolute"
          marginLeft={Math.floor((width - 60) / 2)}
          marginTop={Math.floor((height - 14) / 2)}
        >
          <TemplatePicker
            visible={showTemplatePicker}
            onClose={() => setShowTemplatePicker(false)}
            onSelectTemplate={handleSelectTemplate}
            width={60}
          />
        </Box>
      )}

      {/* Format menu overlay */}
      {showFormatMenu && (
        <Box
          position="absolute"
          marginLeft={Math.floor((width - 40) / 2)}
          marginTop={Math.floor((height - 14) / 2)}
        >
          <FormatMenu
            visible={showFormatMenu}
            onClose={() => setShowFormatMenu(false)}
            onApplyFormat={handleApplyFormat}
            currentFormat={state.activeCellData.format}
            width={40}
          />
        </Box>
      )}

      {/* Export menu overlay */}
      {showExportMenu && (
        <Box
          position="absolute"
          marginLeft={Math.floor((width - 35) / 2)}
          marginTop={Math.floor((height - 12) / 2)}
        >
          <ExportMenu
            visible={showExportMenu}
            onClose={() => setShowExportMenu(false)}
            onExportCSV={handleExportCSV}
            onExportExcel={handleExportExcel}
            width={35}
          />
        </Box>
      )}

      {/* Exit confirmation dialog */}
      {showExitConfirm && (
        <Box
          position="absolute"
          marginLeft={Math.floor((width - 45) / 2)}
          marginTop={Math.floor((height - 12) / 2)}
        >
          <ExitConfirmDialog
            visible={showExitConfirm}
            hasUnsavedChanges={isDirty}
            onConfirmExit={handleConfirmExit}
            onCancel={() => setShowExitConfirm(false)}
            onSaveAndExit={isDirty ? handleSaveAndExit : undefined}
            width={45}
          />
        </Box>
      )}

      {/* Clear confirmation dialog */}
      {showClearConfirm && (
        <Box
          position="absolute"
          marginLeft={Math.floor((width - 42) / 2)}
          marginTop={Math.floor((height - 10) / 2)}
        >
          <ConfirmDialog
            visible={showClearConfirm}
            title="Clear Spreadsheet?"
            message="This will delete all data in the current spreadsheet."
            warning="This action cannot be undone."
            confirmLabel="Clear all data"
            cancelLabel="Cancel"
            onConfirm={handleClearSpreadsheet}
            onCancel={() => setShowClearConfirm(false)}
            confirmColor="#f38ba8"
            width={42}
          />
        </Box>
      )}
    </Box>
  );
}
