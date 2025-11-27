// Interactive session using raw stdin for clean input handling
import * as p from "@clack/prompts";
import pc from "picocolors";
import { getSetting } from "../db/index.js";
import { symbols } from "./theme.js";

// Show quick stats
function showStats(): void {
  try {
    const { getBalanceSheet, getReceivablesAging } = require("../domain/reports.js");
    const balance = getBalanceSheet();
    const ar = getReceivablesAging();

    const cash = balance.assets.cash;
    const receivables = balance.assets.receivables;
    const overdue = ar.totals.days_31_60 + ar.totals.days_61_90 + ar.totals.days_90_plus;

    const stats = [];
    stats.push(`Cash: ${cash >= 0 ? pc.green(`$${cash.toFixed(0)}`) : pc.red(`-$${Math.abs(cash).toFixed(0)}`)}`);
    stats.push(`AR: $${receivables.toFixed(0)}`);

    if (overdue > 0) {
      stats.push(pc.yellow(`${symbols.warning} Overdue: $${overdue.toFixed(0)}`));
    }

    p.log.info(stats.join("  │  "));
  } catch {
    // Stats not available
  }
}

// Session command handler type
type CommandHandler = (args: string[]) => Promise<void>;

export interface SessionOptions {
  onCommand: CommandHandler;
}

// Start interactive session using raw stdin
export async function startSession(options: SessionOptions): Promise<void> {
  const { onCommand } = options;
  const businessName = getSetting("business_name") || "OpenAccounting";

  // Clear and show intro
  console.clear();
  p.intro(pc.bgCyan(pc.black(` ${businessName} `)));

  // Show stats
  showStats();

  // Use raw stdin for complete control
  const stdin = process.stdin;
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');

  let inputBuffer = '';

  const showPrompt = () => {
    process.stdout.write(`\n${pc.cyan("oa")} ${pc.dim("❯")} `);
  };

  showPrompt();

  const handleInput = async (key: string) => {
    // Ctrl+C - exit
    if (key === '\u0003') {
      stdin.setRawMode(false);
      console.log();
      p.outro(pc.dim("Goodbye!"));
      process.exit(0);
    }

    // Ctrl+D - exit
    if (key === '\u0004') {
      stdin.setRawMode(false);
      console.log();
      p.outro(pc.dim("Goodbye!"));
      process.exit(0);
    }

    // Enter key
    if (key === '\r' || key === '\n') {
      console.log();

      const trimmed = inputBuffer.trim();
      inputBuffer = '';

      if (!trimmed) {
        showPrompt();
        return;
      }

      // Exit commands
      if (trimmed === "exit" || trimmed === "quit" || trimmed === "q") {
        stdin.setRawMode(false);
        p.outro(pc.dim("Goodbye!"));
        process.exit(0);
      }

      // Clear command
      if (trimmed === "clear" || trimmed === "cls") {
        console.clear();
        p.intro(pc.bgCyan(pc.black(` ${businessName} `)));
        showStats();
        showPrompt();
        return;
      }

      // Parse and execute
      const args = trimmed.split(/\s+/);

      // Temporarily disable raw mode for command execution
      stdin.setRawMode(false);
      stdin.removeAllListeners('data');

      try {
        await onCommand(args);
      } catch (err) {
        p.log.error((err as Error).message);
      }

      // Re-enable raw mode for next input
      stdin.setRawMode(true);
      stdin.on('data', handleInput);

      showPrompt();
      return;
    }

    // Backspace
    if (key === '\u007F' || key === '\b') {
      if (inputBuffer.length > 0) {
        inputBuffer = inputBuffer.slice(0, -1);
        process.stdout.write('\b \b');
      }
      return;
    }

    // Regular character
    if (key.length === 1 && key.charCodeAt(0) >= 32) {
      inputBuffer += key;
      process.stdout.write(key);
    }
  };

  stdin.on('data', handleInput);
}

// Quick action selector after an action
export async function suggestNextAction(
  suggestions: Array<{ label: string; value: string; hint?: string }>
): Promise<string | null> {
  const result = await p.select({
    message: "What's next?",
    options: [
      ...suggestions,
      { value: "_other", label: pc.dim("Something else...") },
    ],
  });

  if (p.isCancel(result) || result === "_other") {
    return null;
  }

  return result as string;
}
