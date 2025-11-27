/**
 * KeyboardHelp Component
 *
 * Contextual keyboard shortcut overlay triggered by ? key.
 */

import React from "react";
import { Box, Text, useInput } from "ink";
import { getEnhancedTheme } from "../../design/theme.js";
import { borderStyles, indicators } from "../../design/tokens.js";

export interface KeyboardShortcut {
  /** Key or key combination */
  key: string;
  /** Description of action */
  description: string;
  /** Category for grouping */
  category?: string;
}

export interface KeyboardHelpProps {
  /** Whether overlay is visible */
  visible: boolean;
  /** Called when overlay is dismissed */
  onDismiss: () => void;
  /** Shortcut definitions */
  shortcuts: KeyboardShortcut[];
  /** Title for the help overlay */
  title?: string;
  /** Width of the overlay */
  width?: number;
  /** Context-specific subtitle */
  context?: string;
}

export function KeyboardHelp({
  visible,
  onDismiss,
  shortcuts,
  title = "Keyboard Shortcuts",
  width = 50,
  context,
}: KeyboardHelpProps) {
  const theme = getEnhancedTheme();

  useInput(
    (input, key) => {
      if (!visible) return;
      // Any key dismisses the help overlay
      onDismiss();
    },
    { isActive: visible }
  );

  if (!visible) return null;

  // Group shortcuts by category
  const grouped = shortcuts.reduce((acc, shortcut) => {
    const category = shortcut.category || "General";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(shortcut);
    return acc;
  }, {} as Record<string, KeyboardShortcut[]>);

  const categories = Object.keys(grouped);

  // Calculate key column width
  const maxKeyWidth = Math.max(...shortcuts.map((s) => s.key.length)) + 2;

  return (
    <Box
      flexDirection="column"
      width={width}
      borderStyle={borderStyles.modal}
      borderColor={theme.semantic.primary}
      paddingX={2}
      paddingY={1}
    >
      {/* Header */}
      <Box marginBottom={1} justifyContent="space-between">
        <Text bold color={theme.semantic.primary}>
          {indicators.question} {title}
        </Text>
        {context && (
          <Text color={theme.semantic.textMuted}>({context})</Text>
        )}
      </Box>

      {/* Shortcuts by category */}
      {categories.map((category, catIndex) => (
        <Box key={category} flexDirection="column" marginBottom={catIndex < categories.length - 1 ? 1 : 0}>
          {/* Category header */}
          {categories.length > 1 && (
            <Text bold color={theme.semantic.textSecondary}>
              {category}
            </Text>
          )}

          {/* Shortcuts in category */}
          {grouped[category].map((shortcut, index) => (
            <Box key={index}>
              <Box width={maxKeyWidth}>
                <Text bold color={theme.semantic.primary}>
                  {shortcut.key}
                </Text>
              </Box>
              <Text color={theme.semantic.textPrimary}>
                {shortcut.description}
              </Text>
            </Box>
          ))}
        </Box>
      ))}

      {/* Footer */}
      <Box justifyContent="center" marginTop={1} borderStyle="single" borderTop borderColor={theme.semantic.border}>
        <Text color={theme.semantic.textMuted} dimColor>
          Press any key to close
        </Text>
      </Box>
    </Box>
  );
}

/**
 * Compact keyboard hint bar (shown at bottom of views)
 */
export interface KeyboardHintBarProps {
  /** Hints to display */
  hints: Array<{
    key: string;
    label: string;
  }>;
  /** Separator between hints */
  separator?: string;
}

export function KeyboardHintBar({
  hints,
  separator = "  ",
}: KeyboardHintBarProps) {
  const theme = getEnhancedTheme();

  return (
    <Box>
      {hints.map((hint, index) => (
        <React.Fragment key={index}>
          {index > 0 && <Text color={theme.semantic.textMuted}>{separator}</Text>}
          <Text bold color={theme.semantic.primary}>
            {hint.key}
          </Text>
          <Text color={theme.semantic.textMuted}>:{hint.label}</Text>
        </React.Fragment>
      ))}
    </Box>
  );
}

/**
 * Default shortcuts for common views
 */
export const commonShortcuts: KeyboardShortcut[] = [
  // Navigation
  { key: "j/↓", description: "Move down", category: "Navigation" },
  { key: "k/↑", description: "Move up", category: "Navigation" },
  { key: "Enter", description: "Select/Open", category: "Navigation" },
  { key: "Esc", description: "Go back", category: "Navigation" },
  { key: "Tab", description: "Switch panels", category: "Navigation" },

  // Actions
  { key: "n", description: "New item", category: "Actions" },
  { key: "e", description: "Edit", category: "Actions" },
  { key: "d", description: "Delete", category: "Actions" },
  { key: "s", description: "Save", category: "Actions" },

  // Global
  { key: "?", description: "Show help", category: "Global" },
  { key: "q", description: "Quit", category: "Global" },
  { key: "R", description: "Refresh", category: "Global" },
  { key: "t", description: "Toggle theme", category: "Global" },
];

/**
 * Invoice view specific shortcuts
 */
export const invoiceShortcuts: KeyboardShortcut[] = [
  ...commonShortcuts.filter((s) => s.category === "Navigation"),
  { key: "n", description: "New invoice", category: "Invoice Actions" },
  { key: "v", description: "View details", category: "Invoice Actions" },
  { key: "s", description: "Mark as sent", category: "Invoice Actions" },
  { key: "p", description: "Record payment", category: "Invoice Actions" },
  { key: "a", description: "Attach document", category: "Invoice Actions" },
  { key: "Ctrl+S", description: "Save invoice", category: "Form" },
  { key: "Ctrl+A", description: "Add line item", category: "Form" },
  { key: "←/→", description: "Select customer/option", category: "Form" },
];

/**
 * Contacts view specific shortcuts
 */
export const contactShortcuts: KeyboardShortcut[] = [
  ...commonShortcuts.filter((s) => s.category === "Navigation"),
  { key: "n", description: "New contact", category: "Contact Actions" },
  { key: "e", description: "Edit contact", category: "Contact Actions" },
  { key: "Tab", description: "Switch form tabs", category: "Form" },
  { key: "←/→", description: "Select ID type", category: "Form" },
  { key: "Ctrl+S", description: "Save contact", category: "Form" },
];

/**
 * Chat view specific shortcuts
 */
export const chatShortcuts: KeyboardShortcut[] = [
  { key: "Enter", description: "Send message", category: "Chat" },
  { key: "↑/↓", description: "Browse suggestions", category: "Chat" },
  { key: "Tab", description: "Use suggestion", category: "Chat" },
  { key: "Ctrl+C", description: "Cancel generation", category: "Chat" },
  { key: "Esc", description: "Exit chat", category: "Navigation" },
];

/**
 * Dashboard shortcuts
 */
export const dashboardShortcuts: KeyboardShortcut[] = [
  { key: "d", description: "Dashboard", category: "Views" },
  { key: "i", description: "Invoices", category: "Views" },
  { key: "e", description: "Expenses", category: "Views" },
  { key: "p", description: "Contacts", category: "Views" },
  { key: "v", description: "Vault", category: "Views" },
  { key: "r", description: "Reports", category: "Views" },
  { key: "a", description: "Accounting", category: "Views" },
  { key: "c", description: "AI Chat", category: "Views" },
  { key: "l", description: "LHDN Settings", category: "Views" },
  { key: "s", description: "Settings", category: "Views" },
  { key: "n", description: "Quick: New invoice", category: "Quick Actions" },
  { key: "R", description: "Refresh data", category: "Quick Actions" },
  { key: "t", description: "Toggle theme", category: "Quick Actions" },
  { key: "?", description: "Show help", category: "Help" },
  { key: "q", description: "Quit", category: "Help" },
];
