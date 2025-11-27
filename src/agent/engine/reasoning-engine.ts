/**
 * Reasoning Engine
 *
 * Multi-step reasoning engine for the AI Accounting Agent.
 * Implements a ReAct-style loop with tool calls, observation, and iterative refinement.
 */

import OpenAI from "openai";
import { AGENT_CONFIG } from "../config.js";
import { getTools, type ToolResult } from "../tools/index.js";
import { agentLogger } from "../../core/logger.js";

const reasoningLogger = agentLogger.child({ service: "reasoning" });

export interface ReasoningStep {
  id: number;
  type: "thought" | "action" | "observation" | "answer";
  content: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: ToolResult;
  timestamp: number;
}

export interface ReasoningContext {
  query: string;
  systemPrompt: string;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  financialContext?: string;
  memories?: string;
}

export interface ReasoningResult {
  steps: ReasoningStep[];
  finalAnswer: string;
  toolsUsed: string[];
  iterationCount: number;
  confidence: number;
  sources: string[];
}

export type ReasoningCallback = (step: ReasoningStep) => void;

export class ReasoningEngine {
  private openai: OpenAI;
  private maxIterations: number;
  private stepCallback?: ReasoningCallback;

  constructor(options?: { onStep?: ReasoningCallback }) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is required for reasoning engine");
    }

    this.openai = new OpenAI({ apiKey });
    this.maxIterations = AGENT_CONFIG.reasoning.maxIterations;
    this.stepCallback = options?.onStep;
  }

  /**
   * Run the reasoning loop
   */
  async reason(context: ReasoningContext): Promise<ReasoningResult> {
    const steps: ReasoningStep[] = [];
    const toolsUsed: string[] = [];
    const sources: string[] = [];
    let stepId = 0;
    let iterationCount = 0;

    // Build conversation messages
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: context.systemPrompt },
      ...context.messages.map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      })),
    ];

    // Add the current query with context
    let userContent = context.query;
    if (context.financialContext) {
      userContent = `${context.financialContext}\n\n---\n\n${context.query}`;
    }
    if (context.memories) {
      userContent = `${context.memories}\n\n---\n\n${userContent}`;
    }
    messages.push({ role: "user", content: userContent });

    // Get tools
    const tools = getTools();
    const openaiTools = tools.toOpenAITools();

    reasoningLogger.debug(
      { query: context.query.substring(0, 100), toolCount: openaiTools.length },
      "Starting reasoning loop"
    );

    try {
      while (iterationCount < this.maxIterations) {
        iterationCount++;

        // Call OpenAI with tools
        const response = await this.openai.chat.completions.create({
          model: AGENT_CONFIG.models.chat,
          messages,
          tools: openaiTools.length > 0 ? openaiTools : undefined,
          tool_choice: openaiTools.length > 0 ? "auto" : undefined,
          temperature: AGENT_CONFIG.temperature.toolSelection,
          max_tokens: AGENT_CONFIG.tokens.maxResponse,
        });

        const choice = response.choices[0];
        if (!choice) {
          throw new Error("No response from OpenAI");
        }

        const message = choice.message;

        // Check if there are tool calls
        if (message.tool_calls && message.tool_calls.length > 0) {
          // Add assistant message with tool calls
          messages.push({
            role: "assistant",
            content: message.content || null,
            tool_calls: message.tool_calls,
          });

          // Process each tool call
          for (const toolCall of message.tool_calls) {
            // Access function property with type assertion
            const func = (toolCall as { function: { name: string; arguments: string } }).function;
            const toolName = func.name;
            let toolArgs: Record<string, unknown>;

            try {
              toolArgs = JSON.parse(func.arguments);
            } catch {
              toolArgs = {};
            }

            // Record the thought/action step
            const thoughtStep: ReasoningStep = {
              id: stepId++,
              type: "action",
              content: `Calling ${toolName}`,
              toolName,
              toolArgs,
              timestamp: Date.now(),
            };
            steps.push(thoughtStep);
            this.stepCallback?.(thoughtStep);

            // Execute the tool
            const result = await tools.execute(toolName, toolArgs);
            toolsUsed.push(toolName);

            if (result.success) {
              sources.push(`Tool: ${toolName}`);
            }

            // Record the observation step
            const observationStep: ReasoningStep = {
              id: stepId++,
              type: "observation",
              content: result.result,
              toolName,
              toolResult: result,
              timestamp: Date.now(),
            };
            steps.push(observationStep);
            this.stepCallback?.(observationStep);

            // Add tool result to messages
            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: result.result,
            });
          }

          // Continue the loop to process tool results
          continue;
        }

        // No tool calls - this is the final answer
        const finalAnswer = message.content || "Unable to generate a response.";

        // Record the final answer step
        const answerStep: ReasoningStep = {
          id: stepId++,
          type: "answer",
          content: finalAnswer,
          timestamp: Date.now(),
        };
        steps.push(answerStep);
        this.stepCallback?.(answerStep);

        // Calculate confidence based on tool usage and iteration count
        const confidence = this.calculateConfidence(steps, toolsUsed, iterationCount);

        reasoningLogger.info(
          {
            iterations: iterationCount,
            toolsUsed: toolsUsed.length,
            stepsCount: steps.length,
            confidence,
          },
          "Reasoning completed"
        );

        return {
          steps,
          finalAnswer,
          toolsUsed: [...new Set(toolsUsed)],
          iterationCount,
          confidence,
          sources: [...new Set(sources)],
        };
      }

      // Max iterations reached
      const timeoutAnswer =
        "I've gathered a lot of information but need to stop here. Based on what I've found:\n\n" +
        this.summarizeSteps(steps);

      reasoningLogger.warn(
        { maxIterations: this.maxIterations, toolsUsed: toolsUsed.length },
        "Max iterations reached"
      );

      return {
        steps,
        finalAnswer: timeoutAnswer,
        toolsUsed: [...new Set(toolsUsed)],
        iterationCount,
        confidence: 0.5,
        sources: [...new Set(sources)],
      };
    } catch (err) {
      reasoningLogger.error({ err }, "Reasoning failed");

      const errorStep: ReasoningStep = {
        id: stepId++,
        type: "answer",
        content: `Error during reasoning: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: Date.now(),
      };
      steps.push(errorStep);
      this.stepCallback?.(errorStep);

      return {
        steps,
        finalAnswer: errorStep.content,
        toolsUsed: [...new Set(toolsUsed)],
        iterationCount,
        confidence: 0,
        sources: [],
      };
    }
  }

  /**
   * Calculate confidence score based on reasoning process
   */
  private calculateConfidence(
    steps: ReasoningStep[],
    toolsUsed: string[],
    iterations: number
  ): number {
    let confidence = 0.5; // Base confidence

    // Higher confidence if tools were used (data-backed)
    if (toolsUsed.length > 0) {
      confidence += 0.2;
    }

    // Higher confidence if multiple data sources
    if (toolsUsed.length >= 3) {
      confidence += 0.1;
    }

    // Lower confidence if too many iterations (complex/uncertain)
    if (iterations > 5) {
      confidence -= 0.1;
    }

    // Check for successful tool results
    const successfulTools = steps.filter(
      (s) => s.type === "observation" && s.toolResult?.success
    ).length;
    const failedTools = steps.filter(
      (s) => s.type === "observation" && !s.toolResult?.success
    ).length;

    if (failedTools > successfulTools) {
      confidence -= 0.2;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Summarize steps for timeout response
   */
  private summarizeSteps(steps: ReasoningStep[]): string {
    const observations = steps
      .filter((s) => s.type === "observation" && s.toolResult?.success)
      .map((s) => s.content)
      .slice(-3);

    if (observations.length === 0) {
      return "I couldn't gather sufficient information to provide a complete answer.";
    }

    return observations.join("\n\n");
  }

  /**
   * Stream reasoning steps (for real-time UI updates)
   */
  async *reasonStream(
    context: ReasoningContext
  ): AsyncGenerator<ReasoningStep, ReasoningResult, unknown> {
    const steps: ReasoningStep[] = [];
    const toolsUsed: string[] = [];
    const sources: string[] = [];
    let stepId = 0;
    let iterationCount = 0;

    // Build messages (same as reason method)
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: context.systemPrompt },
      ...context.messages.map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      })),
    ];

    let userContent = context.query;
    if (context.financialContext) {
      userContent = `${context.financialContext}\n\n---\n\n${context.query}`;
    }
    if (context.memories) {
      userContent = `${context.memories}\n\n---\n\n${userContent}`;
    }
    messages.push({ role: "user", content: userContent });

    const tools = getTools();
    const openaiTools = tools.toOpenAITools();

    while (iterationCount < this.maxIterations) {
      iterationCount++;

      const response = await this.openai.chat.completions.create({
        model: AGENT_CONFIG.models.chat,
        messages,
        tools: openaiTools.length > 0 ? openaiTools : undefined,
        tool_choice: openaiTools.length > 0 ? "auto" : undefined,
        temperature: AGENT_CONFIG.temperature.toolSelection,
        max_tokens: AGENT_CONFIG.tokens.maxResponse,
      });

      const choice = response.choices[0];
      if (!choice) {
        throw new Error("No response from OpenAI");
      }

      const message = choice.message;

      if (message.tool_calls && message.tool_calls.length > 0) {
        messages.push({
          role: "assistant",
          content: message.content || null,
          tool_calls: message.tool_calls,
        });

        for (const toolCall of message.tool_calls) {
          // Access function property with type assertion
          const func = (toolCall as { function: { name: string; arguments: string } }).function;
          const toolName = func.name;
          let toolArgs: Record<string, unknown>;

          try {
            toolArgs = JSON.parse(func.arguments);
          } catch {
            toolArgs = {};
          }

          const actionStep: ReasoningStep = {
            id: stepId++,
            type: "action",
            content: `Calling ${toolName}`,
            toolName,
            toolArgs,
            timestamp: Date.now(),
          };
          steps.push(actionStep);
          yield actionStep;

          const result = await tools.execute(toolName, toolArgs);
          toolsUsed.push(toolName);

          if (result.success) {
            sources.push(`Tool: ${toolName}`);
          }

          const observationStep: ReasoningStep = {
            id: stepId++,
            type: "observation",
            content: result.result,
            toolName,
            toolResult: result,
            timestamp: Date.now(),
          };
          steps.push(observationStep);
          yield observationStep;

          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: result.result,
          });
        }

        continue;
      }

      const finalAnswer = message.content || "Unable to generate a response.";
      const answerStep: ReasoningStep = {
        id: stepId++,
        type: "answer",
        content: finalAnswer,
        timestamp: Date.now(),
      };
      steps.push(answerStep);
      yield answerStep;

      const confidence = this.calculateConfidence(steps, toolsUsed, iterationCount);

      return {
        steps,
        finalAnswer,
        toolsUsed: [...new Set(toolsUsed)],
        iterationCount,
        confidence,
        sources: [...new Set(sources)],
      };
    }

    // Max iterations reached
    const timeoutAnswer =
      "I've gathered information but need to stop here. " + this.summarizeSteps(steps);

    return {
      steps,
      finalAnswer: timeoutAnswer,
      toolsUsed: [...new Set(toolsUsed)],
      iterationCount,
      confidence: 0.5,
      sources: [...new Set(sources)],
    };
  }
}

// Singleton instance
let reasoningEngine: ReasoningEngine | null = null;

export function getReasoningEngine(options?: { onStep?: ReasoningCallback }): ReasoningEngine {
  if (!reasoningEngine || options?.onStep) {
    reasoningEngine = new ReasoningEngine(options);
  }
  return reasoningEngine;
}
