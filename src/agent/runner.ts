import OpenAI from "openai";
import { validateApiKey } from "../core/workspace.js";
import { agentLogger } from "../core/logger.js";
import { getLedgerSnapshot, type LedgerEntry } from "./tools.js";
import { buildContextFromLedger } from "./prompts.js";
import type {
  AgentStage,
  StageEvent,
  PlanStep,
  ActionResult,
  ValidationResult,
  AgentResult,
} from "./stages.js";

export type AgentRunnerOptions = {
  input: string;
  kind: "question" | "propose_postings";
  ledgerPath: string;
  onStageChange?: (event: StageEvent) => void;
};

export class AgentRunner {
  private client: OpenAI;
  private options: AgentRunnerOptions;
  private plan: PlanStep[] = [];
  private actions: ActionResult[] = [];
  private entries: LedgerEntry[] = [];

  constructor(options: AgentRunnerOptions) {
    const apiKey = validateApiKey(process.env.OPENAI_API_KEY);
    this.client = new OpenAI({ apiKey });
    this.options = options;
  }

  private emit(stage: AgentStage, message: string, data?: unknown) {
    agentLogger.debug({ stage, message, data }, "Stage event");
    this.options.onStageChange?.({ stage, message, data });
  }

  async run(): Promise<AgentResult> {
    try {
      // Load ledger data
      try {
        this.entries = getLedgerSnapshot(this.options.ledgerPath);
        agentLogger.debug({ count: this.entries.length }, "Loaded ledger entries");
      } catch (err) {
        agentLogger.warn({ err }, "Failed to load ledger");
      }

      // Stage 1: Planning
      this.emit("planning", "Analyzing your request...");
      const plan = await this.planStage();

      // Stage 2: Actions
      this.emit("actions", "Executing plan...");
      const actionResults = await this.actionsStage(plan);

      // Stage 3: Validation
      this.emit("validating", "Validating results...");
      const validation = await this.validationStage(actionResults);

      // Stage 4: Answer
      this.emit("answering", "Generating response...");
      const answer = await this.answerStage(plan, actionResults, validation);

      this.emit("complete", "Done");

      return {
        plan: this.plan,
        actions: this.actions,
        validation,
        answer,
      };
    } catch (err) {
      const errorMsg = (err as Error).message;
      this.emit("error", errorMsg);
      agentLogger.error({ err }, "Agent run failed");
      return {
        plan: this.plan,
        actions: this.actions,
        validation: { isValid: false, issues: [errorMsg], suggestions: [] },
        answer: `Error: ${errorMsg}`,
        error: errorMsg,
      };
    }
  }

  private async planStage(): Promise<PlanStep[]> {
    const context = buildContextFromLedger(this.entries);

    const response = await this.client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a planning assistant for an accounting agent. Given a user request about their ledger data, create a step-by-step plan to answer it.

Return a JSON array of steps. Each step should have:
- id: number
- description: what to do
- tool: which tool to use (one of: "search_entries", "calculate_totals", "analyze_patterns", "format_response")

Example output:
[
  {"id": 1, "description": "Search for expense entries in the specified period", "tool": "search_entries"},
  {"id": 2, "description": "Calculate total expenses by category", "tool": "calculate_totals"},
  {"id": 3, "description": "Format the results as a summary", "tool": "format_response"}
]

Only return valid JSON, no other text.`,
        },
        {
          role: "user",
          content: `Context:\n${context}\n\nUser request: ${this.options.input}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content || "[]";

    try {
      const steps = JSON.parse(content) as Array<{ id: number; description: string; tool: string }>;
      this.plan = steps.map(s => ({
        id: s.id,
        description: s.description,
        tool: s.tool,
        status: "pending" as const,
      }));
    } catch {
      // Fallback plan if parsing fails
      this.plan = [
        { id: 1, description: "Analyze request", tool: "analyze_patterns", status: "pending" },
        { id: 2, description: "Generate response", tool: "format_response", status: "pending" },
      ];
    }

    this.emit("planning", `Created ${this.plan.length} step plan`, this.plan);
    return this.plan;
  }

  private async actionsStage(plan: PlanStep[]): Promise<ActionResult[]> {
    const results: ActionResult[] = [];

    for (const step of plan) {
      step.status = "running";
      this.emit("actions", `Step ${step.id}: ${step.description}`, step);

      try {
        const result = await this.executeTool(step.tool || "analyze_patterns", step);
        results.push(result);
        step.status = "completed";
      } catch (err) {
        step.status = "failed";
        results.push({
          tool: step.tool || "unknown",
          input: step,
          output: null,
          success: false,
          error: (err as Error).message,
        });
      }
    }

    this.actions = results;
    return results;
  }

  private async executeTool(tool: string, step: PlanStep): Promise<ActionResult> {
    // Simulate tool execution with actual data analysis
    switch (tool) {
      case "search_entries": {
        // Search through ledger entries
        const filtered = this.entries.filter(e => {
          const input = this.options.input.toLowerCase();
          return e.description.toLowerCase().includes(input) ||
                 e.account.toLowerCase().includes(input);
        });
        return {
          tool,
          input: step,
          output: { found: filtered.length, entries: filtered.slice(0, 10) },
          success: true,
        };
      }

      case "calculate_totals": {
        // Calculate totals from entries
        const totals: Record<string, number> = {};
        for (const entry of this.entries) {
          totals[entry.account] = (totals[entry.account] || 0) + entry.amount;
        }
        return {
          tool,
          input: step,
          output: totals,
          success: true,
        };
      }

      case "analyze_patterns": {
        // Analyze spending patterns
        const byMonth: Record<string, number> = {};
        for (const entry of this.entries) {
          const month = entry.date.substring(0, 7);
          byMonth[month] = (byMonth[month] || 0) + entry.amount;
        }
        return {
          tool,
          input: step,
          output: byMonth,
          success: true,
        };
      }

      case "format_response":
      default:
        return {
          tool,
          input: step,
          output: { message: "Ready to format response" },
          success: true,
        };
    }
  }

  private async validationStage(actions: ActionResult[]): Promise<ValidationResult> {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check for failed actions
    const failed = actions.filter(a => !a.success);
    if (failed.length > 0) {
      issues.push(`${failed.length} action(s) failed`);
    }

    // Check if we have data
    if (this.entries.length === 0) {
      issues.push("No ledger data available");
      suggestions.push("Initialize workspace and add ledger entries");
    }

    // Validate calculations if any
    const calcAction = actions.find(a => a.tool === "calculate_totals");
    if (calcAction?.success && calcAction.output) {
      const totals = calcAction.output as Record<string, number>;
      const sum = Object.values(totals).reduce((a, b) => a + b, 0);
      if (Math.abs(sum) > 0.01) {
        // This is expected for non-balanced views
        suggestions.push("Note: Totals may not balance in this view");
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
      suggestions,
    };
  }

  private async answerStage(
    plan: PlanStep[],
    actions: ActionResult[],
    validation: ValidationResult
  ): Promise<string> {
    const context = buildContextFromLedger(this.entries);

    // Build action results summary
    const actionSummary = actions
      .map(a => `- ${a.tool}: ${a.success ? "success" : "failed"}`)
      .join("\n");

    const systemPrompt = this.options.kind === "question"
      ? `You are an accounting assistant. Based on the analysis performed, provide a clear and helpful answer to the user's question. Be specific and reference actual data when possible.`
      : `You are an accounting assistant. Based on the analysis performed, propose ledger postings in proper format. Each posting must balance (debits = credits).`;

    const response = await this.client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: `## Ledger Context
${context}

## Plan Executed
${plan.map(p => `${p.id}. ${p.description} (${p.status})`).join("\n")}

## Action Results
${actionSummary}

## Validation
${validation.isValid ? "All checks passed" : `Issues: ${validation.issues.join(", ")}`}
${validation.suggestions.length > 0 ? `Suggestions: ${validation.suggestions.join(", ")}` : ""}

## User Request
${this.options.input}

Provide a helpful response:`,
        },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    return response.choices[0]?.message?.content || "Unable to generate response.";
  }
}

// Convenience function for simple usage
export async function runAgentWithStages(
  options: AgentRunnerOptions
): Promise<AgentResult> {
  const runner = new AgentRunner(options);
  return runner.run();
}
