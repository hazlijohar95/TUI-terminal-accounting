// Enhanced chat UI with animations and better layout
import pc from "picocolors";
import { getDatabaseContext } from "../agent/tools/db-queries.js";

// Terminal control codes
const ESC = "\x1b";
const clearLine = `${ESC}[2K`;
const cursorUp = (n: number) => `${ESC}[${n}A`;
const cursorDown = (n: number) => `${ESC}[${n}B`;
const cursorTo = (x: number) => `${ESC}[${x}G`;
const saveCursor = `${ESC}[s`;
const restoreCursor = `${ESC}[u`;

// Get terminal width
function getTerminalWidth(): number {
  return process.stdout.columns || 80;
}

// Render the header
export function renderHeader(): void {
  const width = Math.min(getTerminalWidth() - 4, 70);

  console.log();
  console.log(pc.dim("  ╭" + "─".repeat(width - 2) + "╮"));
  console.log(pc.dim("  │ ") + pc.bold(pc.magenta("🤖 Financial Advisor")) + " ".repeat(width - 24) + pc.dim("│"));
  console.log(pc.dim("  │ ") + pc.dim("Your AI-powered financial assistant") + " ".repeat(width - 38) + pc.dim("│"));
  console.log(pc.dim("  ╰" + "─".repeat(width - 2) + "╯"));
  console.log();
}

// Render context sidebar (returns string array for positioning)
export function getContextSidebar(): string[] {
  const ctx = getDatabaseContext();
  const lines: string[] = [];

  lines.push(pc.dim("┌─ Overview ────────┐"));
  lines.push(pc.dim("│ ") + `Cash: ${ctx.summary.cash >= 0 ? pc.green(`$${ctx.summary.cash.toFixed(0)}`) : pc.red(`-$${Math.abs(ctx.summary.cash).toFixed(0)}`)}`.padEnd(26) + pc.dim("│"));
  lines.push(pc.dim("│ ") + `AR: ${pc.yellow(`$${ctx.summary.receivables.toFixed(0)}`)}`.padEnd(26) + pc.dim("│"));

  if (ctx.invoices.overdue > 0) {
    lines.push(pc.dim("│ ") + `${pc.red("⚠")} Overdue: ${pc.red(`$${ctx.invoices.overdue.toFixed(0)}`)}`.padEnd(26) + pc.dim("│"));
  }

  lines.push(pc.dim("│") + " ".repeat(19) + pc.dim("│"));
  lines.push(pc.dim("│ ") + pc.bold("This Month") + " ".repeat(8) + pc.dim("│"));
  lines.push(pc.dim("│ ") + `Rev: ${pc.green(`$${ctx.profitLoss.revenue.toFixed(0)}`)}`.padEnd(26) + pc.dim("│"));
  lines.push(pc.dim("│ ") + `Exp: ${pc.red(`$${ctx.profitLoss.expenses.toFixed(0)}`)}`.padEnd(26) + pc.dim("│"));
  lines.push(pc.dim("└───────────────────┘"));

  return lines;
}

// Render a message box
export function renderAgentMessage(text: string, width: number = 52): void {
  const lines = wrapText(text, width - 4).split('\n');

  console.log();
  console.log(pc.cyan("  ┌─ Agent ") + pc.cyan("─".repeat(width - 11)) + pc.cyan("┐"));
  for (const line of lines) {
    const padding = width - 4 - stripAnsi(line).length;
    console.log(pc.cyan("  │ ") + line + " ".repeat(Math.max(0, padding)) + pc.cyan(" │"));
  }
  console.log(pc.cyan("  └") + pc.cyan("─".repeat(width - 2)) + pc.cyan("┘"));
}

// Typewriter effect for text
export async function typeWriter(
  text: string,
  speed: number = 15,
  prefix: string = ""
): Promise<void> {
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    process.stdout.write(prefix);

    for (const char of line) {
      process.stdout.write(char);
      await sleep(speed);
    }

    if (i < lines.length - 1) {
      console.log();
    }
  }
  console.log();
}

// Render agent message with typewriter effect
export async function renderAgentMessageAnimated(text: string, width: number = 52): Promise<void> {
  const lines = wrapText(text, width - 4).split('\n');

  console.log();
  console.log(pc.cyan("  ┌─ Agent ") + pc.cyan("─".repeat(width - 11)) + pc.cyan("┐"));

  for (const line of lines) {
    process.stdout.write(pc.cyan("  │ "));

    // Type each character
    for (const char of line) {
      process.stdout.write(char);
      await sleep(12);
    }

    // Padding and border
    const padding = width - 4 - line.length;
    process.stdout.write(" ".repeat(Math.max(0, padding)) + pc.cyan(" │") + "\n");
  }

  console.log(pc.cyan("  └") + pc.cyan("─".repeat(width - 2)) + pc.cyan("┘"));
}

// Render quick actions
export function renderQuickActions(actions: Array<{ key: string; label: string }>): void {
  if (actions.length === 0) return;

  console.log();
  console.log(pc.dim("  Quick actions:"));
  for (const action of actions) {
    console.log(`  ${pc.cyan(`[${action.key}]`)} ${pc.dim(action.label)}`);
  }
}

// Render suggestions
export function renderSuggestions(suggestions: string[]): void {
  if (suggestions.length === 0) return;

  console.log();
  console.log(pc.dim("  Try asking:"));
  for (const suggestion of suggestions) {
    console.log(`  ${pc.dim("•")} ${pc.italic(pc.dim(suggestion))}`);
  }
}

// Animated spinner frames
export const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

// Create animated spinner
export function createSpinner(message: string): { start: () => void; stop: () => void } {
  let frameIndex = 0;
  let interval: NodeJS.Timeout | null = null;

  return {
    start: () => {
      interval = setInterval(() => {
        process.stdout.write(`\r  ${pc.magenta(spinnerFrames[frameIndex])} ${pc.dim(message)}`);
        frameIndex = (frameIndex + 1) % spinnerFrames.length;
      }, 80);
    },
    stop: () => {
      if (interval) {
        clearInterval(interval);
        process.stdout.write("\r" + " ".repeat(message.length + 10) + "\r");
      }
    }
  };
}

// Pulse animation for waiting
export async function pulseText(text: string, duration: number = 2000): Promise<void> {
  const start = Date.now();
  const colors = [pc.dim, pc.reset, pc.bold];
  let colorIndex = 0;

  while (Date.now() - start < duration) {
    process.stdout.write(`\r  ${colors[colorIndex](text)}`);
    colorIndex = (colorIndex + 1) % colors.length;
    await sleep(300);
  }
  process.stdout.write("\r" + " ".repeat(text.length + 10) + "\r");
}

// Helper: wrap text to width
function wrapText(text: string, width: number): string {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= width) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines.join('\n');
}

// Helper: strip ANSI codes for length calculation
function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

// Helper: sleep
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Generate contextual suggestions based on data
export function getContextualSuggestions(context: ReturnType<typeof getDatabaseContext>): string[] {
  const suggestions: string[] = [];

  if (context.invoices.overdue > 0) {
    suggestions.push("How do I collect overdue payments?");
  }

  if (context.summary.cash < context.profitLoss.expenses) {
    suggestions.push("How can I improve my cash flow?");
  }

  if (context.profitLoss.expenses > context.profitLoss.revenue) {
    suggestions.push("Where can I cut expenses?");
  }

  if (suggestions.length === 0) {
    suggestions.push("What's my financial health score?");
    suggestions.push("Show me spending trends");
  }

  return suggestions.slice(0, 3);
}

// Generate quick actions based on conversation
export function getQuickActions(lastResponse: string): Array<{ key: string; label: string; command: string }> {
  const actions: Array<{ key: string; label: string; command: string }> = [];

  // Detect mentions in response
  if (lastResponse.toLowerCase().includes("overdue") || lastResponse.toLowerCase().includes("collect")) {
    actions.push({ key: "1", label: "View overdue invoices", command: "list inv --status overdue" });
  }

  if (lastResponse.toLowerCase().includes("expense") || lastResponse.toLowerCase().includes("cost")) {
    actions.push({ key: "2", label: "View expenses", command: "report expenses" });
  }

  if (lastResponse.toLowerCase().includes("cash") || lastResponse.toLowerCase().includes("flow")) {
    actions.push({ key: "3", label: "Cash flow report", command: "report cashflow" });
  }

  // Default actions if none detected
  if (actions.length === 0) {
    actions.push({ key: "1", label: "View dashboard", command: "dashboard" });
    actions.push({ key: "2", label: "Create invoice", command: "create inv" });
  }

  return actions.slice(0, 3);
}
