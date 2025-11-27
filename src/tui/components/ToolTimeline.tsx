/**
 * ToolTimeline Component
 *
 * Visual timeline showing tool execution sequence with duration bars.
 * Compact by default, expandable for details.
 */

import React from "react";
import { Box, Text } from "ink";
import { getEnhancedTheme } from "../design/theme.js";
import { indicators } from "../design/tokens.js";

export interface ToolTimelineEntry {
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  startTime?: number;
  endTime?: number;
  duration?: number;
}

export interface ToolTimelineProps {
  tools: ToolTimelineEntry[];
  isExpanded?: boolean;
  maxWidth?: number;
}

// Format tool name for display
function formatToolName(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Format duration
function formatDuration(ms?: number): string {
  if (!ms || ms < 0) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function ToolTimeline({ tools, isExpanded = false, maxWidth = 40 }: ToolTimelineProps) {
  const theme = getEnhancedTheme();

  if (tools.length === 0) return null;

  // Calculate total duration for scaling bars
  const totalDuration = tools.reduce((sum, t) => sum + (t.duration || 0), 0);
  const maxBarWidth = maxWidth - 20; // Leave room for labels

  // Compact view - single line summary
  if (!isExpanded) {
    const completed = tools.filter((t) => t.status === "completed").length;
    const failed = tools.filter((t) => t.status === "failed").length;
    const totalTime = formatDuration(totalDuration);

    return (
      <Box paddingX={2}>
        <Text color={theme.semantic.textMuted}>
          {tools.length} tool{tools.length !== 1 ? "s" : ""}
        </Text>
        {completed > 0 && (
          <Text color={theme.semantic.success}> · {completed} done</Text>
        )}
        {failed > 0 && (
          <Text color={theme.semantic.error}> · {failed} failed</Text>
        )}
        {totalTime && (
          <Text color={theme.semantic.textMuted} dimColor> · {totalTime}</Text>
        )}
      </Box>
    );
  }

  // Expanded view - visual timeline
  return (
    <Box flexDirection="column" paddingX={2} marginY={1}>
      <Box marginBottom={1}>
        <Text color={theme.semantic.textMuted}>Timeline</Text>
        {totalDuration > 0 && (
          <Text color={theme.semantic.textMuted} dimColor> · {formatDuration(totalDuration)} total</Text>
        )}
      </Box>

      <Box flexDirection="column" paddingLeft={1}>
        {tools.map((tool, i) => {
          const barWidth = totalDuration > 0 && tool.duration
            ? Math.max(1, Math.round((tool.duration / totalDuration) * maxBarWidth))
            : 1;

          const statusConfig = {
            pending: { color: theme.semantic.textMuted, icon: indicators.pending, bar: "░" },
            running: { color: theme.semantic.warning, icon: indicators.partial, bar: "▒" },
            completed: { color: theme.semantic.success, icon: indicators.complete, bar: "█" },
            failed: { color: theme.semantic.error, icon: indicators.cross, bar: "█" },
          }[tool.status];

          return (
            <Box key={i} marginBottom={1}>
              {/* Status indicator */}
              <Text color={statusConfig.color}>{statusConfig.icon} </Text>

              {/* Tool name (fixed width) */}
              <Text color={theme.semantic.textPrimary}>
                {formatToolName(tool.name).slice(0, 12).padEnd(12)}
              </Text>

              {/* Duration bar */}
              <Text color={statusConfig.color}>
                {statusConfig.bar.repeat(barWidth)}
              </Text>

              {/* Duration label */}
              {tool.duration && (
                <Text color={theme.semantic.textMuted} dimColor>
                  {" "}{formatDuration(tool.duration)}
                </Text>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

/**
 * MiniTimeline - Ultra-compact horizontal view
 */
export function MiniTimeline({ tools }: { tools: ToolTimelineEntry[] }) {
  const theme = getEnhancedTheme();

  if (tools.length === 0) return null;

  return (
    <Box>
      {tools.map((tool, i) => {
        const statusConfig = {
          pending: { color: theme.semantic.textMuted, icon: indicators.pending },
          running: { color: theme.semantic.warning, icon: indicators.partial },
          completed: { color: theme.semantic.success, icon: indicators.complete },
          failed: { color: theme.semantic.error, icon: indicators.cross },
        }[tool.status];

        return (
          <React.Fragment key={i}>
            <Text color={statusConfig.color}>{statusConfig.icon}</Text>
            {i < tools.length - 1 && (
              <Text color={theme.semantic.textMuted} dimColor>{indicators.dividerH}</Text>
            )}
          </React.Fragment>
        );
      })}
    </Box>
  );
}

/**
 * ToolSequence - Shows tool execution in sequence with arrows
 */
export function ToolSequence({ tools }: { tools: ToolTimelineEntry[] }) {
  const theme = getEnhancedTheme();

  if (tools.length === 0) return null;

  return (
    <Box>
      {tools.map((tool, i) => {
        const statusColor = {
          pending: theme.semantic.textMuted,
          running: theme.semantic.warning,
          completed: theme.semantic.success,
          failed: theme.semantic.error,
        }[tool.status];

        const shortName = formatToolName(tool.name).slice(0, 10);

        return (
          <React.Fragment key={i}>
            <Text color={statusColor}>{shortName}</Text>
            {i < tools.length - 1 && (
              <Text color={theme.semantic.textMuted} dimColor> {indicators.arrow} </Text>
            )}
          </React.Fragment>
        );
      })}
    </Box>
  );
}
