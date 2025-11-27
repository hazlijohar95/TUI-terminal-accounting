/**
 * Memory Manager
 *
 * Core semantic memory system for the AI Accounting Agent.
 * Handles storing, retrieving, and managing long-term memories using vector embeddings.
 */

import { getDb } from "../../db/index.js";
import { getEmbeddingService, EmbeddingService } from "./embeddings.js";
import { AGENT_CONFIG } from "../config.js";
import { agentLogger } from "../../core/logger.js";
import OpenAI from "openai";

const memoryLogger = agentLogger.child({ service: "memory" });

export type MemoryType = "conversation" | "fact" | "preference" | "task";

export interface Memory {
  id: number;
  content: string;
  embedding: number[];
  memoryType: MemoryType;
  sourceMessageId?: string;
  importance: number;
  createdAt: string;
  lastAccessedAt?: string;
  accessCount: number;
}

export interface MemoryWithScore extends Memory {
  similarity: number;
}

interface MemoryRow {
  id: number;
  content: string;
  embedding: Buffer;
  memory_type: string;
  source_message_id: string | null;
  importance: number;
  created_at: string;
  last_accessed_at: string | null;
  access_count: number;
}

interface PreferenceRow {
  id: number;
  key: string;
  value: string;
  confidence: number;
  source: string | null;
  updated_at: string;
}

export interface UserPreference {
  key: string;
  value: string;
  confidence: number;
  source?: string;
}

export class MemoryManager {
  private embeddingService: EmbeddingService;
  private openai: OpenAI | null = null;

  constructor() {
    this.embeddingService = getEmbeddingService();

    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  /**
   * Store a new memory with its embedding
   */
  async store(
    content: string,
    type: MemoryType,
    options?: {
      importance?: number;
      sourceMessageId?: string;
    }
  ): Promise<Memory> {
    const db = getDb();
    const importance = options?.importance ?? 0.5;
    const sourceMessageId = options?.sourceMessageId;

    // Generate embedding
    const embedding = await this.embeddingService.embed(content);
    const embeddingBuffer = this.embeddingService.serializeEmbedding(embedding);

    // Insert into database
    const result = db
      .prepare(
        `
      INSERT INTO agent_memories (content, embedding, memory_type, source_message_id, importance)
      VALUES (?, ?, ?, ?, ?)
    `
      )
      .run(content, embeddingBuffer, type, sourceMessageId ?? null, importance);

    const id = result.lastInsertRowid as number;

    memoryLogger.debug({ id, type, contentLength: content.length }, "Stored memory");

    return {
      id,
      content,
      embedding,
      memoryType: type,
      sourceMessageId,
      importance,
      createdAt: new Date().toISOString(),
      accessCount: 0,
    };
  }

  /**
   * Recall relevant memories using semantic search
   */
  async recall(
    query: string,
    options?: {
      limit?: number;
      minSimilarity?: number;
      types?: MemoryType[];
    }
  ): Promise<MemoryWithScore[]> {
    const db = getDb();
    const limit = options?.limit ?? AGENT_CONFIG.memory.recallLimit;
    const minSimilarity = options?.minSimilarity ?? AGENT_CONFIG.memory.minSimilarity;
    const types = options?.types;

    // Generate query embedding
    const queryEmbedding = await this.embeddingService.embed(query);

    // Get all memories (filtered by type if specified)
    let sql = "SELECT * FROM agent_memories";
    const params: string[] = [];

    if (types && types.length > 0) {
      const placeholders = types.map(() => "?").join(", ");
      sql += ` WHERE memory_type IN (${placeholders})`;
      params.push(...types);
    }

    const rows = db.prepare(sql).all(...params) as MemoryRow[];

    if (rows.length === 0) {
      return [];
    }

    // Calculate similarities and rank
    const memoriesWithScores: MemoryWithScore[] = [];

    for (const row of rows) {
      const embedding = this.embeddingService.deserializeEmbedding(row.embedding);
      const similarity = this.embeddingService.cosineSimilarity(queryEmbedding, embedding);

      if (similarity >= minSimilarity) {
        memoriesWithScores.push({
          id: row.id,
          content: row.content,
          embedding,
          memoryType: row.memory_type as MemoryType,
          sourceMessageId: row.source_message_id ?? undefined,
          importance: row.importance,
          createdAt: row.created_at,
          lastAccessedAt: row.last_accessed_at ?? undefined,
          accessCount: row.access_count,
          similarity,
        });
      }
    }

    // Sort by similarity (descending) and take top results
    memoriesWithScores.sort((a, b) => b.similarity - a.similarity);
    const results = memoriesWithScores.slice(0, limit);

    // Update access times and counts for retrieved memories
    if (results.length > 0) {
      const ids = results.map((m) => m.id);
      const placeholders = ids.map(() => "?").join(", ");
      db.prepare(
        `
        UPDATE agent_memories
        SET last_accessed_at = CURRENT_TIMESTAMP, access_count = access_count + 1
        WHERE id IN (${placeholders})
      `
      ).run(...ids);
    }

    memoryLogger.debug(
      { query: query.substring(0, 50), found: results.length, total: rows.length },
      "Recalled memories"
    );

    return results;
  }

  /**
   * Extract and store facts from a conversation
   */
  async extractFacts(
    messages: Array<{ role: string; content: string }>,
    sourceMessageId?: string
  ): Promise<Memory[]> {
    if (!this.openai || messages.length === 0) {
      return [];
    }

    try {
      const conversationText = messages
        .map((m) => `${m.role}: ${m.content}`)
        .join("\n")
        .substring(0, 4000);

      const response = await this.openai.chat.completions.create({
        model: AGENT_CONFIG.models.fast,
        messages: [
          {
            role: "system",
            content: `Extract key accounting facts from this conversation that would be useful to remember for future interactions. Focus on:
- Business information (company name, industry, fiscal year)
- Financial patterns (typical expenses, income sources)
- User preferences (reporting style, frequency, categories)
- Important dates (tax deadlines, payment schedules)

Return a JSON array of objects with: {"fact": "...", "importance": 0.1-1.0}
Only include genuinely useful facts. Return empty array [] if no notable facts.`,
          },
          {
            role: "user",
            content: conversationText,
          },
        ],
        temperature: AGENT_CONFIG.temperature.extraction,
        max_tokens: 500,
      });

      const content = response.choices[0]?.message?.content || "[]";

      let facts: Array<{ fact: string; importance: number }>;
      try {
        facts = JSON.parse(content);
      } catch {
        memoryLogger.warn({ content }, "Failed to parse extracted facts");
        return [];
      }

      if (!Array.isArray(facts) || facts.length === 0) {
        return [];
      }

      // Store each fact as a memory
      const memories: Memory[] = [];
      for (const { fact, importance } of facts) {
        if (fact && typeof fact === "string" && fact.trim().length > 0) {
          const memory = await this.store(fact.trim(), "fact", {
            importance: Math.min(1, Math.max(0, importance || 0.5)),
            sourceMessageId,
          });
          memories.push(memory);
        }
      }

      memoryLogger.debug({ count: memories.length }, "Extracted and stored facts");
      return memories;
    } catch (err) {
      memoryLogger.error({ err }, "Failed to extract facts");
      return [];
    }
  }

  /**
   * Learn and store user preferences from interactions
   */
  async learnPreferences(
    messages: Array<{ role: string; content: string }>
  ): Promise<UserPreference[]> {
    if (!this.openai || messages.length === 0) {
      return [];
    }

    try {
      const conversationText = messages
        .map((m) => `${m.role}: ${m.content}`)
        .join("\n")
        .substring(0, 4000);

      const response = await this.openai.chat.completions.create({
        model: AGENT_CONFIG.models.fast,
        messages: [
          {
            role: "system",
            content: `Identify user preferences from this accounting conversation. Look for:
- preferred_date_format (e.g., "MM/DD/YYYY")
- preferred_currency (e.g., "USD")
- reporting_frequency (e.g., "weekly", "monthly")
- detail_level (e.g., "summary", "detailed")
- expense_categories (commonly used categories)
- communication_style (e.g., "concise", "detailed")

Return a JSON array: [{"key": "...", "value": "...", "confidence": 0.1-1.0}]
Only include preferences that are clearly indicated. Return [] if none found.`,
          },
          {
            role: "user",
            content: conversationText,
          },
        ],
        temperature: AGENT_CONFIG.temperature.extraction,
        max_tokens: 300,
      });

      const content = response.choices[0]?.message?.content || "[]";

      let prefs: Array<{ key: string; value: string; confidence: number }>;
      try {
        prefs = JSON.parse(content);
      } catch {
        return [];
      }

      if (!Array.isArray(prefs) || prefs.length === 0) {
        return [];
      }

      const db = getDb();
      const learned: UserPreference[] = [];

      for (const pref of prefs) {
        if (pref.key && pref.value) {
          // Upsert preference
          db.prepare(
            `
            INSERT INTO agent_user_preferences (key, value, confidence, source, updated_at)
            VALUES (?, ?, ?, 'conversation', CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET
              value = excluded.value,
              confidence = excluded.confidence,
              updated_at = CURRENT_TIMESTAMP
            WHERE excluded.confidence > agent_user_preferences.confidence
          `
          ).run(pref.key, pref.value, Math.min(1, Math.max(0, pref.confidence || 0.5)));

          learned.push({
            key: pref.key,
            value: pref.value,
            confidence: pref.confidence,
            source: "conversation",
          });
        }
      }

      memoryLogger.debug({ count: learned.length }, "Learned preferences");
      return learned;
    } catch (err) {
      memoryLogger.error({ err }, "Failed to learn preferences");
      return [];
    }
  }

  /**
   * Get all stored user preferences
   */
  getPreferences(): UserPreference[] {
    const db = getDb();
    const rows = db.prepare("SELECT * FROM agent_user_preferences").all() as PreferenceRow[];

    return rows.map((row) => ({
      key: row.key,
      value: row.value,
      confidence: row.confidence,
      source: row.source ?? undefined,
    }));
  }

  /**
   * Get a specific preference
   */
  getPreference(key: string): string | undefined {
    const db = getDb();
    const row = db
      .prepare("SELECT value FROM agent_user_preferences WHERE key = ?")
      .get(key) as { value: string } | undefined;

    return row?.value;
  }

  /**
   * Set a preference directly
   */
  setPreference(key: string, value: string, confidence: number = 1.0): void {
    const db = getDb();
    db.prepare(
      `
      INSERT INTO agent_user_preferences (key, value, confidence, source, updated_at)
      VALUES (?, ?, ?, 'manual', CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        confidence = excluded.confidence,
        source = excluded.source,
        updated_at = CURRENT_TIMESTAMP
    `
    ).run(key, value, confidence);
  }

  /**
   * Consolidate similar memories to reduce storage
   */
  async consolidate(): Promise<number> {
    const db = getDb();
    const config = AGENT_CONFIG.memory;

    // Get memory count
    const countResult = db.prepare("SELECT COUNT(*) as count FROM agent_memories").get() as {
      count: number;
    };

    if (countResult.count < config.consolidationThreshold) {
      return 0;
    }

    // Get all fact and conversation memories
    const rows = db
      .prepare(
        `
      SELECT * FROM agent_memories
      WHERE memory_type IN ('fact', 'conversation')
      ORDER BY created_at ASC
    `
      )
      .all() as MemoryRow[];

    const toDelete: number[] = [];
    const processed = new Set<number>();

    // Find similar memories and mark duplicates for deletion
    for (let i = 0; i < rows.length; i++) {
      if (processed.has(rows[i].id)) continue;

      const embedding1 = this.embeddingService.deserializeEmbedding(rows[i].embedding);

      for (let j = i + 1; j < rows.length; j++) {
        if (processed.has(rows[j].id)) continue;

        const embedding2 = this.embeddingService.deserializeEmbedding(rows[j].embedding);
        const similarity = this.embeddingService.cosineSimilarity(embedding1, embedding2);

        // If very similar (>0.95), keep the more important/newer one
        if (similarity > 0.95) {
          const keepRow = rows[i].importance >= rows[j].importance ? rows[i] : rows[j];
          const deleteRow = keepRow === rows[i] ? rows[j] : rows[i];

          toDelete.push(deleteRow.id);
          processed.add(deleteRow.id);
        }
      }
    }

    // Delete duplicates
    if (toDelete.length > 0) {
      const placeholders = toDelete.map(() => "?").join(", ");
      db.prepare(`DELETE FROM agent_memories WHERE id IN (${placeholders})`).run(...toDelete);
    }

    memoryLogger.info({ deleted: toDelete.length }, "Consolidated memories");
    return toDelete.length;
  }

  /**
   * Forget old, low-importance, rarely-accessed memories
   */
  async forget(): Promise<number> {
    const db = getDb();
    const config = AGENT_CONFIG.memory;

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - config.maxAgeDays);
    const cutoffStr = cutoffDate.toISOString();

    // Delete old, low-importance memories that haven't been accessed recently
    const result = db
      .prepare(
        `
      DELETE FROM agent_memories
      WHERE created_at < ?
        AND importance < ?
        AND access_count < 3
        AND (last_accessed_at IS NULL OR last_accessed_at < ?)
    `
      )
      .run(cutoffStr, config.minImportance, cutoffStr);

    memoryLogger.info({ deleted: result.changes }, "Forgot old memories");
    return result.changes;
  }

  /**
   * Get memory statistics
   */
  getStats(): {
    total: number;
    byType: Record<MemoryType, number>;
    avgImportance: number;
    oldestDate: string | null;
    newestDate: string | null;
  } {
    const db = getDb();

    const total = (
      db.prepare("SELECT COUNT(*) as count FROM agent_memories").get() as { count: number }
    ).count;

    const byTypeRows = db
      .prepare(
        `
      SELECT memory_type, COUNT(*) as count
      FROM agent_memories
      GROUP BY memory_type
    `
      )
      .all() as Array<{ memory_type: string; count: number }>;

    const byType: Record<MemoryType, number> = {
      conversation: 0,
      fact: 0,
      preference: 0,
      task: 0,
    };
    for (const row of byTypeRows) {
      byType[row.memory_type as MemoryType] = row.count;
    }

    const avgImportance = (
      db.prepare("SELECT AVG(importance) as avg FROM agent_memories").get() as { avg: number | null }
    ).avg || 0;

    const dates = db
      .prepare(
        "SELECT MIN(created_at) as oldest, MAX(created_at) as newest FROM agent_memories"
      )
      .get() as { oldest: string | null; newest: string | null };

    return {
      total,
      byType,
      avgImportance,
      oldestDate: dates.oldest,
      newestDate: dates.newest,
    };
  }

  /**
   * Format memories for context injection
   */
  formatForContext(memories: MemoryWithScore[]): string {
    if (memories.length === 0) {
      return "";
    }

    const lines: string[] = ["## Relevant Context from Memory"];

    for (const memory of memories) {
      const typeLabel =
        memory.memoryType === "fact"
          ? "Fact"
          : memory.memoryType === "preference"
            ? "Preference"
            : memory.memoryType === "conversation"
              ? "Previous conversation"
              : "Note";

      lines.push(`- [${typeLabel}] ${memory.content}`);
    }

    return lines.join("\n");
  }
}

// Singleton instance
let memoryManager: MemoryManager | null = null;

export function getMemoryManager(): MemoryManager {
  if (!memoryManager) {
    memoryManager = new MemoryManager();
  }
  return memoryManager;
}
