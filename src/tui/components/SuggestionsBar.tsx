/**
 * SuggestionsBar Component
 *
 * Clean, minimal suggestion display with inline keyboard hints.
 * Enhanced with smart context-aware suggestions based on financial state.
 */

import React from "react";
import { Box, Text } from "ink";
import { getEnhancedTheme } from "../design/theme.js";
import { indicators } from "../design/tokens.js";
import { getSuggestedQuestions, buildSmartContext } from "../../agent/smart-context.js";

export interface Suggestion {
  key: string; // "1", "2", "3"
  label: string;
  action: string; // The actual query to send
  type: "question" | "action" | "insight";
}

export interface SuggestionsBarProps {
  suggestions: Suggestion[];
  onSelect?: (action: string) => void;
  isCompact?: boolean;
}

export function SuggestionsBar({ suggestions, isCompact = false }: SuggestionsBarProps) {
  const theme = getEnhancedTheme();

  if (suggestions.length === 0) return null;

  // Minimal type indicators
  const typeIndicators = {
    question: indicators.question,
    action: indicators.arrow,
    insight: indicators.pending,
  };

  // Compact inline view
  if (isCompact) {
    return (
      <Box paddingX={2}>
        <Text color={theme.semantic.textMuted} dimColor>Try: </Text>
        {suggestions.map((suggestion, i) => (
          <React.Fragment key={suggestion.key}>
            <Text color={theme.semantic.info}>{suggestion.key}</Text>
            <Text color={theme.semantic.textMuted}> {suggestion.label}</Text>
            {i < suggestions.length - 1 && (
              <Text color={theme.semantic.textMuted} dimColor> · </Text>
            )}
          </React.Fragment>
        ))}
      </Box>
    );
  }

  // Full suggestions view
  return (
    <Box flexDirection="column" paddingX={2} marginY={1}>
      <Box marginBottom={1}>
        <Text color={theme.semantic.textMuted} dimColor>Suggestions</Text>
      </Box>

      <Box flexDirection="column" paddingLeft={1}>
        {suggestions.map((suggestion) => (
          <Box key={suggestion.key} marginBottom={1}>
            <Text color={theme.semantic.info} bold>{suggestion.key} </Text>
            <Text color={theme.semantic.textMuted} dimColor>{typeIndicators[suggestion.type]} </Text>
            <Text color={theme.semantic.textPrimary}>{suggestion.label}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/**
 * InlineSuggestions - Ultra-compact single line
 */
export function InlineSuggestions({ suggestions }: { suggestions: Suggestion[] }) {
  const theme = getEnhancedTheme();

  if (suggestions.length === 0) return null;

  return (
    <Box>
      {suggestions.slice(0, 3).map((s, i) => (
        <React.Fragment key={s.key}>
          <Text color={theme.semantic.info}>[{s.key}]</Text>
          <Text color={theme.semantic.textMuted}> {s.label.slice(0, 20)}{s.label.length > 20 ? indicators.ellipsis : ""}</Text>
          {i < Math.min(suggestions.length, 3) - 1 && (
            <Text color={theme.semantic.textMuted} dimColor>  </Text>
          )}
        </React.Fragment>
      ))}
    </Box>
  );
}

// Context for generating suggestions, including error information
export interface SuggestionContext {
  hasInvoices: boolean;
  hasExpenses: boolean;
  hasCustomers: boolean;
  // Error context for smart recovery suggestions
  lastToolError?: {
    tool: string;
    error: string;
    success: boolean;
  };
}

// Helper function to generate smart suggestions based on context
export function generateSuggestions(
  lastMessage: string,
  context: SuggestionContext
): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // PRIORITY: Check for tool errors first and provide recovery suggestions
  if (context.lastToolError && !context.lastToolError.success) {
    const { tool, error } = context.lastToolError;

    // Expense recording error - category not found
    if (tool === 'record_expense' && (error.includes('not found') || error.includes('category'))) {
      return [
        {
          key: "1",
          label: "List expense accounts",
          action: "What expense accounts are available?",
          type: "question",
        },
        {
          key: "2",
          label: "Create expense account",
          action: "Create a new expense account",
          type: "action",
        },
        {
          key: "3",
          label: "Show chart of accounts",
          action: "Show me the full chart of accounts",
          type: "question",
        },
      ];
    }

    // Payment recording error - invoice not found
    if (tool === 'record_payment' && (error.includes('not found') || error.includes('invoice'))) {
      return [
        {
          key: "1",
          label: "List outstanding invoices",
          action: "Show all outstanding invoices",
          type: "question",
        },
        {
          key: "2",
          label: "Create invoice first",
          action: "Create a new invoice",
          type: "action",
        },
        {
          key: "3",
          label: "Search invoices",
          action: "Search for invoices by customer name",
          type: "question",
        },
      ];
    }

    // Generic error - offer help
    if (!context.lastToolError.success) {
      return [
        {
          key: "1",
          label: "Get help",
          action: "Help me understand what went wrong",
          type: "question",
        },
        {
          key: "2",
          label: "Try again",
          action: "Let's try that again with the correct information",
          type: "action",
        },
      ];
    }
  }

  // Analyze last message to generate contextual suggestions
  const lower = lastMessage.toLowerCase();

  // Invoice-related suggestions
  if (lower.includes("invoice") || lower.includes("owe")) {
    if (context.hasInvoices) {
      suggestions.push({
        key: "1",
        label: "Show overdue invoices",
        action: "Which invoices are overdue?",
        type: "question",
      });
      suggestions.push({
        key: "2",
        label: "Send invoice reminders",
        action: "Send reminders for unpaid invoices",
        type: "action",
      });
    } else {
      suggestions.push({
        key: "1",
        label: "Create your first invoice",
        action: "Create a new invoice",
        type: "action",
      });
    }
  }

  // Expense-related suggestions
  if (lower.includes("expense") || lower.includes("spent") || lower.includes("spending")) {
    suggestions.push({
      key: suggestions.length === 0 ? "1" : String(suggestions.length + 1),
      label: "Show expense breakdown by category",
      action: "Break down my expenses by category this month",
      type: "question",
    });
    suggestions.push({
      key: String(suggestions.length + 1),
      label: "Compare to last month",
      action: "How do my expenses compare to last month?",
      type: "insight",
    });
  }

  // Revenue/income suggestions
  if (lower.includes("revenue") || lower.includes("income") || lower.includes("earning")) {
    suggestions.push({
      key: suggestions.length === 0 ? "1" : String(suggestions.length + 1),
      label: "Show profit & loss",
      action: "Show me my profit and loss statement",
      type: "question",
    });
    suggestions.push({
      key: String(suggestions.length + 1),
      label: "Revenue trends",
      action: "What are my revenue trends over time?",
      type: "insight",
    });
  }

  // Customer-related suggestions
  if (lower.includes("customer") || lower.includes("client")) {
    if (!context.hasCustomers) {
      suggestions.push({
        key: "1",
        label: "Add your first customer",
        action: "Add a new customer",
        type: "action",
      });
    } else {
      suggestions.push({
        key: suggestions.length === 0 ? "1" : String(suggestions.length + 1),
        label: "List all customers",
        action: "Show me all my customers",
        type: "question",
      });
    }
  }

  // Default suggestions if nothing matched - use smart context
  if (suggestions.length === 0) {
    try {
      // Get smart suggestions based on financial state
      const smartQuestions = getSuggestedQuestions();

      // Map smart suggestions to our format
      for (let i = 0; i < Math.min(smartQuestions.length, 3); i++) {
        const question = smartQuestions[i];
        // Determine type based on content
        const type: Suggestion["type"] = question.toLowerCase().includes("create") ||
                    question.toLowerCase().includes("add") ||
                    question.toLowerCase().includes("send")
          ? "action"
          : question.toLowerCase().includes("insight") ||
            question.toLowerCase().includes("trend") ||
            question.toLowerCase().includes("why")
          ? "insight"
          : "question";

        suggestions.push({
          key: String(i + 1),
          label: question,
          action: question,
          type,
        });
      }
    } catch {
      // Fallback if smart context fails
      suggestions.push(
        {
          key: "1",
          label: "Financial summary",
          action: "Give me a financial summary",
          type: "question",
        },
        {
          key: "2",
          label: "Recent activity",
          action: "What's my recent financial activity?",
          type: "question",
        },
        {
          key: "3",
          label: "Quick insights",
          action: "Any insights I should know about my finances?",
          type: "insight",
        }
      );
    }
  }

  // Limit to 3 suggestions max
  return suggestions.slice(0, 3);
}

/**
 * Get proactive alert-based suggestions
 * Call this when the chat view loads or after significant actions
 */
export function getAlertBasedSuggestions(): Suggestion[] {
  try {
    const context = buildSmartContext();
    const suggestions: Suggestion[] = [];

    // Generate suggestions based on alerts
    for (const alert of context.alerts) {
      if (alert.type === "critical") {
        // Critical alerts get priority suggestions
        if (alert.title.includes("Overdue")) {
          suggestions.push({
            key: String(suggestions.length + 1),
            label: "Show overdue invoices",
            action: "Show me all overdue invoices with details",
            type: "action",
          });
        } else if (alert.title.includes("Cash")) {
          suggestions.push({
            key: String(suggestions.length + 1),
            label: "Check cash flow",
            action: "What's causing my cash flow issues?",
            type: "insight",
          });
        }
      } else if (alert.type === "warning") {
        if (alert.title.includes("Loss")) {
          suggestions.push({
            key: String(suggestions.length + 1),
            label: "Expense breakdown",
            action: "Break down my expenses - where am I overspending?",
            type: "insight",
          });
        } else if (alert.title.includes("Aged")) {
          suggestions.push({
            key: String(suggestions.length + 1),
            label: "Collection help",
            action: "Which customers need payment reminders?",
            type: "action",
          });
        }
      }

      if (suggestions.length >= 3) break;
    }

    return suggestions;
  } catch {
    return [];
  }
}
