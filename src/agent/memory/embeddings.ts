/**
 * Embedding Service
 *
 * Handles vector embedding generation using OpenAI's text-embedding-3-small model.
 * Used for semantic memory storage and retrieval via cosine similarity search.
 */

import OpenAI from "openai";
import { AGENT_CONFIG } from "../config.js";
import { agentLogger } from "../../core/logger.js";

const embeddingLogger = agentLogger.child({ service: "embeddings" });

export class EmbeddingService {
  private openai: OpenAI;
  private model: string;
  private dimensions: number;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is required for embedding service");
    }

    this.openai = new OpenAI({ apiKey });
    this.model = AGENT_CONFIG.models.embedding;
    this.dimensions = AGENT_CONFIG.memory.embeddingDimensions;
  }

  /**
   * Generate embedding for a single text
   */
  async embed(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new Error("Cannot embed empty text");
    }

    try {
      const response = await this.openai.embeddings.create({
        model: this.model,
        input: text.trim(),
        dimensions: this.dimensions,
      });

      const embedding = response.data[0]?.embedding;
      if (!embedding) {
        throw new Error("No embedding returned from OpenAI");
      }

      embeddingLogger.debug(
        { textLength: text.length, dimensions: embedding.length },
        "Generated embedding"
      );

      return embedding;
    } catch (err) {
      embeddingLogger.error({ err, textLength: text.length }, "Failed to generate embedding");
      throw err;
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    const validTexts = texts.filter((t) => t && t.trim().length > 0);
    if (validTexts.length === 0) {
      throw new Error("No valid texts to embed");
    }

    try {
      const response = await this.openai.embeddings.create({
        model: this.model,
        input: validTexts.map((t) => t.trim()),
        dimensions: this.dimensions,
      });

      const embeddings = response.data.map((d) => d.embedding);

      embeddingLogger.debug(
        { count: embeddings.length, dimensions: this.dimensions },
        "Generated batch embeddings"
      );

      return embeddings;
    } catch (err) {
      embeddingLogger.error({ err, count: texts.length }, "Failed to generate batch embeddings");
      throw err;
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   * Returns a value between -1 and 1, where 1 means identical
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    if (magnitude === 0) {
      return 0;
    }

    return dotProduct / magnitude;
  }

  /**
   * Find the most similar vectors from a list
   * Returns indices and scores sorted by similarity (highest first)
   */
  findMostSimilar(
    queryEmbedding: number[],
    embeddings: number[][],
    topK: number = 10,
    minSimilarity: number = 0
  ): Array<{ index: number; similarity: number }> {
    const scores: Array<{ index: number; similarity: number }> = [];

    for (let i = 0; i < embeddings.length; i++) {
      const similarity = this.cosineSimilarity(queryEmbedding, embeddings[i]);
      if (similarity >= minSimilarity) {
        scores.push({ index: i, similarity });
      }
    }

    // Sort by similarity descending
    scores.sort((a, b) => b.similarity - a.similarity);

    return scores.slice(0, topK);
  }

  /**
   * Serialize embedding to Buffer for SQLite BLOB storage
   */
  serializeEmbedding(embedding: number[]): Buffer {
    const float32Array = new Float32Array(embedding);
    return Buffer.from(float32Array.buffer);
  }

  /**
   * Deserialize embedding from SQLite BLOB
   */
  deserializeEmbedding(buffer: Buffer): number[] {
    const float32Array = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
    return Array.from(float32Array);
  }
}

// Singleton instance
let embeddingService: EmbeddingService | null = null;

export function getEmbeddingService(): EmbeddingService {
  if (!embeddingService) {
    embeddingService = new EmbeddingService();
  }
  return embeddingService;
}
