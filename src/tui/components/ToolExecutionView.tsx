/**
 * ToolExecutionView Component
 *
 * Displays tool execution status in a clean, minimal format.
 * Supports compact and expanded views.
 */

import React from "react";
import { Box, Text } from "ink";
import { getEnhancedTheme } from "../design/theme.js";
import { ToolResultCard, ToolResultSummary } from "./ToolResultCard.js";

export interface ToolExecution {
  name: string;
  status: "running" | "completed" | "failed";
  args?: Record<string, unknown>;
  result?: string;
  error?: string;
  duration?: number;
}

export interface ToolExecutionViewProps {
  tools: ToolExecution[];
  isExpanded: boolean;
}

export function ToolExecutionView({ tools, isExpanded }: ToolExecutionViewProps) {
  const theme = getEnhancedTheme();

  if (tools.length === 0) return null;

  // Compact view - single line summary
  if (!isExpanded) {
    return (
      <Box paddingX={2} marginY={1}>
        <ToolResultSummary tools={tools} />
        <Text color={theme.semantic.textMuted} dimColor> · e to expand</Text>
      </Box>
    );
  }

  // Expanded view - show full tool details
  return (
    <Box flexDirection="column" paddingX={2} marginY={1}>
      <Box marginBottom={1}>
        <Text color={theme.semantic.textMuted}>Tools</Text>
      </Box>

      <Box flexDirection="column" paddingLeft={1}>
        {tools.map((tool, i) => (
          <ToolResultCard
            key={i}
            name={tool.name}
            status={tool.status}
            args={tool.args}
            result={tool.result}
            error={tool.error}
            duration={tool.duration}
          />
        ))}
      </Box>

      <Box marginTop={1}>
        <Text color={theme.semantic.textMuted} dimColor>e to collapse</Text>
      </Box>
    </Box>
  );
}
