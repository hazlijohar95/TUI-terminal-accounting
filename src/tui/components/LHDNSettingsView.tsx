/**
 * LHDN Settings View
 *
 * Configuration interface for Malaysia LHDN e-Invoice integration.
 * Polished tabbed interface with visual status indicators.
 */

import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { getEnhancedTheme } from "../design/theme.js";
import { indicators, borderStyles } from "../design/tokens.js";
import {
  MALAYSIA_STATES,
  COMMON_MSIC_CODES,
  CLASSIFICATION_CODES,
  TAX_TYPES,
  TAX_TYPE_LABELS,
} from "../../services/myinvois/constants.js";

interface LHDNSettingsViewProps {
  width: number;
  height: number;
  onSave?: (settings: LHDNSettingsData) => void;
  initialSettings?: Partial<LHDNSettingsData>;
}

interface LHDNSettingsData {
  tin: string;
  brn: string;
  sstRegistration: string;
  tourismTaxRegistration: string;
  msicCode: string;
  businessActivityDescription: string;
  supplierEmail: string;
  supplierPhone: string;
  addressLine1: string;
  addressLine2: string;
  addressLine3: string;
  postalCode: string;
  city: string;
  state: string;
  country: string;
  clientId: string;
  clientSecret: string;
  certificatePath: string;
  certificatePassword: string;
  environment: "sandbox" | "production";
  autoSubmit: boolean;
  defaultClassificationCode: string;
  defaultTaxType: string;
}

type SettingKey = keyof LHDNSettingsData;

interface SettingField {
  key: SettingKey;
  label: string;
  placeholder: string;
  masked?: boolean;
  required?: boolean;
  category: "supplier" | "address" | "credentials" | "preferences";
  helpText?: string;
}

const settingFields: SettingField[] = [
  // Supplier Information
  { key: "tin", label: "Tax ID (TIN)", placeholder: "C12345678000", required: true, category: "supplier", helpText: "12-digit Tax Identification Number from LHDN" },
  { key: "brn", label: "Business Reg. No. (SSM)", placeholder: "202001012345", category: "supplier", helpText: "Company registration number from SSM" },
  { key: "sstRegistration", label: "SST Registration", placeholder: "A01-1234-56789012", category: "supplier" },
  { key: "tourismTaxRegistration", label: "Tourism Tax Reg.", placeholder: "", category: "supplier" },
  { key: "msicCode", label: "MSIC Code", placeholder: "62010", required: true, category: "supplier", helpText: "5-digit Malaysia Standard Industrial Classification" },
  { key: "businessActivityDescription", label: "Business Activity", placeholder: "Computer programming", required: true, category: "supplier" },
  { key: "supplierEmail", label: "Contact Email", placeholder: "invoices@company.com", category: "supplier" },
  { key: "supplierPhone", label: "Contact Phone", placeholder: "+60123456789", category: "supplier" },

  // Address
  { key: "addressLine1", label: "Address Line 1", placeholder: "123 Jalan Ampang", required: true, category: "address" },
  { key: "addressLine2", label: "Address Line 2", placeholder: "Suite 10, Level 5", category: "address" },
  { key: "addressLine3", label: "Address Line 3", placeholder: "", category: "address" },
  { key: "postalCode", label: "Postal Code", placeholder: "50450", required: true, category: "address" },
  { key: "city", label: "City", placeholder: "Kuala Lumpur", required: true, category: "address" },
  { key: "state", label: "State", placeholder: "KUL", required: true, category: "address", helpText: "State code: JHR, KDH, KTN, MLK, NSN, PHG, PNG, PRK, PLS, SBH, SWK, SGR, TRG, KUL, LBN, PJY" },
  { key: "country", label: "Country Code", placeholder: "MYS", required: true, category: "address", helpText: "ISO 3166-1 alpha-3 (MYS for Malaysia)" },

  // API Credentials
  { key: "clientId", label: "LHDN Client ID", placeholder: "xxxx-xxxx-xxxx-xxxx", required: true, category: "credentials", helpText: "From LHDN MyInvois portal" },
  { key: "clientSecret", label: "LHDN Client Secret", placeholder: "••••••••", required: true, masked: true, category: "credentials" },
  { key: "certificatePath", label: "Certificate Path", placeholder: "/path/to/cert.p12", category: "credentials", helpText: "PKCS#12 certificate from LHDN" },
  { key: "certificatePassword", label: "Certificate Password", placeholder: "••••••••", masked: true, category: "credentials" },

  // Preferences
  { key: "environment", label: "Environment", placeholder: "sandbox", required: true, category: "preferences", helpText: "sandbox or production" },
  { key: "autoSubmit", label: "Auto-Submit", placeholder: "false", category: "preferences", helpText: "Auto-submit when invoice is finalized" },
  { key: "defaultClassificationCode", label: "Default Classification", placeholder: "002", category: "preferences", helpText: "001=Goods, 002=Services, etc." },
  { key: "defaultTaxType", label: "Default Tax Type", placeholder: "E", category: "preferences", helpText: "E=Exempt, 01=Sales Tax, 02=Service Tax" },
];

const defaultValues: LHDNSettingsData = {
  tin: "",
  brn: "",
  sstRegistration: "",
  tourismTaxRegistration: "",
  msicCode: "",
  businessActivityDescription: "",
  supplierEmail: "",
  supplierPhone: "",
  addressLine1: "",
  addressLine2: "",
  addressLine3: "",
  postalCode: "",
  city: "",
  state: "",
  country: "MYS",
  clientId: "",
  clientSecret: "",
  certificatePath: "",
  certificatePassword: "",
  environment: "sandbox",
  autoSubmit: false,
  defaultClassificationCode: "002",
  defaultTaxType: "E",
};

export function LHDNSettingsView({ width, height, onSave, initialSettings }: LHDNSettingsViewProps) {
  const theme = getEnhancedTheme();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [values, setValues] = useState<LHDNSettingsData>({ ...defaultValues, ...initialSettings });
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"supplier" | "address" | "credentials" | "preferences">("supplier");

  const currentField = settingFields[selectedIndex];
  const listWidth = Math.floor(width * 0.38);
  const detailWidth = width - listWidth - 3;

  // Tab icons
  const tabIcons = {
    supplier: "◧",
    address: "◨",
    credentials: "◩",
    preferences: "◪",
  };

  const maskValue = (value: string): string => {
    if (!value || value.length <= 4) return "••••••••";
    return "••••••••" + value.slice(-4);
  };

  const saveValue = () => {
    if (currentField) {
      let newValue: unknown = editValue;

      // Special handling for boolean
      if (currentField.key === "autoSubmit") {
        newValue = editValue.toLowerCase() === "true" || editValue === "1" || editValue.toLowerCase() === "yes";
      }

      setValues((prev) => ({ ...prev, [currentField.key]: newValue }));
      setMessage({ type: "success", text: `${currentField.label} saved!` });
      setTimeout(() => setMessage(null), 2000);
    }
    setIsEditing(false);
    setEditValue("");
  };

  const saveAllSettings = () => {
    // Validate required fields
    const missingFields = settingFields
      .filter((f) => f.required && !values[f.key])
      .map((f) => f.label);

    if (missingFields.length > 0) {
      setMessage({ type: "error", text: `Missing: ${missingFields.slice(0, 3).join(", ")}${missingFields.length > 3 ? "..." : ""}` });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    if (onSave) {
      onSave(values);
      setMessage({ type: "success", text: "Settings saved successfully!" });
      setTimeout(() => setMessage(null), 2000);
    }
  };

  useInput((input, key) => {
    if (isEditing) {
      if (key.escape) {
        setIsEditing(false);
        setEditValue("");
        return;
      }
      if (key.return) {
        saveValue();
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

    // Tab switching
    if (input === "1") setActiveTab("supplier");
    if (input === "2") setActiveTab("address");
    if (input === "3") setActiveTab("credentials");
    if (input === "4") setActiveTab("preferences");

    // Navigation
    const tabFields = settingFields.filter((f) => f.category === activeTab);
    const currentTabIndex = tabFields.findIndex((f) => f.key === currentField?.key);

    if (key.upArrow || input === "k") {
      if (currentTabIndex > 0) {
        const prevField = tabFields[currentTabIndex - 1];
        setSelectedIndex(settingFields.indexOf(prevField));
      }
    }
    if (key.downArrow || input === "j") {
      if (currentTabIndex < tabFields.length - 1) {
        const nextField = tabFields[currentTabIndex + 1];
        setSelectedIndex(settingFields.indexOf(nextField));
      }
    }

    // Edit
    if (key.return || input === "e") {
      setIsEditing(true);
      const val = values[currentField.key];
      setEditValue(typeof val === "boolean" ? (val ? "true" : "false") : String(val || ""));
    }

    // Save all with Ctrl+S
    if (key.ctrl && input === "s") {
      saveAllSettings();
    }
  });

  // Switch tab and update selected field
  useEffect(() => {
    const tabFields = settingFields.filter((f) => f.category === activeTab);
    if (tabFields.length > 0) {
      setSelectedIndex(settingFields.indexOf(tabFields[0]));
    }
  }, [activeTab]);

  const tabFields = settingFields.filter((f) => f.category === activeTab);

  // Check configuration status per category
  const supplierConfigured = Boolean(values.tin && values.msicCode && values.businessActivityDescription);
  const addressConfigured = Boolean(values.addressLine1 && values.postalCode && values.city && values.state);
  const credentialsConfigured = Boolean(values.clientId && values.clientSecret);
  const isConfigured = supplierConfigured && addressConfigured && credentialsConfigured;

  // Calculate completion progress
  const requiredFields = settingFields.filter((f) => f.required);
  const completedRequired = requiredFields.filter((f) => values[f.key]).length;
  const progressWidth = 10;
  const filledBlocks = Math.round((completedRequired / requiredFields.length) * progressWidth);
  const progressBar = "█".repeat(filledBlocks) + "░".repeat(progressWidth - filledBlocks);

  return (
    <Box flexDirection="row" width={width} height={height}>
      {/* Left Panel */}
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
          <Text bold color={theme.semantic.warning}>◆ LHDN e-Invoice</Text>
        </Box>

        {/* Divider */}
        <Text color={theme.semantic.border}>{"─".repeat(listWidth - 4)}</Text>

        {/* Hints */}
        <Box marginY={1}>
          <Text color={theme.semantic.textMuted}>1-4 tabs • j/k ↕ • Enter edit</Text>
        </Box>

        {/* Tabs */}
        <Box flexDirection="row" marginBottom={1} flexWrap="wrap">
          {(["supplier", "address", "credentials", "preferences"] as const).map((tab, i) => {
            const isActive = activeTab === tab;
            const tabConfigured =
              tab === "supplier" ? supplierConfigured :
              tab === "address" ? addressConfigured :
              tab === "credentials" ? credentialsConfigured : true;

            if (isActive) {
              return (
                <Box key={tab} backgroundColor={theme.semantic.focusBorder}>
                  <Text color={theme.base} bold>
                    {" "}{i + 1}.{tabIcons[tab]}{" "}
                  </Text>
                </Box>
              );
            }
            return (
              <Text key={tab} color={tabConfigured ? theme.semantic.success : theme.semantic.textMuted}>
                {" "}{i + 1}.{tabIcons[tab]}{tabConfigured ? indicators.check : ""}{" "}
              </Text>
            );
          })}
        </Box>

        {/* Fields */}
        {tabFields.map((field) => {
          const idx = settingFields.indexOf(field);
          const value = values[field.key];
          const hasValue = value !== "" && value !== undefined;
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

        <Box flexGrow={1} />

        {/* Configuration Progress */}
        <Box flexDirection="column" marginTop={1}>
          <Text color={theme.semantic.textMuted}>Setup Progress</Text>
          <Box>
            <Text color={isConfigured ? theme.semantic.success : theme.semantic.warning}>
              {progressBar}
            </Text>
            <Text color={theme.semantic.textMuted}> {completedRequired}/{requiredFields.length}</Text>
          </Box>
        </Box>

        {/* Status */}
        <Box
          borderStyle={borderStyles.input}
          borderColor={isConfigured ? theme.semantic.success : theme.semantic.border}
          paddingX={1}
          flexDirection="column"
          marginTop={1}
        >
          <Text color={isConfigured ? theme.semantic.success : theme.semantic.warning}>
            {isConfigured ? indicators.check : indicators.pending} {isConfigured ? "Ready" : "Setup Required"}
          </Text>
          <Text color={theme.semantic.textMuted}>
            Env: {values.environment === "production" ? "Production" : "Sandbox"}
          </Text>
        </Box>
      </Box>

      <Box width={1} />

      {/* Right Panel */}
      <Box
        flexDirection="column"
        width={detailWidth}
        height={height}
        borderStyle={borderStyles.panel}
        borderColor={theme.semantic.border}
        paddingX={1}
      >
        {/* Header */}
        <Box justifyContent="space-between" marginBottom={1}>
          <Box>
            <Text bold color={theme.semantic.info}>{indicators.pointer} {currentField?.label}</Text>
            {currentField?.required && <Text color={theme.semantic.error}> *</Text>}
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
            {isEditing ? "Enter save • Esc cancel" : "Enter or 'e' to edit • ^S save all"}
          </Text>
        </Box>

        {/* Current Value */}
        <Box marginBottom={1} flexDirection="column">
          <Text color={theme.semantic.textMuted}>Current Value:</Text>
          <Box
            borderStyle={borderStyles.input}
            borderColor={theme.semantic.border}
            paddingX={1}
            marginTop={1}
          >
            <Text color={values[currentField?.key] ? theme.semantic.textPrimary : theme.semantic.textMuted}>
              {(() => {
                const val = values[currentField?.key];
                if (!val && val !== false) return `(${currentField?.placeholder})`;
                if (currentField?.masked) return maskValue(String(val));
                if (typeof val === "boolean") return val ? "Yes" : "No";
                return String(val);
              })()}
            </Text>
          </Box>
        </Box>

        {/* Edit Mode */}
        {isEditing && (
          <Box flexDirection="column" marginBottom={1}>
            <Text color={theme.semantic.warning}>New Value:</Text>
            <Box
              borderStyle={borderStyles.input}
              borderColor={theme.semantic.focusBorder}
              paddingX={1}
              marginTop={1}
            >
              <Text color={theme.semantic.textPrimary}>
                {currentField?.masked && editValue.length > 0
                  ? maskValue(editValue)
                  : editValue || " "}
              </Text>
              <Text backgroundColor={theme.semantic.focusBorder}> </Text>
            </Box>
          </Box>
        )}

        {/* Divider */}
        <Box marginY={1}>
          <Text color={theme.semantic.border}>{"─".repeat(detailWidth - 4)}</Text>
        </Box>

        {/* Help Text */}
        {currentField?.helpText && (
          <Box flexDirection="column">
            <Text bold color={theme.semantic.textSecondary}>{indicators.info} Help</Text>
            <Box marginTop={1} paddingLeft={1}>
              <Text color={theme.semantic.textMuted}>{currentField.helpText}</Text>
            </Box>
          </Box>
        )}

        {/* Reference Data */}
        {currentField?.key === "state" && (
          <Box flexDirection="column" marginTop={1}>
            <Text color={theme.semantic.warning} bold>{indicators.bullet} State Codes:</Text>
            <Text color={theme.semantic.textMuted} wrap="wrap">
              {Object.entries(MALAYSIA_STATES).slice(0, 8).map(([code, name]) => `${code}=${name}`).join(", ")}
            </Text>
          </Box>
        )}

        {currentField?.key === "msicCode" && (
          <Box flexDirection="column" marginTop={1}>
            <Text color={theme.semantic.warning} bold>{indicators.bullet} Common MSIC:</Text>
            <Text color={theme.semantic.textMuted} wrap="wrap">
              {Object.entries(COMMON_MSIC_CODES).slice(0, 4).map(([code, desc]) => `${code}=${desc}`).join(", ")}
            </Text>
          </Box>
        )}

        {currentField?.key === "defaultClassificationCode" && (
          <Box flexDirection="column" marginTop={1}>
            <Text color={theme.semantic.warning} bold>{indicators.bullet} Classification:</Text>
            <Text color={theme.semantic.textMuted} wrap="wrap">
              {Object.entries(CLASSIFICATION_CODES).slice(0, 5).map(([code, desc]) => `${code}=${desc}`).join(", ")}
            </Text>
          </Box>
        )}

        {currentField?.key === "defaultTaxType" && (
          <Box flexDirection="column" marginTop={1}>
            <Text color={theme.semantic.warning} bold>{indicators.bullet} Tax Types:</Text>
            <Text color={theme.semantic.textMuted} wrap="wrap">
              {Object.entries(TAX_TYPE_LABELS).map(([code, desc]) => `${code}=${desc}`).join(", ")}
            </Text>
          </Box>
        )}

        <Box flexGrow={1} />

        {/* Message */}
        {message && (
          <Box
            borderStyle={borderStyles.input}
            borderColor={
              message.type === "success"
                ? theme.semantic.success
                : message.type === "error"
                  ? theme.semantic.error
                  : theme.semantic.info
            }
            paddingX={1}
          >
            <Text
              color={
                message.type === "success"
                  ? theme.semantic.success
                  : message.type === "error"
                    ? theme.semantic.error
                    : theme.semantic.info
              }
            >
              {message.type === "success" ? indicators.check : message.type === "error" ? indicators.cross : indicators.info} {message.text}
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}

export type { LHDNSettingsData };
