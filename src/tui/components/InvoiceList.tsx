/**
 * InvoiceList Component
 *
 * Visually rich invoice management with sparklines, gauges,
 * and btop/lazygit-inspired data visualization.
 */

import React, { useState, useEffect, useMemo } from "react";
import { Box, Text, useInput, Key } from "ink";
import {
  listInvoices,
  createInvoice,
  getInvoice,
  updateInvoiceStatus,
  recordPaymentToInvoice,
  Invoice,
} from "../../domain/invoices.js";
import {
  listCustomers,
  createCustomer,
  updateCustomer,
  getCustomer,
  type Customer,
  type CustomerWithBalance,
} from "../../domain/customers.js";
import {
  getDocumentsForInvoice,
  getUnlinkedDocuments,
  linkDocumentToInvoice,
  type Document,
} from "../../domain/documents.js";
import { isEmailConfigured, sendInvoiceEmail } from "../../services/email.js";
import {
  generateInvoicePDF,
  updateInvoiceEmailStatus,
} from "../../services/pdf.js";

import { getEnhancedTheme } from "../design/theme.js";
import { indicators, spacing, borderStyles } from "../design/tokens.js";
import { useBlinkingCursor } from "../animations.js";
import { Sparkline, Gauge, ChartProgressBar as ProgressBar } from "./ui/index.js";
import { EInvoiceView } from "./EInvoiceView.js";
import {
  EINVOICE_STATUS_LABELS,
  CURRENCY_CODES,
  PAYMENT_MODE_LABELS,
  CLASSIFICATION_CODES,
  TAX_TYPE_LABELS,
  UNIT_CODES,
} from "../../services/myinvois/constants.js";
import type { EInvoiceStatus } from "../../services/myinvois/types.js";

// LHDN constants arrays for selectors
const CURRENCY_KEYS = Object.keys(CURRENCY_CODES);
const PAYMENT_MODE_KEYS = Object.keys(PAYMENT_MODE_LABELS);
const CLASSIFICATION_KEYS = Object.keys(CLASSIFICATION_CODES);
const TAX_TYPE_KEYS = Object.keys(TAX_TYPE_LABELS);
const UNIT_CODE_KEYS = Object.keys(UNIT_CODES);

interface InvoiceListProps {
  width: number;
  height: number;
}

interface LineItem {
  description: string;
  quantity: string;
  unitPrice: string;
  classificationCode: string;
  taxType: string;
  unitCode: string;
}

type FocusArea = "list" | "form" | "detail" | "payment" | "attach" | "einvoice";
type FormField =
  | "customer"
  | "address"
  | "dueDate"
  | "currency"
  | "paymentMode"
  | "taxRate"
  | "notes"
  | "itemDesc"
  | "itemQty"
  | "itemPrice"
  | "itemClassification"
  | "itemTaxType"
  | "itemUnitCode";

// ============================================================================
// Sub-components
// ============================================================================

interface StatusBadgeProps {
  status: string;
  einvoiceStatus?: EInvoiceStatus;
  hasEmail?: boolean;
  hasDocuments?: boolean;
}

function StatusBadge({ status, einvoiceStatus, hasEmail, hasDocuments }: StatusBadgeProps) {
  const theme = getEnhancedTheme();

  const getStatusConfig = (s: string) => {
    switch (s) {
      case "draft":
        return { icon: indicators.pending, color: theme.semantic.textMuted, label: "DRAFT" };
      case "sent":
        return { icon: indicators.complete, color: theme.semantic.info, label: "SENT" };
      case "partial":
        return { icon: indicators.partial, color: theme.semantic.warning, label: "PARTIAL" };
      case "paid":
        return { icon: indicators.complete, color: theme.semantic.success, label: "PAID" };
      case "overdue":
        return { icon: indicators.complete, color: theme.semantic.error, label: "OVERDUE" };
      case "cancelled":
        return { icon: indicators.pending, color: theme.semantic.textMuted, label: "CANCELLED" };
      default:
        return { icon: " ", color: theme.semantic.textSecondary, label: s.toUpperCase() };
    }
  };

  const config = getStatusConfig(status);
  const eInvoiceIcon = getEInvoiceIcon(einvoiceStatus);
  const eInvoiceColor = getEInvoiceColor(einvoiceStatus);

  return (
    <Box>
      {hasEmail && <Text color={theme.semantic.success}>✉</Text>}
      {hasDocuments && <Text color={theme.semantic.textMuted}>📎</Text>}
      {einvoiceStatus && einvoiceStatus !== "none" && (
        <Text color={eInvoiceColor}>{eInvoiceIcon}</Text>
      )}
      <Text color={config.color}>
        {config.icon} {config.label}
      </Text>
    </Box>
  );
}

interface InvoiceRowProps {
  invoice: Invoice;
  selected: boolean;
  einvoiceStatus?: EInvoiceStatus;
  hasEmail: boolean;
  hasDocuments: boolean;
  width: number;
}

function InvoiceRow({ invoice, selected, einvoiceStatus, hasEmail, hasDocuments, width }: InvoiceRowProps) {
  const theme = getEnhancedTheme();
  const paidPercent = invoice.total > 0 ? Math.round((invoice.amount_paid / invoice.total) * 100) : 0;
  const statusIcon = getStatusIcon(invoice.status);
  const statusColor = getStatusColor(invoice.status);

  // Payment progress bar chars
  const progressWidth = 6;
  const filledBlocks = Math.round((paidPercent / 100) * progressWidth);
  const progressBar = "█".repeat(filledBlocks) + "░".repeat(progressWidth - filledBlocks);

  if (selected) {
    return (
      <Box flexDirection="column" marginBottom={1}>
        <Box backgroundColor={theme.semantic.focusBorder}>
          <Text color={theme.base} bold>
            {" ▶ "}
            {invoice.number}
            {" "}
          </Text>
          <Text color={theme.base}>
            {invoice.customer_name?.slice(0, 15) || "—"}
          </Text>
          <Box flexGrow={1} />
          <Text color={theme.base} bold>
            {" $"}{invoice.total.toFixed(0).padStart(6)}{" "}
          </Text>
        </Box>
        <Box paddingLeft={3}>
          <Text color={statusColor}>{statusIcon} {invoice.status.toUpperCase()}</Text>
          {invoice.amount_paid > 0 && invoice.status !== "paid" && (
            <Text color={theme.semantic.textMuted}>
              {" "}• <Text color={theme.semantic.success}>{progressBar}</Text> {paidPercent}%
            </Text>
          )}
          {hasEmail && <Text color={theme.semantic.success}> ✉</Text>}
          {hasDocuments && <Text color={theme.semantic.textMuted}> 📎</Text>}
          {einvoiceStatus && einvoiceStatus !== "none" && (
            <Text color={getEInvoiceColor(einvoiceStatus)}> {getEInvoiceIcon(einvoiceStatus)}</Text>
          )}
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      <Text color={theme.semantic.textMuted}>{"   "}</Text>
      <Text color={theme.semantic.textPrimary}>{invoice.number.padEnd(9)}</Text>
      <Text color={theme.semantic.textSecondary}>{(invoice.customer_name || "—").slice(0, 12).padEnd(13)}</Text>
      <Text color={statusColor}>{statusIcon}</Text>
      <Text color={theme.semantic.income}> ${invoice.total.toFixed(0).padStart(6)}</Text>
      {invoice.amount_paid > 0 && invoice.status !== "paid" && (
        <Text color={theme.semantic.textMuted}> {paidPercent}%</Text>
      )}
    </Box>
  );
}

function getStatusIcon(status: string): string {
  switch (status) {
    case "paid": return "✓";
    case "sent": return "→";
    case "draft": return "○";
    case "partial": return "◐";
    case "overdue": return "!";
    case "cancelled": return "×";
    default: return "·";
  }
}

interface FormInputProps {
  label: string;
  value: string;
  focused: boolean;
  width?: number;
  placeholder?: string;
}

function FormInput({ label, value, focused, width, placeholder }: FormInputProps) {
  const theme = getEnhancedTheme();
  const cursorVisible = useBlinkingCursor(500);

  return (
    <Box width={width}>
      <Text color={focused ? theme.semantic.focus : theme.semantic.textMuted}>{label}: </Text>
      <Text color={theme.semantic.textPrimary}>
        {value || <Text color={theme.semantic.inputPlaceholder}>{placeholder || ""}</Text>}
      </Text>
      {focused && cursorVisible && <Text color={theme.semantic.focus}>│</Text>}
    </Box>
  );
}

interface SelectorFieldProps {
  label: string;
  value: string;
  focused: boolean;
  width?: number;
}

function SelectorField({ label, value, focused, width }: SelectorFieldProps) {
  const theme = getEnhancedTheme();

  return (
    <Box width={width}>
      <Text color={focused ? theme.semantic.focus : theme.semantic.textMuted}>{label}: </Text>
      <Text color={theme.semantic.primary}>
        {focused && indicators.arrowLeft + " "}
        {value}
        {focused && " " + indicators.arrowRight}
      </Text>
    </Box>
  );
}

interface KeyValueRowProps {
  label: string;
  value: React.ReactNode;
  labelWidth?: number;
}

function KeyValueRow({ label, value, labelWidth = 12 }: KeyValueRowProps) {
  const theme = getEnhancedTheme();

  return (
    <Box>
      <Box width={labelWidth}>
        <Text color={theme.semantic.textMuted}>{label}</Text>
      </Box>
      {typeof value === "string" ? <Text>{value}</Text> : value}
    </Box>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function InvoiceList({ width, height }: InvoiceListProps) {
  const theme = getEnhancedTheme();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [focusArea, setFocusArea] = useState<FocusArea>("list");
  const [activeField, setActiveField] = useState<FormField>("customer");

  // Detail view state
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [unlinkedDocs, setUnlinkedDocs] = useState<any[]>([]);
  const [docIndex, setDocIndex] = useState(0);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Form state
  const [customerName, setCustomerName] = useState("");
  const [address, setAddress] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [taxRate, setTaxRate] = useState("");
  const [notes, setNotes] = useState("");

  // LHDN invoice-level selectors
  const [currencyIndex, setCurrencyIndex] = useState(0);
  const [paymentModeIndex, setPaymentModeIndex] = useState(2);

  // Line items with LHDN fields
  const [items, setItems] = useState<LineItem[]>([
    {
      description: "",
      quantity: "1",
      unitPrice: "",
      classificationCode: "002",
      taxType: "E",
      unitCode: "EA",
    },
  ]);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [showItemLhdnFields, setShowItemLhdnFields] = useState(false);

  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Form fields configuration
  const baseFormFields: FormField[] = [
    "customer",
    "address",
    "dueDate",
    "currency",
    "paymentMode",
    "itemDesc",
    "itemQty",
    "itemPrice",
    "taxRate",
    "notes",
  ];
  const itemLhdnFields: FormField[] = [
    "itemClassification",
    "itemTaxType",
    "itemUnitCode",
  ];
  const formFields: FormField[] = showItemLhdnFields
    ? [...baseFormFields.slice(0, 8), ...itemLhdnFields, ...baseFormFields.slice(8)]
    : baseFormFields;

  // Layout dimensions
  const listWidth = Math.floor(width * 0.35);
  const detailWidth = width - listWidth - 3;

  // Calculate totals
  const formTotal = useMemo(() => {
    return items.reduce((sum, item) => {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unitPrice) || 0;
      return sum + qty * price;
    }, 0);
  }, [items]);

  const loadInvoices = () => {
    const invs = listInvoices({});
    setInvoices(invs);
    setUnlinkedDocs(getUnlinkedDocuments());
    if (selectedInvoice && invs.length > 0) {
      const updated = getInvoice(selectedInvoice.id);
      setSelectedInvoice(updated || null);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, []);

  useEffect(() => {
    if (invoices.length > 0 && selectedIndex < invoices.length) {
      const inv = getInvoice(invoices[selectedIndex].id);
      setSelectedInvoice(inv || null);
    }
  }, [selectedIndex, invoices]);

  const resetForm = () => {
    setCustomerName("");
    setAddress("");
    setDueDate("");
    setTaxRate("");
    setNotes("");
    setCurrencyIndex(0);
    setPaymentModeIndex(2);
    setItems([
      {
        description: "",
        quantity: "1",
        unitPrice: "",
        classificationCode: "002",
        taxType: "E",
        unitCode: "EA",
      },
    ]);
    setCurrentItemIndex(0);
    setShowItemLhdnFields(false);
  };

  const showMessage = (type: "success" | "error", text: string, duration = 2000) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), duration);
  };

  const addLineItem = () => {
    setItems([
      ...items,
      {
        description: "",
        quantity: "1",
        unitPrice: "",
        classificationCode: "002",
        taxType: "E",
        unitCode: "EA",
      },
    ]);
    setCurrentItemIndex(items.length);
    setActiveField("itemDesc");
  };

  const updateCurrentItem = (field: keyof LineItem, value: string) => {
    const newItems = [...items];
    newItems[currentItemIndex] = { ...newItems[currentItemIndex], [field]: value };
    setItems(newItems);
  };

  const handleSubmit = () => {
    if (!customerName.trim()) {
      showMessage("error", "Customer name required");
      return;
    }

    const validItems = items.filter(
      (item) => item.unitPrice && parseFloat(item.unitPrice) > 0
    );
    if (validItems.length === 0) {
      showMessage("error", "At least one item with price required");
      return;
    }

    try {
      const customers = listCustomers();
      let customer: CustomerWithBalance | Customer | undefined = customers.find(
        (c) => c.name.toLowerCase() === customerName.trim().toLowerCase()
      );

      if (!customer) {
        customer = createCustomer({
          name: customerName.trim(),
          address: address.trim() || undefined,
        });
      } else if (address.trim() && customer.address !== address.trim()) {
        updateCustomer(customer.id, { address: address.trim() });
      }

      const invoiceData = {
        customer_id: customer.id,
        due_date: dueDate || undefined,
        tax_rate: taxRate ? parseFloat(taxRate) : undefined,
        notes: notes || undefined,
        currency_code: CURRENCY_KEYS[currencyIndex],
        payment_mode: PAYMENT_MODE_KEYS[paymentModeIndex],
        items: validItems.map((item) => ({
          description: item.description || "Services",
          quantity: parseFloat(item.quantity) || 1,
          unit_price: parseFloat(item.unitPrice),
          classification_code: item.classificationCode || "002",
          tax_type: item.taxType || "E",
          unit_code: item.unitCode || "EA",
        })),
      };

      createInvoice(invoiceData);
      showMessage("success", "Invoice created!");
      resetForm();
      loadInvoices();
    } catch (err) {
      showMessage("error", (err as Error).message);
    }
  };

  // Keyboard handling
  useInput((input, key) => {
    // Escape to go back
    if (key.escape) {
      if (focusArea === "payment" || focusArea === "attach" || focusArea === "einvoice") {
        setFocusArea("detail");
        setPaymentAmount("");
      } else if (focusArea === "form") {
        setFocusArea("list");
      } else if (focusArea === "detail") {
        setFocusArea("list");
      }
      return;
    }

    // Tab to switch between areas
    if (key.tab) {
      if (focusArea === "list") {
        setFocusArea(invoices.length > 0 ? "detail" : "form");
      } else {
        setFocusArea("list");
      }
      return;
    }

    // Payment mode
    if (focusArea === "payment") {
      if (key.return && paymentAmount.trim()) {
        const amount = parseFloat(paymentAmount);
        if (!isNaN(amount) && amount > 0 && selectedInvoice) {
          recordPaymentToInvoice(selectedInvoice.id, amount);
          showMessage("success", `Payment of $${amount.toFixed(2)} recorded!`);
          setPaymentAmount("");
          setFocusArea("detail");
          loadInvoices();
        }
        return;
      }
      if (key.backspace) {
        setPaymentAmount((prev) => prev.slice(0, -1));
        return;
      }
      if (input && /[\d.]/.test(input)) {
        setPaymentAmount((prev) => prev + input);
      }
      return;
    }

    // Attach mode
    if (focusArea === "attach") {
      if (key.leftArrow || input === "h") {
        setDocIndex((prev) => Math.max(0, prev - 1));
        return;
      }
      if (key.rightArrow || input === "l") {
        setDocIndex((prev) => Math.min(unlinkedDocs.length - 1, prev + 1));
        return;
      }
      if (key.return && unlinkedDocs[docIndex] && selectedInvoice) {
        linkDocumentToInvoice(unlinkedDocs[docIndex].id, selectedInvoice.id);
        showMessage("success", "Document attached!");
        setFocusArea("detail");
        loadInvoices();
      }
      return;
    }

    // List/Detail navigation
    if (focusArea === "list" || focusArea === "detail") {
      if (key.upArrow || input === "k") {
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      }
      if (key.downArrow || input === "j") {
        setSelectedIndex((prev) => Math.min(invoices.length - 1, prev + 1));
      }
      if (input === "n") {
        setFocusArea("form");
        setActiveField("customer");
      }
      if ((key.return || input === "v") && invoices.length > 0) {
        setFocusArea("detail");
      }
      if (input === "s" && selectedInvoice && selectedInvoice.status === "draft") {
        updateInvoiceStatus(selectedInvoice.id, "sent");
        showMessage("success", "Invoice marked as sent!");
        loadInvoices();
      }
      if (
        input === "p" &&
        selectedInvoice &&
        selectedInvoice.status !== "paid" &&
        selectedInvoice.status !== "cancelled"
      ) {
        setFocusArea("payment");
        setPaymentAmount("");
      }
      if (input === "a" && selectedInvoice && unlinkedDocs.length > 0) {
        setFocusArea("attach");
        setDocIndex(0);
      }
      if (input === "e" && selectedInvoice) {
        setFocusArea("einvoice");
      }
      if (input === "m" && selectedInvoice && !isSendingEmail) {
        handleEmailInvoice();
      }
    } else if (focusArea === "einvoice") {
      if (key.escape || input === "q") {
        setFocusArea("detail");
      }
    } else if (focusArea === "form") {
      handleFormInput(input, key);
    }
  });

  const handleEmailInvoice = async () => {
    if (!selectedInvoice) return;

    if (!isEmailConfigured()) {
      showMessage("error", "Email not configured. Set resend_api_key and from_email.", 3000);
      return;
    }
    const customer = getCustomer(selectedInvoice.customer_id);
    if (!customer?.email) {
      showMessage("error", "Customer has no email address.");
      return;
    }

    setIsSendingEmail(true);
    showMessage("success", "Generating PDF and sending...");

    try {
      const pdfBuffer = await generateInvoicePDF(selectedInvoice.id);
      const result = await sendInvoiceEmail(
        customer.email!,
        selectedInvoice.number,
        customer.name,
        selectedInvoice.total - selectedInvoice.amount_paid,
        selectedInvoice.due_date,
        pdfBuffer
      );

      if (result.success) {
        updateInvoiceEmailStatus(selectedInvoice.id, "email_sent_at");
        if (selectedInvoice.status === "draft") {
          updateInvoiceStatus(selectedInvoice.id, "sent");
        }
        showMessage("success", "Invoice emailed!", 3000);
        loadInvoices();
      } else {
        showMessage("error", `Email failed: ${result.error}`, 3000);
      }
    } catch (err) {
      showMessage("error", `Error: ${(err as Error).message}`, 3000);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleFormInput = (input: string, key: Key) => {
    if (key.upArrow) {
      const idx = formFields.indexOf(activeField);
      if (idx > 0) setActiveField(formFields[idx - 1]);
      return;
    }
    if (key.downArrow) {
      const idx = formFields.indexOf(activeField);
      if (idx < formFields.length - 1) setActiveField(formFields[idx + 1]);
      return;
    }

    if (input === "a" && key.ctrl) {
      addLineItem();
      return;
    }
    if (input === "l" && key.ctrl) {
      setShowItemLhdnFields((prev) => !prev);
      return;
    }
    if (input === "s" && key.ctrl) {
      handleSubmit();
      return;
    }

    // Handle selector fields
    if (handleSelectorInput(activeField, key)) return;

    if (key.return) {
      const idx = formFields.indexOf(activeField);
      if (idx < formFields.length - 1) {
        setActiveField(formFields[idx + 1]);
      } else {
        handleSubmit();
      }
      return;
    }

    if (key.backspace || key.delete) {
      handleBackspace(activeField);
      return;
    }

    if (input && !key.ctrl && !key.meta && !key.escape) {
      handleCharInput(activeField, input);
    }
  };

  const handleSelectorInput = (field: FormField, key: Key): boolean => {
    const selectorHandlers: Record<string, () => void> = {
      currency_left: () => setCurrencyIndex((prev) => Math.max(0, prev - 1)),
      currency_right: () =>
        setCurrencyIndex((prev) => Math.min(CURRENCY_KEYS.length - 1, prev + 1)),
      paymentMode_left: () => setPaymentModeIndex((prev) => Math.max(0, prev - 1)),
      paymentMode_right: () =>
        setPaymentModeIndex((prev) => Math.min(PAYMENT_MODE_KEYS.length - 1, prev + 1)),
    };

    const direction = key.leftArrow ? "left" : key.rightArrow ? "right" : null;
    if (!direction) return false;

    if (field === "currency" || field === "paymentMode") {
      const handler = selectorHandlers[`${field}_${direction}`];
      if (handler) {
        handler();
        return true;
      }
    }

    // Item LHDN fields
    if (field === "itemClassification") {
      const currentIdx = CLASSIFICATION_KEYS.indexOf(items[currentItemIndex].classificationCode);
      if (key.leftArrow && currentIdx > 0) {
        updateCurrentItem("classificationCode", CLASSIFICATION_KEYS[currentIdx - 1]);
        return true;
      }
      if (key.rightArrow && currentIdx < CLASSIFICATION_KEYS.length - 1) {
        updateCurrentItem("classificationCode", CLASSIFICATION_KEYS[currentIdx + 1]);
        return true;
      }
    }

    if (field === "itemTaxType") {
      const currentIdx = TAX_TYPE_KEYS.indexOf(items[currentItemIndex].taxType);
      if (key.leftArrow && currentIdx > 0) {
        updateCurrentItem("taxType", TAX_TYPE_KEYS[currentIdx - 1]);
        return true;
      }
      if (key.rightArrow && currentIdx < TAX_TYPE_KEYS.length - 1) {
        updateCurrentItem("taxType", TAX_TYPE_KEYS[currentIdx + 1]);
        return true;
      }
    }

    if (field === "itemUnitCode") {
      const currentIdx = UNIT_CODE_KEYS.indexOf(items[currentItemIndex].unitCode);
      if (key.leftArrow && currentIdx > 0) {
        updateCurrentItem("unitCode", UNIT_CODE_KEYS[currentIdx - 1]);
        return true;
      }
      if (key.rightArrow && currentIdx < UNIT_CODE_KEYS.length - 1) {
        updateCurrentItem("unitCode", UNIT_CODE_KEYS[currentIdx + 1]);
        return true;
      }
    }

    return false;
  };

  const handleBackspace = (field: FormField) => {
    const handlers: Record<string, () => void> = {
      customer: () => setCustomerName((prev) => prev.slice(0, -1)),
      address: () => setAddress((prev) => prev.slice(0, -1)),
      dueDate: () => setDueDate((prev) => prev.slice(0, -1)),
      taxRate: () => setTaxRate((prev) => prev.slice(0, -1)),
      notes: () => setNotes((prev) => prev.slice(0, -1)),
      itemDesc: () =>
        updateCurrentItem("description", items[currentItemIndex].description.slice(0, -1)),
      itemQty: () =>
        updateCurrentItem("quantity", items[currentItemIndex].quantity.slice(0, -1)),
      itemPrice: () =>
        updateCurrentItem("unitPrice", items[currentItemIndex].unitPrice.slice(0, -1)),
    };
    handlers[field]?.();
  };

  const handleCharInput = (field: FormField, input: string) => {
    const handlers: Record<string, () => void> = {
      customer: () => setCustomerName((prev) => prev + input),
      address: () => setAddress((prev) => prev + input),
      dueDate: () => /[\d-]/.test(input) && setDueDate((prev) => prev + input),
      taxRate: () => /[\d.]/.test(input) && setTaxRate((prev) => prev + input),
      notes: () => setNotes((prev) => prev + input),
      itemDesc: () =>
        updateCurrentItem("description", items[currentItemIndex].description + input),
      itemQty: () =>
        /[\d.]/.test(input) &&
        updateCurrentItem("quantity", items[currentItemIndex].quantity + input),
      itemPrice: () =>
        /[\d.]/.test(input) &&
        updateCurrentItem("unitPrice", items[currentItemIndex].unitPrice + input),
    };
    handlers[field]?.();
  };

  // Calculate summary stats
  const outstandingTotal = invoices
    .filter((i) => i.status !== "paid")
    .reduce((s, i) => s + i.total, 0);

  // Calculate stats for visual display
  const paidCount = invoices.filter((i) => i.status === "paid").length;
  const sentCount = invoices.filter((i) => i.status === "sent").length;
  const overdueCount = invoices.filter((i) => i.status === "overdue").length;
  const paidTotal = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.total, 0);

  // Generate sparkline data from recent invoices (amounts)
  const sparklineData = invoices.slice(0, 12).map((i) => i.total).reverse();

  return (
    <Box flexDirection="row" width={width} height={height}>
      {/* Left Panel - Invoice List */}
      <Box
        flexDirection="column"
        width={listWidth}
        height={height}
        borderStyle={borderStyles.panel}
        borderColor={focusArea === "list" ? theme.semantic.focusBorder : theme.semantic.border}
        paddingX={1}
      >
        {/* Header with stats */}
        <Box justifyContent="space-between" marginBottom={1}>
          <Text bold color={theme.semantic.primary}>◆ Invoices</Text>
          <Text color={theme.semantic.textMuted}>{invoices.length}</Text>
        </Box>

        {/* Visual Summary */}
        {invoices.length > 0 && (
          <Box flexDirection="column" marginBottom={1}>
            <Box>
              <Box width={Math.floor(listWidth / 2) - 2}>
                <Text color={theme.semantic.success}>✓ {paidCount}</Text>
                <Text color={theme.semantic.textMuted}> paid</Text>
              </Box>
              <Box>
                <Text color={theme.semantic.info}>→ {sentCount}</Text>
                <Text color={theme.semantic.textMuted}> sent</Text>
              </Box>
            </Box>
            <Box>
              {overdueCount > 0 && (
                <Text color={theme.semantic.error}>! {overdueCount} overdue</Text>
              )}
            </Box>
            <Box marginTop={1}>
              <Text color={theme.semantic.textMuted}>Trend: </Text>
              <Sparkline data={sparklineData} width={listWidth - 10} color={theme.semantic.income} showTrend={false} />
            </Box>
          </Box>
        )}

        {/* Divider */}
        <Text color={theme.semantic.border}>{"─".repeat(listWidth - 4)}</Text>

        {/* Hints */}
        <Box marginY={1}>
          <Text color={theme.semantic.textMuted}>
            <Text color={theme.semantic.success}>n</Text> new
            <Text color={theme.semantic.textMuted}> • </Text>
            j/k ↕ • v view • s send • p pay • <Text color={theme.semantic.info}>e</Text> e-inv
          </Text>
        </Box>

        {/* Invoice List */}
        {invoices.length === 0 ? (
          <Box flexDirection="column" paddingY={2} alignItems="center">
            <Text color={theme.semantic.textMuted}>No invoices yet</Text>
            <Box marginTop={1}>
              <Text color={theme.semantic.textMuted}>Press </Text>
              <Text bold color={theme.semantic.success}>n</Text>
              <Text color={theme.semantic.textMuted}> to create one</Text>
            </Box>
          </Box>
        ) : (
          <Box flexDirection="column" overflowY="hidden">
            {invoices.slice(0, height - 14).map((inv, i) => {
              const docs = getDocumentsForInvoice(inv.id);
              const fullInv = getInvoice(inv.id);
              const einvoiceStatus = fullInv?.einvoice_status as EInvoiceStatus | undefined;
              return (
                <InvoiceRow
                  key={inv.id}
                  invoice={{ ...inv, amount_paid: fullInv?.amount_paid || 0 }}
                  selected={i === selectedIndex}
                  einvoiceStatus={einvoiceStatus}
                  hasEmail={!!fullInv?.email_sent_at}
                  hasDocuments={docs.length > 0}
                  width={listWidth - 4}
                />
              );
            })}
          </Box>
        )}

        {/* Footer Stats */}
        <Box flexGrow={1} />
        <Box
          borderStyle="single"
          borderColor={theme.semantic.border}
          borderTop
          borderBottom={false}
          borderLeft={false}
          borderRight={false}
          paddingTop={1}
          flexDirection="column"
        >
          <Box justifyContent="space-between">
            <Text color={theme.semantic.textMuted}>Outstanding</Text>
            <Text bold color={theme.semantic.warning}>${outstandingTotal.toFixed(0)}</Text>
          </Box>
          <Box justifyContent="space-between">
            <Text color={theme.semantic.textMuted}>Collected</Text>
            <Text color={theme.semantic.success}>${paidTotal.toFixed(0)}</Text>
          </Box>
        </Box>
      </Box>

      <Box width={1} />

      {/* Right Panel - Form, Detail, or E-Invoice */}
      {focusArea === "form" ? (
        <InvoiceForm
          width={detailWidth}
          height={height}
          theme={theme}
          activeField={activeField}
          customerName={customerName}
          address={address}
          dueDate={dueDate}
          currencyIndex={currencyIndex}
          paymentModeIndex={paymentModeIndex}
          items={items}
          currentItemIndex={currentItemIndex}
          showItemLhdnFields={showItemLhdnFields}
          taxRate={taxRate}
          notes={notes}
          formTotal={formTotal}
          message={message}
        />
      ) : focusArea === "einvoice" && selectedInvoice ? (
        <EInvoiceView
          width={detailWidth}
          height={height}
          invoiceId={String(selectedInvoice.id)}
          invoiceNumber={selectedInvoice.number}
          invoiceTotal={Math.round(selectedInvoice.total * 100)}
          customerId={String(selectedInvoice.customer_id)}
          customerName={selectedInvoice.customer_name || "Unknown"}
          status={(selectedInvoice.einvoice_status as EInvoiceStatus) || "none"}
          uuid={selectedInvoice.einvoice_uuid}
          longId={selectedInvoice.einvoice_long_id}
          submittedAt={selectedInvoice.einvoice_submitted_at ? new Date(selectedInvoice.einvoice_submitted_at) : undefined}
          validatedAt={selectedInvoice.einvoice_validated_at ? new Date(selectedInvoice.einvoice_validated_at) : undefined}
          errorMessage={selectedInvoice.einvoice_error}
          onBack={() => setFocusArea("detail")}
        />
      ) : (
        <InvoiceDetail
          width={detailWidth}
          height={height}
          theme={theme}
          focusArea={focusArea}
          selectedInvoice={selectedInvoice}
          paymentAmount={paymentAmount}
          unlinkedDocs={unlinkedDocs}
          docIndex={docIndex}
          message={message}
        />
      )}
    </Box>
  );
}

// ============================================================================
// Form Panel
// ============================================================================

interface InvoiceFormProps {
  width: number;
  height: number;
  theme: ReturnType<typeof getEnhancedTheme>;
  activeField: FormField;
  customerName: string;
  address: string;
  dueDate: string;
  currencyIndex: number;
  paymentModeIndex: number;
  items: LineItem[];
  currentItemIndex: number;
  showItemLhdnFields: boolean;
  taxRate: string;
  notes: string;
  formTotal: number;
  message: { type: "success" | "error"; text: string } | null;
}

function InvoiceForm({
  width,
  height,
  theme,
  activeField,
  customerName,
  address,
  dueDate,
  currencyIndex,
  paymentModeIndex,
  items,
  currentItemIndex,
  showItemLhdnFields,
  taxRate,
  notes,
  formTotal,
  message,
}: InvoiceFormProps) {
  const cursorVisible = useBlinkingCursor(500);

  return (
    <Box
      flexDirection="column"
      width={width}
      height={height}
      borderStyle={borderStyles.panel}
      borderColor={theme.semantic.focusBorder}
      paddingX={1}
    >
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color={theme.semantic.primary}>
          {indicators.bullet} New Invoice
        </Text>
      </Box>
      <Text color={theme.semantic.textMuted}>
        ↑↓ fields {indicators.bullet} ←→ select {indicators.bullet} Ctrl+S save{" "}
        {indicators.bullet} Ctrl+A item {indicators.bullet} Ctrl+L LHDN
      </Text>

      {/* Customer Section */}
      <Box marginTop={1}>
        <Text bold color={theme.semantic.primary}>
          Customer
        </Text>
      </Box>
      <Box>
        <FormInput
          label="Name"
          value={customerName}
          focused={activeField === "customer"}
          width={Math.floor(width / 2) - 2}
        />
        <FormInput
          label="Address"
          value={address}
          focused={activeField === "address"}
          width={Math.floor(width / 2) - 2}
        />
      </Box>

      {/* Date & Payment */}
      <Box marginTop={1}>
        <FormInput
          label="Due Date"
          value={dueDate}
          focused={activeField === "dueDate"}
          placeholder="YYYY-MM-DD"
        />
      </Box>
      <Box>
        <SelectorField
          label="Currency"
          value={CURRENCY_KEYS[currencyIndex]}
          focused={activeField === "currency"}
          width={Math.floor(width / 2) - 2}
        />
        <SelectorField
          label="Payment"
          value={PAYMENT_MODE_LABELS[PAYMENT_MODE_KEYS[paymentModeIndex]]}
          focused={activeField === "paymentMode"}
          width={Math.floor(width / 2) - 2}
        />
      </Box>

      {/* Line Items */}
      <Box marginTop={1}>
        <Text bold color={theme.semantic.primary}>
          Line Items
        </Text>
        {showItemLhdnFields && (
          <Text color={theme.semantic.success}> (LHDN)</Text>
        )}
      </Box>
      <Box>
        <Text color={theme.semantic.textMuted}>
          {"Description".padEnd(20)}
          {"Qty".padEnd(6)}
          {"Price".padEnd(10)}
          {showItemLhdnFields && "Class   Tax   Unit"}
        </Text>
      </Box>
      {items.map((item, idx) => (
        <Box key={idx}>
          {idx === currentItemIndex ? (
            <>
              <Box width={20}>
                <Text
                  color={
                    activeField === "itemDesc"
                      ? theme.semantic.textPrimary
                      : theme.semantic.textMuted
                  }
                >
                  {item.description || "Services"}
                </Text>
                {activeField === "itemDesc" && cursorVisible && (
                  <Text color={theme.semantic.focus}>│</Text>
                )}
              </Box>
              <Box width={6}>
                <Text
                  color={
                    activeField === "itemQty"
                      ? theme.semantic.textPrimary
                      : theme.semantic.textMuted
                  }
                >
                  {item.quantity}
                </Text>
                {activeField === "itemQty" && cursorVisible && (
                  <Text color={theme.semantic.focus}>│</Text>
                )}
              </Box>
              <Box width={10}>
                <Text
                  color={
                    activeField === "itemPrice"
                      ? theme.semantic.success
                      : theme.semantic.textMuted
                  }
                >
                  ${item.unitPrice}
                </Text>
                {activeField === "itemPrice" && cursorVisible && (
                  <Text color={theme.semantic.focus}>│</Text>
                )}
              </Box>
              {showItemLhdnFields && (
                <>
                  <Box width={8}>
                    <Text
                      color={
                        activeField === "itemClassification"
                          ? theme.semantic.primary
                          : theme.semantic.textMuted
                      }
                    >
                      {activeField === "itemClassification" ? "←" : ""}
                      {item.classificationCode}
                      {activeField === "itemClassification" ? "→" : ""}
                    </Text>
                  </Box>
                  <Box width={6}>
                    <Text
                      color={
                        activeField === "itemTaxType"
                          ? theme.semantic.primary
                          : theme.semantic.textMuted
                      }
                    >
                      {activeField === "itemTaxType" ? "←" : ""}
                      {item.taxType}
                      {activeField === "itemTaxType" ? "→" : ""}
                    </Text>
                  </Box>
                  <Box width={6}>
                    <Text
                      color={
                        activeField === "itemUnitCode"
                          ? theme.semantic.primary
                          : theme.semantic.textMuted
                      }
                    >
                      {activeField === "itemUnitCode" ? "←" : ""}
                      {item.unitCode}
                      {activeField === "itemUnitCode" ? "→" : ""}
                    </Text>
                  </Box>
                </>
              )}
            </>
          ) : (
            <Text color={theme.semantic.textMuted}>
              {(item.description || "Services").slice(0, 18).padEnd(20)}
              {item.quantity.padEnd(6)}${item.unitPrice.padEnd(9)}
              {showItemLhdnFields &&
                `${item.classificationCode.padEnd(8)}${item.taxType.padEnd(6)}${item.unitCode}`}
            </Text>
          )}
        </Box>
      ))}

      {/* Settings */}
      <Box marginTop={1}>
        <Text bold color={theme.semantic.primary}>
          Settings
        </Text>
      </Box>
      <FormInput label="Tax %" value={taxRate || "0"} focused={activeField === "taxRate"} />
      <FormInput label="Notes" value={notes} focused={activeField === "notes"} />

      {/* Total */}
      <Box
        marginTop={1}
        borderStyle={borderStyles.subtle}
        borderColor={theme.semantic.border}
        paddingX={1}
      >
        <Text bold color={theme.semantic.success}>
          Total: ${formTotal.toFixed(2)}
          {taxRate && ` + ${taxRate}% tax`}
        </Text>
      </Box>

      <Box flexGrow={1} />

      {/* Message */}
      {message && (
        <Box>
          <Text
            color={message.type === "success" ? theme.semantic.success : theme.semantic.error}
          >
            {message.type === "success" ? indicators.check : indicators.warning} {message.text}
          </Text>
        </Box>
      )}
    </Box>
  );
}

// ============================================================================
// Detail Panel
// ============================================================================

interface InvoiceDetailProps {
  width: number;
  height: number;
  theme: ReturnType<typeof getEnhancedTheme>;
  focusArea: FocusArea;
  selectedInvoice: Invoice | null;
  paymentAmount: string;
  unlinkedDocs: Document[];
  docIndex: number;
  message: { type: "success" | "error"; text: string } | null;
}

function InvoiceDetail({
  width,
  height,
  theme,
  focusArea,
  selectedInvoice,
  paymentAmount,
  unlinkedDocs,
  docIndex,
  message,
}: InvoiceDetailProps) {
  const cursorVisible = useBlinkingCursor(500);
  const isFocused = focusArea === "detail" || focusArea === "payment" || focusArea === "attach";

  if (!selectedInvoice) {
    return (
      <Box
        flexDirection="column"
        width={width}
        height={height}
        borderStyle={borderStyles.panel}
        borderColor={theme.semantic.border}
        paddingX={1}
        justifyContent="center"
        alignItems="center"
      >
        <Text color={theme.semantic.textMuted}>No invoice selected</Text>
        <Box marginTop={1}>
          <Text color={theme.semantic.textMuted}>Press </Text>
          <Text bold color={theme.semantic.success}>n</Text>
          <Text color={theme.semantic.textMuted}> to create one</Text>
        </Box>
      </Box>
    );
  }

  const customer = getCustomer(selectedInvoice.customer_id);
  const docs = getDocumentsForInvoice(selectedInvoice.id);
  const einvoiceStatus = selectedInvoice?.einvoice_status as EInvoiceStatus | undefined;
  const balance = selectedInvoice.total - selectedInvoice.amount_paid;
  const paidPercent = selectedInvoice.total > 0 ? (selectedInvoice.amount_paid / selectedInvoice.total) * 100 : 0;
  const statusIcon = getStatusIcon(selectedInvoice.status);
  const statusColor = getStatusColor(selectedInvoice.status);

  return (
    <Box
      flexDirection="column"
      width={width}
      height={height}
      borderStyle={borderStyles.panel}
      borderColor={isFocused ? theme.semantic.focusBorder : theme.semantic.border}
      paddingX={1}
    >
      {/* Header with visual status */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Box>
          <Text bold color={theme.semantic.primary}>◆ </Text>
          <Text bold color={theme.semantic.textPrimary}>{selectedInvoice.number}</Text>
        </Box>
        <Box>
          <Text color={statusColor} bold>{statusIcon} {selectedInvoice.status.toUpperCase()}</Text>
        </Box>
      </Box>

      {/* Payment Progress Visual */}
      {selectedInvoice.status !== "draft" && (
        <Box flexDirection="column" marginBottom={1}>
          <Box justifyContent="space-between">
            <Text color={theme.semantic.textMuted}>Payment Progress</Text>
            <Text color={paidPercent >= 100 ? theme.semantic.success : theme.semantic.warning}>
              {paidPercent.toFixed(0)}%
            </Text>
          </Box>
          <Gauge
            value={selectedInvoice.amount_paid}
            max={selectedInvoice.total}
            size="sm"
            showValue={false}
            thresholds={{ warn: 50, danger: 20 }}
          />
          <Box justifyContent="space-between">
            <Text color={theme.semantic.textMuted}>
              Paid: <Text color={theme.semantic.success}>${selectedInvoice.amount_paid.toFixed(0)}</Text>
            </Text>
            <Text color={theme.semantic.textMuted}>
              Due: <Text color={balance > 0 ? theme.semantic.warning : theme.semantic.success}>${balance.toFixed(0)}</Text>
            </Text>
          </Box>
        </Box>
      )}

      {/* Divider */}
      <Text color={theme.semantic.border}>{"─".repeat(width - 6)}</Text>

      {/* Hints */}
      <Box marginY={1}>
        <Text color={theme.semantic.textMuted}>
          {focusArea === "payment"
            ? "Enter amount • ↵ confirm • Esc cancel"
            : focusArea === "attach"
            ? "←/→ select • ↵ attach • Esc cancel"
            : <><Text color={theme.semantic.success}>n</Text> new • s send • p pay • <Text color={theme.semantic.info}>e</Text> e-inv • m mail</>}
        </Text>
      </Box>

      {/* Payment Input */}
      {focusArea === "payment" && (
        <Box
          marginTop={1}
          borderStyle={borderStyles.input}
          borderColor={theme.semantic.focus}
          paddingX={1}
        >
          <Text color={theme.semantic.focus}>Payment amount: $</Text>
          <Text>{paymentAmount}</Text>
          {cursorVisible && <Text color={theme.semantic.focus}>│</Text>}
        </Box>
      )}

      {/* Attach Mode */}
      {focusArea === "attach" && unlinkedDocs.length > 0 && (
        <Box
          marginTop={1}
          borderStyle={borderStyles.input}
          borderColor={theme.semantic.focus}
          paddingX={1}
        >
          <Text color={theme.semantic.focus}>Select document: </Text>
          <Text>{unlinkedDocs[docIndex]?.original_name || "None"}</Text>
          <Text color={theme.semantic.textMuted}>
            {" "}
            ({docIndex + 1}/{unlinkedDocs.length})
          </Text>
        </Box>
      )}

      {/* Customer Info */}
      <Box marginTop={1}>
        <Text bold color={theme.semantic.primary}>
          Customer
        </Text>
      </Box>
      <Text color={theme.semantic.textPrimary}>{selectedInvoice.customer_name}</Text>
      {customer?.email && <Text color={theme.semantic.textMuted}>{customer.email}</Text>}
      {customer?.address && <Text color={theme.semantic.textMuted}>{customer.address}</Text>}
      {customer?.tin ? (
        <Text color={theme.semantic.success}>TIN: {customer.tin}</Text>
      ) : (
        <Text color={theme.semantic.warning}>{indicators.warning} No TIN (required for e-Invoice)</Text>
      )}

      {/* Dates */}
      <Box marginTop={1}>
        <Text bold color={theme.semantic.primary}>
          Dates
        </Text>
      </Box>
      <KeyValueRow label="Issued:" value={selectedInvoice.date} />
      <KeyValueRow
        label="Due:"
        value={
          <Text color={isOverdue(selectedInvoice) ? theme.semantic.error : theme.semantic.textPrimary}>
            {selectedInvoice.due_date}
            {isOverdue(selectedInvoice) && " (OVERDUE)"}
          </Text>
        }
      />
      {selectedInvoice.email_sent_at && (
        <KeyValueRow
          label="Emailed:"
          value={
            <Text color={theme.semantic.success}>
              ✉ {selectedInvoice.email_sent_at.split("T")[0]}
            </Text>
          }
        />
      )}

      {/* E-Invoice Status */}
      {einvoiceStatus && einvoiceStatus !== "none" && (
        <>
          <Box marginTop={1}>
            <Text bold color={theme.semantic.primary}>
              E-Invoice (LHDN)
            </Text>
          </Box>
          <KeyValueRow
            label="Status:"
            value={
              <Text color={getEInvoiceColor(einvoiceStatus)}>
                {getEInvoiceIcon(einvoiceStatus)} {EINVOICE_STATUS_LABELS[einvoiceStatus] || einvoiceStatus}
              </Text>
            }
          />
          {selectedInvoice.einvoice_uuid && (
            <KeyValueRow label="UUID:" value={selectedInvoice.einvoice_uuid} />
          )}
        </>
      )}

      {/* Line Items */}
      <Box marginTop={1}>
        <Text bold color={theme.semantic.primary}>
          Line Items
        </Text>
      </Box>
      <Text color={theme.semantic.textMuted}>
        {"Description".padEnd(20)}
        {"Qty".padEnd(6)}
        {"Price".padEnd(10)}
        {"Amount"}
      </Text>
      {selectedInvoice.items?.slice(0, 3).map((item, idx) => (
        <Box key={idx}>
          <Text color={theme.semantic.textPrimary}>
            {(item.description || "").slice(0, 18).padEnd(20)}
            {String(item.quantity).padEnd(6)}${item.unit_price.toFixed(0).padEnd(9)}$
            {item.amount.toFixed(2)}
          </Text>
        </Box>
      ))}
      {(selectedInvoice.items?.length || 0) > 3 && (
        <Text color={theme.semantic.textMuted}>
          ...and {selectedInvoice.items!.length - 3} more items
        </Text>
      )}

      {/* Totals */}
      <Box
        marginTop={1}
        borderStyle={borderStyles.subtle}
        borderColor={theme.semantic.border}
        paddingX={1}
        flexDirection="column"
      >
        <Box justifyContent="space-between">
          <Text color={theme.semantic.textMuted}>Subtotal</Text>
          <Text>${selectedInvoice.subtotal.toFixed(2)}</Text>
        </Box>
        {selectedInvoice.tax_rate > 0 && (
          <Box justifyContent="space-between">
            <Text color={theme.semantic.textMuted}>Tax ({selectedInvoice.tax_rate}%)</Text>
            <Text>${selectedInvoice.tax_amount.toFixed(2)}</Text>
          </Box>
        )}
        <Box justifyContent="space-between">
          <Text bold>Total</Text>
          <Text bold color={theme.semantic.success}>
            ${selectedInvoice.total.toFixed(2)}
          </Text>
        </Box>
        {selectedInvoice.amount_paid > 0 && (
          <>
            <Box justifyContent="space-between">
              <Text color={theme.semantic.textMuted}>Paid</Text>
              <Text color={theme.semantic.success}>${selectedInvoice.amount_paid.toFixed(2)}</Text>
            </Box>
            <Box justifyContent="space-between">
              <Text bold>Balance</Text>
              <Text bold color={theme.semantic.warning}>
                ${balance.toFixed(2)}
              </Text>
            </Box>
          </>
        )}
      </Box>

      {/* Documents */}
      {docs.length > 0 && (
        <>
          <Box marginTop={1}>
            <Text bold color={theme.semantic.primary}>
              Documents
            </Text>
          </Box>
          {docs.map((doc, idx) => (
            <Text key={idx} color={theme.semantic.textMuted}>
              📎 {doc.original_name}
            </Text>
          ))}
        </>
      )}

      <Box flexGrow={1} />

      {/* Message */}
      {message && (
        <Box>
          <Text
            color={message.type === "success" ? theme.semantic.success : theme.semantic.error}
          >
            {message.type === "success" ? indicators.check : indicators.warning} {message.text}
          </Text>
        </Box>
      )}
    </Box>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function isOverdue(invoice: Invoice): boolean {
  if (invoice.status === "paid" || invoice.status === "cancelled") return false;
  const today = new Date().toISOString().split("T")[0];
  return invoice.due_date < today;
}

function getStatusColor(status: string): string {
  const theme = getEnhancedTheme();
  switch (status) {
    case "paid":
      return theme.semantic.success;
    case "sent":
      return theme.semantic.info;
    case "overdue":
      return theme.semantic.error;
    case "draft":
      return theme.semantic.textMuted;
    default:
      return theme.semantic.textPrimary;
  }
}

function getEInvoiceIcon(status?: EInvoiceStatus): string {
  if (!status || status === "none") return " ";
  const icons: Record<EInvoiceStatus, string> = {
    none: " ",
    pending: indicators.partial,
    submitted: "◑",
    valid: indicators.complete,
    invalid: indicators.cross,
    cancelled: "⊘",
    rejected: indicators.cross,
  };
  return icons[status] || " ";
}

function getEInvoiceColor(status?: EInvoiceStatus): string {
  const theme = getEnhancedTheme();
  if (!status || status === "none") return theme.semantic.textMuted;
  const colorMap: Record<EInvoiceStatus, string> = {
    none: theme.semantic.textMuted,
    pending: theme.semantic.warning,
    submitted: theme.semantic.info,
    valid: theme.semantic.success,
    invalid: theme.semantic.error,
    cancelled: theme.semantic.primary,
    rejected: theme.semantic.error,
  };
  return colorMap[status] || theme.semantic.textMuted;
}
