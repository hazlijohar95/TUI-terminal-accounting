/**
 * Agent Configuration
 *
 * Centralized configuration for the AI Accounting Agent including
 * model settings, memory parameters, reasoning limits, and validation options.
 */

export const AGENT_CONFIG = {
  // OpenAI Model Settings
  models: {
    // Primary model for reasoning and tool calls
    chat: "gpt-4o",
    // Fast model for planning and simple tasks
    fast: "gpt-4o-mini",
    // Embedding model for semantic memory (1536 dimensions)
    embedding: "text-embedding-3-small",
  },

  // Token Limits
  tokens: {
    // Maximum tokens in response
    maxResponse: 2000,
    // Maximum tokens in context window
    maxContext: 16000,
    // Maximum tokens for memory context injection
    maxMemoryContext: 2000,
    // Maximum tokens for financial context
    maxFinancialContext: 4000,
  },

  // Memory Settings
  memory: {
    // Maximum memories to recall per query
    recallLimit: 10,
    // Minimum cosine similarity for relevant memories (0-1)
    minSimilarity: 0.7,
    // Number of memories before triggering consolidation
    consolidationThreshold: 100,
    // Maximum age for memories in days (older ones may be forgotten)
    maxAgeDays: 90,
    // Minimum importance score to keep during forgetting (0-1)
    minImportance: 0.3,
    // Embedding dimensions for text-embedding-3-small
    embeddingDimensions: 1536,
  },

  // Reasoning Engine Settings
  reasoning: {
    // Maximum tool call iterations per query
    maxIterations: 10,
    // Enable visible thinking process in UI
    enableThinkingDisplay: true,
    // Timeout for a single reasoning step (ms)
    stepTimeoutMs: 30000,
    // Delay between reasoning steps for UX (ms)
    stepDelayMs: 100,
  },

  // Validation Settings
  validation: {
    // Enable fact-checking against database
    enableFactChecking: true,
    // Minimum confidence score to return response (0-1)
    minConfidenceThreshold: 0.7,
    // Verify numerical claims
    validateNumbers: true,
    // Verify entity references
    validateEntities: true,
    // Verify accounting logic (debits = credits)
    validateAccountingLogic: true,
  },

  // Temperature Settings (0-1)
  temperature: {
    // Planning phase - more deterministic
    planning: 0.3,
    // Tool selection - balanced
    toolSelection: 0.5,
    // Final response - more creative
    response: 0.7,
    // Fact extraction - deterministic
    extraction: 0.2,
  },

  // Rate Limiting
  rateLimit: {
    // Maximum requests per minute
    maxRequestsPerMinute: 60,
    // Delay between API calls (ms)
    minDelayBetweenCalls: 100,
  },

  // Conversation Settings
  conversation: {
    // Maximum messages to keep in context
    maxMessages: 20,
    // Maximum conversation history age (hours)
    maxHistoryHours: 24,
  },
} as const;

// Type exports for configuration
export type AgentConfig = typeof AGENT_CONFIG;
export type ModelConfig = typeof AGENT_CONFIG.models;
export type TokenConfig = typeof AGENT_CONFIG.tokens;
export type MemoryConfig = typeof AGENT_CONFIG.memory;
export type ReasoningConfig = typeof AGENT_CONFIG.reasoning;
export type ValidationConfig = typeof AGENT_CONFIG.validation;
export type TemperatureConfig = typeof AGENT_CONFIG.temperature;

// Helper functions
export function getModel(type: keyof ModelConfig): string {
  return AGENT_CONFIG.models[type];
}

export function getMaxTokens(type: keyof TokenConfig): number {
  return AGENT_CONFIG.tokens[type];
}

export function getTemperature(phase: keyof TemperatureConfig): number {
  return AGENT_CONFIG.temperature[phase];
}

// Feature flags based on environment
export function isMemoryEnabled(): boolean {
  return process.env.DISABLE_AGENT_MEMORY !== "true";
}

export function isValidationEnabled(): boolean {
  return (
    AGENT_CONFIG.validation.enableFactChecking &&
    process.env.DISABLE_AGENT_VALIDATION !== "true"
  );
}

export function isThinkingDisplayEnabled(): boolean {
  return (
    AGENT_CONFIG.reasoning.enableThinkingDisplay &&
    process.env.DISABLE_THINKING_DISPLAY !== "true"
  );
}
