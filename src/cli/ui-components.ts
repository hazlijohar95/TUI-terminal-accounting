// UI Components for consistent, beautiful CLI output

// Colors
export const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",

  // Text colors
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",

  // Background
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
};

// Box drawing characters
const box = {
  topLeft: "╔",
  topRight: "╗",
  bottomLeft: "╚",
  bottomRight: "╝",
  horizontal: "═",
  vertical: "║",

  // Light box
  ltl: "┌",
  ltr: "┐",
  lbl: "└",
  lbr: "┘",
  lh: "─",
  lv: "│",

  // Table
  cross: "┼",
  tDown: "┬",
  tUp: "┴",
  tRight: "├",
  tLeft: "┤",
};

// Format money with commas and proper alignment
export function formatMoney(amount: number, width: number = 12): string {
  const formatted = amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `$${formatted}`.padStart(width);
}

// Format money with color
export function formatMoneyColored(amount: number, width: number = 12): string {
  const formatted = formatMoney(amount, width);
  if (amount > 0) return `${colors.green}${formatted}${colors.reset}`;
  if (amount < 0) return `${colors.red}${formatted}${colors.reset}`;
  return formatted;
}

// Print a header box
export function printHeader(title: string, width: number = 45): void {
  const padding = width - title.length - 4;
  const rightPad = " ".repeat(Math.max(0, padding));

  console.log(`${colors.bold}${box.topLeft}${box.horizontal.repeat(width - 2)}${box.topRight}${colors.reset}`);
  console.log(`${colors.bold}${box.vertical}  ${title}${rightPad}${box.vertical}${colors.reset}`);
  console.log(`${colors.bold}${box.bottomLeft}${box.horizontal.repeat(width - 2)}${box.bottomRight}${colors.reset}`);
}

// Print a section header
export function printSection(title: string, width: number = 43): void {
  const line = box.lh.repeat(width - title.length - 3);
  console.log(`${colors.bold}${box.ltl}${box.lh} ${title} ${line}${box.ltr}${colors.reset}`);
}

// Print section end
export function printSectionEnd(width: number = 43): void {
  console.log(`${colors.dim}${box.lbl}${box.lh.repeat(width - 2)}${box.lbr}${colors.reset}`);
}

// Print a status badge
export function printStatus(status: string): string {
  const statusConfig: Record<string, { color: string; label: string }> = {
    draft: { color: colors.gray, label: "DRAFT" },
    sent: { color: colors.cyan, label: "SENT" },
    partial: { color: colors.yellow, label: "PARTIAL" },
    paid: { color: colors.green, label: "PAID" },
    overdue: { color: colors.red, label: "OVERDUE" },
    cancelled: { color: colors.gray, label: "CANCELLED" },
  };

  const config = statusConfig[status] || { color: colors.white, label: status.toUpperCase() };
  return `${config.color}${config.label}${colors.reset}`;
}

// Table column definition
export interface TableColumn {
  header: string;
  width: number;
  align?: "left" | "right" | "center";
}

// Print a table
export function printTable(columns: TableColumn[], rows: string[][]): void {
  const totalWidth = columns.reduce((sum, col) => sum + col.width + 3, 1);

  // Top border
  let topBorder = box.ltl;
  columns.forEach((col, i) => {
    topBorder += box.lh.repeat(col.width + 2);
    topBorder += i < columns.length - 1 ? box.tDown : box.ltr;
  });
  console.log(colors.dim + topBorder + colors.reset);

  // Header row
  let headerRow = box.lv;
  columns.forEach((col) => {
    const text = col.header.slice(0, col.width);
    const padded = col.align === "right"
      ? text.padStart(col.width)
      : text.padEnd(col.width);
    headerRow += ` ${colors.bold}${padded}${colors.reset} ${colors.dim}${box.lv}${colors.reset}`;
  });
  console.log(headerRow);

  // Header separator
  let separator = box.tRight;
  columns.forEach((col, i) => {
    separator += box.lh.repeat(col.width + 2);
    separator += i < columns.length - 1 ? box.cross : box.tLeft;
  });
  console.log(colors.dim + separator + colors.reset);

  // Data rows
  for (const row of rows) {
    let dataRow = colors.dim + box.lv + colors.reset;
    columns.forEach((col, i) => {
      const text = (row[i] || "").slice(0, col.width);
      const padded = col.align === "right"
        ? text.padStart(col.width)
        : text.padEnd(col.width);
      dataRow += ` ${padded} ${colors.dim}${box.lv}${colors.reset}`;
    });
    console.log(dataRow);
  }

  // Bottom border
  let bottomBorder = box.lbl;
  columns.forEach((col, i) => {
    bottomBorder += box.lh.repeat(col.width + 2);
    bottomBorder += i < columns.length - 1 ? box.tUp : box.lbr;
  });
  console.log(colors.dim + bottomBorder + colors.reset);
}

// Print key-value pairs in a box
export function printInfoBox(items: Array<{ label: string; value: string; color?: string }>, width: number = 43): void {
  const maxLabelWidth = Math.max(...items.map(i => i.label.length));

  for (const item of items) {
    const label = item.label.padEnd(maxLabelWidth);
    const value = item.color ? `${item.color}${item.value}${colors.reset}` : item.value;
    console.log(`${colors.dim}${box.lv}${colors.reset}  ${label}  ${value}`);
  }
}

// Print a simple divider
export function printDivider(width: number = 43): void {
  console.log(colors.dim + box.lh.repeat(width) + colors.reset);
}

// Print success message
export function printSuccessBox(message: string): void {
  console.log(`${colors.green}✓ ${message}${colors.reset}`);
}

// Print error message
export function printErrorBox(message: string): void {
  console.log(`${colors.red}✗ ${message}${colors.reset}`);
}

// Print warning message
export function printWarningBox(message: string): void {
  console.log(`${colors.yellow}⚠ ${message}${colors.reset}`);
}

// Print hint
export function printHint(message: string): void {
  console.log(`${colors.dim}${message}${colors.reset}`);
}

// Format date nicely
export function formatDate(date: string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Calculate days until/since
export function daysUntil(date: string): number {
  const target = new Date(date);
  const today = new Date();
  const diff = target.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
