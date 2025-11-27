import { cliLogger } from "./logger.js";

export type MessageRole = "user" | "assistant" | "system";

export type Message = {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  tokens?: number;
  toolCalls?: ToolCallRecord[];
};

export type ToolCallRecord = {
  id: string;
  tool: string;
  input: unknown;
  output: unknown;
  success: boolean;
  duration: number;
};

export type ConversationStats = {
  messageCount: number;
  userMessages: number;
  assistantMessages: number;
  totalTokens: number;
  startTime: Date;
  lastActivity: Date;
};

export class ConversationManager {
  private messages: Message[] = [];
  private maxMessages: number;
  private maxTokens: number;
  private startTime: Date;

  constructor(options?: { maxMessages?: number; maxTokens?: number }) {
    this.maxMessages = options?.maxMessages || 50;
    this.maxTokens = options?.maxTokens || 8000;
    this.startTime = new Date();
    cliLogger.debug({ maxMessages: this.maxMessages, maxTokens: this.maxTokens }, "Conversation manager initialized");
  }

  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  addMessage(role: MessageRole, content: string, options?: { tokens?: number; toolCalls?: ToolCallRecord[] }): Message {
    const message: Message = {
      id: this.generateId(),
      role,
      content,
      timestamp: new Date(),
      tokens: options?.tokens,
      toolCalls: options?.toolCalls,
    };

    this.messages.push(message);
    this.pruneIfNeeded();

    cliLogger.debug({ role, contentLength: content.length, messageCount: this.messages.length }, "Message added");
    return message;
  }

  addUserMessage(content: string): Message {
    return this.addMessage("user", content);
  }

  addAssistantMessage(content: string, options?: { tokens?: number; toolCalls?: ToolCallRecord[] }): Message {
    return this.addMessage("assistant", content, options);
  }

  addSystemMessage(content: string): Message {
    return this.addMessage("system", content);
  }

  private pruneIfNeeded(): void {
    // Prune by message count
    while (this.messages.length > this.maxMessages) {
      const removed = this.messages.shift();
      cliLogger.debug({ removedId: removed?.id }, "Pruned old message");
    }

    // Prune by token count (keep removing oldest until under limit)
    let totalTokens = this.getTotalTokens();
    while (totalTokens > this.maxTokens && this.messages.length > 1) {
      const removed = this.messages.shift();
      totalTokens = this.getTotalTokens();
      cliLogger.debug({ removedId: removed?.id, newTotal: totalTokens }, "Pruned for token limit");
    }
  }

  getMessages(): Message[] {
    return [...this.messages];
  }

  getMessagesForAPI(): Array<{ role: MessageRole; content: string }> {
    return this.messages.map(m => ({
      role: m.role,
      content: m.content,
    }));
  }

  getRecentMessages(count: number): Message[] {
    return this.messages.slice(-count);
  }

  getLastMessage(): Message | undefined {
    return this.messages[this.messages.length - 1];
  }

  getLastUserMessage(): Message | undefined {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].role === "user") {
        return this.messages[i];
      }
    }
    return undefined;
  }

  getLastAssistantMessage(): Message | undefined {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].role === "assistant") {
        return this.messages[i];
      }
    }
    return undefined;
  }

  getTotalTokens(): number {
    return this.messages.reduce((sum, m) => sum + (m.tokens || this.estimateTokens(m.content)), 0);
  }

  private estimateTokens(text: string): number {
    // Rough estimate: ~4 chars per token
    return Math.ceil(text.length / 4);
  }

  getStats(): ConversationStats {
    return {
      messageCount: this.messages.length,
      userMessages: this.messages.filter(m => m.role === "user").length,
      assistantMessages: this.messages.filter(m => m.role === "assistant").length,
      totalTokens: this.getTotalTokens(),
      startTime: this.startTime,
      lastActivity: this.messages.length > 0
        ? this.messages[this.messages.length - 1].timestamp
        : this.startTime,
    };
  }

  clear(): void {
    const count = this.messages.length;
    this.messages = [];
    cliLogger.info({ clearedCount: count }, "Conversation cleared");
  }

  reset(): void {
    this.clear();
    this.startTime = new Date();
    cliLogger.info("Conversation reset");
  }

  getHistory(): string {
    return this.messages
      .map(m => {
        const time = m.timestamp.toLocaleTimeString();
        const role = m.role.toUpperCase().padEnd(10);
        const preview = m.content.length > 100
          ? m.content.substring(0, 100) + "..."
          : m.content;
        return `[${time}] ${role} ${preview}`;
      })
      .join("\n");
  }

  export(): string {
    return JSON.stringify({
      messages: this.messages,
      stats: this.getStats(),
      exportedAt: new Date().toISOString(),
    }, null, 2);
  }

  search(query: string): Message[] {
    const lowerQuery = query.toLowerCase();
    return this.messages.filter(m =>
      m.content.toLowerCase().includes(lowerQuery)
    );
  }
}

// Singleton for global conversation state
let globalConversation: ConversationManager | null = null;

export function getConversation(): ConversationManager {
  if (!globalConversation) {
    globalConversation = new ConversationManager();
  }
  return globalConversation;
}

export function resetConversation(): void {
  globalConversation = new ConversationManager();
}
