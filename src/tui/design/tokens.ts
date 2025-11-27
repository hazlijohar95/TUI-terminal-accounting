/**
 * Design Tokens
 *
 * Consistent spacing, borders, typography, and indicators
 * for a polished, OS-like TUI experience.
 */

/**
 * Spacing scale for consistent layouts
 * Values represent character units in terminal
 */
export const spacing = {
  none: 0,
  xs: 1,
  sm: 1,
  md: 2,
  lg: 3,
  xl: 4,
} as const;

export type Spacing = keyof typeof spacing;

/**
 * Border styles for different UI contexts
 * Uses Ink's borderStyle prop values
 */
export const borderStyles = {
  none: undefined,
  panel: "round" as const,     // Main containers, primary panels
  section: "single" as const,  // Inner sections, subdivisions
  input: "round" as const,     // Form inputs, text fields
  modal: "double" as const,    // Dialogs, overlays, confirmations
  subtle: "single" as const,   // De-emphasized borders
} as const;

export type BorderStyle = keyof typeof borderStyles;

/**
 * Typography styles for text hierarchy
 * Returns props to spread on Ink's Text component
 */
export const typography = {
  // Headings
  h1: { bold: true } as const,
  h2: { bold: true } as const,
  h3: { bold: true, dimColor: false } as const,

  // Body text
  body: {} as const,
  bodyMuted: { dimColor: true } as const,

  // Labels and captions
  label: { dimColor: true } as const,
  caption: { dimColor: true } as const,

  // Code and data
  code: { inverse: true } as const,
  mono: {} as const,

  // Interactive hints
  hint: { dimColor: true } as const,
  shortcut: { bold: true } as const,
} as const;

export type Typography = keyof typeof typography;

/**
 * Unicode indicators for visual communication
 * Carefully chosen for terminal compatibility
 */
export const indicators = {
  // Selection & navigation
  selected: "›",
  pointer: "▸",
  bullet: "•",
  arrow: "→",
  arrowLeft: "←",
  arrowRight: "→",
  arrowUp: "↑",
  arrowDown: "↓",

  // Status
  check: "✓",
  cross: "✗",
  warning: "⚠",
  info: "ℹ",
  question: "?",

  // Progress & loading
  loading: "◐",
  pending: "○",
  complete: "●",
  partial: "◐",

  // Financial
  income: "▸",
  expense: "◂",
  neutral: "─",

  // Dividers
  dividerH: "─",
  dividerV: "│",
  corner: "└",

  // Expansion
  expanded: "▼",
  collapsed: "▶",
  ellipsis: "…",
} as const;

export type Indicator = keyof typeof indicators;

/**
 * Z-index layers for overlays
 * (Conceptual - for rendering order logic)
 */
export const layers = {
  base: 0,
  panel: 1,
  dropdown: 2,
  modal: 3,
  toast: 4,
  tooltip: 5,
} as const;

/**
 * Animation timing presets (in milliseconds)
 */
export const timing = {
  instant: 0,
  fast: 80,
  normal: 150,
  slow: 300,
  verySlow: 500,
} as const;

/**
 * Common widths for UI elements
 */
export const widths = {
  // Input field widths
  inputSmall: 10,
  inputMedium: 20,
  inputLarge: 40,

  // Panel widths (as percentages converted to ratio)
  sidebarNarrow: 0.2,
  sidebarNormal: 0.25,
  sidebarWide: 0.35,

  // Modal widths
  modalSmall: 40,
  modalMedium: 60,
  modalLarge: 80,
} as const;

/**
 * Common heights for UI elements
 */
export const heights = {
  // Row heights
  rowCompact: 1,
  rowNormal: 1,
  rowSpaced: 2,

  // Panel minimum heights
  panelMin: 5,
  panelSmall: 10,
  panelMedium: 15,
  panelLarge: 20,
} as const;

/**
 * Badge/status label variants
 */
export const badgeStyles = {
  success: { text: "white", bg: "green" },
  warning: { text: "black", bg: "yellow" },
  error: { text: "white", bg: "red" },
  info: { text: "white", bg: "blue" },
  neutral: { text: "white", bg: "gray" },
  pending: { text: "black", bg: "yellow" },
  paid: { text: "white", bg: "green" },
  overdue: { text: "white", bg: "red" },
  draft: { text: "white", bg: "gray" },
  sent: { text: "white", bg: "blue" },
  partial: { text: "black", bg: "cyan" },
  cancelled: { text: "white", bg: "gray" },
} as const;

export type BadgeVariant = keyof typeof badgeStyles;

/**
 * Spinner presets for different contexts
 */
export const spinnerPresets = {
  loading: { type: "dots" as const, label: "Loading..." },
  processing: { type: "circle" as const, label: "Processing..." },
  saving: { type: "bounce" as const, label: "Saving..." },
  thinking: { type: "pulse" as const, label: "Thinking..." },
  uploading: { type: "dots" as const, label: "Uploading..." },
  searching: { type: "dots" as const, label: "Searching..." },
} as const;

export type SpinnerPreset = keyof typeof spinnerPresets;
