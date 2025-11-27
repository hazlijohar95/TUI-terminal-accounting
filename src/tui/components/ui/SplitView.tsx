/**
 * SplitView Component
 *
 * Two-panel layout with adjustable ratio.
 * Commonly used for list/detail views.
 */

import React from "react";
import { Box } from "ink";
import { spacing as spacingTokens, type Spacing } from "../../design/tokens.js";

export interface SplitViewProps {
  /** Ratio of first panel (0-1), e.g., 0.35 means 35% for left panel */
  ratio?: number;
  /** Gap between panels */
  gap?: Spacing | number;
  /** Total width available */
  width?: number;
  /** Total height available */
  height?: number | string;
  /** Direction of split */
  direction?: "horizontal" | "vertical";
  /** Children - expects exactly 2 children */
  children: [React.ReactNode, React.ReactNode];
}

export function SplitView({
  ratio = 0.35,
  gap = "xs",
  width,
  height,
  direction = "horizontal",
  children,
}: SplitViewProps) {
  const gapValue = typeof gap === "number" ? gap : spacingTokens[gap];
  const isHorizontal = direction === "horizontal";

  // Ensure we have exactly 2 children
  const [first, second] = children;

  if (isHorizontal) {
    // Calculate widths if total width is provided
    const firstWidth = width ? Math.floor((width - gapValue) * ratio) : undefined;
    const secondWidth = width ? width - gapValue - (firstWidth || 0) : undefined;

    return (
      <Box
        flexDirection="row"
        width={width}
        height={height}
      >
        <Box width={firstWidth} flexGrow={firstWidth ? undefined : ratio} height="100%">
          {first}
        </Box>
        {gapValue > 0 && <Box width={gapValue} />}
        <Box width={secondWidth} flexGrow={secondWidth ? undefined : 1 - ratio} height="100%">
          {second}
        </Box>
      </Box>
    );
  }

  // Vertical split
  const firstHeight = typeof height === "number" ? Math.floor((height - gapValue) * ratio) : undefined;
  const secondHeight = typeof height === "number" && firstHeight ? height - gapValue - firstHeight : undefined;

  return (
    <Box
      flexDirection="column"
      width={width}
      height={height}
    >
      <Box height={firstHeight} flexGrow={firstHeight ? undefined : ratio} width="100%">
        {first}
      </Box>
      {gapValue > 0 && <Box height={gapValue} />}
      <Box height={secondHeight} flexGrow={secondHeight ? undefined : 1 - ratio} width="100%">
        {second}
      </Box>
    </Box>
  );
}

/**
 * Three-panel layout (sidebar + main + detail)
 */
export interface ThreePanelLayoutProps {
  /** Width of left sidebar */
  sidebarWidth?: number | string;
  /** Width of right detail panel */
  detailWidth?: number | string;
  /** Gap between panels */
  gap?: Spacing | number;
  /** Total width */
  width?: number;
  /** Total height */
  height?: number | string;
  /** Children - expects exactly 3 children [sidebar, main, detail] */
  children: [React.ReactNode, React.ReactNode, React.ReactNode];
}

export function ThreePanelLayout({
  sidebarWidth = 20,
  detailWidth = 30,
  gap = "xs",
  width,
  height,
  children,
}: ThreePanelLayoutProps) {
  const gapValue = typeof gap === "number" ? gap : spacingTokens[gap];
  const [sidebar, main, detail] = children;

  return (
    <Box
      flexDirection="row"
      width={width}
      height={height}
    >
      <Box width={sidebarWidth} height="100%">
        {sidebar}
      </Box>
      {gapValue > 0 && <Box width={gapValue} />}
      <Box flexGrow={1} height="100%">
        {main}
      </Box>
      {gapValue > 0 && <Box width={gapValue} />}
      <Box width={detailWidth} height="100%">
        {detail}
      </Box>
    </Box>
  );
}

/**
 * Responsive split that can switch between stacked and side-by-side
 */
export interface ResponsiveSplitProps {
  /** Breakpoint width to switch to stacked */
  breakpoint?: number;
  /** Current container width */
  containerWidth: number;
  /** Props to pass through */
  ratio?: number;
  gap?: Spacing | number;
  height?: number | string;
  children: [React.ReactNode, React.ReactNode];
}

export function ResponsiveSplit({
  breakpoint = 60,
  containerWidth,
  ratio = 0.35,
  gap = "xs",
  height,
  children,
}: ResponsiveSplitProps) {
  const isStacked = containerWidth < breakpoint;

  return (
    <SplitView
      ratio={isStacked ? 0.5 : ratio}
      gap={gap}
      width={containerWidth}
      height={height}
      direction={isStacked ? "vertical" : "horizontal"}
    >
      {children}
    </SplitView>
  );
}
