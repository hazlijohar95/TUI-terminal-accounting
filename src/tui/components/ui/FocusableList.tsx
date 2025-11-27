/**
 * FocusableList Component
 *
 * A list with keyboard navigation, focus ring, and customizable rendering.
 * Handles j/k and arrow key navigation with visual selection feedback.
 */

import React, { useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { getEnhancedTheme } from "../../design/theme.js";
import { indicators } from "../../design/tokens.js";

export interface FocusableListProps<T> {
  /** List items */
  items: T[];
  /** Currently selected index */
  selectedIndex: number;
  /** Called when selection changes */
  onSelect: (index: number) => void;
  /** Called when Enter is pressed on selected item */
  onActivate?: (item: T, index: number) => void;
  /** Custom render function for each item */
  renderItem: (item: T, isSelected: boolean, index: number) => React.ReactNode;
  /** Whether this list is focused (receives keyboard input) */
  focused?: boolean;
  /** Maximum visible items (for scrolling) */
  maxVisible?: number;
  /** Empty state component */
  emptyState?: React.ReactNode;
  /** Height of each item (for scroll calculations) */
  itemHeight?: number;
  /** Width of the list */
  width?: number | string;
  /** Height of the list */
  height?: number | string;
  /** Key extractor for React keys */
  keyExtractor?: (item: T, index: number) => string;
  /** Show selection indicator */
  showIndicator?: boolean;
  /** Selection indicator character */
  indicator?: string;
  /** Wrap around when reaching start/end */
  wrap?: boolean;
}

export function FocusableList<T>({
  items,
  selectedIndex,
  onSelect,
  onActivate,
  renderItem,
  focused = true,
  maxVisible,
  emptyState,
  itemHeight = 1,
  width,
  height,
  keyExtractor,
  showIndicator = true,
  indicator = indicators.pointer,
  wrap = false,
}: FocusableListProps<T>) {
  const theme = getEnhancedTheme();

  // Calculate scroll offset
  const visibleCount = maxVisible || items.length;
  const scrollOffset = Math.max(
    0,
    Math.min(
      selectedIndex - Math.floor(visibleCount / 2),
      items.length - visibleCount
    )
  );

  // Visible items
  const visibleItems = maxVisible
    ? items.slice(scrollOffset, scrollOffset + visibleCount)
    : items;

  // Handle keyboard navigation
  useInput(
    (input, key) => {
      if (!focused) return;

      const moveUp = () => {
        if (selectedIndex > 0) {
          onSelect(selectedIndex - 1);
        } else if (wrap && items.length > 0) {
          onSelect(items.length - 1);
        }
      };

      const moveDown = () => {
        if (selectedIndex < items.length - 1) {
          onSelect(selectedIndex + 1);
        } else if (wrap && items.length > 0) {
          onSelect(0);
        }
      };

      // Navigation
      if (key.upArrow || input === "k") {
        moveUp();
      }
      if (key.downArrow || input === "j") {
        moveDown();
      }

      // Page up/down
      if (key.pageUp) {
        onSelect(Math.max(0, selectedIndex - visibleCount));
      }
      if (key.pageDown) {
        onSelect(Math.min(items.length - 1, selectedIndex + visibleCount));
      }

      // Home/End
      if (input === "g" && key.shift) {
        onSelect(items.length - 1); // G = go to end
      }
      if (input === "g" && !key.shift) {
        onSelect(0); // g = go to start
      }

      // Activate
      if (key.return && onActivate && items[selectedIndex]) {
        onActivate(items[selectedIndex], selectedIndex);
      }
    },
    { isActive: focused }
  );

  // Empty state
  if (items.length === 0) {
    if (emptyState) {
      return <Box width={width} height={height}>{emptyState}</Box>;
    }
    return (
      <Box width={width} height={height} justifyContent="center" alignItems="center">
        <Text color={theme.semantic.textMuted}>No items</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width={width} height={height}>
      {/* Scroll indicator (top) */}
      {maxVisible && scrollOffset > 0 && (
        <Box justifyContent="center" width="100%">
          <Text color={theme.semantic.textMuted}>{indicators.arrowUp} more</Text>
        </Box>
      )}

      {/* List items */}
      {visibleItems.map((item, visibleIndex) => {
        const actualIndex = maxVisible ? scrollOffset + visibleIndex : visibleIndex;
        const isSelected = actualIndex === selectedIndex;
        const key = keyExtractor
          ? keyExtractor(item, actualIndex)
          : `item-${actualIndex}`;

        return (
          <Box
            key={key}
            height={itemHeight}
            width="100%"
          >
            {showIndicator && (
              <Text
                color={isSelected && focused ? theme.semantic.selected : undefined}
                bold={isSelected}
              >
                {isSelected && focused ? indicator : " "}{" "}
              </Text>
            )}
            <Box flexGrow={1}>
              {renderItem(item, isSelected && focused, actualIndex)}
            </Box>
          </Box>
        );
      })}

      {/* Scroll indicator (bottom) */}
      {maxVisible && scrollOffset + visibleCount < items.length && (
        <Box justifyContent="center" width="100%">
          <Text color={theme.semantic.textMuted}>{indicators.arrowDown} more</Text>
        </Box>
      )}
    </Box>
  );
}

/**
 * Simple list item component
 */
export interface ListItemProps {
  /** Primary text */
  primary: string;
  /** Secondary text */
  secondary?: string;
  /** Right-aligned text (e.g., amount, date) */
  trailing?: string;
  /** Whether this item is selected */
  selected?: boolean;
  /** Trailing text color */
  trailingColor?: string;
}

export function ListItem({
  primary,
  secondary,
  trailing,
  selected,
  trailingColor,
}: ListItemProps) {
  const theme = getEnhancedTheme();

  return (
    <Box width="100%" justifyContent="space-between">
      <Box>
        <Text
          color={selected ? theme.semantic.selected : theme.semantic.textPrimary}
          bold={selected}
        >
          {primary}
        </Text>
        {secondary && (
          <Text color={theme.semantic.textMuted}> {secondary}</Text>
        )}
      </Box>
      {trailing && (
        <Text color={trailingColor || theme.semantic.textSecondary}>
          {trailing}
        </Text>
      )}
    </Box>
  );
}

/**
 * Default empty state component
 */
export interface EmptyStateProps {
  /** Icon (emoji or text) */
  icon?: string;
  /** Main message */
  message: string;
  /** Action hint */
  action?: string;
}

export function EmptyState({ icon = "📭", message, action }: EmptyStateProps) {
  const theme = getEnhancedTheme();

  return (
    <Box
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      paddingY={2}
      width="100%"
    >
      <Text>{icon}</Text>
      <Box height={1} />
      <Text color={theme.semantic.textMuted}>{message}</Text>
      {action && (
        <>
          <Box height={1} />
          <Text color={theme.semantic.textSecondary}>{action}</Text>
        </>
      )}
    </Box>
  );
}
