/**
 * SettingsView Component
 *
 * Comprehensive personalization center with tabbed categories
 * covering all business profile, financial, and integration settings.
 */

import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { getSetting, setSetting } from "../../db/index.js";
import { getEnhancedTheme } from "../design/theme.js";
import { indicators, borderStyles } from "../design/tokens.js";

interface SettingsViewProps {
  width: number;
  height: number;
}

// All available settings
type SettingKey =
  | "business_name"
  | "entity_type"
  | "owner_name"
  | "business_address"
  | "business_city"
  | "business_state"
  | "business_postal"
  | "business_country"
  | "business_phone"
  | "business_email"
  | "tax_id"
  | "currency"
  | "fiscal_year_end"
  | "tax_rate"
  | "default_payment_terms"
  | "invoice_prefix"
  | "invoice_notes"
  | "from_email"
  | "reply_to"
  | "resend_api_key"
  | "openai_api_key"
  | "theme";

type Category = "profile" | "financial" | "invoice" | "email" | "ai" | "appearance";

interface SettingField {
  key: SettingKey;
  label: string;
  placeholder: string;
  masked?: boolean;
  required?: boolean;
  category: Category;
  helpText?: string;
  options?: string[]; // For select-style fields
}

const CATEGORY_LABELS: Record<Category, { label: string; icon: string }> = {
  profile: { label: "Business Profile", icon: "◧" },
  financial: { label: "Financial", icon: "◨" },
  invoice: { label: "Invoicing", icon: "◩" },
  email: { label: "Email", icon: "◪" },
  ai: { label: "AI Assistant", icon: "◈" },
  appearance: { label: "Appearance", icon: "◫" },
};

const settingFields: SettingField[] = [
  // Business Profile
  {
    key: "business_name",
    label: "Business Name",
    placeholder: "My Business",
    required: true,
    category: "profile",
    helpText: "Your company or business name",
  },
  {
    key: "entity_type",
    label: "Entity Type",
    placeholder: "LLC",
    category: "profile",
    helpText: "LLC, Inc, Corp, Sole Prop, Sdn Bhd, etc.",
    options: ["LLC", "Inc", "Corp", "Sole Proprietor", "Partnership", "Sdn Bhd", ""],
  },
  {
    key: "owner_name",
    label: "Owner/Contact",
    placeholder: "John Doe",
    category: "profile",
    helpText: "Primary contact name",
  },
  {
    key: "business_address",
    label: "Address",
    placeholder: "123 Main Street",
    category: "profile",
  },
  {
    key: "business_city",
    label: "City",
    placeholder: "New York",
    category: "profile",
  },
  {
    key: "business_state",
    label: "State/Region",
    placeholder: "NY",
    category: "profile",
  },
  {
    key: "business_postal",
    label: "Postal Code",
    placeholder: "10001",
    category: "profile",
  },
  {
    key: "business_country",
    label: "Country",
    placeholder: "USA",
    category: "profile",
    options: ["USA", "Malaysia", "Singapore", "UK", "Canada", "Australia", ""],
  },
  {
    key: "business_phone",
    label: "Phone",
    placeholder: "+1 555-1234",
    category: "profile",
  },
  {
    key: "business_email",
    label: "Business Email",
    placeholder: "contact@mybusiness.com",
    category: "profile",
  },
  {
    key: "tax_id",
    label: "Tax ID / EIN",
    placeholder: "XX-XXXXXXX",
    category: "profile",
    helpText: "Federal Tax ID, SSM number, etc.",
  },

  // Financial
  {
    key: "currency",
    label: "Currency",
    placeholder: "USD",
    required: true,
    category: "financial",
    helpText: "ISO 4217 code (USD, MYR, EUR, GBP)",
    options: ["USD", "MYR", "EUR", "GBP", "SGD", "AUD", "CAD", ""],
  },
  {
    key: "fiscal_year_end",
    label: "Fiscal Year End",
    placeholder: "12",
    category: "financial",
    helpText: "Month number (1-12, e.g., 12 for December)",
    options: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
  },
  {
    key: "tax_rate",
    label: "Default Tax Rate %",
    placeholder: "0",
    category: "financial",
    helpText: "Default tax rate for new invoices (0-100)",
  },
  {
    key: "default_payment_terms",
    label: "Payment Terms",
    placeholder: "net_30",
    category: "financial",
    helpText: "Default payment terms for invoices",
    options: ["due_on_receipt", "net_15", "net_30", "net_45", "net_60", ""],
  },

  // Invoicing
  {
    key: "invoice_prefix",
    label: "Invoice Prefix",
    placeholder: "INV",
    category: "invoice",
    helpText: "Prefix for invoice numbers (e.g., INV-001)",
  },
  {
    key: "invoice_notes",
    label: "Default Notes",
    placeholder: "Thank you for your business!",
    category: "invoice",
    helpText: "Default notes shown on invoices",
  },

  // Email
  {
    key: "from_email",
    label: "From Email",
    placeholder: "invoices@yourdomain.com",
    category: "email",
    helpText: "Must be from a verified domain in Resend",
  },
  {
    key: "reply_to",
    label: "Reply To",
    placeholder: "support@yourdomain.com",
    category: "email",
    helpText: "Where customer replies are sent",
  },
  {
    key: "resend_api_key",
    label: "Resend API Key",
    placeholder: "re_xxxxxxxxxx",
    masked: true,
    category: "email",
    helpText: "Get your API key from resend.com/api-keys",
  },

  // AI Assistant
  {
    key: "openai_api_key",
    label: "OpenAI API Key",
    placeholder: "sk-...",
    masked: true,
    category: "ai",
    helpText: "Get your API key from platform.openai.com/api-keys. Enables AI chat features.",
  },

  // Appearance
  {
    key: "theme",
    label: "Theme",
    placeholder: "dark",
    category: "appearance",
    helpText: "UI color scheme",
    options: ["dark", "light"],
  },
];

const CATEGORIES: Category[] = ["profile", "financial", "invoice", "email", "ai", "appearance"];

export function SettingsView({ width, height }: SettingsViewProps) {
  const theme = getEnhancedTheme();
  const [activeCategory, setActiveCategory] = useState<Category>("profile");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [optionIndex, setOptionIndex] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Load all settings
  useEffect(() => {
    const loaded: Record<string, string> = {};
    settingFields.forEach((field) => {
      loaded[field.key] = getSetting(field.key) || "";
    });
    setValues(loaded);
  }, []);

  const categoryFields = settingFields.filter((f) => f.category === activeCategory);
  const currentField = categoryFields[selectedIndex];
  const listWidth = Math.floor(width * 0.4);
  const detailWidth = width - listWidth - 3;

  const maskValue = (value: string): string => {
    if (!value || value.length <= 4) return "••••••••";
    return "••••••••" + value.slice(-4);
  };

  const saveValue = (value: string) => {
    if (currentField) {
      setSetting(currentField.key, value);
      setValues((prev) => ({ ...prev, [currentField.key]: value }));
      setMessage({ type: "success", text: `${currentField.label} saved!` });
      setTimeout(() => setMessage(null), 2000);
    }
    setIsEditing(false);
    setEditValue("");
  };

  // Update option index when field changes
  useEffect(() => {
    if (currentField?.options) {
      const currentValue = values[currentField.key] || "";
      const idx = currentField.options.indexOf(currentValue);
      setOptionIndex(idx >= 0 ? idx : 0);
    }
  }, [currentField, values]);

  useInput((input, key) => {
    if (isEditing) {
      if (key.escape) {
        setIsEditing(false);
        setEditValue("");
        return;
      }

      // For fields with options, use left/right to cycle
      if (currentField?.options) {
        if (key.leftArrow) {
          const newIdx = Math.max(0, optionIndex - 1);
          setOptionIndex(newIdx);
          setEditValue(currentField.options[newIdx]);
          return;
        }
        if (key.rightArrow) {
          const newIdx = Math.min(currentField.options.length - 1, optionIndex + 1);
          setOptionIndex(newIdx);
          setEditValue(currentField.options[newIdx]);
          return;
        }
        if (key.return) {
          saveValue(editValue);
          return;
        }
        return;
      }

      // Regular text editing
      if (key.return) {
        saveValue(editValue);
        return;
      }
      if (key.backspace || key.delete) {
        setEditValue((prev) => prev.slice(0, -1));
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setEditValue((prev) => prev + input);
      }
      return;
    }

    // Tab switching (1-5)
    if (input >= "1" && input <= "5") {
      const idx = parseInt(input) - 1;
      if (idx < CATEGORIES.length) {
        setActiveCategory(CATEGORIES[idx]);
        setSelectedIndex(0);
      }
      return;
    }

    // Navigation
    if (key.upArrow || input === "k") {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    }
    if (key.downArrow || input === "j") {
      setSelectedIndex((prev) => Math.min(categoryFields.length - 1, prev + 1));
    }

    // Enter to edit
    if (key.return || input === "e") {
      setIsEditing(true);
      const currentValue = values[currentField?.key] || "";
      setEditValue(currentValue);
      if (currentField?.options) {
        const idx = currentField.options.indexOf(currentValue);
        setOptionIndex(idx >= 0 ? idx : 0);
      }
    }
  });

  // Calculate completion stats per category
  const getCategoryStatus = (cat: Category) => {
    const fields = settingFields.filter((f) => f.category === cat);
    const required = fields.filter((f) => f.required);
    const filled = fields.filter((f) => values[f.key]);
    const requiredFilled = required.filter((f) => values[f.key]);
    return {
      total: fields.length,
      filled: filled.length,
      requiredTotal: required.length,
      requiredFilled: requiredFilled.length,
      complete: required.length === 0 || requiredFilled.length === required.length,
    };
  };

  // Overall progress
  const requiredFields = settingFields.filter((f) => f.required);
  const completedRequired = requiredFields.filter((f) => values[f.key]).length;
  const progressWidth = 12;
  const filledBlocks = Math.round((completedRequired / Math.max(1, requiredFields.length)) * progressWidth);
  const progressBar = "█".repeat(filledBlocks) + "░".repeat(progressWidth - filledBlocks);

  return (
    <Box flexDirection="row" width={width} height={height}>
      {/* Left Panel - Categories & Fields */}
      <Box
        flexDirection="column"
        width={listWidth}
        height={height}
        borderStyle={borderStyles.panel}
        borderColor={theme.semantic.focusBorder}
        paddingX={1}
      >
        {/* Header */}
        <Box justifyContent="space-between" marginBottom={1}>
          <Text bold color={theme.semantic.warning}>◆ Settings</Text>
        </Box>

        {/* Divider */}
        <Text color={theme.semantic.border}>{"─".repeat(listWidth - 4)}</Text>

        {/* Category Tabs */}
        <Box marginY={1} flexWrap="wrap">
          {CATEGORIES.map((cat, i) => {
            const status = getCategoryStatus(cat);
            const isActive = activeCategory === cat;
            const info = CATEGORY_LABELS[cat];

            if (isActive) {
              return (
                <Box key={cat} marginRight={1}>
                  <Box backgroundColor={theme.semantic.focusBorder}>
                    <Text color={theme.base} bold>
                      {" "}{i + 1}.{info.icon}{" "}
                    </Text>
                  </Box>
                </Box>
              );
            }
            return (
              <Box key={cat} marginRight={1}>
                <Text color={status.complete ? theme.semantic.success : theme.semantic.textMuted}>
                  {i + 1}.{info.icon}{status.complete ? indicators.check : ""}
                </Text>
              </Box>
            );
          })}
        </Box>

        {/* Category Label */}
        <Box marginBottom={1}>
          <Text bold color={theme.semantic.info}>
            {CATEGORY_LABELS[activeCategory].icon} {CATEGORY_LABELS[activeCategory].label}
          </Text>
        </Box>

        {/* Fields in Category */}
        <Box flexDirection="column" flexGrow={1}>
          {categoryFields.map((field, idx) => {
            const value = values[field.key];
            const hasValue = Boolean(value);
            const isSelected = idx === selectedIndex;

            if (isSelected) {
              return (
                <Box key={field.key} marginBottom={0}>
                  <Box backgroundColor={theme.semantic.focusBorder}>
                    <Text color={theme.base} bold>
                      {" ▶ "}{field.required ? "*" : " "}{field.label}{" "}
                    </Text>
                  </Box>
                  <Text color={hasValue ? theme.semantic.success : theme.semantic.textMuted}>
                    {" "}{hasValue ? indicators.check : indicators.pending}
                  </Text>
                </Box>
              );
            }
            return (
              <Box key={field.key}>
                <Text color={theme.semantic.textSecondary}>
                  {"   "}{field.required ? "*" : " "}{field.label}
                </Text>
                <Text color={hasValue ? theme.semantic.success : theme.semantic.textMuted}>
                  {" "}{hasValue ? indicators.check : indicators.pending}
                </Text>
              </Box>
            );
          })}
        </Box>

        {/* Overall Progress */}
        <Box flexDirection="column" marginTop={1}>
          <Text color={theme.semantic.textMuted}>Setup Progress</Text>
          <Box>
            <Text color={completedRequired === requiredFields.length ? theme.semantic.success : theme.semantic.warning}>
              {progressBar}
            </Text>
            <Text color={theme.semantic.textMuted}> {completedRequired}/{requiredFields.length}</Text>
          </Box>
        </Box>
      </Box>

      <Box width={1} />

      {/* Right Panel - Edit/Preview */}
      <Box
        flexDirection="column"
        width={detailWidth}
        height={height}
        borderStyle={borderStyles.panel}
        borderColor={theme.semantic.border}
        paddingX={1}
      >
        {currentField ? (
          <>
            {/* Header */}
            <Box justifyContent="space-between" marginBottom={1}>
              <Box>
                <Text bold color={theme.semantic.info}>{indicators.pointer} {currentField.label}</Text>
                {currentField.required && <Text color={theme.semantic.error}> *</Text>}
              </Box>
              <Text color={theme.semantic.textMuted}>
                {isEditing ? "editing" : "viewing"}
              </Text>
            </Box>

            {/* Divider */}
            <Text color={theme.semantic.border}>{"─".repeat(detailWidth - 4)}</Text>

            {/* Mode Hint */}
            <Box marginY={1}>
              <Text color={theme.semantic.textMuted}>
                {isEditing
                  ? currentField.options
                    ? "← → select • Enter save • Esc cancel"
                    : "Enter save • Esc cancel"
                  : "Enter or 'e' to edit • 1-5 switch tabs"}
              </Text>
            </Box>

            {/* Current Value Display */}
            <Box marginBottom={1} flexDirection="column">
              <Text color={theme.semantic.textMuted}>Current Value:</Text>
              <Box
                borderStyle={borderStyles.input}
                borderColor={theme.semantic.border}
                paddingX={1}
                marginTop={1}
              >
                <Text color={values[currentField.key] ? theme.semantic.textPrimary : theme.semantic.textMuted}>
                  {values[currentField.key]
                    ? currentField.masked
                      ? maskValue(values[currentField.key])
                      : values[currentField.key]
                    : `(${currentField.placeholder})`}
                </Text>
              </Box>
            </Box>

            {/* Edit Mode */}
            {isEditing && (
              <Box flexDirection="column" marginBottom={1}>
                <Text color={theme.semantic.warning}>New Value:</Text>
                {currentField.options ? (
                  // Option selector
                  <Box marginTop={1}>
                    <Text color={theme.semantic.warning}>
                      {indicators.arrowLeft} {editValue || "(empty)"} {indicators.arrowRight}
                    </Text>
                  </Box>
                ) : (
                  // Text input
                  <Box
                    borderStyle={borderStyles.input}
                    borderColor={theme.semantic.focusBorder}
                    paddingX={1}
                    marginTop={1}
                  >
                    <Text color={theme.semantic.textPrimary}>
                      {currentField.masked && editValue.length > 0
                        ? maskValue(editValue)
                        : editValue || " "}
                    </Text>
                    <Text backgroundColor={theme.semantic.focusBorder}> </Text>
                  </Box>
                )}
              </Box>
            )}

            {/* Divider */}
            <Box marginY={1}>
              <Text color={theme.semantic.border}>{"─".repeat(detailWidth - 4)}</Text>
            </Box>

            {/* Help Text */}
            {currentField.helpText && (
              <Box flexDirection="column">
                <Text bold color={theme.semantic.textSecondary}>{indicators.info} Help</Text>
                <Box marginTop={1} paddingLeft={1}>
                  <Text color={theme.semantic.textMuted}>{currentField.helpText}</Text>
                </Box>
              </Box>
            )}

            {/* Available Options */}
            {currentField.options && !isEditing && (
              <Box flexDirection="column" marginTop={1}>
                <Text bold color={theme.semantic.textSecondary}>{indicators.bullet} Options</Text>
                <Box marginTop={1} paddingLeft={1} flexWrap="wrap">
                  <Text color={theme.semantic.textMuted}>
                    {currentField.options.filter(Boolean).join(", ") || "Custom value"}
                  </Text>
                </Box>
              </Box>
            )}

            <Box flexGrow={1} />

            {/* Message */}
            {message && (
              <Box
                borderStyle={borderStyles.input}
                borderColor={message.type === "success" ? theme.semantic.success : theme.semantic.error}
                paddingX={1}
              >
                <Text color={message.type === "success" ? theme.semantic.success : theme.semantic.error}>
                  {message.type === "success" ? indicators.check : indicators.cross} {message.text}
                </Text>
              </Box>
            )}
          </>
        ) : (
          <Text color={theme.semantic.textMuted}>{indicators.info} Select a setting</Text>
        )}
      </Box>
    </Box>
  );
}
