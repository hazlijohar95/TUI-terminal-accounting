import * as readline from "readline";
import { loadWorkspaceConfig } from "../core/workspace.js";
import { ensureWorkspace } from "../cli/commands/init.js";
import { getDashboardData } from "../cli/commands/dashboard.js";
import { quickAdd } from "../cli/commands/add.js";
import { runStreamingAgent } from "../agent/streaming.js";
import { parseAnyLedgerFormat } from "../core/ledger-parser.js";

// Colors
const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  blue: "\x1b[34m",
  purple: "\x1b[35m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
};

function print(text: string) {
  process.stdout.write(text);
}

function println(text: string = "") {
  console.log(text);
}

function clearLine() {
  process.stdout.write("\r\x1b[K");
}

export async function startSimpleCLI() {
  // Initialize workspace if needed
  const wasInitialized = await ensureWorkspace();

  // Clear screen and show header
  console.clear();
  println(`${colors.bold}${colors.blue}Open${colors.yellow}Accounting${colors.reset}`);
  println(`${colors.dim}Your AI Financial Assistant${colors.reset}`);
  println();

  // Load workspace info
  let workspaceName = "";
  let transactionCount = 0;

  try {
    const workspace = loadWorkspaceConfig();
    workspaceName = workspace.name;

    try {
      const entries = parseAnyLedgerFormat(workspace.ledger.path);
      transactionCount = entries.length;
    } catch {
      transactionCount = 0;
    }

    println(`${colors.green}●${colors.reset} ${workspaceName} • ${transactionCount} transactions`);

    if (wasInitialized) {
      println(`${colors.green}✓ Created workspace with sample data${colors.reset}`);
    }
  } catch {
    println(`${colors.yellow}No workspace found. Type 'help' to get started.${colors.reset}`);
  }

  println();

  // Show quick start
  println(`${colors.dim}Ask me anything about your finances.${colors.reset}`);
  println(`${colors.dim}Examples: "How am I doing?" • "Show expenses" • "Add coffee 5"${colors.reset}`);
  println();

  // Create readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Helper to promisify question
  const question = (prompt: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(prompt, resolve);
    });
  };

  // Main loop
  while (true) {
    const input = await question(`${colors.blue}>${colors.reset} `);
    const trimmed = input.trim();

    if (!trimmed) {
      continue;
    }

    const lower = trimmed.toLowerCase();

    // Handle commands
    if (lower === "quit" || lower === "exit" || lower === "q") {
      println(`${colors.dim}Goodbye!${colors.reset}`);
      rl.close();
      process.exit(0);
    }

    if (lower === "help" || lower === "h") {
      println();
      println(`${colors.bold}How to use:${colors.reset}`);
      println(`  Just type what you want to know.`);
      println();
      println(`${colors.bold}Examples:${colors.reset}`);
      println(`  "How am I doing this month?"`);
      println(`  "Show my top expenses"`);
      println(`  "Add coffee 5.50"`);
      println(`  "Compare to last month"`);
      println();
      println(`${colors.bold}Commands:${colors.reset}`);
      println(`  dashboard  - See financial summary`);
      println(`  clear      - Clear screen`);
      println(`  quit       - Exit`);
      println();
      continue;
    }

    if (lower === "clear" || lower === "cls") {
      console.clear();
      println(`${colors.bold}${colors.blue}Open${colors.yellow}Accounting${colors.reset}`);
      println();
      continue;
    }

    if (lower === "dashboard" || lower === "dash") {
      try {
        const data = getDashboardData();
        println();
        println(`${colors.bold}${data.period} Summary${colors.reset}`);
        println(`  Income:   ${colors.green}$${data.income.toFixed(2)}${colors.reset}`);
        println(`  Expenses: ${colors.red}$${data.expenses.toFixed(2)}${colors.reset}`);
        const netColor = data.net >= 0 ? colors.green : colors.red;
        println(`  Net:      ${netColor}$${data.net.toFixed(2)}${colors.reset}`);

        if (data.topCategories.length > 0) {
          println();
          println(`${colors.bold}Top Expenses:${colors.reset}`);
          for (const cat of data.topCategories.slice(0, 3)) {
            println(`  • ${cat.name}: $${cat.amount.toFixed(2)} (${cat.percentage}%)`);
          }
        }

        if (data.alerts.length > 0) {
          println();
          for (const alert of data.alerts) {
            println(`  ${alert}`);
          }
        }
        println();
      } catch (err) {
        println(`${colors.red}Error: ${(err as Error).message}${colors.reset}`);
      }
      continue;
    }

    // Handle "add" command
    if (lower.startsWith("add ")) {
      const result = quickAdd(trimmed.substring(4));
      if (result.success) {
        println(`${colors.green}${result.message}${colors.reset}`);
      } else {
        println(`${colors.red}${result.message}${colors.reset}`);
      }
      println();
      continue;
    }

    // Ask the AI agent
    println();

    try {
      const workspace = loadWorkspaceConfig();

      await runStreamingAgent({
        input: trimmed,
        kind: "question",
        ledgerPath: workspace.ledger.path,
        onStageChange: (event) => {
          clearLine();
          const stageText = event.stage === "planning" ? "Thinking..." :
                           event.stage === "actions" ? "Analyzing..." :
                           event.stage === "validating" ? "Checking..." :
                           event.stage === "answering" ? "" : "";
          if (stageText) {
            print(`${colors.dim}${stageText}${colors.reset}`);
          }
        },
        onToken: (token) => {
          // First token clears the stage line
          if (token) {
            clearLine();
          }
          print(token);
        },
        onComplete: () => {
          println();
          println();

          // Show suggestions
          const suggestions = generateSuggestions(trimmed);
          if (suggestions.length > 0) {
            println(`${colors.dim}Try: ${suggestions.join(" • ")}${colors.reset}`);
            println();
          }
        },
      });
    } catch (err) {
      clearLine();
      println(`${colors.red}Error: ${(err as Error).message}${colors.reset}`);
      println();
    }
  }
}

function generateSuggestions(question: string): string[] {
  const lower = question.toLowerCase();

  if (lower.includes("expense") || lower.includes("spending")) {
    return ["break down by category", "compare to last month"];
  }
  if (lower.includes("income") || lower.includes("salary")) {
    return ["show income sources", "calculate savings rate"];
  }
  if (lower.includes("food") || lower.includes("restaurant")) {
    return ["show all food expenses", "average per meal"];
  }
  if (lower.includes("month") || lower.includes("summary")) {
    return ["show trends", "set a budget"];
  }

  return ["show dashboard", "add expense"];
}
