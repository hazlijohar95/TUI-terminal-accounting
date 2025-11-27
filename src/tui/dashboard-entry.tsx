#!/usr/bin/env node

/**
 * Dashboard Entry Point
 *
 * Renders a full-screen TUI dashboard using Ink.
 * Uses alternate screen mode like htop/lazygit.
 */

import React from "react";
import { render } from "ink";
import { DashboardApp } from "./DashboardApp.js";
import { config } from "dotenv";
import { existsSync } from "fs";
import { createInterface } from "readline";
import { getDb, setSetting } from "../db/index.js";
import { init } from "../cli/commands/init.js";

// Load environment variables from current working directory
config();

// Colors
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;

// Wait for Enter key
async function waitForEnter(): Promise<void> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question("", () => {
      rl.close();
      resolve();
    });
  });
}

// Prompt with better formatting
async function prompt(label: string, hint?: string, defaultValue?: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  return new Promise((resolve) => {
    let promptText = `  ${cyan("›")} ${label}`;
    if (defaultValue) {
      promptText += dim(` [${defaultValue}]`);
    }
    promptText += ": ";

    rl.question(promptText, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue || "");
    });
  });
}

// ASCII art logo
const ASCII_LOGO = [
  "    ██████╗ ██████╗ ███████╗███╗   ██╗",
  "   ██╔═══██╗██╔══██╗██╔════╝████╗  ██║",
  "   ██║   ██║██████╔╝█████╗  ██╔██╗ ██║",
  "   ██║   ██║██╔═══╝ ██╔══╝  ██║╚██╗██║",
  "   ╚██████╔╝██║     ███████╗██║ ╚████║",
  "    ╚═════╝ ╚═╝     ╚══════╝╚═╝  ╚═══╝",
  "    █████╗  ██████╗ ██████╗████████╗",
  "   ██╔══██╗██╔════╝██╔════╝╚══██╔══╝",
  "   ███████║██║     ██║        ██║   ",
  "   ██╔══██║██║     ██║        ██║   ",
  "   ██║  ██║╚██████╗╚██████╗   ██║   ",
  "   ╚═╝  ╚═╝ ╚═════╝ ╚═════╝   ╚═╝   ",
];

// Render welcome screen
function renderWelcome(): void {
  console.clear();
  console.log();

  // ASCII art in default terminal color (no color = uses terminal's text color)
  ASCII_LOGO.forEach(line => console.log(line));

  console.log();
  console.log(bold("         ◆ OpenAccounting.dev ◆"));
  console.log(dim("      Track invoices, expenses & more"));
  console.log(dim("      All data stays on your machine"));
  console.log();
}

// Interactive onboarding
async function runOnboarding(): Promise<void> {
  renderWelcome();

  console.log(dim("   Press Enter to start setup..."));
  await waitForEnter();

  // Initialize workspace files
  await init({ silent: true });

  console.clear();
  console.log();
  console.log(bold("   Quick Setup") + dim(" (4 questions)\n"));

  // Step 1: Business name
  console.log(dim("   What should we call your business?\n"));
  const businessName = await prompt("Business name", undefined, "My Business");
  setSetting("business_name", businessName);

  // Step 2: Currency
  console.log();
  console.log(dim("   What currency do you use?\n"));
  const currency = await prompt("Currency code", "e.g. USD, EUR, MYR, GBP", "USD");
  setSetting("currency", currency);

  // Step 3: Fiscal year
  console.log();
  console.log(dim("   When does your fiscal year end?\n"));
  const fiscalYearEnd = await prompt("Month (1-12)", "12 = December", "12");
  setSetting("fiscal_year_end", fiscalYearEnd);

  // Step 4: Entity type (optional)
  console.log();
  console.log(dim("   What type of business? ") + dim("(optional, press Enter to skip)\n"));
  const entityType = await prompt("Entity type", "LLC, Inc, Sole Prop, etc.", "");
  setSetting("entity_type", entityType);

  // Mark setup as complete
  setSetting("_initialized", "true");

  // Success
  console.log();
  console.log(green("   ✓ Ready to go!"));
  console.log();
  console.log(dim("   Tip: Press ") + yellow("?") + dim(" anytime to see keyboard shortcuts"));
  console.log();
  console.log(dim("   Launching dashboard..."));
  await new Promise(resolve => setTimeout(resolve, 1500));
}

// Enter alternate screen mode (like htop/lazygit)
function enterAlternateScreen() {
  process.stdout.write("\x1b[?1049h"); // Enter alternate screen buffer
  process.stdout.write("\x1b[?25l");   // Hide cursor
  process.stdout.write("\x1b[2J");     // Clear screen
  process.stdout.write("\x1b[H");      // Move cursor to home
}

// Exit alternate screen mode
function exitAlternateScreen() {
  process.stdout.write("\x1b[?25h");   // Show cursor
  process.stdout.write("\x1b[?1049l"); // Exit alternate screen buffer
}

// Handle unexpected exits
function setupCleanup() {
  const cleanup = () => {
    exitAlternateScreen();
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
  process.on("exit", () => {
    exitAlternateScreen();
  });
}

// Handle CLI arguments
function handleArgs(): boolean {
  const args = process.argv.slice(2);

  if (args[0] === "reset" || args[0] === "fresh") {
    const { rmSync } = require("fs");
    const { homedir } = require("os");

    console.log();
    console.log(bold("  ◆ OpenAccounting"));
    console.log();
    console.log(dim("  Clearing all data..."));

    // Remove local files
    try { rmSync("oa.db", { force: true }); } catch {}
    try { rmSync("oa-workspace.json", { force: true }); } catch {}
    try { rmSync(`${homedir()}/.openaccounting`, { recursive: true, force: true }); } catch {}

    console.log(green("  ✓ Fresh start ready"));
    console.log();
    console.log(dim("  Run ") + cyan("oa") + dim(" to begin"));
    console.log();
    return true;
  }

  if (args[0] === "version" || args[0] === "-v" || args[0] === "--version") {
    console.log("OpenAccounting v0.2.0");
    return true;
  }

  if (args[0] === "help" || args[0] === "-h" || args[0] === "--help") {
    console.log();
    console.log(bold("  ◆ OpenAccounting"));
    console.log(dim("  Terminal-native accounting for freelancers & small businesses"));
    console.log();
    console.log("  " + bold("Commands"));
    console.log();
    console.log("    " + cyan("oa") + "              Open your books");
    console.log("    " + cyan("oa fresh") + "        Start fresh (clears all data)");
    console.log("    " + cyan("oa help") + "         Show this guide");
    console.log("    " + cyan("oa version") + "      Show version");
    console.log();
    console.log("  " + bold("Navigation"));
    console.log();
    console.log("    " + dim("Press") + " ? " + dim("inside the app for keyboard shortcuts"));
    console.log();
    console.log("  " + bold("Links"));
    console.log();
    console.log("    " + dim("Docs") + "    openaccounting.dev/docs");
    console.log("    " + dim("GitHub") + "  github.com/openaccounting/openaccounting");
    console.log();
    return true;
  }

  return false;
}

async function main() {
  // Handle CLI arguments first
  if (handleArgs()) {
    return;
  }

  // Check if workspace exists, run onboarding if not
  if (!existsSync("oa-workspace.json")) {
    await runOnboarding();
  }

  // Initialize database
  getDb();

  // Enter full-screen mode
  enterAlternateScreen();
  setupCleanup();

  try {
    // Render the dashboard
    const { waitUntilExit } = render(<DashboardApp />, {
      exitOnCtrlC: false, // We handle this ourselves
    });

    // Wait for user to exit
    await waitUntilExit();
  } finally {
    // Always restore terminal
    exitAlternateScreen();
  }
}

main().catch((error) => {
  exitAlternateScreen();
  console.error("Error:", error.message);
  process.exit(1);
});
