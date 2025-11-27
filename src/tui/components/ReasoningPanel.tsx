/**
 * ReasoningPanel Component
 *
 * Displays the agent's real-time reasoning steps in a clean, minimal format.
 * Shows thoughts, actions, observations, and final answers.
 */

import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { getEnhancedTheme } from "../design/theme.js";
import { indicators } from "../design/tokens.js";
import type { ReasoningStep } from "../../agent/engine/reasoning-engine.js";

export interface ReasoningPanelProps {
  steps: ReasoningStep[];
  isLoading?: boolean;
  maxVisibleSteps?: number;
}

// Format elapsed time in a human-readable way
function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = (ms / 1000).toFixed(1);
  return `${seconds}s`;
}

// Get time since a timestamp
function getTimeSince(timestamp: number): string {
  return formatElapsed(Date.now() - timestamp);
}

// Truncate text with ellipsis
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + "…";
}

// Format tool arguments for display
function formatArgs(args?: Record<string, unknown>): string {
  if (!args || Object.keys(args).length === 0) return "";
  const pairs = Object.entries(args)
    .slice(0, 3) // Show max 3 args
    .map(([k, v]) => `${k}=${typeof v === "string" ? `"${truncate(v, 20)}"` : v}`);
  const suffix = Object.keys(args).length > 3 ? ", …" : "";
  return `(${pairs.join(", ")}${suffix})`;
}

export function ReasoningPanel({ steps, isLoading = false, maxVisibleSteps = 6 }: ReasoningPanelProps) {
  const theme = getEnhancedTheme();
  const [visibleSteps, setVisibleSteps] = useState<ReasoningStep[]>([]);
  const [expandedStepId, setExpandedStepId] = useState<number | null>(null);

  // Animate steps appearing
  useEffect(() => {
    setVisibleSteps(steps.slice(-maxVisibleSteps));
  }, [steps, maxVisibleSteps]);

  if (steps.length === 0 && !isLoading) {
    return null;
  }

  return (
    <Box flexDirection="column" marginY={1}>
      {/* Header */}
      <Box paddingX={1} marginBottom={1}>
        <Text color={theme.semantic.textMuted}>
          {isLoading ? (
            <>
              <Text color={theme.semantic.warning}>
                <Spinner type="dots" />
              </Text>
              <Text> Reasoning</Text>
            </>
          ) : (
            <>
              <Text color={theme.semantic.success}>{indicators.complete}</Text>
              <Text> {steps.length} step{steps.length !== 1 ? "s" : ""}</Text>
            </>
          )}
        </Text>
      </Box>

      {/* Steps */}
      <Box flexDirection="column" paddingLeft={2}>
        {visibleSteps.map((step, index) => (
          <ReasoningStepRow
            key={step.id}
            step={step}
            isLast={index === visibleSteps.length - 1 && isLoading}
            isExpanded={expandedStepId === step.id}
            onToggle={() => setExpandedStepId(expandedStepId === step.id ? null : step.id)}
          />
        ))}
      </Box>

      {/* Truncation indicator */}
      {steps.length > maxVisibleSteps && (
        <Box paddingX={1} marginTop={1}>
          <Text color={theme.semantic.textMuted} dimColor>
            {indicators.ellipsis} {steps.length - maxVisibleSteps} earlier step{steps.length - maxVisibleSteps !== 1 ? "s" : ""} hidden
          </Text>
        </Box>
      )}
    </Box>
  );
}

interface ReasoningStepRowProps {
  step: ReasoningStep;
  isLast: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}

function ReasoningStepRow({ step, isLast, isExpanded }: ReasoningStepRowProps) {
  const theme = getEnhancedTheme();

  // Step type styling
  const typeConfig: Record<ReasoningStep["type"], { prefix: string; color: string; dimContent?: boolean }> = {
    thought: { prefix: indicators.pending, color: theme.semantic.textMuted, dimContent: true },
    action: { prefix: indicators.arrow, color: theme.semantic.warning },
    observation: { prefix: "  ", color: theme.semantic.textPrimary },
    answer: { prefix: indicators.check, color: theme.semantic.success },
  };

  const config = typeConfig[step.type];
  const elapsed = getTimeSince(step.timestamp);

  // For action steps, show tool name and args
  if (step.type === "action" && step.toolName) {
    return (
      <Box flexDirection="column" marginBottom={1}>
        <Box>
          <Text color={config.color}>{config.prefix} </Text>
          <Text bold color={config.color}>{step.toolName}</Text>
          <Text color={theme.semantic.textMuted}>{formatArgs(step.toolArgs)}</Text>
          <Text color={theme.semantic.textMuted} dimColor> {elapsed}</Text>
          {isLast && (
            <Text color={theme.semantic.warning}>
              {" "}<Spinner type="dots" />
            </Text>
          )}
        </Box>
      </Box>
    );
  }

  // For observation steps, show result with indentation
  if (step.type === "observation") {
    const content = step.toolResult?.success
      ? truncate(step.content, isExpanded ? 500 : 80)
      : step.content;
    const statusColor = step.toolResult?.success ? theme.semantic.success : theme.semantic.error;
    const statusIcon = step.toolResult?.success ? indicators.check : indicators.cross;

    return (
      <Box flexDirection="column" marginBottom={1} paddingLeft={2}>
        <Box>
          <Text color={statusColor}>{statusIcon} </Text>
          <Text color={theme.semantic.textPrimary}>{content}</Text>
        </Box>
        {isExpanded && step.toolResult?.data !== undefined && (
          <Box paddingLeft={2} marginTop={1}>
            <Text color={theme.semantic.textMuted} dimColor>
              {JSON.stringify(step.toolResult.data, null, 2).slice(0, 200)}
            </Text>
          </Box>
        )}
      </Box>
    );
  }

  // For thought and answer steps
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text color={config.color}>{config.prefix} </Text>
        <Text color={config.dimContent ? theme.semantic.textMuted : theme.semantic.textPrimary} italic={step.type === "thought"}>
          {truncate(step.content, isExpanded ? 500 : 120)}
        </Text>
        {step.type !== "answer" && (
          <Text color={theme.semantic.textMuted} dimColor> {elapsed}</Text>
        )}
      </Box>
    </Box>
  );
}

/**
 * Compact single-line reasoning indicator
 * For use when space is limited or user prefers minimal view
 */
export function ReasoningIndicator({ steps, isLoading }: { steps: ReasoningStep[]; isLoading: boolean }) {
  const theme = getEnhancedTheme();

  if (!isLoading && steps.length === 0) return null;

  const lastStep = steps[steps.length - 1];
  const actionCount = steps.filter((s) => s.type === "action").length;
  const observationCount = steps.filter((s) => s.type === "observation").length;

  if (isLoading) {
    return (
      <Box paddingX={1}>
        <Text color={theme.semantic.warning}>
          <Spinner type="dots" />
        </Text>
        <Text color={theme.semantic.textMuted}>
          {lastStep?.type === "action" && lastStep.toolName
            ? ` Calling ${lastStep.toolName}${indicators.ellipsis}`
            : ` Thinking${indicators.ellipsis}`}
        </Text>
        {actionCount > 0 && (
          <Text color={theme.semantic.textMuted} dimColor>
            {` ${indicators.bullet} ${actionCount} tool${actionCount !== 1 ? "s" : ""}`}
          </Text>
        )}
      </Box>
    );
  }

  return (
    <Box paddingX={1}>
      <Text color={theme.semantic.success}>{indicators.complete}</Text>
      <Text color={theme.semantic.textMuted}>
        {" "}{actionCount} tool{actionCount !== 1 ? "s" : ""} {indicators.bullet} {observationCount} result{observationCount !== 1 ? "s" : ""}
      </Text>
    </Box>
  );
}
