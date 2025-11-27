/**
 * Stack Component
 *
 * Vertical or horizontal stacking of children with consistent spacing.
 * Supports dividers between items.
 */

import React from "react";
import { Box, Text } from "ink";
import { getEnhancedTheme } from "../../design/theme.js";
import { spacing as spacingTokens, type Spacing, indicators } from "../../design/tokens.js";

export interface StackProps {
  /** Stack direction */
  direction?: "vertical" | "horizontal";
  /** Spacing between items (uses spacing tokens) */
  spacing?: Spacing;
  /** Show dividers between items */
  dividers?: boolean;
  /** Divider style */
  dividerStyle?: "line" | "dot" | "space";
  /** Alignment along cross axis */
  align?: "start" | "center" | "end" | "stretch";
  /** Alignment along main axis */
  justify?: "start" | "center" | "end" | "space-between" | "space-around";
  /** Wrap items */
  wrap?: boolean;
  /** Gap override (number of chars) */
  gap?: number;
  /** Width */
  width?: number | string;
  /** Height */
  height?: number | string;
  /** Flex grow */
  flexGrow?: number;
  /** Children */
  children?: React.ReactNode;
}

export function Stack({
  direction = "vertical",
  spacing = "sm",
  dividers = false,
  dividerStyle = "line",
  align = "stretch",
  justify = "start",
  wrap = false,
  gap,
  width,
  height,
  flexGrow,
  children,
}: StackProps) {
  const theme = getEnhancedTheme();
  const isVertical = direction === "vertical";

  // Convert alignment props to Ink's flexbox values
  const alignItems = {
    start: "flex-start",
    center: "center",
    end: "flex-end",
    stretch: "stretch",
  }[align] as "flex-start" | "center" | "flex-end" | "stretch";

  const justifyContent = {
    start: "flex-start",
    center: "center",
    end: "flex-end",
    "space-between": "space-between",
    "space-around": "space-around",
  }[justify] as
    | "flex-start"
    | "center"
    | "flex-end"
    | "space-between"
    | "space-around";

  // Calculate gap
  const gapValue = gap !== undefined ? gap : spacingTokens[spacing];

  // Filter out null/undefined children
  const validChildren = React.Children.toArray(children).filter(Boolean);

  // Render divider based on style
  const renderDivider = (key: string) => {
    if (!dividers) return null;

    if (dividerStyle === "space") {
      return isVertical ? (
        <Box key={key} height={gapValue} />
      ) : (
        <Box key={key} width={gapValue} />
      );
    }

    const dividerChar =
      dividerStyle === "dot" ? indicators.bullet : indicators.dividerH;

    if (isVertical) {
      return (
        <Box key={key} width="100%" paddingY={gapValue > 0 ? 1 : 0}>
          <Text color={theme.semantic.border} dimColor>
            {dividerChar.repeat(20)}
          </Text>
        </Box>
      );
    }

    return (
      <Box key={key} paddingX={gapValue > 0 ? 1 : 0}>
        <Text color={theme.semantic.border} dimColor>
          {indicators.dividerV}
        </Text>
      </Box>
    );
  };

  // Add spacing/dividers between children
  const spacedChildren = validChildren.flatMap((child, index) => {
    const isLast = index === validChildren.length - 1;

    if (isLast) {
      return [child];
    }

    if (dividers) {
      return [child, renderDivider(`divider-${index}`)];
    }

    // Add gap spacer
    if (gapValue > 0) {
      const spacer = isVertical ? (
        <Box key={`spacer-${index}`} height={gapValue} />
      ) : (
        <Box key={`spacer-${index}`} width={gapValue} />
      );
      return [child, spacer];
    }

    return [child];
  });

  return (
    <Box
      flexDirection={isVertical ? "column" : "row"}
      alignItems={alignItems}
      justifyContent={justifyContent}
      flexWrap={wrap ? "wrap" : "nowrap"}
      width={width}
      height={height}
      flexGrow={flexGrow}
    >
      {spacedChildren}
    </Box>
  );
}

/**
 * Horizontal stack shorthand
 */
export function HStack(props: Omit<StackProps, "direction">) {
  return <Stack {...props} direction="horizontal" />;
}

/**
 * Vertical stack shorthand
 */
export function VStack(props: Omit<StackProps, "direction">) {
  return <Stack {...props} direction="vertical" />;
}

/**
 * Spacer that fills available space
 */
export function Spacer() {
  return <Box flexGrow={1} />;
}

/**
 * Fixed-size gap
 */
export interface GapProps {
  size?: Spacing | number;
}

export function Gap({ size = "md" }: GapProps) {
  const gapValue = typeof size === "number" ? size : spacingTokens[size];
  return <Box width={gapValue} height={gapValue} />;
}
