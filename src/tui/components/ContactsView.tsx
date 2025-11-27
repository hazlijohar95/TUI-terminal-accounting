/**
 * ContactsView Component
 *
 * Visually rich contact management with LHDN compliance indicators,
 * balance visualizations, and btop/lazygit-inspired styling.
 */

import React, { useState, useEffect, useMemo } from "react";
import { Box, Text, useInput, Key } from "ink";
import {
  listCustomers,
  createCustomer,
  updateCustomer,
  type CustomerWithBalance,
} from "../../domain/customers.js";
import { listVendors, createVendor, type VendorWithBalance } from "../../domain/vendors.js";
import { getEnhancedTheme } from "../design/theme.js";
import { indicators, borderStyles } from "../design/tokens.js";
import { useBlinkingCursor } from "../animations.js";
import { ID_TYPES } from "../../services/myinvois/constants.js";
import { HealthIndicator } from "./ui/index.js";

interface ContactsViewProps {
  width: number;
  height: number;
}

type FocusPanel = "customers" | "vendors";
type Mode = "list" | "add" | "edit";
type FormTab = "basic" | "lhdn" | "address";
type FormField =
  | "name"
  | "email"
  | "phone"
  | "tin"
  | "idType"
  | "idNumber"
  | "sstReg"
  | "address";

const ID_TYPE_KEYS = Object.keys(ID_TYPES);

// ============================================================================
// Sub-components
// ============================================================================

interface ContactRowProps {
  item: CustomerWithBalance | VendorWithBalance;
  selected: boolean;
  hasLhdn?: boolean;
  type: "customer" | "vendor";
  width: number;
}

function ContactRow({ item, selected, hasLhdn, type, width }: ContactRowProps) {
  const theme = getEnhancedTheme();
  const balance = item.balance || 0;

  if (selected) {
    return (
      <Box flexDirection="column" marginBottom={1}>
        <Box backgroundColor={theme.semantic.focusBorder}>
          <Text color={theme.base} bold>
            {" ▶ "}{item.name.slice(0, 20)}{" "}
          </Text>
          <Box flexGrow={1} />
          <Text color={theme.base} bold>
            {" $"}{balance.toFixed(0).padStart(6)}{" "}
          </Text>
        </Box>
        <Box paddingLeft={3}>
          {type === "customer" && (
            <Text color={hasLhdn ? theme.semantic.success : theme.semantic.warning}>
              {hasLhdn ? "✓ LHDN Ready" : "○ No TIN"}
            </Text>
          )}
          {item.email && (
            <Text color={theme.semantic.textMuted}> • {item.email.slice(0, 20)}</Text>
          )}
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      <Text color={theme.semantic.textMuted}>{"   "}</Text>
      <Text color={theme.semantic.textPrimary}>{item.name.slice(0, 18).padEnd(19)}</Text>
      <Text color={hasLhdn ? theme.semantic.success : type === "customer" ? theme.semantic.warning : theme.semantic.textMuted}>
        {hasLhdn ? "✓" : type === "customer" ? "○" : " "}
      </Text>
      <Text color={type === "customer" ? theme.semantic.income : theme.semantic.expense}>
        {" $"}{balance.toFixed(0).padStart(6)}
      </Text>
    </Box>
  );
}

interface FormInputFieldProps {
  label: string;
  value: string;
  focused: boolean;
  placeholder?: string;
  width?: number;
}

function FormInputField({ label, value, focused, placeholder, width }: FormInputFieldProps) {
  const theme = getEnhancedTheme();
  const cursorVisible = useBlinkingCursor(500);

  return (
    <Box width={width}>
      <Text color={focused ? theme.semantic.focus : theme.semantic.textMuted}>
        {label}:{" "}
      </Text>
      <Text color={theme.semantic.textPrimary}>
        {value || (focused ? "" : <Text color={theme.semantic.inputPlaceholder}>{placeholder || "-"}</Text>)}
      </Text>
      {focused && cursorVisible && <Text color={theme.semantic.focus}>│</Text>}
    </Box>
  );
}

interface SelectorInputProps {
  label: string;
  value: string;
  focused: boolean;
}

function SelectorInput({ label, value, focused }: SelectorInputProps) {
  const theme = getEnhancedTheme();

  return (
    <Box>
      <Text color={focused ? theme.semantic.focus : theme.semantic.textMuted}>
        {label}:{" "}
      </Text>
      <Text color={theme.semantic.primary}>
        {focused && indicators.arrowLeft + " "}
        {value}
        {focused && " " + indicators.arrowRight}
      </Text>
    </Box>
  );
}

interface TabBarProps {
  tabs: { id: string; label: string }[];
  activeTab: string;
}

function TabBar({ tabs, activeTab }: TabBarProps) {
  const theme = getEnhancedTheme();

  return (
    <Box marginY={1}>
      {tabs.map((tab, idx) => (
        <Text
          key={tab.id}
          backgroundColor={activeTab === tab.id ? theme.semantic.focusBorder : undefined}
          color={activeTab === tab.id ? theme.base : theme.semantic.textMuted}
        >
          {" "}
          {idx + 1}.{tab.label}{" "}
        </Text>
      ))}
    </Box>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ContactsView({ width, height }: ContactsViewProps) {
  const theme = getEnhancedTheme();
  const [customers, setCustomers] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [focusPanel, setFocusPanel] = useState<FocusPanel>("customers");
  const [mode, setMode] = useState<Mode>("list");

  // Selection state
  const [customerIndex, setCustomerIndex] = useState(0);
  const [vendorIndex, setVendorIndex] = useState(0);

  // Form state
  const [activeTab, setActiveTab] = useState<FormTab>("basic");
  const [activeField, setActiveField] = useState<FormField>("name");

  // Form values
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formTin, setFormTin] = useState("");
  const [formIdTypeIndex, setFormIdTypeIndex] = useState(0);
  const [formIdNumber, setFormIdNumber] = useState("");
  const [formSstReg, setFormSstReg] = useState("");
  const [formAddress, setFormAddress] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const panelWidth = Math.floor((width - 3) / 2);
  const listHeight = height - 12;

  // Field definitions per tab
  const tabFields: Record<FormTab, FormField[]> = {
    basic: ["name", "email", "phone"],
    lhdn: ["tin", "idType", "idNumber", "sstReg"],
    address: ["address"],
  };

  const fieldLabels: Record<FormField, string> = {
    name: "Name",
    email: "Email",
    phone: "Phone",
    tin: "TIN (12 digits)",
    idType: "ID Type",
    idNumber: "ID Number",
    sstReg: "SST Registration",
    address: "Address",
  };

  const loadData = () => {
    setCustomers(listCustomers());
    setVendors(listVendors());
  };

  useEffect(() => {
    loadData();
  }, []);

  const showMessage = (type: "success" | "error", text: string, duration = 2000) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), duration);
  };

  const resetForm = () => {
    setFormName("");
    setFormEmail("");
    setFormPhone("");
    setFormTin("");
    setFormIdTypeIndex(0);
    setFormIdNumber("");
    setFormSstReg("");
    setFormAddress("");
    setActiveTab("basic");
    setActiveField("name");
    setEditingId(null);
  };

  const loadCustomerToForm = (customer: CustomerWithBalance) => {
    setFormName(customer.name || "");
    setFormEmail(customer.email || "");
    setFormPhone(customer.phone || "");
    setFormTin(customer.tin || "");
    const idTypeIdx = ID_TYPE_KEYS.indexOf(customer.id_type || "NRIC");
    setFormIdTypeIndex(idTypeIdx >= 0 ? idTypeIdx : 0);
    setFormIdNumber(customer.id_number || "");
    setFormSstReg(customer.sst_registration || "");
    setFormAddress(customer.address || "");
    setEditingId(customer.id);
  };

  const getFieldValue = (field: FormField): string => {
    switch (field) {
      case "name":
        return formName;
      case "email":
        return formEmail;
      case "phone":
        return formPhone;
      case "tin":
        return formTin;
      case "idType":
        return ID_TYPE_KEYS[formIdTypeIndex];
      case "idNumber":
        return formIdNumber;
      case "sstReg":
        return formSstReg;
      case "address":
        return formAddress;
    }
  };

  const setFieldValue = (field: FormField, value: string) => {
    switch (field) {
      case "name":
        setFormName(value);
        break;
      case "email":
        setFormEmail(value);
        break;
      case "phone":
        setFormPhone(value);
        break;
      case "tin":
        setFormTin(value);
        break;
      case "idNumber":
        setFormIdNumber(value);
        break;
      case "sstReg":
        setFormSstReg(value);
        break;
      case "address":
        setFormAddress(value);
        break;
    }
  };

  const handleSave = () => {
    if (!formName.trim()) {
      showMessage("error", "Name is required");
      return;
    }

    try {
      const data = {
        name: formName.trim(),
        email: formEmail.trim() || undefined,
        phone: formPhone.trim() || undefined,
        address: formAddress.trim() || undefined,
        tin: formTin.trim() || undefined,
        id_type: ID_TYPE_KEYS[formIdTypeIndex],
        id_number: formIdNumber.trim() || undefined,
        sst_registration: formSstReg.trim() || undefined,
      };

      if (focusPanel === "customers") {
        if (editingId) {
          updateCustomer(editingId, data);
          showMessage("success", "Customer updated!");
        } else {
          createCustomer(data);
          showMessage("success", "Customer added!");
        }
      } else {
        createVendor({
          name: data.name,
          email: data.email,
          phone: data.phone,
          address: data.address,
        });
        showMessage("success", "Vendor added!");
      }

      resetForm();
      setMode("list");
      loadData();
    } catch (err) {
      showMessage("error", (err as Error).message, 3000);
    }
  };

  const moveToNextField = () => {
    const currentFields = tabFields[activeTab];
    const currentIndex = currentFields.indexOf(activeField);
    if (currentIndex < currentFields.length - 1) {
      setActiveField(currentFields[currentIndex + 1]);
    } else {
      const tabs: FormTab[] = ["basic", "lhdn", "address"];
      const tabIndex = tabs.indexOf(activeTab);
      if (tabIndex < tabs.length - 1) {
        const nextTab = tabs[tabIndex + 1];
        setActiveTab(nextTab);
        setActiveField(tabFields[nextTab][0]);
      }
    }
  };

  const moveToPrevField = () => {
    const currentFields = tabFields[activeTab];
    const currentIndex = currentFields.indexOf(activeField);
    if (currentIndex > 0) {
      setActiveField(currentFields[currentIndex - 1]);
    } else {
      const tabs: FormTab[] = ["basic", "lhdn", "address"];
      const tabIndex = tabs.indexOf(activeTab);
      if (tabIndex > 0) {
        const prevTab = tabs[tabIndex - 1];
        setActiveTab(prevTab);
        const prevFields = tabFields[prevTab];
        setActiveField(prevFields[prevFields.length - 1]);
      }
    }
  };

  // Keyboard handling
  useInput((input, key) => {
    // Tab to switch panels (only in list mode)
    if (key.tab && mode === "list") {
      setFocusPanel((prev) => (prev === "customers" ? "vendors" : "customers"));
      return;
    }

    // Escape to cancel add/edit mode
    if (key.escape && (mode === "add" || mode === "edit")) {
      resetForm();
      setMode("list");
      return;
    }

    if (mode === "list") {
      // Navigation
      if (key.upArrow || input === "k") {
        if (focusPanel === "customers") {
          setCustomerIndex((prev) => Math.max(0, prev - 1));
        } else {
          setVendorIndex((prev) => Math.max(0, prev - 1));
        }
      }
      if (key.downArrow || input === "j") {
        if (focusPanel === "customers") {
          setCustomerIndex((prev) => Math.min(customers.length - 1, prev + 1));
        } else {
          setVendorIndex((prev) => Math.min(vendors.length - 1, prev + 1));
        }
      }

      // Add new
      if (input === "n") {
        resetForm();
        setMode("add");
      }

      // Edit existing (customers only for LHDN fields)
      if (input === "e" && focusPanel === "customers" && customers[customerIndex]) {
        loadCustomerToForm(customers[customerIndex]);
        setMode("edit");
      }
    } else {
      // Add/Edit mode - form input
      handleFormInput(input, key);
    }
  });

  const handleFormInput = (input: string, key: Key) => {
    // Tab switching with number keys
    if (input === "1") {
      setActiveTab("basic");
      setActiveField(tabFields.basic[0]);
      return;
    }
    if (input === "2" && focusPanel === "customers") {
      setActiveTab("lhdn");
      setActiveField(tabFields.lhdn[0]);
      return;
    }
    if (input === "3" || (input === "2" && focusPanel === "vendors")) {
      setActiveTab("address");
      setActiveField(tabFields.address[0]);
      return;
    }

    // Save with Ctrl+S
    if (key.ctrl && input === "s") {
      handleSave();
      return;
    }

    // Navigation between fields
    if (key.downArrow) {
      moveToNextField();
      return;
    }
    if (key.upArrow) {
      moveToPrevField();
      return;
    }

    // Enter to move to next field or save on last
    if (key.return) {
      const tabs: FormTab[] =
        focusPanel === "customers"
          ? ["basic", "lhdn", "address"]
          : ["basic", "address"];
      const isLastTab = activeTab === tabs[tabs.length - 1];
      const currentFields = tabFields[activeTab];
      const isLastField = activeField === currentFields[currentFields.length - 1];

      if (isLastTab && isLastField) {
        handleSave();
      } else {
        moveToNextField();
      }
      return;
    }

    // ID Type selector with left/right arrows
    if (activeField === "idType") {
      if (key.leftArrow) {
        setFormIdTypeIndex((prev) => Math.max(0, prev - 1));
        return;
      }
      if (key.rightArrow) {
        setFormIdTypeIndex((prev) => Math.min(ID_TYPE_KEYS.length - 1, prev + 1));
        return;
      }
    }

    // Backspace
    if (key.backspace || key.delete) {
      if (activeField !== "idType") {
        const currentValue = getFieldValue(activeField);
        setFieldValue(activeField, currentValue.slice(0, -1));
      }
      return;
    }

    // Character input (except for selector fields)
    if (input && !key.ctrl && !key.meta && activeField !== "idType") {
      // TIN validation: only digits, max 12
      if (activeField === "tin") {
        if (/^\d$/.test(input) && formTin.length < 12) {
          setFormTin((prev) => prev + input);
        }
        return;
      }

      const currentValue = getFieldValue(activeField);
      setFieldValue(activeField, currentValue + input);
    }
  };

  // Calculate summary stats
  const customerTotal = customers.reduce((s, c) => s + (c.balance || 0), 0);
  const vendorTotal = vendors.reduce((s, v) => s + (v.balance || 0), 0);

  // LHDN compliance stats
  const lhdnReadyCount = customers.filter((c) => c.tin).length;
  const lhdnCompliancePercent = customers.length > 0 ? Math.round((lhdnReadyCount / customers.length) * 100) : 0;

  return (
    <Box flexDirection="row" width={width} height={height}>
      {/* Left Panel - Customers */}
      <Box
        flexDirection="column"
        width={panelWidth}
        height={height}
        borderStyle={borderStyles.panel}
        borderColor={
          focusPanel === "customers"
            ? theme.semantic.focusBorder
            : theme.semantic.border
        }
        paddingX={1}
      >
        {/* Header with stats */}
        <Box justifyContent="space-between" marginBottom={1}>
          <Text bold color={theme.semantic.primary}>◆ Customers</Text>
          <Text color={theme.semantic.textMuted}>{customers.length}</Text>
        </Box>

        {/* LHDN Compliance Visual */}
        {customers.length > 0 && (
          <Box flexDirection="column" marginBottom={1}>
            <Box justifyContent="space-between">
              <Text color={theme.semantic.textMuted}>LHDN Ready:</Text>
              <Text color={lhdnCompliancePercent >= 80 ? theme.semantic.success : theme.semantic.warning}>
                {lhdnReadyCount}/{customers.length} ({lhdnCompliancePercent}%)
              </Text>
            </Box>
          </Box>
        )}

        {/* Divider */}
        <Text color={theme.semantic.border}>{"─".repeat(panelWidth - 4)}</Text>

        {/* Hints */}
        <Box marginY={1}>
          <Text color={theme.semantic.textMuted}>
            <Text color={theme.semantic.success}>n</Text> add • e edit • j/k ↕ • Tab →
          </Text>
        </Box>

        {/* Content */}
        {(mode === "add" || mode === "edit") && focusPanel === "customers" ? (
          <ContactForm
            mode={mode}
            isCustomer={true}
            activeTab={activeTab}
            activeField={activeField}
            formName={formName}
            formEmail={formEmail}
            formPhone={formPhone}
            formTin={formTin}
            formIdTypeIndex={formIdTypeIndex}
            formIdNumber={formIdNumber}
            formSstReg={formSstReg}
            formAddress={formAddress}
            theme={theme}
          />
        ) : (
          <>
            <ContactList
              items={customers}
              selectedIndex={customerIndex}
              isFocused={focusPanel === "customers"}
              type="customer"
              listHeight={listHeight}
              width={panelWidth - 4}
            />
            {focusPanel === "customers" && customers[customerIndex] && (
              <ContactDetail
                item={customers[customerIndex]}
                type="customer"
                theme={theme}
              />
            )}
          </>
        )}

        {/* Footer */}
        <Box flexGrow={1} />
        <Box
          borderStyle={borderStyles.subtle}
          borderColor={theme.semantic.border}
          borderTop
          borderBottom={false}
          borderLeft={false}
          borderRight={false}
          paddingTop={1}
        >
          <Text color={theme.semantic.textMuted}>
            {customers.length} customers {indicators.bullet}{" "}
            <Text color={theme.semantic.success}>${customerTotal.toFixed(2)}</Text> owed
          </Text>
        </Box>
      </Box>

      <Box width={1} />

      {/* Right Panel - Vendors */}
      <Box
        flexDirection="column"
        width={panelWidth}
        height={height}
        borderStyle={borderStyles.panel}
        borderColor={
          focusPanel === "vendors"
            ? theme.semantic.focusBorder
            : theme.semantic.border
        }
        paddingX={1}
      >
        {/* Header with stats */}
        <Box justifyContent="space-between" marginBottom={1}>
          <Text bold color={theme.semantic.warning}>◆ Vendors</Text>
          <Text color={theme.semantic.textMuted}>{vendors.length}</Text>
        </Box>

        {/* Summary */}
        {vendors.length > 0 && (
          <Box flexDirection="column" marginBottom={1}>
            <Box justifyContent="space-between">
              <Text color={theme.semantic.textMuted}>Unpaid:</Text>
              <Text color={theme.semantic.expense}>${vendorTotal.toFixed(0)}</Text>
            </Box>
          </Box>
        )}

        {/* Divider */}
        <Text color={theme.semantic.border}>{"─".repeat(panelWidth - 4)}</Text>

        {/* Hints */}
        <Box marginY={1}>
          <Text color={theme.semantic.textMuted}>
            <Text color={theme.semantic.success}>n</Text> add • j/k ↕ • Tab ←
          </Text>
        </Box>

        {/* Content */}
        {(mode === "add" || mode === "edit") && focusPanel === "vendors" ? (
          <ContactForm
            mode={mode}
            isCustomer={false}
            activeTab={activeTab}
            activeField={activeField}
            formName={formName}
            formEmail={formEmail}
            formPhone={formPhone}
            formTin={formTin}
            formIdTypeIndex={formIdTypeIndex}
            formIdNumber={formIdNumber}
            formSstReg={formSstReg}
            formAddress={formAddress}
            theme={theme}
          />
        ) : (
          <>
            <ContactList
              items={vendors}
              selectedIndex={vendorIndex}
              isFocused={focusPanel === "vendors"}
              type="vendor"
              listHeight={listHeight}
              width={panelWidth - 4}
            />
            {focusPanel === "vendors" && vendors[vendorIndex] && (
              <ContactDetail
                item={vendors[vendorIndex]}
                type="vendor"
                theme={theme}
              />
            )}
          </>
        )}

        {/* Footer */}
        <Box flexGrow={1} />
        <Box
          borderStyle={borderStyles.subtle}
          borderColor={theme.semantic.border}
          borderTop
          borderBottom={false}
          borderLeft={false}
          borderRight={false}
          paddingTop={1}
        >
          <Text color={theme.semantic.textMuted}>
            {vendors.length} vendors {indicators.bullet}{" "}
            <Text color={theme.semantic.expense}>${vendorTotal.toFixed(2)}</Text> unpaid
          </Text>
        </Box>
      </Box>

      {/* Message overlay */}
      {message && (
        <Box position="absolute" marginTop={height - 3} marginLeft={2}>
          <Text
            color={
              message.type === "success"
                ? theme.semantic.success
                : theme.semantic.error
            }
          >
            {message.type === "success" ? indicators.check : indicators.warning}{" "}
            {message.text}
          </Text>
        </Box>
      )}
    </Box>
  );
}

// ============================================================================
// Contact List Component
// ============================================================================

interface ContactListProps {
  items: (CustomerWithBalance | VendorWithBalance)[];
  selectedIndex: number;
  isFocused: boolean;
  type: "customer" | "vendor";
  listHeight: number;
  width: number;
}

function ContactList({
  items,
  selectedIndex,
  isFocused,
  type,
  listHeight,
  width,
}: ContactListProps) {
  const theme = getEnhancedTheme();

  if (items.length === 0) {
    return (
      <Box flexDirection="column" paddingY={2} alignItems="center">
        <Text color={theme.semantic.textMuted}>No {type}s yet</Text>
        <Box marginTop={1}>
          <Text color={theme.semantic.textMuted}>Press </Text>
          <Text bold color={theme.semantic.success}>n</Text>
          <Text color={theme.semantic.textMuted}> to add one</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" overflowY="hidden">
      {items.slice(0, listHeight).map((item, i) => {
        const hasLhdn = type === "customer" && "tin" in item && !!item.tin;
        return (
          <ContactRow
            key={item.id}
            item={item}
            selected={i === selectedIndex && isFocused}
            hasLhdn={hasLhdn}
            type={type}
            width={width}
          />
        );
      })}
    </Box>
  );
}

// ============================================================================
// Contact Detail Component
// ============================================================================

interface ContactDetailProps {
  item: CustomerWithBalance | VendorWithBalance | null;
  type: "customer" | "vendor";
  theme: ReturnType<typeof getEnhancedTheme>;
}

function ContactDetail({ item, type, theme }: ContactDetailProps) {
  if (!item) return null;

  // Type guard for customer-specific properties
  const isCustomer = (contact: CustomerWithBalance | VendorWithBalance): contact is CustomerWithBalance => {
    return type === "customer";
  };

  return (
    <Box flexDirection="column" marginTop={1} paddingX={1}>
      <Text color={theme.semantic.border}>─────────────────</Text>
      {item.email && (
        <Text color={theme.semantic.textMuted}>Email: {item.email}</Text>
      )}
      {item.phone && (
        <Text color={theme.semantic.textMuted}>Phone: {item.phone}</Text>
      )}
      {item.address && (
        <Text color={theme.semantic.textMuted}>Addr: {item.address}</Text>
      )}
      {isCustomer(item) && (
        <>
          {item.tin && <Text color={theme.semantic.success}>TIN: {item.tin}</Text>}
          {item.id_type && (
            <Text color={theme.semantic.textMuted}>
              ID: {item.id_type} {item.id_number}
            </Text>
          )}
          {item.sst_registration && (
            <Text color={theme.semantic.textMuted}>SST: {item.sst_registration}</Text>
          )}
          {!item.tin && (
            <Text color={theme.semantic.warning}>
              {indicators.warning} No TIN (required for e-Invoice)
            </Text>
          )}
        </>
      )}
    </Box>
  );
}

// ============================================================================
// Contact Form Component
// ============================================================================

interface ContactFormProps {
  mode: Mode;
  isCustomer: boolean;
  activeTab: FormTab;
  activeField: FormField;
  formName: string;
  formEmail: string;
  formPhone: string;
  formTin: string;
  formIdTypeIndex: number;
  formIdNumber: string;
  formSstReg: string;
  formAddress: string;
  theme: ReturnType<typeof getEnhancedTheme>;
}

function ContactForm({
  mode,
  isCustomer,
  activeTab,
  activeField,
  formName,
  formEmail,
  formPhone,
  formTin,
  formIdTypeIndex,
  formIdNumber,
  formSstReg,
  formAddress,
  theme,
}: ContactFormProps) {
  const tabs = isCustomer
    ? [
        { id: "basic", label: "Basic" },
        { id: "lhdn", label: "LHDN" },
        { id: "address", label: "Address" },
      ]
    : [
        { id: "basic", label: "Basic" },
        { id: "address", label: "Address" },
      ];

  const renderField = (field: FormField) => {
    if (!isCustomer && ["tin", "idType", "idNumber", "sstReg"].includes(field)) {
      return null;
    }

    const fieldLabels: Record<FormField, string> = {
      name: "Name",
      email: "Email",
      phone: "Phone",
      tin: "TIN (12 digits)",
      idType: "ID Type",
      idNumber: "ID Number",
      sstReg: "SST Registration",
      address: "Address",
    };

    const values: Record<FormField, string> = {
      name: formName,
      email: formEmail,
      phone: formPhone,
      tin: formTin,
      idType: ID_TYPES[ID_TYPE_KEYS[formIdTypeIndex]],
      idNumber: formIdNumber,
      sstReg: formSstReg,
      address: formAddress,
    };

    if (field === "idType") {
      return (
        <SelectorInput
          key={field}
          label={fieldLabels[field]}
          value={values[field]}
          focused={activeField === field}
        />
      );
    }

    return (
      <FormInputField
        key={field}
        label={fieldLabels[field]}
        value={values[field]}
        focused={activeField === field}
      />
    );
  };

  const tabFields: Record<FormTab, FormField[]> = {
    basic: ["name", "email", "phone"],
    lhdn: ["tin", "idType", "idNumber", "sstReg"],
    address: ["address"],
  };

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Text color={theme.semantic.focus} bold>
        {mode === "edit" ? "Edit" : "Add"} {isCustomer ? "Customer" : "Vendor"}
      </Text>

      {/* Tab Bar */}
      <TabBar tabs={tabs} activeTab={activeTab} />

      {/* Form Fields */}
      <Box
        flexDirection="column"
        borderStyle={borderStyles.subtle}
        borderColor={theme.semantic.border}
        paddingX={1}
      >
        {tabFields[activeTab].map(renderField)}
      </Box>

      {/* Help Text */}
      {activeTab === "lhdn" && activeField === "idType" && (
        <Box marginTop={1}>
          <Text color={theme.semantic.textMuted}>
            Use ←/→: {ID_TYPE_KEYS.join(", ")}
          </Text>
        </Box>
      )}

      {activeTab === "lhdn" && activeField === "tin" && (
        <Box marginTop={1}>
          <Text color={theme.semantic.textMuted}>
            12-digit Tax ID from LHDN
          </Text>
        </Box>
      )}

      {/* Footer Hints */}
      <Box marginTop={1}>
        <Text color={theme.semantic.textMuted}>
          ↑↓ fields {indicators.bullet} 1-{tabs.length} tabs {indicators.bullet}{" "}
          Ctrl+S save {indicators.bullet} Esc cancel
        </Text>
      </Box>
    </Box>
  );
}
