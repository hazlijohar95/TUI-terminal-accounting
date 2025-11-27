/**
 * ThinkingSection Component
 *
 * Minimal, clean display of agent thinking stages.
 * Uses subtle Unicode indicators instead of emojis.
 */

import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { getEnhancedTheme } from "../design/theme.js";
import { indicators } from "../design/tokens.js";

export interface ThinkingSectionProps {
  stage: "planning" | "actions" | "validating" | "answering" | "complete";
  message: string;
  plan?: Array<{ id: number; description: string; tool: string; status: "pending" | "running" | "completed" | "failed" }>;
  isExpanded: boolean;
  startTime?: number;
}

export function ThinkingSection({ stage, message, plan, isExpanded, startTime }: ThinkingSectionProps) {
  const theme = getEnhancedTheme();
  const [elapsed, setElapsed] = useState(0);

  // Track elapsed time
  useEffect(() => {
    if (!startTime || stage === "complete") return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime, stage]);

  // Clean, minimal stage config
  const stageInfo = {
    planning: { icon: indicators.pending, label: "Planning", color: theme.semantic.textMuted },
    actions: { icon: indicators.partial, label: "Executing", color: theme.semantic.warning },
    validating: { icon: indicators.partial, label: "Validating", color: theme.semantic.success },
    answering: { icon: indicators.partial, label: "Responding", color: theme.semantic.info },
    complete: { icon: indicators.complete, label: "Done", color: theme.semantic.success },
  };

  const info = stageInfo[stage];
  const isActive = stage !== "complete";

  // Compact view - single line
  if (!isExpanded) {
    return (
      <Box paddingX={2} marginY={1}>
        {isActive ? (
          <>
            <Text color={theme.semantic.warning}>
              <Spinner type="dots" />
            </Text>
            <Text color={theme.semantic.textMuted}> {info.label}</Text>
          </>
        ) : (
          <>
            <Text color={info.color}>{info.icon}</Text>
            <Text color={theme.semantic.textMuted}> {info.label}</Text>
          </>
        )}
        {elapsed > 0 && isActive && (
          <Text color={theme.semantic.textMuted} dimColor> · {elapsed}s</Text>
        )}
        <Text color={theme.semantic.textMuted} dimColor> · e expand</Text>
      </Box>
    );
  }

  // Expanded view - show stages and plan
  return (
    <Box flexDirection="column" paddingX={2} marginY={1}>
      {/* Stage progress */}
      <Box marginBottom={1}>
        <StageProgress currentStage={stage} />
        {elapsed > 0 && isActive && (
          <Text color={theme.semantic.textMuted} dimColor> · {elapsed}s</Text>
        )}
      </Box>

      {/* Current message */}
      <Box paddingLeft={2} marginBottom={1}>
        <Text color={theme.semantic.textPrimary}>{message}</Text>
      </Box>

      {/* Plan steps if available */}
      {plan && plan.length > 0 && (
        <Box flexDirection="column" paddingLeft={2}>
          {plan.map((step) => {
            const statusIcon = {
              pending: indicators.pending,
              running: indicators.partial,
              completed: indicators.complete,
              failed: indicators.cross,
            }[step.status];

            const statusColor = {
              pending: theme.semantic.textMuted,
              running: theme.semantic.warning,
              completed: theme.semantic.success,
              failed: theme.semantic.error,
            }[step.status];

            return (
              <Box key={step.id}>
                <Text color={statusColor}>{statusIcon} </Text>
                <Text color={statusColor === theme.semantic.textMuted ? theme.semantic.textMuted : theme.semantic.textPrimary}>
                  {step.description}
                </Text>
              </Box>
            );
          })}
        </Box>
      )}

      <Box marginTop={1}>
        <Text color={theme.semantic.textMuted} dimColor>e to collapse</Text>
      </Box>
    </Box>
  );
}

/**
 * StageProgress - Visual progress through stages
 */
function StageProgress({ currentStage }: { currentStage: ThinkingSectionProps["stage"] }) {
  const theme = getEnhancedTheme();
  const stages: ThinkingSectionProps["stage"][] = ["planning", "actions", "validating", "answering", "complete"];
  const currentIndex = stages.indexOf(currentStage);

  return (
    <Box>
      {stages.slice(0, -1).map((stage, i) => {
        const isPast = i < currentIndex;
        const isCurrent = i === currentIndex;
        const color = isPast ? theme.semantic.success : isCurrent ? theme.semantic.warning : theme.semantic.textMuted;
        const icon = isPast ? indicators.complete : isCurrent ? indicators.partial : indicators.pending;

        return (
          <React.Fragment key={stage}>
            <Text color={color}>{icon}</Text>
            {i < stages.length - 2 && <Text color={theme.semantic.textMuted} dimColor> {indicators.dividerH} </Text>}
          </React.Fragment>
        );
      })}
    </Box>
  );
}

/**
 * MinimalThinking - Ultra-compact single spinner
 */
export function MinimalThinking({ message }: { message?: string }) {
  const theme = getEnhancedTheme();

  return (
    <Box paddingX={2}>
      <Text color={theme.semantic.warning}>
        <Spinner type="dots" />
      </Text>
      {message && <Text color={theme.semantic.textMuted}> {message}</Text>}
    </Box>
  );
}
