/**
 * LoadingOverlay Component
 *
 * Full-screen or inline loading indicator with message.
 */

import React from "react";
import { Box, Text } from "ink";
import { getEnhancedTheme } from "../../design/theme.js";
import { borderStyles, spinnerPresets, type SpinnerPreset } from "../../design/tokens.js";
import { useSpinner, SPINNERS } from "../../animations.js";

export interface LoadingOverlayProps {
  /** Whether overlay is visible */
  visible: boolean;
  /** Loading message */
  message?: string;
  /** Spinner type preset */
  preset?: SpinnerPreset;
  /** Custom spinner type */
  spinnerType?: keyof typeof SPINNERS;
  /** Show in full-screen mode */
  fullScreen?: boolean;
  /** Width (for non-fullscreen) */
  width?: number;
  /** Height (for non-fullscreen) */
  height?: number;
  /** Show progress percentage */
  progress?: number;
  /** Detailed status message */
  detail?: string;
}

export function LoadingOverlay({
  visible,
  message,
  preset = "loading",
  spinnerType,
  fullScreen = false,
  width,
  height,
  progress,
  detail,
}: LoadingOverlayProps) {
  const theme = getEnhancedTheme();
  const presetConfig = spinnerPresets[preset];
  const spinner = useSpinner(spinnerType || presetConfig.type, 80);

  if (!visible) return null;

  const displayMessage = message || presetConfig.label;

  const content = (
    <Box
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      borderStyle={borderStyles.modal}
      borderColor={theme.semantic.info}
      paddingX={3}
      paddingY={1}
    >
      <Text color={theme.semantic.info}>{spinner}</Text>
      <Box height={1} />
      <Text color={theme.semantic.textPrimary}>{displayMessage}</Text>
      {progress !== undefined && (
        <Text color={theme.semantic.textMuted}>
          {Math.round(progress)}%
        </Text>
      )}
      {detail && (
        <Text color={theme.semantic.textMuted} dimColor>
          {detail}
        </Text>
      )}
    </Box>
  );

  if (fullScreen) {
    return (
      <Box
        width="100%"
        height="100%"
        alignItems="center"
        justifyContent="center"
      >
        {content}
      </Box>
    );
  }

  return (
    <Box
      width={width}
      height={height}
      alignItems="center"
      justifyContent="center"
    >
      {content}
    </Box>
  );
}

/**
 * Inline loading spinner (no overlay)
 */
export interface InlineLoaderProps {
  /** Loading message */
  message?: string;
  /** Spinner type */
  spinnerType?: keyof typeof SPINNERS;
  /** Size */
  size?: "sm" | "md";
}

export function InlineLoader({
  message,
  spinnerType = "dots",
  size = "md",
}: InlineLoaderProps) {
  const theme = getEnhancedTheme();
  const spinner = useSpinner(spinnerType, 80);

  return (
    <Box>
      <Text color={theme.semantic.info}>{spinner}</Text>
      {message && (
        <Text color={size === "sm" ? theme.semantic.textMuted : theme.semantic.textPrimary}>
          {" "}{message}
        </Text>
      )}
    </Box>
  );
}

/**
 * Skeleton placeholder for loading content
 */
export interface SkeletonProps {
  /** Width of skeleton */
  width?: number;
  /** Number of lines */
  lines?: number;
  /** Animation style */
  animated?: boolean;
}

export function Skeleton({
  width = 20,
  lines = 1,
  animated = true,
}: SkeletonProps) {
  const theme = getEnhancedTheme();
  const pulse = animated ? "░" : "▒";

  return (
    <Box flexDirection="column">
      {Array.from({ length: lines }).map((_, i) => (
        <Text key={i} color={theme.semantic.textMuted}>
          {pulse.repeat(i === lines - 1 ? Math.floor(width * 0.7) : width)}
        </Text>
      ))}
    </Box>
  );
}

/**
 * Loading state wrapper
 * Renders children when not loading, shows skeleton/spinner when loading
 */
export interface LoadingStateProps {
  loading: boolean;
  children: React.ReactNode;
  /** Type of loading indicator */
  type?: "spinner" | "skeleton";
  /** Loading message */
  message?: string;
  /** Skeleton configuration */
  skeletonConfig?: SkeletonProps;
}

export function LoadingState({
  loading,
  children,
  type = "spinner",
  message,
  skeletonConfig,
}: LoadingStateProps) {
  if (!loading) {
    return <>{children}</>;
  }

  if (type === "skeleton") {
    return <Skeleton {...skeletonConfig} />;
  }

  return <InlineLoader message={message} />;
}
