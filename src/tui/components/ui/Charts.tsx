/**
 * Charts - ASCII Visual Data Components
 *
 * Sparklines, bar charts, progress bars, and mini-charts
 * for rich data visualization in the terminal.
 */

import React from "react";
import { Box, Text } from "ink";
import { getEnhancedTheme } from "../../design/theme.js";

// ============================================================================
// Sparkline - Mini line chart using Unicode blocks
// ============================================================================

const SPARK_CHARS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

export interface SparklineProps {
  data: number[];
  width?: number;
  color?: string;
  showTrend?: boolean;
}

export function Sparkline({ data, width = 12, color, showTrend = true }: SparklineProps) {
  const theme = getEnhancedTheme();
  const displayColor = color || theme.semantic.primary;

  if (data.length === 0) {
    return <Text color={theme.semantic.textMuted}>{"─".repeat(width)}</Text>;
  }

  // Normalize data to fit width
  const normalized = normalizeToWidth(data, width);
  const min = Math.min(...normalized);
  const max = Math.max(...normalized);
  const range = max - min || 1;

  const sparkline = normalized.map((val) => {
    const index = Math.floor(((val - min) / range) * (SPARK_CHARS.length - 1));
    return SPARK_CHARS[Math.max(0, Math.min(SPARK_CHARS.length - 1, index))];
  }).join("");

  // Calculate trend
  const trend = data.length >= 2 ? data[data.length - 1] - data[0] : 0;
  const trendColor = trend > 0 ? theme.semantic.income : trend < 0 ? theme.semantic.expense : theme.semantic.textMuted;
  const trendIcon = trend > 0 ? "↑" : trend < 0 ? "↓" : "→";

  return (
    <Box>
      <Text color={displayColor}>{sparkline}</Text>
      {showTrend && (
        <Text color={trendColor}> {trendIcon}</Text>
      )}
    </Box>
  );
}

function normalizeToWidth(data: number[], width: number): number[] {
  if (data.length === width) return data;
  if (data.length < width) {
    // Pad with zeros at the beginning
    return [...Array(width - data.length).fill(data[0] || 0), ...data];
  }
  // Sample to fit
  const result: number[] = [];
  const step = data.length / width;
  for (let i = 0; i < width; i++) {
    const idx = Math.floor(i * step);
    result.push(data[idx]);
  }
  return result;
}

// ============================================================================
// Progress Bar - Horizontal bar with percentage
// ============================================================================

export interface ProgressBarProps {
  value: number;
  max: number;
  width?: number;
  showPercent?: boolean;
  showValue?: boolean;
  color?: string;
  backgroundColor?: string;
  label?: string;
  variant?: "default" | "gradient" | "segmented";
}

export function ProgressBar({
  value,
  max,
  width = 20,
  showPercent = true,
  showValue = false,
  color,
  backgroundColor,
  label,
  variant = "default",
}: ProgressBarProps) {
  const theme = getEnhancedTheme();
  const percent = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const filledWidth = Math.round((percent / 100) * width);
  const emptyWidth = width - filledWidth;

  // Color based on percentage for gradient variant
  const getGradientColor = () => {
    if (percent >= 80) return theme.semantic.error;
    if (percent >= 60) return theme.semantic.warning;
    return theme.semantic.success;
  };

  const fillColor = variant === "gradient" ? getGradientColor() : (color || theme.semantic.primary);
  const bgColor = backgroundColor || theme.semantic.border;

  const filled = variant === "segmented"
    ? "█".repeat(filledWidth)
    : "━".repeat(filledWidth);
  const empty = variant === "segmented"
    ? "░".repeat(emptyWidth)
    : "─".repeat(emptyWidth);

  return (
    <Box>
      {label && (
        <Text color={theme.semantic.textMuted}>{label} </Text>
      )}
      <Text color={fillColor}>{filled}</Text>
      <Text color={bgColor}>{empty}</Text>
      {showPercent && (
        <Text color={theme.semantic.textMuted}> {percent.toFixed(0)}%</Text>
      )}
      {showValue && (
        <Text color={theme.semantic.textSecondary}> {value.toLocaleString()}/{max.toLocaleString()}</Text>
      )}
    </Box>
  );
}

// ============================================================================
// Horizontal Bar Chart - Compare values side by side
// ============================================================================

export interface BarChartItem {
  label: string;
  value: number;
  color?: string;
}

export interface HorizontalBarChartProps {
  items: BarChartItem[];
  width?: number;
  showValues?: boolean;
  labelWidth?: number;
}

export function HorizontalBarChart({
  items,
  width = 30,
  showValues = true,
  labelWidth = 12,
}: HorizontalBarChartProps) {
  const theme = getEnhancedTheme();
  const maxValue = Math.max(...items.map((i) => i.value), 1);
  const barWidth = width - labelWidth - (showValues ? 10 : 0);
  const colors = [
    theme.semantic.primary,
    theme.semantic.success,
    theme.semantic.warning,
    theme.semantic.info,
    theme.semantic.error,
  ];

  return (
    <Box flexDirection="column">
      {items.map((item, idx) => {
        const filled = Math.round((item.value / maxValue) * barWidth);
        const color = item.color || colors[idx % colors.length];

        return (
          <Box key={item.label}>
            <Text color={theme.semantic.textMuted}>
              {item.label.slice(0, labelWidth - 1).padEnd(labelWidth)}
            </Text>
            <Text color={color}>{"█".repeat(filled)}</Text>
            <Text color={theme.semantic.border}>{"░".repeat(barWidth - filled)}</Text>
            {showValues && (
              <Text color={theme.semantic.textSecondary}>
                {" $" + item.value.toLocaleString()}
              </Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

// ============================================================================
// Mini Donut / Pie representation
// ============================================================================

export interface DonutSegment {
  label: string;
  value: number;
  color?: string;
}

export interface MiniDonutProps {
  segments: DonutSegment[];
  total?: number;
  size?: "sm" | "md" | "lg";
}

export function MiniDonut({ segments, total, size = "md" }: MiniDonutProps) {
  const theme = getEnhancedTheme();
  const totalValue = total || segments.reduce((sum, s) => sum + s.value, 0);
  const colors = [
    theme.semantic.primary,
    theme.semantic.success,
    theme.semantic.warning,
    theme.semantic.info,
    theme.semantic.error,
  ];

  // Simple representation with blocks
  const blockCount = size === "sm" ? 10 : size === "md" ? 20 : 30;
  let blocks = "";
  let currentPos = 0;

  segments.forEach((seg, idx) => {
    const segBlocks = Math.round((seg.value / totalValue) * blockCount);
    const color = seg.color || colors[idx % colors.length];
    blocks += `<${color}>` + "█".repeat(segBlocks);
    currentPos += segBlocks;
  });

  // Fill remaining
  if (currentPos < blockCount) {
    blocks += "░".repeat(blockCount - currentPos);
  }

  return (
    <Box flexDirection="column">
      <Box>
        {segments.map((seg, idx) => {
          const segBlocks = Math.round((seg.value / totalValue) * blockCount);
          const color = seg.color || colors[idx % colors.length];
          return <Text key={seg.label} color={color}>{"█".repeat(segBlocks)}</Text>;
        })}
        {currentPos < blockCount && (
          <Text color={theme.semantic.border}>{"░".repeat(blockCount - currentPos)}</Text>
        )}
      </Box>
      <Box marginTop={1}>
        {segments.slice(0, 4).map((seg, idx) => (
          <Box key={seg.label} marginRight={2}>
            <Text color={seg.color || colors[idx % colors.length]}>● </Text>
            <Text color={theme.semantic.textMuted}>{seg.label}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// ============================================================================
// Gauge - Circular-ish meter
// ============================================================================

export interface GaugeProps {
  value: number;
  max: number;
  label?: string;
  showValue?: boolean;
  size?: "sm" | "md";
  thresholds?: { warn: number; danger: number };
}

export function Gauge({
  value,
  max,
  label,
  showValue = true,
  size = "md",
  thresholds = { warn: 60, danger: 80 },
}: GaugeProps) {
  const theme = getEnhancedTheme();
  const percent = max > 0 ? Math.min(100, (value / max) * 100) : 0;

  const getColor = () => {
    if (percent >= thresholds.danger) return theme.semantic.error;
    if (percent >= thresholds.warn) return theme.semantic.warning;
    return theme.semantic.success;
  };

  const color = getColor();
  const width = size === "sm" ? 8 : 12;
  const filled = Math.round((percent / 100) * width);

  // ASCII gauge representation
  const gauge = size === "sm"
    ? `[${" ".repeat(filled)}${"░".repeat(width - filled)}]`
    : `╭${"─".repeat(width)}╮\n│${"█".repeat(filled)}${"░".repeat(width - filled)}│\n╰${"─".repeat(width)}╯`;

  if (size === "sm") {
    return (
      <Box>
        {label && <Text color={theme.semantic.textMuted}>{label} </Text>}
        <Text color={theme.semantic.border}>[</Text>
        <Text color={color}>{"█".repeat(filled)}</Text>
        <Text color={theme.semantic.border}>{"░".repeat(width - filled)}</Text>
        <Text color={theme.semantic.border}>]</Text>
        {showValue && <Text color={color}> {percent.toFixed(0)}%</Text>}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" alignItems="center">
      {label && <Text color={theme.semantic.textMuted}>{label}</Text>}
      <Text color={theme.semantic.border}>╭{"─".repeat(width)}╮</Text>
      <Box>
        <Text color={theme.semantic.border}>│</Text>
        <Text color={color}>{"█".repeat(filled)}</Text>
        <Text color={theme.semantic.border}>{"░".repeat(width - filled)}</Text>
        <Text color={theme.semantic.border}>│</Text>
      </Box>
      <Text color={theme.semantic.border}>╰{"─".repeat(width)}╯</Text>
      {showValue && (
        <Text bold color={color}>{percent.toFixed(0)}%</Text>
      )}
    </Box>
  );
}

// ============================================================================
// Trend Indicator - Shows change with arrow and color
// ============================================================================

export interface TrendIndicatorProps {
  current: number;
  previous: number;
  format?: "percent" | "absolute" | "currency";
  invertColors?: boolean;
  showIcon?: boolean;
}

export function TrendIndicator({
  current,
  previous,
  format = "percent",
  invertColors = false,
  showIcon = true,
}: TrendIndicatorProps) {
  const theme = getEnhancedTheme();
  const diff = current - previous;
  const percentChange = previous !== 0 ? (diff / previous) * 100 : 0;

  const isPositive = diff > 0;
  const isNeutral = diff === 0;

  // For expenses, down is good (inverted)
  const goodColor = invertColors ? theme.semantic.expense : theme.semantic.income;
  const badColor = invertColors ? theme.semantic.income : theme.semantic.expense;
  const color = isNeutral
    ? theme.semantic.textMuted
    : isPositive
      ? (invertColors ? badColor : goodColor)
      : (invertColors ? goodColor : badColor);

  const icon = isPositive ? "▲" : isNeutral ? "─" : "▼";

  let displayValue: string;
  switch (format) {
    case "currency":
      displayValue = `$${Math.abs(diff).toLocaleString()}`;
      break;
    case "absolute":
      displayValue = Math.abs(diff).toLocaleString();
      break;
    default:
      displayValue = `${Math.abs(percentChange).toFixed(1)}%`;
  }

  return (
    <Text color={color}>
      {showIcon && icon} {displayValue}
    </Text>
  );
}

// ============================================================================
// Financial Health Indicator
// ============================================================================

export interface HealthIndicatorProps {
  score: number; // 0-100
  label?: string;
}

export function HealthIndicator({ score, label }: HealthIndicatorProps) {
  const theme = getEnhancedTheme();

  const getConfig = () => {
    if (score >= 80) return { color: theme.semantic.success, label: "Excellent", icon: "●●●●●" };
    if (score >= 60) return { color: theme.semantic.income, label: "Good", icon: "●●●●○" };
    if (score >= 40) return { color: theme.semantic.warning, label: "Fair", icon: "●●●○○" };
    if (score >= 20) return { color: theme.semantic.error, label: "Poor", icon: "●●○○○" };
    return { color: theme.semantic.error, label: "Critical", icon: "●○○○○" };
  };

  const config = getConfig();

  return (
    <Box>
      {label && <Text color={theme.semantic.textMuted}>{label} </Text>}
      <Text color={config.color}>{config.icon}</Text>
      <Text color={config.color}> {config.label}</Text>
    </Box>
  );
}

// ============================================================================
// Calendar Heat Map (simplified)
// ============================================================================

export interface CalendarHeatProps {
  data: Record<string, number>; // date -> value
  weeks?: number;
}

export function CalendarHeat({ data, weeks = 4 }: CalendarHeatProps) {
  const theme = getEnhancedTheme();
  const intensityChars = ["░", "▒", "▓", "█"];

  // Generate last N weeks
  const today = new Date();
  const days: string[] = [];
  for (let i = weeks * 7 - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split("T")[0]);
  }

  const maxVal = Math.max(...Object.values(data), 1);

  // Group by week
  const weekRows: string[][] = [];
  for (let w = 0; w < weeks; w++) {
    const week = days.slice(w * 7, (w + 1) * 7);
    weekRows.push(week);
  }

  return (
    <Box flexDirection="column">
      {weekRows.map((week, wi) => (
        <Box key={wi}>
          {week.map((day) => {
            const val = data[day] || 0;
            const intensity = Math.floor((val / maxVal) * (intensityChars.length - 1));
            const char = val > 0 ? intensityChars[intensity] : "·";
            const color = val > 0 ? theme.semantic.success : theme.semantic.border;
            return <Text key={day} color={color}>{char}</Text>;
          })}
        </Box>
      ))}
    </Box>
  );
}

// ============================================================================
// Big Number Display
// ============================================================================

export interface BigNumberProps {
  value: number;
  label: string;
  prefix?: string;
  suffix?: string;
  trend?: { current: number; previous: number };
  color?: string;
}

export function BigNumber({ value, label, prefix = "$", suffix, trend, color }: BigNumberProps) {
  const theme = getEnhancedTheme();
  const displayColor = color || theme.semantic.textPrimary;

  const formatBigNumber = (n: number): string => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toLocaleString();
  };

  return (
    <Box flexDirection="column">
      <Text color={theme.semantic.textMuted}>{label}</Text>
      <Box>
        <Text bold color={displayColor}>
          {prefix}{formatBigNumber(value)}{suffix}
        </Text>
        {trend && (
          <Box marginLeft={1}>
            <TrendIndicator
              current={trend.current}
              previous={trend.previous}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
}
