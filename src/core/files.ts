import { readFileSync, existsSync } from "node:fs";
import { basename } from "node:path";
import { loadWorkspaceConfig } from "./workspace.js";

export function readTextFile(path: string): string {
  return readFileSync(path, "utf-8");
}

export function listWorkspaceFiles(): string[] {
  const files: string[] = [];

  try {
    const workspace = loadWorkspaceConfig();

    // Add ledger file
    if (workspace.ledger?.path && existsSync(workspace.ledger.path)) {
      files.push(basename(workspace.ledger.path));
    }

    // Add source files
    for (const source of workspace.sources || []) {
      if (source.path && existsSync(source.path)) {
        files.push(basename(source.path));
      }
    }

    // Add workspace config itself
    if (existsSync("oa-workspace.json")) {
      files.push("oa-workspace.json");
    }
  } catch {
    // No workspace configured
  }

  return files;
}
