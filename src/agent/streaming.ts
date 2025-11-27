import OpenAI from "openai";
import { agentLogger } from "../core/logger.js";
import { getConversation } from "../core/conversation.js";
import { getLedgerSnapshot, type LedgerEntry } from "./tools.js";
import { buildContextFromLedger, SYSTEM_PROMPT_QUESTION, SYSTEM_PROMPT_PROPOSE } from "./prompts.js";
import { getContextForAgent } from "./context-builder.js";
import type { AgentStage, StageEvent, PlanStep, ActionResult, ValidationResult } from "./stages.js";

// Check if we should use Convex or direct OpenAI
const USE_CONVEX = !!process.env.CONVEX_URL;
const CONVEX_URL = process.env.CONVEX_URL || "";

export type StreamingOptions = {
  input: string;
  kind: "question" | "propose_postings";
  ledgerPath: string;
  onStageChange?: (event: StageEvent) => void;
  onToken?: (token: string) => void;
  onComplete?: (fullResponse: string) => void;
};

export class StreamingAgentRunner {
  private client: OpenAI | null = null;
  private options: StreamingOptions;
  private entries: LedgerEntry[] = [];
  private plan: PlanStep[] = [];
  private actions: ActionResult[] = [];

  constructor(options: StreamingOptions) {
    this.options = options;

    if (USE_CONVEX) {
      agentLogger.debug("Using Convex backend");
    } else {
      // Direct OpenAI - need API key
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error(
          "OpenAI API key not found.\n\n" +
          "Option 1: Set CONVEX_URL to use hosted backend\n" +
          "Option 2: Set OPENAI_API_KEY in your environment\n\n" +
          "Run: export OPENAI_API_KEY=sk-..."
        );
      }
      this.client = new OpenAI({ apiKey });
    }
  }

  private async callConvex(action: string, args: Record<string, string>): Promise<string> {
    const response = await fetch(`${CONVEX_URL}/api/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: `agent:${action}`,
        args,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Convex error: ${response.statusText} - ${text}`);
    }

    const result = await response.json();

    // Handle different response formats
    if (result.value) {
      return result.value;
    }
    if (result.result) {
      return result.result;
    }
    if (typeof result === "string") {
      return result;
    }

    throw new Error(`Unexpected Convex response: ${JSON.stringify(result)}`);
  }

  private emit(stage: AgentStage, message: string, data?: unknown) {
    agentLogger.debug({ stage, message }, "Stage event");
    this.options.onStageChange?.({ stage, message, data });
  }

  async run(): Promise<string> {
    const conversation = getConversation();

    try {
      // Load ledger data
      try {
        this.entries = getLedgerSnapshot(this.options.ledgerPath);
      } catch {
        // Ledger might not exist
      }

      // Add user message to conversation
      conversation.addUserMessage(this.options.input);

      // Stage 1: Planning
      this.emit("planning", "Analyzing your request...");
      await this.planStage();

      // Stage 2: Actions
      this.emit("actions", "Executing plan...");
      await this.actionsStage();

      // Stage 3: Validation
      this.emit("validating", "Validating results...");
      const validation = await this.validationStage();

      // Stage 4: Streaming Answer
      this.emit("answering", "Generating response...");
      const answer = await this.streamingAnswerStage(validation);

      // Add assistant response to conversation
      conversation.addAssistantMessage(answer);

      this.emit("complete", "Done");
      this.options.onComplete?.(answer);

      return answer;
    } catch (err) {
      const errorMsg = (err as Error).message;
      this.emit("error", errorMsg);
      agentLogger.error({ err }, "Streaming agent run failed");
      return `Error: ${errorMsg}`;
    }
  }

  private async planStage(): Promise<void> {
    const context = buildContextFromLedger(this.entries);

    let content: string;

    if (USE_CONVEX) {
      content = await this.callConvex("plan", {
        input: this.options.input,
        context,
      });
    } else {
      const response = await this.client!.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Create a brief step-by-step plan to answer this accounting question. Return JSON array with id, description, and tool fields. Tools: search_entries, calculate_totals, analyze_patterns, format_response. Only return valid JSON.`,
          },
          {
            role: "user",
            content: `Context:\n${context}\n\nRequest: ${this.options.input}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 300,
      });

      content = response.choices[0]?.message?.content || "[]";
    }

    try {
      const steps = JSON.parse(content) as Array<{ id: number; description: string; tool: string }>;
      this.plan = steps.map(s => ({
        id: s.id,
        description: s.description,
        tool: s.tool,
        status: "pending" as const,
      }));
    } catch {
      this.plan = [
        { id: 1, description: "Analyze request", tool: "analyze_patterns", status: "pending" },
        { id: 2, description: "Generate response", tool: "format_response", status: "pending" },
      ];
    }

    this.emit("planning", `Created ${this.plan.length} step plan`, this.plan);
  }

  private async actionsStage(): Promise<void> {
    for (const step of this.plan) {
      step.status = "running";
      this.emit("actions", `Step ${step.id}: ${step.description}`, step);

      try {
        const result = await this.executeTool(step.tool || "analyze_patterns", step);
        this.actions.push(result);
        step.status = "completed";
      } catch (err) {
        step.status = "failed";
        this.actions.push({
          tool: step.tool || "unknown",
          input: step,
          output: null,
          success: false,
          error: (err as Error).message,
        });
      }
    }
  }

  private async executeTool(tool: string, step: PlanStep): Promise<ActionResult> {
    switch (tool) {
      case "search_entries": {
        const filtered = this.entries.filter(e => {
          const input = this.options.input.toLowerCase();
          return e.description.toLowerCase().includes(input) ||
                 e.account.toLowerCase().includes(input);
        });
        return { tool, input: step, output: { found: filtered.length }, success: true };
      }

      case "calculate_totals": {
        const totals: Record<string, number> = {};
        for (const entry of this.entries) {
          totals[entry.account] = (totals[entry.account] || 0) + entry.amount;
        }
        return { tool, input: step, output: totals, success: true };
      }

      case "analyze_patterns": {
        const byMonth: Record<string, number> = {};
        for (const entry of this.entries) {
          const month = entry.date.substring(0, 7);
          byMonth[month] = (byMonth[month] || 0) + entry.amount;
        }
        return { tool, input: step, output: byMonth, success: true };
      }

      default:
        return { tool, input: step, output: { ready: true }, success: true };
    }
  }

  private async validationStage(): Promise<ValidationResult> {
    const issues: string[] = [];
    const suggestions: string[] = [];

    const failed = this.actions.filter(a => !a.success);
    if (failed.length > 0) {
      issues.push(`${failed.length} action(s) failed`);
    }

    if (this.entries.length === 0) {
      issues.push("No ledger data available");
      suggestions.push("Add some transactions first");
    }

    return { isValid: issues.length === 0, issues, suggestions };
  }

  private async streamingAnswerStage(validation: ValidationResult): Promise<string> {
    // Use enhanced context builder for better insights
    const context = getContextForAgent(this.options.ledgerPath);
    const conversation = getConversation();

    const actionSummary = this.actions
      .map(a => `- ${a.tool}: ${a.success ? "success" : "failed"}`)
      .join("\n");

    const userContent = `## Ledger Context\n${context}\n\n## Actions Performed\n${actionSummary}\n\n## Validation\n${validation.isValid ? "Passed" : validation.issues.join(", ")}\n\n## Current Request\n${this.options.input}\n\nProvide a helpful, specific response:`;

    // Use Convex if configured
    if (USE_CONVEX) {
      const action = this.options.kind === "question" ? "ask" : "propose";
      const args: Record<string, string> = this.options.kind === "question"
        ? { question: this.options.input, context }
        : { instruction: this.options.input, context };

      const answer = await this.callConvex(action, args);

      // Simulate streaming for UX
      for (const char of answer) {
        this.options.onToken?.(char);
        await new Promise(resolve => setTimeout(resolve, 5));
      }

      return answer;
    }

    // Direct OpenAI with streaming
    const historyMessages = conversation.getMessagesForAPI().slice(-6);

    const systemPrompt = this.options.kind === "question"
      ? SYSTEM_PROMPT_QUESTION
      : SYSTEM_PROMPT_PROPOSE;

    const stream = await this.client!.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...historyMessages.slice(0, -1),
        { role: "user", content: userContent },
      ],
      temperature: 0.7,
      max_tokens: 1000,
      stream: true,
    });

    let fullResponse = "";

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        fullResponse += content;
        this.options.onToken?.(content);
      }
    }

    return fullResponse;
  }
}

// Convenience function
export async function runStreamingAgent(options: StreamingOptions): Promise<string> {
  const runner = new StreamingAgentRunner(options);
  return runner.run();
}
