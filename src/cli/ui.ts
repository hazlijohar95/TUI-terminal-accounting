// Simple CLI UI helpers (gcloud-inspired)

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
};

export function printTitle(text: string): void {
  console.log(`\n${colors.bold}${colors.cyan}${text}${colors.reset}\n`);
}

export function printSection(label: string): void {
  console.log(`${colors.bold}${colors.yellow}${label}${colors.reset}`);
}

export function printSuccess(text: string): void {
  console.log(`${colors.green}${text}${colors.reset}`);
}

export function printError(text: string): void {
  console.error(`${colors.red}ERROR:${colors.reset} ${text}`);
}

export function printDim(text: string): void {
  console.log(`${colors.dim}${text}${colors.reset}`);
}

export function printBullet(text: string): void {
  console.log(`  ${colors.dim}-${colors.reset} ${text}`);
}

export function printTable(rows: Array<{ [key: string]: string | number }>): void {
  if (rows.length === 0) {
    printDim("  (no data)");
    return;
  }

  const keys = Object.keys(rows[0]);
  const widths: { [key: string]: number } = {};

  // Calculate column widths
  for (const key of keys) {
    widths[key] = key.length;
    for (const row of rows) {
      const val = String(row[key] ?? "");
      widths[key] = Math.max(widths[key], val.length);
    }
  }

  // Print header
  const header = keys.map((k) => k.toUpperCase().padEnd(widths[k])).join("  ");
  console.log(`  ${colors.bold}${header}${colors.reset}`);

  // Print rows
  for (const row of rows) {
    const line = keys.map((k) => String(row[k] ?? "").padEnd(widths[k])).join("  ");
    console.log(`  ${line}`);
  }
}

export function printKeyValue(key: string, value: string): void {
  console.log(`  ${colors.dim}${key}:${colors.reset} ${value}`);
}

export function printHelp(): void {
  console.log(`${colors.bold}NAME${colors.reset}
    oa - OpenAccounting CLI

${colors.bold}SYNOPSIS${colors.reset}
    oa ${colors.dim}<command>${colors.reset} [arguments]

${colors.bold}COMMANDS${colors.reset}
    ${colors.cyan}init${colors.reset}
        Initialize a new OpenAccounting workspace in the current directory.

    ${colors.cyan}ask${colors.reset} <question>
        Ask a question about your accounting data.

    ${colors.cyan}propose${colors.reset} <instruction>
        Propose ledger postings based on an instruction.

${colors.bold}FLAGS${colors.reset}
    --help, -h      Show this help message
    --version, -v   Show version number

${colors.bold}EXAMPLES${colors.reset}
    ${colors.dim}# Initialize a workspace${colors.reset}
    oa init

    ${colors.dim}# Ask about expenses${colors.reset}
    oa ask "explain my expenses this month"

    ${colors.dim}# Propose postings${colors.reset}
    oa propose "propose postings for March bank transactions"
`);
}
