/**
 * StatusBar Component
 *
 * Clean, minimal status bar for navigation and status display.
 */

import React from "react";
import { Box, Text } from "ink";
import type { View } from "../App.js";
import { getEnhancedTheme } from "../design/theme.js";
import { indicators } from "../design/tokens.js";

interface StatusBarProps {
  businessName: string;
  currentView: View;
  width: number;
  isConnected?: boolean;
  isLoading?: boolean;
  memoryEnabled?: boolean;
}

export function StatusBar({
  businessName,
  currentView,
  width,
  isConnected = true,
  isLoading = false,
  memoryEnabled = false,
}: StatusBarProps) {
  const theme = getEnhancedTheme();

  // Clean, minimal view labels
  const viewLabels: Record<View, string> = {
    dashboard: "Dashboard",
    chat: "Chat",
    invoices: "Invoices",
    customers: "Customers",
    reports: "Reports",
    lhdn: "LHDN e-Invoice",
    help: "Help",
  };

  // Shorter keyboard hints
  const shortcuts = "d · c · i · r · l · ? · q";
  const viewLabel = viewLabels[currentView];

  return (
    <Box width={width} height={1} justifyContent="space-between" paddingX={2}>
      {/* Left: business name and current view */}
      <Box>
        <Text color={theme.semantic.textPrimary} bold>{businessName}</Text>
        <Text color={theme.semantic.textMuted}> / </Text>
        <Text color={theme.semantic.info}>{viewLabel}</Text>
      </Box>

      {/* Right: status indicators and shortcuts */}
      <Box>
        {/* Connection indicator */}
        <Text color={isConnected ? theme.semantic.success : theme.semantic.error} dimColor>●</Text>

        {/* Memory indicator */}
        {memoryEnabled && (
          <Text color={theme.semantic.textMuted} dimColor> M</Text>
        )}

        {/* Loading indicator */}
        {isLoading && (
          <Text color={theme.semantic.warning}> {indicators.loading}</Text>
        )}

        {/* Keyboard shortcuts */}
        <Text color={theme.semantic.textMuted} dimColor> {shortcuts}</Text>
      </Box>
    </Box>
  );
}

/**
 * ChatStatusBar - Specialized status bar for chat view
 */
interface ChatStatusBarProps {
  hints?: string;
  lastResponseTime?: number;
  isLoading?: boolean;
}

export function ChatStatusBar({ hints, lastResponseTime, isLoading }: ChatStatusBarProps) {
  const theme = getEnhancedTheme();
  const defaultHints = "↩ send · ↑↓ scroll · e expand · 1-3 suggest · ? help";

  return (
    <Box paddingX={2} justifyContent="space-between">
      <Text color={theme.semantic.textMuted} dimColor>
        {hints || defaultHints}
      </Text>
      {lastResponseTime && !isLoading && (
        <Text color={theme.semantic.textMuted} dimColor>
          {(lastResponseTime / 1000).toFixed(1)}s
        </Text>
      )}
    </Box>
  );
}

/**
 * MiniStatusBar - Ultra-compact single-line status
 */
export function MiniStatusBar({ isConnected = true, isLoading = false }: { isConnected?: boolean; isLoading?: boolean }) {
  const theme = getEnhancedTheme();

  return (
    <Box>
      <Text color={isConnected ? theme.semantic.success : theme.semantic.error} dimColor>●</Text>
      {isLoading && <Text color={theme.semantic.warning}> {indicators.loading}</Text>}
    </Box>
  );
}
