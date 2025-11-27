/**
 * Agent Tools Module
 *
 * Exports the tool registry and initializes all available tools.
 */

import { getToolRegistry, ToolRegistry, type AgentTool, type ToolResult, type ToolCategory } from "./tool-registry.js";
import { coreTools } from "./core-tools.js";
import { reportingTools } from "./reporting-tools.js";
import { agentLogger } from "../../core/logger.js";

const toolLogger = agentLogger.child({ service: "tools" });

/**
 * Initialize the tool registry with all available tools
 */
export function initializeTools(): ToolRegistry {
  const registry = getToolRegistry();

  // Register core business tools
  registry.registerAll(coreTools);
  toolLogger.debug({ count: coreTools.length }, "Registered core tools");

  // Register reporting tools
  registry.registerAll(reportingTools);
  toolLogger.debug({ count: reportingTools.length }, "Registered reporting tools");

  const stats = registry.getCategoryStats();
  toolLogger.info(
    { total: registry.count, categories: stats },
    "Tool registry initialized"
  );

  return registry;
}

/**
 * Get the initialized tool registry
 * Lazily initializes on first call
 */
let initialized = false;
export function getTools(): ToolRegistry {
  const registry = getToolRegistry();
  if (!initialized) {
    initializeTools();
    initialized = true;
  }
  return registry;
}

/**
 * Execute a tool by name
 */
export async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  return getTools().execute(name, args);
}

/**
 * Get OpenAI-formatted tools for function calling
 */
export function getOpenAITools(categories?: ToolCategory[]) {
  return getTools().toOpenAITools(categories);
}

// Re-export types and utilities
export {
  getToolRegistry,
  ToolRegistry,
  type AgentTool,
  type ToolResult,
  type ToolCategory,
} from "./tool-registry.js";
