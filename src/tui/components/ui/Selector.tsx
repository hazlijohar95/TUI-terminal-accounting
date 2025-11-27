/**
 * Selector Component
 *
 * Left/right arrow selector for cycling through options.
 * Great for categories, types, and enumerated values.
 */

import React from "react";
import { Box, Text, useInput } from "ink";
import { getEnhancedTheme } from "../../design/theme.js";
import { indicators } from "../../design/tokens.js";

export interface SelectorOption<T = string> {
  /** Value returned when selected */
  value: T;
  /** Display label */
  label: string;
  /** Optional description */
  description?: string;
}

export interface SelectorProps<T = string> {
  /** Field label */
  label: string;
  /** Available options */
  options: SelectorOption<T>[] | readonly SelectorOption<T>[];
  /** Currently selected value */
  value: T;
  /** Change handler */
  onChange: (value: T) => void;
  /** Whether this selector is focused */
  focused?: boolean;
  /** Label width for alignment */
  labelWidth?: number;
  /** Wrap around when reaching start/end */
  wrap?: boolean;
  /** Show option count (e.g., "2/5") */
  showCount?: boolean;
  /** Disabled state */
  disabled?: boolean;
}

export function Selector<T = string>({
  label,
  options,
  value,
  onChange,
  focused = false,
  labelWidth,
  wrap = true,
  showCount = false,
  disabled = false,
}: SelectorProps<T>) {
  const theme = getEnhancedTheme();

  const currentIndex = options.findIndex((opt) => opt.value === value);
  const currentOption = options[currentIndex] || options[0];

  // Handle keyboard navigation
  useInput(
    (input, key) => {
      if (!focused || disabled) return;

      if (key.leftArrow || input === "h") {
        if (currentIndex > 0) {
          onChange(options[currentIndex - 1].value);
        } else if (wrap && options.length > 0) {
          onChange(options[options.length - 1].value);
        }
      }

      if (key.rightArrow || input === "l") {
        if (currentIndex < options.length - 1) {
          onChange(options[currentIndex + 1].value);
        } else if (wrap && options.length > 0) {
          onChange(options[0].value);
        }
      }
    },
    { isActive: focused }
  );

  const arrowColor = focused ? theme.semantic.primary : theme.semantic.textMuted;
  const valueColor = focused ? theme.semantic.primary : theme.semantic.textPrimary;
  const canGoLeft = wrap || currentIndex > 0;
  const canGoRight = wrap || currentIndex < options.length - 1;

  return (
    <Box flexDirection="column">
      <Box>
        {/* Label */}
        <Box width={labelWidth}>
          <Text
            color={focused ? theme.semantic.textPrimary : theme.semantic.textSecondary}
            bold={focused}
          >
            {label}
          </Text>
        </Box>
        <Text color={theme.semantic.textMuted}>: </Text>

        {/* Selector */}
        <Box>
          <Text color={canGoLeft && focused ? arrowColor : theme.semantic.textMuted} dimColor={!canGoLeft || disabled}>
            {indicators.arrowLeft}
          </Text>
          <Text> </Text>
          <Text color={valueColor} bold={focused}>
            {currentOption?.label || "—"}
          </Text>
          <Text> </Text>
          <Text color={canGoRight && focused ? arrowColor : theme.semantic.textMuted} dimColor={!canGoRight || disabled}>
            {indicators.arrowRight}
          </Text>

          {showCount && (
            <Text color={theme.semantic.textMuted}>
              {" "}({currentIndex + 1}/{options.length})
            </Text>
          )}
        </Box>
      </Box>

      {/* Description */}
      {currentOption?.description && focused && (
        <Box paddingLeft={labelWidth ? labelWidth + 2 : 0}>
          <Text color={theme.semantic.textMuted} dimColor>
            {currentOption.description}
          </Text>
        </Box>
      )}
    </Box>
  );
}

/**
 * Simple string selector (convenience wrapper)
 */
export interface SimpleSelectProps {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  focused?: boolean;
  labelWidth?: number;
}

export function SimpleSelect({
  label,
  options,
  value,
  onChange,
  focused,
  labelWidth,
}: SimpleSelectProps) {
  const selectorOptions: SelectorOption[] = options.map((opt) => ({
    value: opt,
    label: opt,
  }));

  return (
    <Selector
      label={label}
      options={selectorOptions}
      value={value}
      onChange={onChange}
      focused={focused}
      labelWidth={labelWidth}
    />
  );
}

/**
 * Tab bar for switching between views
 */
export interface TabBarProps {
  tabs: Array<{
    id: string;
    label: string;
  }>;
  activeTab: string;
  onChange: (tabId: string) => void;
  focused?: boolean;
}

export function TabBar({ tabs, activeTab, onChange, focused = false }: TabBarProps) {
  const theme = getEnhancedTheme();

  useInput(
    (input, key) => {
      if (!focused) return;

      const currentIndex = tabs.findIndex((t) => t.id === activeTab);

      if (key.leftArrow || input === "h") {
        const newIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
        onChange(tabs[newIndex].id);
      }

      if (key.rightArrow || input === "l") {
        const newIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
        onChange(tabs[newIndex].id);
      }

      // Number keys
      const num = parseInt(input);
      if (!isNaN(num) && num >= 1 && num <= tabs.length) {
        onChange(tabs[num - 1].id);
      }
    },
    { isActive: focused }
  );

  return (
    <Box>
      {tabs.map((tab, index) => {
        const isActive = tab.id === activeTab;

        return (
          <Box key={tab.id}>
            {index > 0 && (
              <Text color={theme.semantic.border}> │ </Text>
            )}
            <Text
              color={isActive ? theme.semantic.primary : theme.semantic.textSecondary}
              bold={isActive}
              inverse={isActive && focused}
            >
              {isActive && focused ? ` ${tab.label} ` : tab.label}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}

/**
 * Radio group for mutually exclusive options
 */
export interface RadioGroupProps<T = string> {
  label?: string;
  options: SelectorOption<T>[];
  value: T;
  onChange: (value: T) => void;
  focused?: boolean;
  focusedIndex?: number;
  onFocusChange?: (index: number) => void;
}

export function RadioGroup<T = string>({
  label,
  options,
  value,
  onChange,
  focused = false,
  focusedIndex = 0,
  onFocusChange,
}: RadioGroupProps<T>) {
  const theme = getEnhancedTheme();

  useInput(
    (input, key) => {
      if (!focused) return;

      if (key.upArrow || input === "k") {
        const newIndex = Math.max(0, focusedIndex - 1);
        onFocusChange?.(newIndex);
      }

      if (key.downArrow || input === "j") {
        const newIndex = Math.min(options.length - 1, focusedIndex + 1);
        onFocusChange?.(newIndex);
      }

      if (input === " " || key.return) {
        onChange(options[focusedIndex].value);
      }
    },
    { isActive: focused }
  );

  return (
    <Box flexDirection="column">
      {label && (
        <Text color={theme.semantic.textSecondary} bold>
          {label}
        </Text>
      )}
      {options.map((option, index) => {
        const isSelected = option.value === value;
        const isFocused = focused && index === focusedIndex;

        return (
          <Box key={String(option.value)}>
            <Text color={isFocused ? theme.semantic.primary : theme.semantic.textSecondary}>
              {isFocused ? indicators.pointer : " "}{" "}
            </Text>
            <Text color={isFocused ? theme.semantic.primary : theme.semantic.border}>
              ({isSelected ? indicators.bullet : " "})
            </Text>
            <Text
              color={isSelected ? theme.semantic.primary : theme.semantic.textPrimary}
              bold={isSelected}
            >
              {" "}{option.label}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
