/**
 * Memory Module
 *
 * Exports the semantic memory system components for the AI Accounting Agent.
 */

export { EmbeddingService, getEmbeddingService } from "./embeddings.js";
export {
  MemoryManager,
  getMemoryManager,
  type Memory,
  type MemoryWithScore,
  type MemoryType,
  type UserPreference,
} from "./memory-manager.js";
