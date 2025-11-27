#!/usr/bin/env node

import React from "react";
import { render } from "ink";
import { App, View } from "./App.js";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { getDb } from "../db/index.js";

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, "../../.env") });

// Initialize database
getDb();

// Parse initial view from args
function getInitialView(): View {
  const args = process.argv.slice(2);
  const viewArg = args[0]?.toLowerCase();

  switch (viewArg) {
    case "chat":
    case "c":
      return "chat";
    case "invoices":
    case "inv":
    case "i":
      return "invoices";
    case "reports":
    case "rep":
    case "r":
      return "reports";
    case "help":
    case "?":
      return "help";
    default:
      return "dashboard";
  }
}

// Render the app
const { waitUntilExit } = render(<App initialView={getInitialView()} />);

waitUntilExit().then(() => {
  process.exit(0);
});
