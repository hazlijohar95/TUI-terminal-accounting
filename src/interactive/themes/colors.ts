/**
 * Interactive Theme Colors
 *
 * Using Catppuccin Mocha for consistency with TUI components.
 * This ensures a unified look across the entire application.
 */

// Catppuccin Mocha palette
const mocha = {
  // Core backgrounds
  base: "#1e1e2e",
  mantle: "#181825",
  crust: "#11111b",
  surface: "#313244",
  surface1: "#45475a",
  surface2: "#585b70",

  // Accent colors
  blue: "#89b4fa",
  sapphire: "#74c7ec",
  yellow: "#f9e2af",
  peach: "#fab387",

  // Status colors
  green: "#a6e3a1",
  red: "#f38ba8",
  teal: "#94e2d5",

  // Additional accents
  pink: "#f5c2e7",
  mauve: "#cba6f7",
  lavender: "#b4befe",

  // Text hierarchy
  text: "#cdd6f4",
  subtext: "#a6adc8",
  overlay: "#9399b2",
};

// Export colors mapped to semantic names (for backward compatibility)
export const colors = {
  // Primary colors - mapped to Catppuccin Mocha
  primary: mocha.blue,
  secondary: mocha.mauve,
  accent: mocha.peach,

  // Status colors
  success: mocha.green,
  error: mocha.red,
  warning: mocha.yellow,
  info: mocha.sapphire,

  // Text colors
  text: mocha.text,
  textMuted: mocha.subtext,
  textDimmed: mocha.overlay,
  textHighlight: "#FFFFFF",

  // Background colors
  background: mocha.base,
  backgroundSecondary: mocha.mantle,
  backgroundTertiary: mocha.surface,

  // Border colors
  border: mocha.surface,
  borderFocused: mocha.blue,
  borderSuccess: mocha.green,

  // Stage colors (for agent workflow)
  stagePlanning: mocha.sapphire,
  stageExecuting: mocha.yellow,
  stageValidating: mocha.mauve,
  stageAnswering: mocha.green,

  // Financial semantics
  income: mocha.green,
  expense: mocha.red,
  neutral: mocha.subtext,
};

// Gradient colors using Catppuccin palette
export const gradientColors = [mocha.blue, mocha.mauve, mocha.peach];

// Export raw mocha palette for direct access if needed
export { mocha };
