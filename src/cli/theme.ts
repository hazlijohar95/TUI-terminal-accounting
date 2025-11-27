// Theme and styling for OpenAccounting CLI
import pc from "picocolors";

// Theme colors and styles
export const theme = {
  // Primary colors
  primary: pc.cyan,
  secondary: pc.blue,
  accent: pc.magenta,

  // Status colors
  success: pc.green,
  error: pc.red,
  warning: pc.yellow,
  info: pc.blue,

  // Text styles
  dim: pc.dim,
  bold: pc.bold,
  italic: pc.italic,

  // Semantic
  money: (amount: number) => (amount >= 0 ? pc.green(`$${amount.toFixed(2)}`) : pc.red(`-$${Math.abs(amount).toFixed(2)}`)),
  highlight: pc.bgCyan,
};

// Re-export pc for convenience
export { pc };

// Box drawing characters
export const box = {
  // Heavy
  tl: "╭",
  tr: "╮",
  bl: "╰",
  br: "╯",
  h: "─",
  v: "│",

  // Connectors
  cross: "┼",
  tDown: "┬",
  tUp: "┴",
  tRight: "├",
  tLeft: "┤",
};

// Icons/symbols
export const symbols = {
  success: pc.green("✓"),
  error: pc.red("✗"),
  warning: pc.yellow("⚠"),
  info: pc.blue("ℹ"),
  pointer: pc.cyan("❯"),
  dot: "•",
  dash: "─",
  arrow: "→",
  check: "✓",
  x: "✗",
};

// ASCII Logo - Premium block letters with gradient
// Re-export from ascii-art module
export { renderWelcome, logoCompact, ASCII_LOGO } from "./ascii-art.js";

// Fallback compact logo for narrow terminals
export const logoFallback = `
${pc.cyan("╭───────────────────────────────╮")}
${pc.cyan("│")}  ${pc.bold(pc.white("OpenAccounting"))}              ${pc.cyan("│")}
${pc.cyan("│")}  ${pc.dim("Terminal-native accounting")}   ${pc.cyan("│")}
${pc.cyan("╰───────────────────────────────╯")}
`;

// Alias for backwards compatibility
export { ASCII_LOGO as logo } from "./ascii-art.js";

// Format helpers
export function formatCurrency(amount: number): string {
  const formatted = Math.abs(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (amount >= 0) {
    return pc.green(`$${formatted}`);
  }
  return pc.red(`-$${formatted}`);
}

export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Status badges
export function statusBadge(status: string): string {
  const badges: Record<string, string> = {
    draft: pc.dim("DRAFT"),
    sent: pc.cyan("SENT"),
    partial: pc.yellow("PARTIAL"),
    paid: pc.green("PAID"),
    overdue: pc.red("OVERDUE"),
    cancelled: pc.dim("CANCELLED"),
  };
  return badges[status] || pc.white(status.toUpperCase());
}

// Print helpers
export function printBox(content: string[], title?: string): void {
  const maxWidth = Math.max(...content.map((l) => l.length), title?.length || 0);
  const width = maxWidth + 4;

  if (title) {
    const padding = width - title.length - 4;
    console.log(`${pc.dim(box.tl)}${pc.dim(box.h)} ${pc.bold(title)} ${pc.dim(box.h.repeat(padding))}${pc.dim(box.tr)}`);
  } else {
    console.log(pc.dim(`${box.tl}${box.h.repeat(width - 2)}${box.tr}`));
  }

  for (const line of content) {
    console.log(`${pc.dim(box.v)} ${line.padEnd(maxWidth + 1)}${pc.dim(box.v)}`);
  }

  console.log(pc.dim(`${box.bl}${box.h.repeat(width - 2)}${box.br}`));
}

// Spinner frames
export const spinnerFrames = ["◒", "◐", "◓", "◑"];

// Print utilities
export function printSuccess(message: string): void {
  console.log(pc.green(`  ${symbols.success} ${message}`));
}

export function printError(message: string): void {
  console.log(pc.red(`  ${symbols.error} ${message}`));
}

export function printWarning(message: string): void {
  console.log(pc.yellow(`  ${symbols.warning} ${message}`));
}

export function printInfo(message: string): void {
  console.log(pc.dim(`  ${symbols.info} ${message}`));
}

export function printDim(message: string): void {
  console.log(pc.dim(`  ${message}`));
}

// Table printing
export interface TableColumn {
  header: string;
  width: number;
  align?: "left" | "right" | "center";
}

export function printTable(columns: TableColumn[], rows: string[][]): void {
  // Header
  let header = "";
  columns.forEach((col, i) => {
    const text = col.header.slice(0, col.width);
    const padded = col.align === "right" ? text.padStart(col.width) : text.padEnd(col.width);
    header += `  ${pc.bold(padded)}`;
  });
  console.log(header);

  // Separator
  let sep = "";
  columns.forEach((col) => {
    sep += `  ${pc.dim(box.h.repeat(col.width))}`;
  });
  console.log(sep);

  // Rows
  for (const row of rows) {
    let line = "";
    columns.forEach((col, i) => {
      const text = (row[i] || "").slice(0, col.width);
      const padded = col.align === "right" ? text.padStart(col.width) : text.padEnd(col.width);
      line += `  ${padded}`;
    });
    console.log(line);
  }
}

// Suggestions after actions
export function printSuggestions(suggestions: Array<{ key: string; label: string; command: string }>): void {
  console.log();
  console.log(pc.dim("  Suggested:"));
  for (const s of suggestions) {
    console.log(`    ${pc.cyan(`[${s.key}]`)} ${s.label} ${pc.dim(`→ ${s.command}`)}`);
  }
}

// Header with optional stats
export function printHeader(title: string, stats?: Array<{ label: string; value: string }>): void {
  console.log();
  console.log(`  ${pc.bold(pc.cyan(title))}`);
  if (stats) {
    const statLine = stats.map(s => `${s.label}: ${s.value}`).join("  │  ");
    console.log(pc.dim(`  ${statLine}`));
  }
  console.log();
}
