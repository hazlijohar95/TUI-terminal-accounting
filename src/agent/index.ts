import { askQuestion, proposePostings } from "./openai.js";

export type AgentKind = "question" | "propose_postings";

export type AgentRequest = {
  input: string;
  kind: AgentKind;
  ledgerPath?: string;
};

export type AgentResponse = {
  text: string;
};

export async function runAgent(req: AgentRequest): Promise<AgentResponse> {
  if (!req.ledgerPath) {
    return { text: "Error: No ledger path provided." };
  }

  try {
    if (req.kind === "question") {
      const response = await askQuestion(req.input, req.ledgerPath);
      return { text: response };
    } else if (req.kind === "propose_postings") {
      const response = await proposePostings(req.input, req.ledgerPath);
      return { text: response };
    }

    return { text: `Unknown agent kind: ${req.kind}` };
  } catch (err) {
    return { text: `Error: ${(err as Error).message}` };
  }
}

// Enhanced agent exports
export { AGENT_CONFIG, isMemoryEnabled, isValidationEnabled, isThinkingDisplayEnabled } from "./config.js";
export { getMemoryManager, type Memory, type MemoryWithScore, type MemoryType } from "./memory/index.js";
export { getReasoningEngine, type ReasoningStep, type ReasoningResult, type ReasoningContext } from "./engine/index.js";
export { getTools, getToolRegistry, executeTool, type AgentTool, type ToolResult, type ToolCategory } from "./tools/index.js";
export {
  EnhancedAgentRunner,
  getEnhancedAgentRunner,
  runEnhancedAgent,
  type EnhancedAgentOptions,
  type EnhancedAgentResult,
} from "./enhanced-runner.js";
export { buildSystemPrompt, TASK_PROMPTS } from "./prompts/system-prompts.js";
