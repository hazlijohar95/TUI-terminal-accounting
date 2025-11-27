import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { agentLogger } from "../../core/logger.js";

export type FileToolResult = {
  success: boolean;
  data?: unknown;
  error?: string;
};

export function readFile(path: string): FileToolResult {
  agentLogger.debug({ path }, "Reading file");

  try {
    if (!existsSync(path)) {
      return { success: false, error: `File not found: ${path}` };
    }

    const content = readFileSync(path, "utf-8");
    return {
      success: true,
      data: {
        path,
        content,
        lines: content.split("\n").length,
        size: content.length
      }
    };
  } catch (err) {
    agentLogger.error({ err, path }, "Failed to read file");
    return { success: false, error: (err as Error).message };
  }
}

export function writeFile(path: string, content: string): FileToolResult {
  agentLogger.debug({ path, contentLength: content.length }, "Writing file");

  try {
    writeFileSync(path, content, "utf-8");
    return {
      success: true,
      data: {
        path,
        written: content.length,
        lines: content.split("\n").length
      }
    };
  } catch (err) {
    agentLogger.error({ err, path }, "Failed to write file");
    return { success: false, error: (err as Error).message };
  }
}

export function editFile(
  path: string,
  searchText: string,
  replaceText: string,
  replaceAll: boolean = false
): FileToolResult {
  agentLogger.debug({ path, searchLength: searchText.length, replaceAll }, "Editing file");

  try {
    if (!existsSync(path)) {
      return { success: false, error: `File not found: ${path}` };
    }

    let content = readFileSync(path, "utf-8");

    if (!content.includes(searchText)) {
      return { success: false, error: "Search text not found in file" };
    }

    const occurrences = (content.match(new RegExp(escapeRegExp(searchText), "g")) || []).length;

    if (replaceAll) {
      content = content.split(searchText).join(replaceText);
    } else {
      content = content.replace(searchText, replaceText);
    }

    writeFileSync(path, content, "utf-8");

    return {
      success: true,
      data: {
        path,
        replacements: replaceAll ? occurrences : 1,
        newSize: content.length
      }
    };
  } catch (err) {
    agentLogger.error({ err, path }, "Failed to edit file");
    return { success: false, error: (err as Error).message };
  }
}

export function appendToFile(path: string, content: string): FileToolResult {
  agentLogger.debug({ path, contentLength: content.length }, "Appending to file");

  try {
    let existing = "";
    if (existsSync(path)) {
      existing = readFileSync(path, "utf-8");
    }

    const newContent = existing + (existing.endsWith("\n") ? "" : "\n") + content;
    writeFileSync(path, newContent, "utf-8");

    return {
      success: true,
      data: {
        path,
        appended: content.length,
        totalSize: newContent.length
      }
    };
  } catch (err) {
    agentLogger.error({ err, path }, "Failed to append to file");
    return { success: false, error: (err as Error).message };
  }
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
