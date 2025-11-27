// Agent stage types and definitions

export type AgentStage = "planning" | "actions" | "validating" | "answering" | "complete" | "error";

export type StageEvent = {
  stage: AgentStage;
  message: string;
  data?: unknown;
};

export type PlanStep = {
  id: number;
  description: string;
  tool?: string;
  status: "pending" | "running" | "completed" | "failed";
};

export type ActionResult = {
  tool: string;
  input: unknown;
  output: unknown;
  success: boolean;
  error?: string;
};

export type ValidationResult = {
  isValid: boolean;
  issues: string[];
  suggestions: string[];
};

export type AgentResult = {
  plan: PlanStep[];
  actions: ActionResult[];
  validation: ValidationResult;
  answer: string;
  error?: string;
};

// Stage display configuration
export const STAGE_CONFIG: Record<AgentStage, { label: string; emoji: string; color: string }> = {
  planning: { label: "Planning", emoji: "🧠", color: "cyan" },
  actions: { label: "Executing", emoji: "⚡", color: "yellow" },
  validating: { label: "Validating", emoji: "✓", color: "magenta" },
  answering: { label: "Answering", emoji: "💬", color: "green" },
  complete: { label: "Complete", emoji: "✅", color: "green" },
  error: { label: "Error", emoji: "❌", color: "red" },
};
