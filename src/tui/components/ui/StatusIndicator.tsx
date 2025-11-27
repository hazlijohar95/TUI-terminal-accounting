/**
 * StatusIndicator Component
 *
 * Inline status display with icon and optional label.
 * Supports animated states for loading/pending.
 */

import React from "react";
import { Box, Text } from "ink";
import { getEnhancedTheme } from "../../design/theme.js";
import { indicators } from "../../design/tokens.js";
import { useSpinner } from "../../animations.js";

export type StatusType =
  | "success"
  | "error"
  | "warning"
  | "info"
  | "pending"
  | "loading"
  | "neutral";

export interface StatusIndicatorProps {
  /** Status type */
  status: StatusType;
  /** Optional label text */
  label?: string;
  /** Show animated indicator for pending/loading */
  animated?: boolean;
  /** Size variant */
  size?: "sm" | "md";
  /** Hide the icon */
  hideIcon?: boolean;
}

export function StatusIndicator({
  status,
  label,
  animated = false,
  size = "md",
  hideIcon = false,
}: StatusIndicatorProps) {
  const theme = getEnhancedTheme();
  const spinner = useSpinner("dots", 80);

  // Get icon and color for status
  const getStatusConfig = () => {
    switch (status) {
      case "success":
        return {
          icon: indicators.check,
          color: theme.semantic.success,
        };
      case "error":
        return {
          icon: indicators.cross,
          color: theme.semantic.error,
        };
      case "warning":
        return {
          icon: indicators.warning,
          color: theme.semantic.warning,
        };
      case "info":
        return {
          icon: indicators.info,
          color: theme.semantic.info,
        };
      case "pending":
        return {
          icon: animated ? spinner : indicators.pending,
          color: theme.semantic.pending,
        };
      case "loading":
        return {
          icon: animated ? spinner : indicators.loading,
          color: theme.semantic.info,
        };
      case "neutral":
      default:
        return {
          icon: indicators.bullet,
          color: theme.semantic.textSecondary,
        };
    }
  };

  const config = getStatusConfig();

  return (
    <Box>
      {!hideIcon && (
        <Text color={config.color}>
          {config.icon}
          {label && " "}
        </Text>
      )}
      {label && (
        <Text color={size === "sm" ? theme.semantic.textMuted : config.color}>
          {label}
        </Text>
      )}
    </Box>
  );
}

/**
 * Compact loading indicator with optional message
 */
export interface LoadingIndicatorProps {
  /** Loading message */
  message?: string;
  /** Spinner type */
  spinnerType?: "dots" | "circle" | "bounce" | "pulse";
}

export function LoadingIndicator({
  message,
  spinnerType = "dots",
}: LoadingIndicatorProps) {
  const theme = getEnhancedTheme();
  const spinner = useSpinner(spinnerType, 80);

  return (
    <Box>
      <Text color={theme.semantic.info}>{spinner}</Text>
      {message && (
        <Text color={theme.semantic.textMuted}> {message}</Text>
      )}
    </Box>
  );
}

/**
 * Connection/online status indicator
 */
export interface ConnectionStatusProps {
  connected: boolean;
  label?: boolean;
}

export function ConnectionStatus({ connected, label = true }: ConnectionStatusProps) {
  return (
    <StatusIndicator
      status={connected ? "success" : "error"}
      label={label ? (connected ? "Connected" : "Disconnected") : undefined}
    />
  );
}

/**
 * Sync status indicator
 */
export interface SyncStatusProps {
  status: "synced" | "syncing" | "error" | "offline";
}

export function SyncStatus({ status }: SyncStatusProps) {
  const statusMap: Record<string, { type: StatusType; label: string; animated: boolean }> = {
    synced: { type: "success", label: "Synced", animated: false },
    syncing: { type: "loading", label: "Syncing...", animated: true },
    error: { type: "error", label: "Sync Error", animated: false },
    offline: { type: "neutral", label: "Offline", animated: false },
  };

  const config = statusMap[status];

  return (
    <StatusIndicator
      status={config.type}
      label={config.label}
      animated={config.animated}
    />
  );
}

/**
 * Validation status for form fields
 */
export interface ValidationStatusProps {
  valid?: boolean;
  error?: string;
  checking?: boolean;
}

export function ValidationStatus({ valid, error, checking }: ValidationStatusProps) {
  if (checking) {
    return <StatusIndicator status="loading" label="Validating..." animated />;
  }

  if (error) {
    return <StatusIndicator status="error" label={error} />;
  }

  if (valid) {
    return <StatusIndicator status="success" />;
  }

  return null;
}
