/**
 * ProgressBar Component
 *
 * Animated progress indicator with multiple styles.
 */

import React from "react";
import { Box, Text } from "ink";
import { getEnhancedTheme } from "../../design/theme.js";
import { PROGRESS_CHARS, generateProgressBar, usePulse } from "../../animations.js";

export interface ProgressBarProps {
  /** Current progress value */
  value: number;
  /** Maximum value */
  max?: number;
  /** Bar width in characters */
  width?: number;
  /** Show percentage text */
  showPercent?: boolean;
  /** Show value text (e.g., "50/100") */
  showValue?: boolean;
  /** Progress bar style */
  style?: keyof typeof PROGRESS_CHARS;
  /** Color when incomplete */
  color?: string;
  /** Color when complete */
  completeColor?: string;
  /** Label text */
  label?: string;
  /** Animate the bar */
  animated?: boolean;
  /** Indeterminate (unknown progress) */
  indeterminate?: boolean;
}

export function ProgressBar({
  value,
  max = 100,
  width = 20,
  showPercent = false,
  showValue = false,
  style = "block",
  color,
  completeColor,
  label,
  animated = false,
  indeterminate = false,
}: ProgressBarProps) {
  const theme = getEnhancedTheme();
  const pulse = usePulse(500);

  const progress = Math.min(1, Math.max(0, value / max));
  const isComplete = progress >= 1;

  const barColor = isComplete
    ? completeColor || theme.semantic.success
    : color || theme.semantic.info;

  // Indeterminate animation
  if (indeterminate) {
    const chars = PROGRESS_CHARS[style];
    const position = Math.floor(pulse * (width - 3));
    const bar = Array(width)
      .fill(chars.empty)
      .map((char, i) => {
        if (i >= position && i < position + 3) {
          return chars.filled;
        }
        return char;
      })
      .join("");

    return (
      <Box>
        {label && (
          <Text color={theme.semantic.textSecondary}>{label} </Text>
        )}
        <Text color={barColor}>{bar}</Text>
      </Box>
    );
  }

  const bar = generateProgressBar(progress, width, style);
  const chars = PROGRESS_CHARS[style];
  const filledCount = Math.round(progress * width);
  const emptyCount = width - filledCount;

  // Animated pulse on the edge
  let displayBar = bar;
  if (animated && !isComplete && filledCount > 0 && filledCount < width) {
    const filled = chars.filled.repeat(filledCount - 1);
    const edge = pulse > 0.5 ? chars.filled : chars.empty;
    const empty = chars.empty.repeat(emptyCount);
    displayBar = filled + edge + empty;
  }

  return (
    <Box>
      {label && (
        <Text color={theme.semantic.textSecondary}>{label} </Text>
      )}
      <Text color={barColor}>
        {displayBar.slice(0, filledCount)}
      </Text>
      <Text color={theme.semantic.textMuted}>
        {displayBar.slice(filledCount)}
      </Text>
      {showPercent && (
        <Text color={theme.semantic.textSecondary}>
          {" "}{Math.round(progress * 100)}%
        </Text>
      )}
      {showValue && (
        <Text color={theme.semantic.textSecondary}>
          {" "}{Math.round(value)}/{max}
        </Text>
      )}
    </Box>
  );
}

/**
 * Step progress indicator
 */
export interface StepProgressProps {
  /** Current step (0-indexed) */
  currentStep: number;
  /** Step labels */
  steps: string[];
  /** Show step numbers */
  showNumbers?: boolean;
}

export function StepProgress({
  currentStep,
  steps,
  showNumbers = true,
}: StepProgressProps) {
  const theme = getEnhancedTheme();

  return (
    <Box flexDirection="row" alignItems="center">
      {steps.map((step, index) => {
        const isComplete = index < currentStep;
        const isCurrent = index === currentStep;
        const isUpcoming = index > currentStep;

        const color = isComplete
          ? theme.semantic.success
          : isCurrent
          ? theme.semantic.primary
          : theme.semantic.textMuted;

        const indicator = isComplete
          ? "✓"
          : showNumbers
          ? String(index + 1)
          : "○";

        return (
          <React.Fragment key={index}>
            <Box>
              <Text color={color} bold={isCurrent}>
                ({indicator})
              </Text>
              <Text
                color={color}
                bold={isCurrent}
                dimColor={isUpcoming}
              >
                {" "}{step}
              </Text>
            </Box>
            {index < steps.length - 1 && (
              <Text color={theme.semantic.textMuted}> → </Text>
            )}
          </React.Fragment>
        );
      })}
    </Box>
  );
}

/**
 * Circular progress (percentage in circle-like display)
 */
export interface CircularProgressProps {
  value: number;
  max?: number;
  label?: string;
  size?: "sm" | "md" | "lg";
}

export function CircularProgress({
  value,
  max = 100,
  label,
  size = "md",
}: CircularProgressProps) {
  const theme = getEnhancedTheme();
  const progress = Math.min(1, Math.max(0, value / max));
  const percent = Math.round(progress * 100);

  // Use different characters based on progress
  const getCircle = () => {
    if (percent === 0) return "○";
    if (percent < 25) return "◔";
    if (percent < 50) return "◑";
    if (percent < 75) return "◕";
    if (percent < 100) return "◕";
    return "●";
  };

  const circleColor = progress >= 1
    ? theme.semantic.success
    : theme.semantic.info;

  return (
    <Box flexDirection="column" alignItems="center">
      <Text color={circleColor}>
        {size === "lg" ? getCircle() + " " : ""}
        {percent}%
        {size === "lg" ? " " + getCircle() : ""}
      </Text>
      {label && (
        <Text color={theme.semantic.textMuted} dimColor>
          {label}
        </Text>
      )}
    </Box>
  );
}

/**
 * Upload/download progress with speed and ETA
 */
export interface TransferProgressProps {
  /** Bytes transferred */
  transferred: number;
  /** Total bytes */
  total: number;
  /** Bytes per second */
  speed?: number;
  /** Transfer label */
  label?: string;
  /** Show ETA */
  showEta?: boolean;
}

export function TransferProgress({
  transferred,
  total,
  speed,
  label,
  showEta = true,
}: TransferProgressProps) {
  const theme = getEnhancedTheme();
  const progress = total > 0 ? transferred / total : 0;

  // Format bytes
  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  // Calculate ETA
  const eta = speed && speed > 0
    ? Math.ceil((total - transferred) / speed)
    : undefined;

  const formatEta = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  return (
    <Box flexDirection="column">
      {label && (
        <Text color={theme.semantic.textPrimary}>{label}</Text>
      )}
      <ProgressBar value={transferred} max={total} width={30} />
      <Box>
        <Text color={theme.semantic.textMuted}>
          {formatBytes(transferred)} / {formatBytes(total)}
        </Text>
        {speed !== undefined && (
          <Text color={theme.semantic.textMuted}>
            {" "}• {formatBytes(speed)}/s
          </Text>
        )}
        {showEta && eta !== undefined && (
          <Text color={theme.semantic.textMuted}>
            {" "}• ETA: {formatEta(eta)}
          </Text>
        )}
      </Box>
    </Box>
  );
}
