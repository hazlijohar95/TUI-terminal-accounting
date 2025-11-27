/**
 * Enhanced Agent Runner
 *
 * Advanced agent runner that integrates semantic memory, multi-step reasoning,
 * and enhanced prompts for the AI Accounting Agent.
 */

import { agentLogger } from "../core/logger.js";
import { getMemoryManager, type MemoryWithScore } from "./memory/memory-manager.js";
import { getReasoningEngine, type ReasoningStep, type ReasoningResult } from "./engine/reasoning-engine.js";
import { buildSystemPrompt } from "./prompts/system-prompts.js";
import { getDatabaseContext, buildDatabaseContextString } from "./tools/db-queries.js";
import { AGENT_CONFIG, isMemoryEnabled, isThinkingDisplayEnabled } from "./config.js";

const runnerLogger = agentLogger.child({ service: "enhanced-runner" });

export interface EnhancedAgentOptions {
  /** The user's query */
  query: string;
  /** Conversation history */
  messages?: Array<{ role: "user" | "assistant"; content: string }>;
  /** Callback for reasoning steps (for streaming UI) */
  onStep?: (step: ReasoningStep) => void;
  /** Callback for streaming tokens in final answer */
  onToken?: (token: string) => void;
  /** Callback when complete */
  onComplete?: (result: EnhancedAgentResult) => void;
}

export interface EnhancedAgentResult {
  /** The final answer */
  answer: string;
  /** All reasoning steps taken */
  steps: ReasoningStep[];
  /** Tools that were used */
  toolsUsed: string[];
  /** Number of reasoning iterations */
  iterations: number;
  /** Confidence score (0-1) */
  confidence: number;
  /** Data sources used */
  sources: string[];
  /** Relevant memories that were recalled */
  memories: MemoryWithScore[];
  /** Whether new memories were stored */
  memoriesStored: number;
}

export class EnhancedAgentRunner {
  private memoryManager = getMemoryManager();
  private reasoningEngine = getReasoningEngine();

  /**
   * Run the enhanced agent
   */
  async run(options: EnhancedAgentOptions): Promise<EnhancedAgentResult> {
    const { query, messages = [], onStep, onComplete } = options;

    runnerLogger.info({ queryLength: query.length }, "Starting enhanced agent run");

    // 1. Recall relevant memories
    let memories: MemoryWithScore[] = [];
    if (isMemoryEnabled()) {
      try {
        memories = await this.memoryManager.recall(query, {
          limit: AGENT_CONFIG.memory.recallLimit,
          minSimilarity: AGENT_CONFIG.memory.minSimilarity,
        });
        runnerLogger.debug({ count: memories.length }, "Recalled memories");
      } catch (err) {
        runnerLogger.warn({ err }, "Failed to recall memories");
      }
    }

    // 2. Get user preferences
    let userPreferences: Record<string, string> = {};
    try {
      const prefs = this.memoryManager.getPreferences();
      userPreferences = Object.fromEntries(prefs.map((p) => [p.key, p.value]));
    } catch (err) {
      runnerLogger.warn({ err }, "Failed to get user preferences");
    }

    // 3. Build financial context
    let financialContext = "";
    try {
      const dbContext = getDatabaseContext();
      financialContext = buildDatabaseContextString(dbContext);
    } catch (err) {
      runnerLogger.warn({ err }, "Failed to build financial context");
    }

    // 4. Build system prompt with all context
    const systemPrompt = buildSystemPrompt({
      memories,
      financialContext,
      userPreferences,
    });

    // 5. Set up step callback if enabled
    const stepCallback = isThinkingDisplayEnabled() ? onStep : undefined;

    // 6. Create reasoning engine with callback
    const reasoningEngine = getReasoningEngine({ onStep: stepCallback });

    // 7. Run reasoning loop
    let result: ReasoningResult;
    try {
      result = await reasoningEngine.reason({
        query,
        systemPrompt,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        financialContext,
        memories: memories.length > 0 ? this.memoryManager.formatForContext(memories) : undefined,
      });
    } catch (err) {
      runnerLogger.error({ err }, "Reasoning failed");
      throw err;
    }

    // 8. Store new memories from this conversation
    let memoriesStored = 0;
    if (isMemoryEnabled()) {
      try {
        // Store the conversation as a memory
        const conversationSummary = `User asked: ${query.substring(0, 200)}... Agent responded about: ${result.finalAnswer.substring(0, 200)}...`;
        await this.memoryManager.store(conversationSummary, "conversation", {
          importance: 0.4,
        });
        memoriesStored++;

        // Extract facts from the conversation
        const allMessages = [
          ...messages,
          { role: "user" as const, content: query },
          { role: "assistant" as const, content: result.finalAnswer },
        ];
        const facts = await this.memoryManager.extractFacts(allMessages);
        memoriesStored += facts.length;

        // Learn preferences
        const prefs = await this.memoryManager.learnPreferences(allMessages);
        runnerLogger.debug(
          { memoriesStored, factsExtracted: facts.length, prefsLearned: prefs.length },
          "Stored new memories"
        );
      } catch (err) {
        runnerLogger.warn({ err }, "Failed to store memories");
      }
    }

    // 9. Build final result
    const agentResult: EnhancedAgentResult = {
      answer: result.finalAnswer,
      steps: result.steps,
      toolsUsed: result.toolsUsed,
      iterations: result.iterationCount,
      confidence: result.confidence,
      sources: result.sources,
      memories,
      memoriesStored,
    };

    runnerLogger.info(
      {
        iterations: result.iterationCount,
        toolsUsed: result.toolsUsed.length,
        confidence: result.confidence,
        memoriesRecalled: memories.length,
        memoriesStored,
      },
      "Enhanced agent run completed"
    );

    onComplete?.(agentResult);

    return agentResult;
  }

  /**
   * Run with streaming reasoning steps
   */
  async *runStream(
    options: EnhancedAgentOptions
  ): AsyncGenerator<ReasoningStep, EnhancedAgentResult, unknown> {
    const { query, messages = [] } = options;

    // 1-4: Same setup as run()
    let memories: MemoryWithScore[] = [];
    if (isMemoryEnabled()) {
      try {
        memories = await this.memoryManager.recall(query, {
          limit: AGENT_CONFIG.memory.recallLimit,
          minSimilarity: AGENT_CONFIG.memory.minSimilarity,
        });
      } catch (err) {
        runnerLogger.warn({ err }, "Failed to recall memories");
      }
    }

    let userPreferences: Record<string, string> = {};
    try {
      const prefs = this.memoryManager.getPreferences();
      userPreferences = Object.fromEntries(prefs.map((p) => [p.key, p.value]));
    } catch {
      // Ignore
    }

    let financialContext = "";
    try {
      const dbContext = getDatabaseContext();
      financialContext = buildDatabaseContextString(dbContext);
    } catch {
      // Ignore
    }

    const systemPrompt = buildSystemPrompt({
      memories,
      financialContext,
      userPreferences,
    });

    const reasoningEngine = getReasoningEngine();

    // Stream reasoning steps
    const generator = reasoningEngine.reasonStream({
      query,
      systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      financialContext,
      memories: memories.length > 0 ? this.memoryManager.formatForContext(memories) : undefined,
    });

    let result: ReasoningResult | undefined;

    // Yield each step as it comes
    while (true) {
      const { value, done } = await generator.next();
      if (done) {
        result = value as ReasoningResult;
        break;
      }
      yield value as ReasoningStep;
    }

    if (!result) {
      throw new Error("Reasoning completed without result");
    }

    // Store memories
    let memoriesStored = 0;
    if (isMemoryEnabled()) {
      try {
        const conversationSummary = `User asked: ${query.substring(0, 200)}... Agent responded: ${result.finalAnswer.substring(0, 200)}...`;
        await this.memoryManager.store(conversationSummary, "conversation", { importance: 0.4 });
        memoriesStored++;

        const allMessages = [
          ...messages,
          { role: "user" as const, content: query },
          { role: "assistant" as const, content: result.finalAnswer },
        ];
        const facts = await this.memoryManager.extractFacts(allMessages);
        memoriesStored += facts.length;

        await this.memoryManager.learnPreferences(allMessages);
      } catch (err) {
        runnerLogger.warn({ err }, "Failed to store memories");
      }
    }

    return {
      answer: result.finalAnswer,
      steps: result.steps,
      toolsUsed: result.toolsUsed,
      iterations: result.iterationCount,
      confidence: result.confidence,
      sources: result.sources,
      memories,
      memoriesStored,
    };
  }

  /**
   * Get memory statistics
   */
  getMemoryStats() {
    return this.memoryManager.getStats();
  }

  /**
   * Manually store a memory
   */
  async storeMemory(content: string, type: "fact" | "preference" | "task", importance?: number) {
    return this.memoryManager.store(content, type, { importance });
  }

  /**
   * Clear old memories
   */
  async clearOldMemories() {
    const forgotten = await this.memoryManager.forget();
    const consolidated = await this.memoryManager.consolidate();
    return { forgotten, consolidated };
  }
}

// Singleton instance
let enhancedRunner: EnhancedAgentRunner | null = null;

export function getEnhancedAgentRunner(): EnhancedAgentRunner {
  if (!enhancedRunner) {
    enhancedRunner = new EnhancedAgentRunner();
  }
  return enhancedRunner;
}

/**
 * Convenience function for simple usage
 */
export async function runEnhancedAgent(
  query: string,
  options?: {
    messages?: Array<{ role: "user" | "assistant"; content: string }>;
    onStep?: (step: ReasoningStep) => void;
  }
): Promise<EnhancedAgentResult> {
  const runner = getEnhancedAgentRunner();
  return runner.run({
    query,
    messages: options?.messages,
    onStep: options?.onStep,
  });
}
