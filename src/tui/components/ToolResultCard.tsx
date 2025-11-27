/**
 * ToolResultCard Component
 *
 * Rich display for individual tool execution results.
 * Provides expandable details, syntax highlighting, and error context.
 */

import React, { useState } from "react";
import { Box, Text } from "ink";
import { getEnhancedTheme } from "../design/theme.js";
import { indicators } from "../design/tokens.js";

export interface ToolResultCardProps {
  name: string;
  status: "running" | "completed" | "failed";
  args?: Record<string, unknown>;
  result?: string;
  error?: string;
  duration?: number;
  isCompact?: boolean;
}

// Tool icons by category
const TOOL_ICONS: Record<string, string> = {
  // Invoice tools
  create_invoice: "◇",
  list_invoices: "≡",
  get_invoice: "○",
  send_invoice: "→",
  mark_invoice_paid: "✓",
  cancel_invoice: "×",
  // Customer tools
  create_customer: "+",
  list_customers: "≡",
  get_customer: "○",
  // Vendor tools
  create_vendor: "+",
  list_vendors: "≡",
  get_vendor: "○",
  // Expense tools
  record_expense: "−",
  list_expenses: "≡",
  get_expense: "○",
  // Payment tools
  record_payment: "$",
  // Report tools
  get_profit_loss: "◊",
  get_balance_sheet: "□",
  get_cash_flow: "~",
  get_financial_summary: "◈",
  // Document tools
  process_document: "⊡",
  list_documents: "≡",
  // Default
  default: "○",
};

// Format tool name for display
function formatToolName(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Truncate with ellipsis
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + "…";
}

// Format duration
function formatDuration(ms?: number): string {
  if (!ms) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// Parse and format result for better display
function formatResult(result: string): string {
  // Try to parse as JSON and format nicely
  try {
    const parsed = JSON.parse(result);
    if (typeof parsed === "object" && parsed !== null) {
      if (Array.isArray(parsed)) {
        return `[${parsed.length} items]`;
      }
      if (parsed.success !== undefined) {
        return parsed.message || (parsed.success ? "Success" : "Failed");
      }
      if (parsed.total !== undefined) {
        return `Total: ${parsed.total}`;
      }
    }
  } catch {
    // Not JSON, return as-is
  }
  return result;
}

export function ToolResultCard({
  name,
  status,
  args,
  result,
  error,
  duration,
  isCompact = false,
}: ToolResultCardProps) {
  const theme = getEnhancedTheme();
  const [isExpanded, setIsExpanded] = useState(false);

  const icon = TOOL_ICONS[name] || TOOL_ICONS.default;
  const displayName = formatToolName(name);

  // Status styling
  const statusConfig = {
    running: { color: theme.semantic.warning, icon: indicators.partial, label: "running" },
    completed: { color: theme.semantic.success, icon: indicators.complete, label: "done" },
    failed: { color: theme.semantic.error, icon: indicators.cross, label: "failed" },
  }[status];

  // Compact single-line view
  if (isCompact) {
    return (
      <Box>
        <Text color={statusConfig.color}>{statusConfig.icon} </Text>
        <Text color={theme.semantic.textMuted}>{icon} </Text>
        <Text color={theme.semantic.textPrimary}>{displayName}</Text>
        {duration && (
          <Text color={theme.semantic.textMuted} dimColor> {formatDuration(duration)}</Text>
        )}
      </Box>
    );
  }

  // Full card view
  return (
    <Box flexDirection="column" marginBottom={1}>
      {/* Header */}
      <Box>
        <Text color={statusConfig.color}>{statusConfig.icon} </Text>
        <Text color={theme.semantic.textMuted}>{icon} </Text>
        <Text bold color={theme.semantic.textPrimary}>{displayName}</Text>
        {duration && (
          <Text color={theme.semantic.textMuted} dimColor> · {formatDuration(duration)}</Text>
        )}
      </Box>

      {/* Arguments (collapsed by default) */}
      {args && Object.keys(args).length > 0 && (
        <Box paddingLeft={3}>
          <Text color={theme.semantic.textMuted} dimColor>
            {Object.entries(args)
              .slice(0, 3)
              .map(([k, v]) => `${k}=${typeof v === "string" ? `"${truncate(v, 15)}"` : v}`)
              .join(", ")}
            {Object.keys(args).length > 3 && "…"}
          </Text>
        </Box>
      )}

      {/* Result */}
      {status === "completed" && result && (
        <Box paddingLeft={3} flexDirection="column">
          <Text color={theme.semantic.success}>
            {isExpanded ? result : truncate(formatResult(result), 60)}
          </Text>
          {result.length > 60 && (
            <Text
              color={theme.semantic.textMuted}
              dimColor
              // Note: In Ink, we can't have onClick, this is just visual
            >
              {isExpanded ? "(showing full)" : "(truncated)"}
            </Text>
          )}
        </Box>
      )}

      {/* Error */}
      {status === "failed" && error && (
        <Box paddingLeft={3} flexDirection="column">
          <Text color={theme.semantic.error}>Error: {truncate(error, 80)}</Text>
        </Box>
      )}
    </Box>
  );
}

/**
 * ToolResultSummary - Compact summary of multiple tool executions
 */
export function ToolResultSummary({ tools }: { tools: ToolResultCardProps[] }) {
  const theme = getEnhancedTheme();

  const completed = tools.filter((t) => t.status === "completed").length;
  const failed = tools.filter((t) => t.status === "failed").length;
  const running = tools.filter((t) => t.status === "running").length;

  return (
    <Box paddingX={1}>
      <Text color={theme.semantic.textMuted}>{tools.length} tool{tools.length !== 1 ? "s" : ""}</Text>
      {completed > 0 && (
        <Text color={theme.semantic.success}> · {completed} done</Text>
      )}
      {failed > 0 && (
        <Text color={theme.semantic.error}> · {failed} failed</Text>
      )}
      {running > 0 && (
        <Text color={theme.semantic.warning}> · {running} running</Text>
      )}
    </Box>
  );
}
