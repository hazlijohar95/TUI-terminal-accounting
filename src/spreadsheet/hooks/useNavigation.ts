/**
 * useNavigation - Keyboard navigation hook for spreadsheet
 */

import { useInput, Key } from "ink";
import { useCallback } from "react";
import { SpreadsheetActions, SpreadsheetState } from "./useSpreadsheet.js";

export interface UseNavigationOptions {
  state: SpreadsheetState;
  actions: SpreadsheetActions;
  onExit?: () => void;
  isActive?: boolean;
}

export function useNavigation({
  state,
  actions,
  onExit,
  isActive = true,
}: UseNavigationOptions): void {
  const handleInput = useCallback(
    (input: string, key: Key) => {
      if (!isActive) return;

      const { isEditing } = state;

      // Handle edit mode input
      if (isEditing) {
        if (key.return) {
          // Confirm edit and move down
          actions.confirmEdit();
          actions.moveDown();
          return;
        }

        if (key.escape) {
          // Cancel edit
          actions.cancelEdit();
          return;
        }

        if (key.tab) {
          // Confirm and move right
          actions.confirmEdit();
          if (key.shift) {
            actions.moveLeft();
          } else {
            actions.moveRight();
          }
          return;
        }

        if (key.backspace || key.delete) {
          // Delete character
          const newValue = state.editValue.slice(0, -1);
          actions.updateEditValue(newValue);
          return;
        }

        // Regular character input
        if (input && !key.ctrl && !key.meta) {
          const newValue = state.editValue + input;
          actions.updateEditValue(newValue);
          return;
        }

        return;
      }

      // Navigation mode (not editing)

      // Exit spreadsheet
      if (key.escape) {
        onExit?.();
        return;
      }

      // Arrow key navigation
      if (key.upArrow) {
        actions.moveUp(key.shift);
        return;
      }
      if (key.downArrow) {
        actions.moveDown(key.shift);
        return;
      }
      if (key.leftArrow) {
        actions.moveLeft(key.shift);
        return;
      }
      if (key.rightArrow) {
        actions.moveRight(key.shift);
        return;
      }

      // Tab navigation
      if (key.tab) {
        if (key.shift) {
          actions.moveLeft();
        } else {
          actions.moveRight();
        }
        return;
      }

      // Enter to edit
      if (key.return) {
        actions.startEdit();
        return;
      }

      // Delete/Backspace to clear
      if (key.delete || key.backspace) {
        actions.clearCell();
        return;
      }

      // Page up/down
      if (key.pageUp) {
        actions.pageUp();
        return;
      }
      if (key.pageDown) {
        actions.pageDown();
        return;
      }

      // Undo (Ctrl+Z)
      if (key.ctrl && input === "z") {
        actions.undo();
        return;
      }

      // Redo (Ctrl+Y)
      if (key.ctrl && input === "y") {
        actions.redo();
        return;
      }

      // Home (Ctrl+Home or just Home)
      if (input === "h" && key.ctrl) {
        actions.moveToCell({ row: 0, col: 0 });
        return;
      }

      // Start editing with typed character
      if (input && !key.ctrl && !key.meta && input.length === 1) {
        // Start editing with the pressed key
        actions.startEdit(true);
        actions.updateEditValue(input);
        return;
      }
    },
    [isActive, state, actions, onExit]
  );

  useInput(handleInput, { isActive });
}
