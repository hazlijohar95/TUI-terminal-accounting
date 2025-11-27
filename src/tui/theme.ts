/**
 * Theme Configuration
 *
 * Minimal, clean color palette inspired by Linear/Notion.
 * Uses Catppuccin colors but simplified to essential semantics.
 */

import { getSetting } from "../db/index.js";

// Catppuccin Mocha (dark theme) - simplified palette
const mocha = {
  // Core backgrounds
  base: "#1e1e2e",        // Main background
  mantle: "#181825",      // Darker background
  crust: "#11111b",       // Darkest background
  surface: "#313244",     // Borders, elevated surfaces
  surface1: "#45475a",    // Lighter surface
  surface2: "#585b70",    // Lightest surface

  // Primary accent - blue (cleaner than yellow)
  blue: "#89b4fa",        // Primary accent, interactive elements
  yellow: "#f9e2af",      // Highlights, warnings
  sapphire: "#74c7ec",    // Secondary accent

  // Status colors
  green: "#a6e3a1",       // Success, positive
  red: "#f38ba8",         // Error, negative
  peach: "#fab387",       // Warning, attention

  // Legacy (kept for compatibility)
  teal: "#94e2d5",
  pink: "#f5c2e7",
  mauve: "#cba6f7",
  lavender: "#b4befe",

  // Text hierarchy
  text: "#cdd6f4",        // Primary text
  subtext: "#a6adc8",     // Secondary text, hints
  overlay: "#9399b2",     // Tertiary text
};

// Catppuccin Latte (light theme) - simplified palette
const latte = {
  // Core backgrounds
  base: "#eff1f5",
  mantle: "#e6e9ef",
  crust: "#dce0e8",
  surface: "#ccd0da",
  surface1: "#bcc0cc",
  surface2: "#acb0be",

  // Primary accent
  blue: "#1e66f5",
  yellow: "#df8e1d",
  sapphire: "#209fb5",

  // Status colors
  green: "#40a02b",
  red: "#d20f39",
  peach: "#fe640b",

  // Legacy
  teal: "#179299",
  pink: "#ea76cb",
  mauve: "#8839ef",
  lavender: "#7287fd",

  // Text hierarchy
  text: "#4c4f69",
  subtext: "#6c6f85",
  overlay: "#7c7f93",
};

// Get current theme based on setting
export function getTheme(): typeof mocha {
  try {
    const theme = getSetting("theme");
    return theme === "light" ? latte : mocha;
  } catch {
    return mocha;
  }
}

// Export current colors (for backward compatibility)
export const colors = getTheme();

/**
 * Semantic color aliases for consistent usage
 * Use these in components for semantic meaning
 */
export const semantic = {
  // Interactive elements
  primary: colors.blue,      // Primary actions, links
  secondary: colors.subtext, // Secondary actions
  accent: colors.yellow,     // Highlights, agent activity
  focus: colors.sapphire,    // Focus states

  // Borders & surfaces
  border: colors.surface,
  borderActive: colors.blue,
  surfaceElevated: colors.surface1,

  // Status
  success: colors.green,
  error: colors.red,
  warning: colors.peach,
  info: colors.blue,
  loading: colors.yellow,

  // Financial semantics
  income: colors.green,
  expense: colors.red,
  neutral: colors.text,

  // Agent reasoning
  thought: colors.subtext,
  action: colors.yellow,
  observation: colors.green,
  answer: colors.blue,

  // Document types
  receipt: colors.peach,
  invoice: colors.blue,
  statement: colors.teal,
  contract: colors.lavender,
};

/**
 * Typography helpers
 */
export const typography = {
  // Semantic text styles (for documentation)
  heading: { bold: true, color: colors.text },
  body: { color: colors.text },
  muted: { color: colors.subtext, dimColor: true },
  label: { color: colors.subtext },
  code: { backgroundColor: colors.surface },
};

// Legacy AI Configuration (moved to config.ts in agent)
export const aiConfig = {
  model: "gpt-4o-mini",
  maxTokens: 500,
  temperature: 0.7,
};

export default colors;
