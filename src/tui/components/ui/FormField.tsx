/**
 * FormField Component
 *
 * Unified form input with label, validation, and error display.
 * Uses Ink's useInput for keyboard handling instead of @inkjs/ui TextInput.
 */

import React from "react";
import { Box, Text, useInput } from "ink";
import { getEnhancedTheme } from "../../design/theme.js";
import { indicators, borderStyles } from "../../design/tokens.js";
import { useBlinkingCursor } from "../../animations.js";

export interface FormFieldProps {
  /** Field label */
  label: string;
  /** Current value */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Whether this field is focused */
  focused?: boolean;
  /** Error message */
  error?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Whether field is required */
  required?: boolean;
  /** Field width */
  width?: number;
  /** Help text shown below field */
  helpText?: string;
  /** Input type for validation hints */
  type?: "text" | "number" | "email" | "date" | "currency";
  /** Maximum length */
  maxLength?: number;
  /** Disabled state */
  disabled?: boolean;
  /** Label width for alignment */
  labelWidth?: number;
  /** Show inline (label and input on same line) */
  inline?: boolean;
  /** Mask input (for passwords) */
  mask?: string;
  /** Called on submit (Enter key) */
  onSubmit?: () => void;
}

export function FormField({
  label,
  value,
  onChange,
  focused = false,
  error,
  placeholder,
  required = false,
  width,
  helpText,
  type = "text",
  maxLength,
  disabled = false,
  labelWidth,
  inline = true,
  mask,
  onSubmit,
}: FormFieldProps) {
  const theme = getEnhancedTheme();
  const cursorVisible = useBlinkingCursor(500);

  // Handle keyboard input when focused
  useInput(
    (input, key) => {
      if (!focused || disabled) return;

      // Submit on Enter
      if (key.return && onSubmit) {
        onSubmit();
        return;
      }

      // Handle backspace
      if (key.backspace || key.delete) {
        onChange(value.slice(0, -1));
        return;
      }

      // Ignore control characters
      if (key.ctrl || key.meta || key.escape) return;

      // Add typed character
      if (input) {
        const newValue = value + input;

        // Type-specific validation
        if (type === "number") {
          if (!/^-?\d*\.?\d*$/.test(newValue)) return;
        }

        if (type === "currency") {
          if (!/^\d*\.?\d{0,2}$/.test(newValue)) return;
        }

        if (maxLength && newValue.length > maxLength) return;

        onChange(newValue);
      }
    },
    { isActive: focused }
  );

  // Determine border/highlight color
  const getBorderColor = () => {
    if (error) return theme.semantic.inputError;
    if (focused) return theme.semantic.inputFocus;
    return theme.semantic.inputBorder;
  };

  const borderColor = getBorderColor();

  // Format display value based on type
  const formatDisplayValue = (val: string) => {
    if (mask && val) {
      return mask.repeat(val.length);
    }
    return val;
  };

  const labelContent = (
    <Box width={labelWidth}>
      <Text
        color={focused ? theme.semantic.textPrimary : theme.semantic.textSecondary}
        bold={focused}
      >
        {label}
        {required && <Text color={theme.semantic.error}> *</Text>}
      </Text>
    </Box>
  );

  const displayValue = formatDisplayValue(value);
  const showPlaceholder = !value && placeholder;
  const cursor = focused && cursorVisible ? "│" : "";

  const inputContent = (
    <Box
      borderStyle={focused ? borderStyles.input : undefined}
      borderColor={borderColor}
      paddingX={focused ? 1 : 0}
    >
      <Text
        color={
          showPlaceholder
            ? theme.semantic.inputPlaceholder
            : theme.semantic.textPrimary
        }
      >
        {displayValue || placeholder || "—"}
        {focused && (
          <Text color={theme.semantic.primary}>{cursor}</Text>
        )}
      </Text>
    </Box>
  );

  if (inline) {
    return (
      <Box flexDirection="column" width={width}>
        <Box>
          {labelContent}
          <Text color={theme.semantic.textMuted}>: </Text>
          {inputContent}
        </Box>
        {error && (
          <Box paddingLeft={labelWidth ? labelWidth + 2 : 0}>
            <Text color={theme.semantic.error}>
              {indicators.warning} {error}
            </Text>
          </Box>
        )}
        {helpText && !error && focused && (
          <Box paddingLeft={labelWidth ? labelWidth + 2 : 0}>
            <Text color={theme.semantic.textMuted} dimColor>
              {helpText}
            </Text>
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width={width}>
      {labelContent}
      <Box marginTop={1}>
        {inputContent}
      </Box>
      {error && (
        <Text color={theme.semantic.error}>
          {indicators.warning} {error}
        </Text>
      )}
      {helpText && !error && focused && (
        <Text color={theme.semantic.textMuted} dimColor>
          {helpText}
        </Text>
      )}
    </Box>
  );
}

/**
 * Multi-line text area field
 */
export interface TextAreaFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  focused?: boolean;
  error?: string;
  placeholder?: string;
  rows?: number;
  labelWidth?: number;
}

export function TextAreaField({
  label,
  value,
  onChange,
  focused = false,
  error,
  placeholder,
  rows = 3,
  labelWidth,
}: TextAreaFieldProps) {
  const theme = getEnhancedTheme();
  const cursorVisible = useBlinkingCursor(500);

  // Handle keyboard input
  useInput(
    (input, key) => {
      if (!focused) return;

      if (key.backspace || key.delete) {
        onChange(value.slice(0, -1));
        return;
      }

      if (key.ctrl || key.meta || key.escape) return;

      if (input) {
        onChange(value + input);
      }
    },
    { isActive: focused }
  );

  const cursor = focused && cursorVisible ? "│" : "";

  return (
    <Box flexDirection="column">
      <Box width={labelWidth}>
        <Text
          color={focused ? theme.semantic.textPrimary : theme.semantic.textSecondary}
          bold={focused}
        >
          {label}
        </Text>
      </Box>
      <Box
        marginTop={1}
        borderStyle={borderStyles.input}
        borderColor={focused ? theme.semantic.inputFocus : theme.semantic.inputBorder}
        paddingX={1}
        height={rows + 2}
      >
        <Text color={value ? theme.semantic.textPrimary : theme.semantic.inputPlaceholder}>
          {value || placeholder || "—"}
          {focused && <Text color={theme.semantic.primary}>{cursor}</Text>}
        </Text>
      </Box>
      {error && (
        <Text color={theme.semantic.error}>
          {indicators.warning} {error}
        </Text>
      )}
    </Box>
  );
}

/**
 * Checkbox/toggle field
 */
export interface CheckboxFieldProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  focused?: boolean;
  disabled?: boolean;
}

export function CheckboxField({
  label,
  checked,
  onChange,
  focused = false,
  disabled = false,
}: CheckboxFieldProps) {
  const theme = getEnhancedTheme();

  useInput(
    (input, key) => {
      if (!focused || disabled) return;
      if (input === " " || key.return) {
        onChange(!checked);
      }
    },
    { isActive: focused }
  );

  const checkboxChar = checked ? indicators.check : " ";
  const borderColor = focused ? theme.semantic.inputFocus : theme.semantic.inputBorder;

  return (
    <Box>
      <Text color={borderColor}>[</Text>
      <Text color={checked ? theme.semantic.success : undefined}>
        {checkboxChar}
      </Text>
      <Text color={borderColor}>]</Text>
      <Text
        color={focused ? theme.semantic.textPrimary : theme.semantic.textSecondary}
        dimColor={disabled}
      >
        {" "}{label}
      </Text>
    </Box>
  );
}

/**
 * Form section with title
 */
export interface FormSectionProps {
  title: string;
  children: React.ReactNode;
}

export function FormSection({ title, children }: FormSectionProps) {
  const theme = getEnhancedTheme();

  return (
    <Box flexDirection="column" marginY={1}>
      <Text bold color={theme.semantic.textSecondary}>
        {title}
      </Text>
      <Box height={1} />
      {children}
    </Box>
  );
}
