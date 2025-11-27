/**
 * Panel Component
 *
 * A consistent container with border, optional title, footer,
 * and focus states. The primary building block for layouts.
 */

import React from "react";
import { Box, Text, DOMElement } from "ink";
import { getEnhancedTheme } from "../../design/theme.js";
import { borderStyles, spacing, indicators } from "../../design/tokens.js";

export interface PanelProps {
  /** Panel title displayed in header */
  title?: string;
  /** Optional subtitle/secondary info */
  subtitle?: string;
  /** Footer text (typically keyboard hints) */
  footer?: string;
  /** Panel width (number or percentage string) */
  width?: number | string;
  /** Panel height */
  height?: number | string;
  /** Whether this panel is currently focused */
  focused?: boolean;
  /** Border style variant */
  variant?: "default" | "primary" | "success" | "warning" | "error" | "subtle";
  /** Disable border entirely */
  borderless?: boolean;
  /** Padding inside the panel */
  padding?: number;
  /** Padding X override */
  paddingX?: number;
  /** Padding Y override */
  paddingY?: number;
  /** Flex grow */
  flexGrow?: number;
  /** Flex shrink */
  flexShrink?: number;
  /** Children content */
  children?: React.ReactNode;
  /** Optional ref for measuring */
  ref?: React.Ref<DOMElement>;
}

export function Panel({
  title,
  subtitle,
  footer,
  width,
  height,
  focused = false,
  variant = "default",
  borderless = false,
  padding,
  paddingX = 1,
  paddingY = 0,
  flexGrow,
  flexShrink,
  children,
}: PanelProps) {
  const theme = getEnhancedTheme();

  // Determine border color based on variant and focus state
  const getBorderColor = () => {
    if (focused) {
      return theme.semantic.focusBorder;
    }

    const variantColors: Record<string, string> = {
      default: theme.panels.default,
      primary: theme.panels.primary,
      success: theme.panels.success,
      warning: theme.panels.warning,
      error: theme.panels.error,
      subtle: theme.semantic.border,
    };

    return variantColors[variant] || theme.panels.default;
  };

  // Determine title color based on variant
  const getTitleColor = () => {
    if (focused) {
      return theme.semantic.focusBorder;
    }

    const variantColors: Record<string, string> = {
      default: theme.semantic.textPrimary,
      primary: theme.panels.primary,
      success: theme.panels.success,
      warning: theme.panels.warning,
      error: theme.panels.error,
      subtle: theme.semantic.textSecondary,
    };

    return variantColors[variant] || theme.semantic.textPrimary;
  };

  const borderColor = getBorderColor();
  const titleColor = getTitleColor();

  // Apply padding
  const pX = padding !== undefined ? padding : paddingX;
  const pY = padding !== undefined ? padding : paddingY;

  return (
    <Box
      width={width}
      height={height}
      flexDirection="column"
      borderStyle={borderless ? undefined : borderStyles.panel}
      borderColor={borderColor}
      flexGrow={flexGrow}
      flexShrink={flexShrink}
    >
      {/* Header with title */}
      {(title || subtitle) && (
        <Box
          paddingX={pX}
          justifyContent="space-between"
          width="100%"
        >
          <Box>
            {focused && (
              <Text color={titleColor}>{indicators.pointer} </Text>
            )}
            {title && (
              <Text bold color={titleColor}>
                {title}
              </Text>
            )}
          </Box>
          {subtitle && (
            <Text color={theme.semantic.textMuted}>{subtitle}</Text>
          )}
        </Box>
      )}

      {/* Content area */}
      <Box
        flexDirection="column"
        flexGrow={1}
        paddingX={pX}
        paddingY={pY}
        overflow="hidden"
      >
        {children}
      </Box>

      {/* Footer with hints */}
      {footer && (
        <Box
          paddingX={pX}
          justifyContent="center"
          width="100%"
        >
          <Text color={theme.semantic.textMuted} dimColor>
            {footer}
          </Text>
        </Box>
      )}
    </Box>
  );
}

/**
 * Simple panel divider line
 */
export function PanelDivider() {
  const theme = getEnhancedTheme();

  return (
    <Box width="100%" height={1} justifyContent="center">
      <Text color={theme.semantic.border}>
        {indicators.dividerH.repeat(40)}
      </Text>
    </Box>
  );
}

/**
 * Panel section header
 */
export interface PanelSectionProps {
  title: string;
  children?: React.ReactNode;
}

export function PanelSection({ title, children }: PanelSectionProps) {
  const theme = getEnhancedTheme();

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text bold color={theme.semantic.textSecondary}>
        {title}
      </Text>
      <Box height={1} />
      {children}
    </Box>
  );
}
