/**
 * KeyValue Component
 *
 * Label-value pairs for displaying data in a structured format.
 */

import React from "react";
import { Box, Text } from "ink";
import { getEnhancedTheme } from "../../design/theme.js";

export interface KeyValueProps {
  /** Label text */
  label: string;
  /** Value to display */
  value: React.ReactNode;
  /** Label width (for alignment) */
  labelWidth?: number;
  /** Whether to dim the label */
  muted?: boolean;
  /** Bold the value */
  bold?: boolean;
  /** Value color */
  color?: string;
  /** Separator between label and value */
  separator?: string;
  /** Align value to right */
  rightAlign?: boolean;
}

export function KeyValue({
  label,
  value,
  labelWidth,
  muted = false,
  bold = false,
  color,
  separator = ":",
  rightAlign = false,
}: KeyValueProps) {
  const theme = getEnhancedTheme();

  const labelColor = muted ? theme.semantic.textMuted : theme.semantic.textSecondary;
  const valueColor = color || theme.semantic.textPrimary;

  return (
    <Box width="100%" justifyContent={rightAlign ? "space-between" : "flex-start"}>
      <Box width={labelWidth}>
        <Text color={labelColor}>
          {label}{separator && `${separator} `}
        </Text>
      </Box>
      <Text color={valueColor} bold={bold}>
        {value}
      </Text>
    </Box>
  );
}

/**
 * Group of key-value pairs with consistent label width
 */
export interface KeyValueGroupProps {
  items: Array<{
    label: string;
    value: React.ReactNode;
    muted?: boolean;
    bold?: boolean;
    color?: string;
  }>;
  /** Auto-calculate label width based on longest label */
  autoWidth?: boolean;
  /** Fixed label width */
  labelWidth?: number;
  /** Spacing between rows */
  spacing?: number;
  /** Title for the group */
  title?: string;
}

export function KeyValueGroup({
  items,
  autoWidth = true,
  labelWidth,
  spacing = 0,
  title,
}: KeyValueGroupProps) {
  const theme = getEnhancedTheme();

  // Calculate max label width
  const calculatedWidth = autoWidth && !labelWidth
    ? Math.max(...items.map((item) => item.label.length)) + 2
    : labelWidth;

  return (
    <Box flexDirection="column">
      {title && (
        <>
          <Text bold color={theme.semantic.textSecondary}>
            {title}
          </Text>
          <Box height={1} />
        </>
      )}
      {items.map((item, index) => (
        <Box key={item.label} marginBottom={spacing}>
          <KeyValue
            label={item.label}
            value={item.value}
            labelWidth={calculatedWidth}
            muted={item.muted}
            bold={item.bold}
            color={item.color}
          />
        </Box>
      ))}
    </Box>
  );
}

/**
 * Financial key-value pair (amount aligned right)
 */
export interface FinancialRowProps {
  label: string;
  amount: number;
  currency?: string;
  /** Show as negative expense */
  isExpense?: boolean;
  /** Bold/highlighted row */
  highlight?: boolean;
  /** Subtotal/total styling */
  variant?: "normal" | "subtotal" | "total";
}

export function FinancialRow({
  label,
  amount,
  currency = "$",
  isExpense = false,
  highlight = false,
  variant = "normal",
}: FinancialRowProps) {
  const theme = getEnhancedTheme();

  const isNegative = amount < 0 || isExpense;
  const displayAmount = Math.abs(amount);

  const amountColor = isNegative
    ? theme.semantic.expense
    : amount > 0
    ? theme.semantic.income
    : theme.semantic.textPrimary;

  const labelColor = variant === "total"
    ? theme.semantic.textPrimary
    : variant === "subtotal"
    ? theme.semantic.textSecondary
    : theme.semantic.textMuted;

  return (
    <Box width="100%" justifyContent="space-between">
      <Text
        color={labelColor}
        bold={variant === "total" || highlight}
        dimColor={variant === "normal" && !highlight}
      >
        {variant === "total" ? label.toUpperCase() : label}
      </Text>
      <Text
        color={amountColor}
        bold={variant === "total" || highlight}
      >
        {isNegative ? "-" : ""}
        {currency}
        {displayAmount.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </Text>
    </Box>
  );
}

/**
 * Definition list style display
 */
export interface DefinitionListProps {
  definitions: Array<{
    term: string;
    definition: React.ReactNode;
  }>;
}

export function DefinitionList({ definitions }: DefinitionListProps) {
  const theme = getEnhancedTheme();

  return (
    <Box flexDirection="column">
      {definitions.map(({ term, definition }) => (
        <Box key={term} flexDirection="column" marginBottom={1}>
          <Text bold color={theme.semantic.textSecondary}>
            {term}
          </Text>
          <Box paddingLeft={2}>
            <Text color={theme.semantic.textPrimary}>{definition}</Text>
          </Box>
        </Box>
      ))}
    </Box>
  );
}
