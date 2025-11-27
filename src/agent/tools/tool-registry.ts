/**
 * Tool Registry
 *
 * Unified tool management system for the AI Accounting Agent.
 * Provides registration, categorization, and execution of agent tools.
 */

import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { agentLogger } from "../../core/logger.js";

const toolLogger = agentLogger.child({ service: "tool-registry" });

export type ToolCategory =
  | "customer"
  | "vendor"
  | "invoice"
  | "expense"
  | "payment"
  | "report"
  | "journal"
  | "utility"
  | "document";

export interface ToolParameter {
  type: "string" | "number" | "boolean" | "array" | "object";
  description?: string;
  enum?: string[];
  items?: ToolParameter;
  properties?: Record<string, ToolParameter>;
  required?: string[];
}

export interface ToolResult {
  success: boolean;
  result: string;
  data?: unknown;
  error?: string;
}

export interface AgentTool {
  name: string;
  description: string;
  category: ToolCategory;
  parameters: {
    type: "object";
    properties: Record<string, ToolParameter>;
    required?: string[];
  };
  handler: (args: Record<string, unknown>) => Promise<ToolResult>;
  requiresConfirmation?: boolean;
  hidden?: boolean; // Hide from tool list but still callable
}

export class ToolRegistry {
  private tools: Map<string, AgentTool> = new Map();

  /**
   * Register a new tool
   */
  register(tool: AgentTool): void {
    if (this.tools.has(tool.name)) {
      toolLogger.warn({ tool: tool.name }, "Overwriting existing tool");
    }
    this.tools.set(tool.name, tool);
    toolLogger.debug({ tool: tool.name, category: tool.category }, "Registered tool");
  }

  /**
   * Register multiple tools at once
   */
  registerAll(tools: AgentTool[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  /**
   * Get a tool by name
   */
  get(name: string): AgentTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Check if a tool exists
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * List all tools, optionally filtered by category
   */
  list(category?: ToolCategory): AgentTool[] {
    const allTools = Array.from(this.tools.values()).filter((t) => !t.hidden);
    if (category) {
      return allTools.filter((t) => t.category === category);
    }
    return allTools;
  }

  /**
   * List tools by multiple categories
   */
  listByCategories(categories: ToolCategory[]): AgentTool[] {
    return Array.from(this.tools.values()).filter(
      (t) => !t.hidden && categories.includes(t.category)
    );
  }

  /**
   * Get all available categories
   */
  getCategories(): ToolCategory[] {
    const categories = new Set<ToolCategory>();
    for (const tool of this.tools.values()) {
      if (!tool.hidden) {
        categories.add(tool.category);
      }
    }
    return Array.from(categories).sort();
  }

  /**
   * Get count of tools per category
   */
  getCategoryStats(): Record<ToolCategory, number> {
    const stats: Partial<Record<ToolCategory, number>> = {};
    for (const tool of this.tools.values()) {
      if (!tool.hidden) {
        stats[tool.category] = (stats[tool.category] || 0) + 1;
      }
    }
    return stats as Record<ToolCategory, number>;
  }

  /**
   * Execute a tool by name
   */
  async execute(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        success: false,
        result: `Unknown tool: ${name}`,
        error: `Tool "${name}" not found in registry`,
      };
    }

    toolLogger.debug({ tool: name, args: Object.keys(args) }, "Executing tool");

    try {
      const result = await tool.handler(args);
      toolLogger.debug(
        { tool: name, success: result.success },
        result.success ? "Tool executed successfully" : "Tool execution failed"
      );
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      toolLogger.error({ tool: name, err }, "Tool execution threw error");
      return {
        success: false,
        result: `Error executing ${name}: ${errorMsg}`,
        error: errorMsg,
      };
    }
  }

  /**
   * Convert tools to OpenAI function calling format
   */
  toOpenAITools(categories?: ToolCategory[]): ChatCompletionTool[] {
    const toolList = categories ? this.listByCategories(categories) : this.list();

    return toolList.map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  /**
   * Get tools that require user confirmation before execution
   */
  getConfirmationRequired(): AgentTool[] {
    return Array.from(this.tools.values()).filter((t) => t.requiresConfirmation);
  }

  /**
   * Check if a tool requires confirmation
   */
  requiresConfirmation(name: string): boolean {
    const tool = this.tools.get(name);
    return tool?.requiresConfirmation ?? false;
  }

  /**
   * Get total count of registered tools
   */
  get count(): number {
    return Array.from(this.tools.values()).filter((t) => !t.hidden).length;
  }

  /**
   * Get tool names
   */
  getNames(): string[] {
    return Array.from(this.tools.values())
      .filter((t) => !t.hidden)
      .map((t) => t.name);
  }

  /**
   * Generate a summary of available tools for context
   */
  generateToolSummary(): string {
    const categories = this.getCategories();
    const lines: string[] = ["## Available Tools"];

    for (const category of categories) {
      const tools = this.list(category);
      if (tools.length > 0) {
        lines.push(`\n### ${category.charAt(0).toUpperCase() + category.slice(1)}`);
        for (const tool of tools) {
          lines.push(`- **${tool.name}**: ${tool.description}`);
        }
      }
    }

    return lines.join("\n");
  }
}

// Singleton instance
let registry: ToolRegistry | null = null;

export function getToolRegistry(): ToolRegistry {
  if (!registry) {
    registry = new ToolRegistry();
  }
  return registry;
}

/**
 * Helper to create a tool definition with proper typing
 */
export function defineTool(
  name: string,
  description: string,
  category: ToolCategory,
  parameters: AgentTool["parameters"],
  handler: AgentTool["handler"],
  options?: { requiresConfirmation?: boolean; hidden?: boolean }
): AgentTool {
  return {
    name,
    description,
    category,
    parameters,
    handler,
    ...options,
  };
}
