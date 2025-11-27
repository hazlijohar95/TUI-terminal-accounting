/**
 * Enhanced Theme System
 *
 * Extends the base Catppuccin theme with semantic colors,
 * state colors, and consistent color mapping for UI elements.
 */

import { getTheme as getBaseTheme } from "../theme.js";

/**
 * Get the full theme with semantic enhancements
 */
export function getEnhancedTheme() {
  const base = getBaseTheme();

  return {
    // Base palette (from theme.ts)
    ...base,

    // Semantic colors for UI states
    semantic: {
      // Interactive elements
      primary: base.blue,
      secondary: base.subtext,
      accent: base.sapphire,

      // Focus states
      focus: base.sapphire,
      focusBorder: base.sapphire,
      focusRing: base.blue,

      // Borders by state
      border: base.surface,
      borderActive: base.sapphire,
      borderError: base.red,
      borderSuccess: base.green,
      borderWarning: base.yellow,

      // Surfaces
      surfaceDefault: base.base,
      surfaceElevated: base.surface,
      surfaceSubtle: base.mantle,
      surfaceMuted: base.crust,

      // Status colors
      success: base.green,
      error: base.red,
      warning: base.peach,
      info: base.blue,

      // Text states
      textPrimary: base.text,
      textSecondary: base.subtext,
      textMuted: base.overlay,
      textDisabled: base.surface2,
      textInverse: base.base,

      // Financial semantics
      income: base.green,
      expense: base.red,
      neutral: base.text,
      balance: base.blue,

      // Invoice/document status
      draft: base.surface2,
      sent: base.blue,
      paid: base.green,
      partial: base.teal,
      overdue: base.red,
      cancelled: base.surface2,
      pending: base.yellow,

      // e-Invoice status
      einvoiceNone: base.surface2,
      einvoicePending: base.yellow,
      einvoiceSubmitted: base.blue,
      einvoiceValid: base.green,
      einvoiceInvalid: base.red,
      einvoiceCancelled: base.surface2,
      einvoiceRejected: base.red,

      // AI/Chat elements
      userMessage: base.text,
      assistantMessage: base.blue,
      thought: base.subtext,
      action: base.yellow,
      observation: base.green,
      tool: base.mauve,

      // Form elements
      inputBg: base.mantle,
      inputBorder: base.surface,
      inputFocus: base.sapphire,
      inputError: base.red,
      inputPlaceholder: base.overlay,

      // Selection
      selected: base.blue,
      selectedBg: base.surface,
      hover: base.surface1,
    },

    // Badge colors (background + text pairs)
    badges: {
      success: { bg: base.green, text: base.crust },
      warning: { bg: base.peach, text: base.crust },
      error: { bg: base.red, text: base.crust },
      info: { bg: base.blue, text: base.crust },
      neutral: { bg: base.surface2, text: base.text },

      // Status badges
      draft: { bg: base.surface2, text: base.text },
      sent: { bg: base.blue, text: base.crust },
      paid: { bg: base.green, text: base.crust },
      partial: { bg: base.teal, text: base.crust },
      overdue: { bg: base.red, text: base.crust },
      cancelled: { bg: base.surface2, text: base.overlay },
      pending: { bg: base.yellow, text: base.crust },

      // e-Invoice badges
      valid: { bg: base.green, text: base.crust },
      invalid: { bg: base.red, text: base.crust },
      submitted: { bg: base.blue, text: base.crust },
      rejected: { bg: base.red, text: base.crust },
    },

    // Panel accent colors for different contexts
    panels: {
      default: base.surface,
      primary: base.sapphire,
      success: base.green,
      warning: base.yellow,
      error: base.red,
      info: base.blue,
      accent: base.mauve,
    },

    // Gradient-like color progressions for charts/graphs
    progressions: {
      heat: [base.green, base.teal, base.yellow, base.peach, base.red],
      cool: [base.blue, base.sapphire, base.teal, base.green],
      neutral: [base.surface, base.surface1, base.surface2, base.overlay],
    },
  } as const;
}

export type EnhancedTheme = ReturnType<typeof getEnhancedTheme>;

/**
 * Get status color from string status
 */
export function getStatusColor(status: string): string {
  const theme = getEnhancedTheme();

  const statusMap: Record<string, string> = {
    // Invoice/payment status
    draft: theme.semantic.draft,
    sent: theme.semantic.sent,
    paid: theme.semantic.paid,
    partial: theme.semantic.partial,
    overdue: theme.semantic.overdue,
    cancelled: theme.semantic.cancelled,
    pending: theme.semantic.pending,

    // e-Invoice status
    none: theme.semantic.einvoiceNone,
    submitted: theme.semantic.einvoiceSubmitted,
    valid: theme.semantic.einvoiceValid,
    invalid: theme.semantic.einvoiceInvalid,
    rejected: theme.semantic.einvoiceRejected,

    // Generic status
    success: theme.semantic.success,
    error: theme.semantic.error,
    warning: theme.semantic.warning,
    info: theme.semantic.info,
  };

  return statusMap[status.toLowerCase()] || theme.semantic.textPrimary;
}

/**
 * Get badge colors for a status
 */
export function getBadgeColors(
  variant: string
): { bg: string; text: string } {
  const theme = getEnhancedTheme();
  const badges = theme.badges as Record<string, { bg: string; text: string }>;

  return badges[variant.toLowerCase()] || badges.neutral;
}

/**
 * Determine if text should be light or dark based on background
 * Simple heuristic based on color name
 */
export function getContrastText(bgColorName: string): "light" | "dark" {
  const lightBgs = [
    "green",
    "yellow",
    "peach",
    "teal",
    "sapphire",
    "blue",
    "pink",
    "mauve",
    "lavender",
  ];

  return lightBgs.some((c) => bgColorName.includes(c)) ? "dark" : "light";
}
