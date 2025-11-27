/**
 * ChatView Component
 *
 * Redesigned with new UI component library for consistent
 * styling and improved UX.
 */

import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import Spinner from "ink-spinner";
import OpenAI from "openai";
import {
  getDatabaseContext,
  buildDatabaseContextString,
} from "../../agent/tools/db-queries.js";
import { agentTools, executeTool } from "../../agent/agent-tools.js";
import { getEnhancedTheme } from "../design/theme.js";
import { indicators, borderStyles } from "../design/tokens.js";
import { useBlinkingCursor } from "../animations.js";
import { ai } from "../../config.js";
import { EnhancedMarkdown } from "./EnhancedMarkdown.js";
import { ReasoningPanel, ReasoningIndicator } from "./ReasoningPanel.js";
import { ToolExecutionView, type ToolExecution } from "./ToolExecutionView.js";
import {
  SuggestionsBar,
  generateSuggestions,
  type Suggestion,
  type SuggestionContext,
} from "./SuggestionsBar.js";
import type { ReasoningStep } from "../../agent/engine/reasoning-engine.js";

interface ChatViewProps {
  width: number;
  height: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  metadata?: {
    responseTime?: number;
    tokenCount?: number;
    dataSource?: string;
  };
}

// ============================================================================
// Sub-components
// ============================================================================

interface MessageBubbleProps {
  message: Message;
  width: number;
}

function MessageBubble({ message, width }: MessageBubbleProps) {
  const theme = getEnhancedTheme();
  const isUser = message.role === "user";

  // Calculate relative time
  const now = new Date();
  const diff = now.getTime() - message.timestamp.getTime();
  const minutes = Math.floor(diff / 60000);
  const relativeTime =
    minutes < 1 ? "" : minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h`;

  if (isUser) {
    // User messages: right-aligned with colored indicator
    return (
      <Box flexDirection="column" marginY={1} paddingX={1}>
        <Box justifyContent="flex-end">
          <Box paddingX={1}>
            <Text color={theme.semantic.primary} bold>You</Text>
            {relativeTime && (
              <Text color={theme.semantic.textMuted} dimColor> • {relativeTime}</Text>
            )}
          </Box>
        </Box>
        <Box justifyContent="flex-end" paddingX={1}>
          <Box
            paddingX={2}
            borderStyle={borderStyles.panel}
            borderColor={theme.semantic.primary}
          >
            <Text color={theme.semantic.textPrimary}>{message.content}</Text>
          </Box>
        </Box>
      </Box>
    );
  }

  // Assistant messages: left-aligned with subtle styling
  return (
    <Box flexDirection="column" marginY={1} paddingX={1}>
      <Box marginBottom={1}>
        <Text color={theme.semantic.info} bold>◇ Assistant</Text>
        {relativeTime && (
          <Text color={theme.semantic.textMuted} dimColor>
            {" "}• {relativeTime}
          </Text>
        )}
        {message.metadata?.responseTime && (
          <Text color={theme.semantic.textMuted} dimColor>
            {" "}• {(message.metadata.responseTime / 1000).toFixed(1)}s
          </Text>
        )}
        {message.metadata?.dataSource && (
          <Text color={theme.semantic.success} dimColor>
            {" "}• {message.metadata.dataSource}
          </Text>
        )}
      </Box>
      <Box paddingLeft={2}>
        <EnhancedMarkdown text={message.content} />
      </Box>
    </Box>
  );
}

interface HelpOverlayProps {
  visible: boolean;
}

function HelpOverlay({ visible }: HelpOverlayProps) {
  const theme = getEnhancedTheme();

  if (!visible) return null;

  const shortcuts = [
    { key: "Enter", desc: "Send message" },
    { key: "↑/↓ or j/k", desc: "Scroll messages" },
    { key: "e", desc: "Expand/collapse agent details" },
    { key: "1-3", desc: "Select suggestion" },
    { key: "?", desc: "Toggle this help" },
    { key: "Esc", desc: "Exit chat view" },
  ];

  return (
    <Box
      flexDirection="column"
      borderStyle={borderStyles.modal}
      borderColor={theme.semantic.focus}
      paddingX={1}
      marginY={1}
    >
      <Text bold color={theme.semantic.focus}>
        {indicators.bullet} Keyboard Shortcuts
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {shortcuts.map((s) => (
          <Text key={s.key} color={theme.semantic.textPrimary}>
            {indicators.bullet} <Text bold>{s.key}</Text> - {s.desc}
          </Text>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text color={theme.semantic.textMuted}>Press ? again to hide</Text>
      </Box>
    </Box>
  );
}

interface ChatInputProps {
  value: string;
  isLoading: boolean;
}

function ChatInput({ value, isLoading }: ChatInputProps) {
  const theme = getEnhancedTheme();
  const cursorVisible = useBlinkingCursor(500);

  return (
    <Box
      borderStyle={borderStyles.input}
      borderColor={isLoading ? theme.semantic.border : theme.semantic.focus}
      paddingX={2}
      marginTop={1}
      marginX={1}
    >
      <Text color={theme.semantic.textMuted}>{indicators.selected} </Text>
      <Text color={theme.semantic.textPrimary}>{value}</Text>
      {!isLoading && cursorVisible && (
        <Text color={theme.semantic.focus}>│</Text>
      )}
      {isLoading && (
        <Text color={theme.semantic.textMuted}> waiting...</Text>
      )}
    </Box>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ChatView({ width, height }: ChatViewProps) {
  const theme = getEnhancedTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const [scrollOffset, setScrollOffset] = useState(0);

  // Enhanced features state
  const [agentStage, setAgentStage] = useState<
    "planning" | "actions" | "validating" | "answering" | "complete"
  >("complete");
  const [toolExecutions, setToolExecutions] = useState<ToolExecution[]>([]);
  const [reasoningSteps, setReasoningSteps] = useState<ReasoningStep[]>([]);
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(true);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  const [lastResponseTime, setLastResponseTime] = useState<number>(0);
  const streamCursorVisible = useBlinkingCursor(500);
  const [context, setContext] = useState<SuggestionContext>({
    hasInvoices: false,
    hasExpenses: false,
    hasCustomers: false,
    lastToolError: undefined,
  });

  const maxVisibleMessages = 7;

  // Initialize with greeting and load context
  useEffect(() => {
    if (!ai.validateApiKey()) {
      setError(ai.getApiKeyError());
      return;
    }

    // Load context data
    try {
      const dbContext = getDatabaseContext();
      setContext({
        hasInvoices: (dbContext.invoices?.total || 0) > 0,
        hasExpenses: (dbContext.expensesByCategory?.length || 0) > 0,
        hasCustomers: (dbContext.customers?.length || 0) > 0,
      });
    } catch (err) {
      // Context loading failed, use defaults
    }

    setMessages([
      {
        role: "assistant",
        content:
          "Hello! I'm your financial assistant. Ask me anything about your finances, or tell me to create invoices, record expenses, and more.\n\n**Quick tips:**\n• Press **?** for keyboard shortcuts\n• I'll show suggestions after each response\n• Watch for proactive insights as we chat",
        timestamp: new Date(),
      },
    ]);
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > maxVisibleMessages) {
      setScrollOffset(messages.length - maxVisibleMessages);
    }
  }, [messages.length, maxVisibleMessages]);

  // Keyboard handling
  useInput((char, key) => {
    // Help toggle - always available
    if (char === "?" && input === "") {
      setShowHelp((prev) => !prev);
      return;
    }

    if (isLoading) return;

    // Expand/collapse thinking section
    if (char === "e" && input === "") {
      setIsThinkingExpanded((prev) => !prev);
      return;
    }

    // Suggestion shortcuts (1, 2, 3)
    if (input === "" && ["1", "2", "3"].includes(char)) {
      const suggestionIndex = parseInt(char, 10) - 1;
      if (suggestions[suggestionIndex]) {
        setInput(suggestions[suggestionIndex].action);
        setTimeout(() => handleSubmit(), 100);
      }
      return;
    }

    if (key.return && input.trim()) {
      handleSubmit();
      return;
    }

    if (key.backspace || key.delete) {
      setInput((prev) => prev.slice(0, -1));
      return;
    }

    // Scroll up/down with arrow keys or j/k when input is empty
    if (input === "" && messages.length > maxVisibleMessages) {
      if (key.upArrow || char === "k") {
        setScrollOffset((prev) => Math.max(0, prev - 1));
        return;
      }
      if (key.downArrow || char === "j") {
        setScrollOffset((prev) =>
          Math.min(messages.length - maxVisibleMessages, prev + 1)
        );
        return;
      }
    }

    if (char && !key.ctrl && !key.meta && !key.escape) {
      setInput((prev) => prev + char);
    }
  });

  const handleSubmit = async () => {
    const userMessage = input.trim();
    if (!userMessage) return;

    const startTime = Date.now();
    setInput("");
    const userMsg: Message = {
      role: "user",
      content: userMessage,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    setStreamingText("");
    setToolExecutions([]);
    setReasoningSteps([]);
    setSuggestions([]);
    setAgentStage("planning");
    let stepId = 0;

    // Helper to add a reasoning step
    const addStep = (
      type: ReasoningStep["type"],
      content: string,
      extra?: Partial<ReasoningStep>
    ) => {
      const step: ReasoningStep = {
        id: stepId++,
        type,
        content,
        timestamp: Date.now(),
        ...extra,
      };
      setReasoningSteps((prev) => [...prev, step]);
      return step;
    };

    // Initial thought
    addStep(
      "thought",
      `Understanding: "${userMessage.slice(0, 60)}${userMessage.length > 60 ? "…" : ""}"`
    );

    try {
      const apiKey = ai.getApiKey();
      if (!apiKey) throw new Error(ai.getApiKeyError());

      const client = new OpenAI({ apiKey });
      const dbContext = getDatabaseContext();
      const contextString = buildDatabaseContextString(dbContext);

      const systemPrompt = `You are a friendly financial assistant for OpenAccounting.
You help users understand their business finances in plain, simple English.

Current Business Data:
${contextString}

Guidelines for your responses:
- **Use plain English** - Avoid accounting jargon. If you must use terms like "receivables" or "payables", explain them (e.g., "money owed to you", "money you owe")
- **Be visual & structured** - Use bullet points, numbered lists, tables, and progress bars to make data easy to scan
- **Use markdown formatting** - Support for tables, key-value pairs, progress bars, and sections
- **Keep it simple** - Short sentences, one idea at a time
- **Be specific** - Always include actual numbers, dates, and names
- **Format money clearly** - Always show currency amounts like $1,234.56
- **Use bold for emphasis** - Highlight key figures and section titles with **bold text**
- **Be proactive** - Point out issues, suggest actions, and offer follow-up questions

You have access to tools to create invoices, record expenses, and more. After using tools, provide a clear summary of what was accomplished.`;

      // First call to check for tool use
      const response = await client.chat.completions.create({
        model: ai.chatModel,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content: userMessage },
        ],
        tools: agentTools,
        tool_choice: "auto",
        max_tokens: 500,
      });

      let assistantMessage = response.choices[0]?.message;

      // Handle tool calls
      if (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0) {
        setAgentStage("actions");
        addStep(
          "thought",
          `Planning to use ${assistantMessage.tool_calls.length} tool${assistantMessage.tool_calls.length > 1 ? "s" : ""}`
        );

        const toolMessages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam> =
          [assistantMessage];
        const executions: ToolExecution[] = [];
        let lastToolError: SuggestionContext['lastToolError'] = undefined;

        for (const toolCall of assistantMessage.tool_calls) {
          if (toolCall.type !== "function") continue;
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments);

          addStep("action", `Calling ${toolName}`, { toolName, toolArgs });

          const execution: ToolExecution = {
            name: toolName,
            status: "running",
            args: toolArgs,
          };
          executions.push(execution);
          setToolExecutions([...executions]);
          setToolStatus(`Executing ${toolName}...`);

          try {
            const result = await executeTool(toolName, toolArgs);
            execution.status = result.success ? "completed" : "failed";
            execution.result = result.result;

            // Track tool errors for smart suggestions
            if (!result.success) {
              lastToolError = {
                tool: toolName,
                error: result.result,
                success: false,
              };
              execution.error = result.result;
            }

            addStep("observation", result.result.slice(0, 200), {
              toolName,
              toolResult: { success: result.success, result: result.result, data: result.data },
            });

            toolMessages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: result.result,
            });
          } catch (err) {
            execution.status = "failed";
            execution.error = (err as Error).message;

            // Track caught errors for smart suggestions
            lastToolError = {
              tool: toolName,
              error: (err as Error).message,
              success: false,
            };

            addStep("observation", `Error: ${(err as Error).message}`, {
              toolName,
              toolResult: {
                success: false,
                result: (err as Error).message,
                error: (err as Error).message,
              },
            });
          }

          setToolExecutions([...executions]);
        }

        setToolStatus(null);
        setAgentStage("validating");

        // Get final response with streaming
        setAgentStage("answering");
        const stream = await client.chat.completions.create({
          model: ai.chatModel,
          messages: [
            { role: "system", content: systemPrompt },
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { role: "user", content: userMessage },
            ...toolMessages,
          ],
          max_tokens: 500,
          stream: true,
        });

        let fullResponse = "";
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          fullResponse += content;
          setStreamingText(fullResponse);
        }

        const responseTime = Date.now() - startTime;
        const tokenCount = Math.ceil(fullResponse.length / 4);
        const dataSource = `Analyzed ${executions.length} tool${executions.length > 1 ? "s" : ""}`;

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: fullResponse,
            timestamp: new Date(),
            metadata: { responseTime, tokenCount, dataSource },
          },
        ]);
        setStreamingText("");
        setLastResponseTime(responseTime);

        // Pass error context to generate smart recovery suggestions
        const suggestionContext: SuggestionContext = {
          ...context,
          lastToolError,
        };
        const smartSuggestions = generateSuggestions(fullResponse, suggestionContext);
        setSuggestions(smartSuggestions);
        setAgentStage("complete");
      } else {
        // No tools - stream the response directly
        setAgentStage("answering");
        const stream = await client.chat.completions.create({
          model: ai.chatModel,
          messages: [
            { role: "system", content: systemPrompt },
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { role: "user", content: userMessage },
          ],
          max_tokens: 500,
          stream: true,
        });

        let fullResponse = "";
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          fullResponse += content;
          setStreamingText(fullResponse);
        }

        const responseTime = Date.now() - startTime;
        const tokenCount = Math.ceil(fullResponse.length / 4);

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: fullResponse,
            timestamp: new Date(),
            metadata: { responseTime, tokenCount, dataSource: "Direct response" },
          },
        ]);
        setStreamingText("");
        setLastResponseTime(responseTime);

        const smartSuggestions = generateSuggestions(fullResponse, context);
        setSuggestions(smartSuggestions);
        setAgentStage("complete");
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${(err as Error).message}`,
          timestamp: new Date(),
        },
      ]);
      setAgentStage("complete");
    }

    setIsLoading(false);
    setToolStatus(null);
  };

  const messageHeight = height - 7;

  // Agent stage visual indicators
  const stageIcons: Record<string, string> = {
    planning: "◐",
    actions: "◑",
    validating: "◒",
    answering: "◓",
    complete: "●",
  };

  return (
    <Box flexDirection="column" width={width} height={height} paddingX={1}>
      {/* Header */}
      <Box
        justifyContent="space-between"
        marginBottom={1}
        borderStyle="single"
        borderColor={theme.semantic.border}
        borderTop={false}
        borderLeft={false}
        borderRight={false}
        paddingBottom={1}
      >
        <Box>
          <Text bold color={theme.semantic.info}>◆ AI Assistant</Text>
          <Text color={theme.semantic.textMuted}> • {ai.chatModel}</Text>
        </Box>
        <Box>
          {isLoading && (
            <Text color={theme.semantic.warning}>
              {stageIcons[agentStage]} {agentStage}
            </Text>
          )}
          {!isLoading && messages.length > 1 && (
            <Text color={theme.semantic.textMuted}>
              {messages.length - 1} message{messages.length > 2 ? "s" : ""}
            </Text>
          )}
        </Box>
      </Box>

      {/* Messages area */}
      <Box flexDirection="column" height={messageHeight} overflowY="hidden">
        {error ? (
          <Box
            borderStyle={borderStyles.panel}
            borderColor={theme.semantic.error}
            paddingX={1}
            marginY={1}
          >
            <Text color={theme.semantic.error}>
              {indicators.cross} {error}
            </Text>
          </Box>
        ) : (
          <>
            {/* Scroll indicator - top */}
            {scrollOffset > 0 && (
              <Box paddingX={1}>
                <Text color={theme.semantic.textMuted}>
                  {indicators.arrowUp} {scrollOffset} more message
                  {scrollOffset > 1 ? "s" : ""} above
                </Text>
              </Box>
            )}

            {messages
              .slice(scrollOffset, scrollOffset + maxVisibleMessages)
              .map((msg, i) => (
                <Box key={i}>
                  <MessageBubble message={msg} width={width - 4} />
                </Box>
              ))}

            {/* Scroll indicator - bottom */}
            {scrollOffset + maxVisibleMessages < messages.length && (
              <Box paddingX={1}>
                <Text color={theme.semantic.textMuted}>
                  {indicators.arrowDown}{" "}
                  {messages.length - scrollOffset - maxVisibleMessages} more below{" "}
                  {indicators.bullet} {scrollOffset + 1}-
                  {Math.min(scrollOffset + maxVisibleMessages, messages.length)} of{" "}
                  {messages.length}
                </Text>
              </Box>
            )}

            {/* Reasoning panel */}
            {(isLoading || reasoningSteps.length > 0) && isThinkingExpanded && (
              <ReasoningPanel
                steps={reasoningSteps}
                isLoading={isLoading}
                maxVisibleSteps={5}
              />
            )}

            {/* Compact reasoning indicator */}
            {(isLoading || reasoningSteps.length > 0) && !isThinkingExpanded && (
              <ReasoningIndicator steps={reasoningSteps} isLoading={isLoading} />
            )}

            {/* Tool execution view */}
            {toolExecutions.length > 0 && !isThinkingExpanded && (
              <ToolExecutionView tools={toolExecutions} isExpanded={false} />
            )}

            {/* Streaming response */}
            {streamingText && (
              <Box flexDirection="column" paddingX={2} marginY={1}>
                <Box marginBottom={1}>
                  <Text color={theme.semantic.textMuted}>Assistant</Text>
                </Box>
                <Box paddingLeft={1}>
                  <EnhancedMarkdown text={streamingText} />
                  <Text color={theme.semantic.warning}>
                    {streamCursorVisible ? "▌" : " "}
                  </Text>
                </Box>
              </Box>
            )}

            {/* Loading indicator */}
            {isLoading && !streamingText && (
              <Box marginY={1} paddingX={1}>
                <Text color={theme.semantic.warning}>
                  <Spinner type="dots" />
                </Text>
                <Text color={theme.semantic.textMuted}>
                  {" "}
                  {toolStatus || "Thinking..."}
                </Text>
              </Box>
            )}

            {/* Suggestions bar */}
            {!isLoading && suggestions.length > 0 && (
              <SuggestionsBar suggestions={suggestions} />
            )}

            {/* Help overlay */}
            <HelpOverlay visible={showHelp} />
          </>
        )}
      </Box>

      {/* Input area */}
      <ChatInput value={input} isLoading={isLoading} />

      {/* Status bar */}
      <Box paddingX={2} justifyContent="space-between">
        <Text color={theme.semantic.textMuted} dimColor>
          ↩ send {indicators.bullet} ↑↓ scroll {indicators.bullet} e expand{" "}
          {indicators.bullet} 1-3 suggest {indicators.bullet} ? help
        </Text>
        <Text color={theme.semantic.textMuted} dimColor>
          {lastResponseTime > 0 && `${(lastResponseTime / 1000).toFixed(1)}s`}
        </Text>
      </Box>
    </Box>
  );
}
