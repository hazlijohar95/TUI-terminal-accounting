/**
 * Badge Component
 *
 * Status badges and labels with consistent styling.
 */

import React from "react";
import { Box, Text } from "ink";
import { getEnhancedTheme, getBadgeColors } from "../../design/theme.js";
import type { BadgeVariant } from "../../design/tokens.js";

export interface BadgeProps {
  /** Badge variant (determines colors) */
  variant?: BadgeVariant | string;
  /** Badge text */
  children: React.ReactNode;
  /** Size variant */
  size?: "sm" | "md";
  /** Use outline style instead of filled */
  outline?: boolean;
  /** Custom background color */
  backgroundColor?: string;
  /** Custom text color */
  color?: string;
}

export function Badge({
  variant = "neutral",
  children,
  size = "md",
  outline = false,
  backgroundColor,
  color,
}: BadgeProps) {
  const theme = getEnhancedTheme();
  const badgeColors = getBadgeColors(variant);

  const bgColor = backgroundColor || (outline ? undefined : badgeColors.bg);
  const textColor = color || (outline ? badgeColors.bg : badgeColors.text);

  const padding = size === "sm" ? 0 : 1;

  if (outline) {
    return (
      <Text color={textColor}>
        [{children}]
      </Text>
    );
  }

  return (
    <Text backgroundColor={bgColor} color={textColor}>
      {" "}{children}{" "}
    </Text>
  );
}

/**
 * Predefined status badges
 */
export function StatusBadge({ status }: { status: string }) {
  const normalizedStatus = status.toLowerCase();

  // Map common status strings to variants
  const variantMap: Record<string, BadgeVariant> = {
    // Invoice status
    draft: "draft",
    sent: "sent",
    paid: "paid",
    partial: "partial",
    overdue: "overdue",
    cancelled: "cancelled",

    // e-Invoice status
    none: "neutral",
    pending: "pending",
    submitted: "info",
    valid: "success",
    invalid: "error",
    rejected: "error",

    // Generic status
    success: "success",
    error: "error",
    warning: "warning",
    info: "info",
    active: "success",
    inactive: "neutral",
  };

  const variant = variantMap[normalizedStatus] || "neutral";

  return <Badge variant={variant}>{status.toUpperCase()}</Badge>;
}

/**
 * E-Invoice status badge with more context
 */
export function EInvoiceBadge({ status }: { status: string }) {
  const theme = getEnhancedTheme();

  const statusConfig: Record<string, { label: string; variant: BadgeVariant }> = {
    none: { label: "Not Submitted", variant: "neutral" },
    pending: { label: "Pending", variant: "pending" },
    submitted: { label: "Submitted", variant: "info" },
    valid: { label: "Valid", variant: "success" },
    invalid: { label: "Invalid", variant: "error" },
    cancelled: { label: "Cancelled", variant: "cancelled" },
    rejected: { label: "Rejected", variant: "error" },
  };

  const config = statusConfig[status.toLowerCase()] || statusConfig.none;

  return <Badge variant={config.variant}>{config.label}</Badge>;
}

/**
 * Count badge (for notifications, etc.)
 */
export interface CountBadgeProps {
  count: number;
  variant?: BadgeVariant;
  max?: number;
}

export function CountBadge({ count, variant = "info", max = 99 }: CountBadgeProps) {
  const displayCount = count > max ? `${max}+` : String(count);

  return <Badge variant={variant} size="sm">{displayCount}</Badge>;
}

/**
 * Tag component (similar to badge but for categories/labels)
 */
export interface TagProps {
  children: React.ReactNode;
  color?: string;
  onRemove?: () => void;
}

export function Tag({ children, color, onRemove }: TagProps) {
  const theme = getEnhancedTheme();
  const tagColor = color || theme.semantic.textSecondary;

  return (
    <Text color={tagColor}>
      [{children}]
      {onRemove && <Text> ×</Text>}
    </Text>
  );
}

/**
 * Inline pill for compact status display
 */
export interface PillProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "error" | "info";
}

export function Pill({ children, variant = "default" }: PillProps) {
  const theme = getEnhancedTheme();

  const colors: Record<string, string> = {
    default: theme.semantic.textSecondary,
    success: theme.semantic.success,
    warning: theme.semantic.warning,
    error: theme.semantic.error,
    info: theme.semantic.info,
  };

  return (
    <Text color={colors[variant]}>({children})</Text>
  );
}
