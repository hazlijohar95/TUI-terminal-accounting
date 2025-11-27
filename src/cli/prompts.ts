// Beautiful prompts using @clack/prompts
import * as p from "@clack/prompts";
import pc from "picocolors";
import { theme, symbols, formatCurrency } from "./theme.js";

// Initialize intro
export function intro(message?: string): void {
  p.intro(pc.bgCyan(pc.black(` ${message || "OpenAccounting"} `)));
}

// Outro
export function outro(message: string): void {
  p.outro(message);
}

// Cancel handler
export function onCancel(): void {
  p.cancel("Operation cancelled");
  process.exit(0);
}

// Check if cancelled
export function isCancel(value: unknown): boolean {
  return p.isCancel(value);
}

// Text input
export async function text(options: {
  message: string;
  placeholder?: string;
  defaultValue?: string;
  validate?: (value: string) => string | Error | undefined;
}): Promise<string> {
  const result = await p.text({
    message: options.message,
    placeholder: options.placeholder,
    defaultValue: options.defaultValue,
    validate: options.validate,
  });

  if (isCancel(result)) {
    onCancel();
  }

  return result as string;
}

// Number input
export async function number(options: {
  message: string;
  placeholder?: string;
  defaultValue?: number;
  min?: number;
  max?: number;
}): Promise<number> {
  const result = await p.text({
    message: options.message,
    placeholder: options.placeholder,
    defaultValue: options.defaultValue?.toString(),
    validate: (value) => {
      const num = parseFloat(value);
      if (isNaN(num)) return "Please enter a valid number";
      if (options.min !== undefined && num < options.min) return `Minimum is ${options.min}`;
      if (options.max !== undefined && num > options.max) return `Maximum is ${options.max}`;
      return undefined;
    },
  });

  if (isCancel(result)) {
    onCancel();
  }

  return parseFloat(result as string);
}

// Select from options
// Using explicit typing to work around @clack/prompts conditional Option<T> type
export async function select<T extends string>(options: {
  message: string;
  options: Array<{ value: T; label?: string; hint?: string }>;
  initialValue?: T;
}): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (p.select as (opts: any) => Promise<symbol | T>)({
    message: options.message,
    options: options.options,
    initialValue: options.initialValue,
  });

  if (isCancel(result)) {
    onCancel();
  }

  return result as T;
}

// Multi-select
// Using explicit typing to work around @clack/prompts conditional Option<T> type
export async function multiselect<T extends string>(options: {
  message: string;
  options: Array<{ value: T; label?: string; hint?: string }>;
  required?: boolean;
}): Promise<T[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (p.multiselect as (opts: any) => Promise<symbol | T[]>)({
    message: options.message,
    options: options.options,
    required: options.required,
  });

  if (isCancel(result)) {
    onCancel();
  }

  return result as T[];
}

// Confirm
export async function confirm(options: {
  message: string;
  initialValue?: boolean;
}): Promise<boolean> {
  const result = await p.confirm({
    message: options.message,
    initialValue: options.initialValue,
  });

  if (isCancel(result)) {
    onCancel();
  }

  return result as boolean;
}

// Spinner
export function spinner(): ReturnType<typeof p.spinner> {
  return p.spinner();
}

// Group prompts
export async function group<T extends Record<string, unknown>>(
  prompts: Parameters<typeof p.group>[0],
  options?: { onCancel?: () => void }
): Promise<T> {
  const result = await p.group(prompts, {
    onCancel: options?.onCancel || onCancel,
  });

  return result as T;
}

// Note/message
export function note(message: string, title?: string): void {
  p.note(message, title);
}

// Log messages
export const log = {
  message: (message: string) => p.log.message(message),
  info: (message: string) => p.log.info(message),
  success: (message: string) => p.log.success(message),
  warn: (message: string) => p.log.warn(message),
  error: (message: string) => p.log.error(message),
  step: (message: string) => p.log.step(message),
};

// Custom: Customer selector with balance
export async function selectCustomer(
  customers: Array<{ id: number; name: string; balance?: number }>
): Promise<number | "new"> {
  const options = [
    ...customers.map((c) => ({
      value: c.id.toString(),
      label: c.name,
      hint: c.balance && c.balance > 0 ? `owes ${formatCurrency(c.balance)}` : undefined,
    })),
    { value: "new", label: pc.cyan("+ Create new customer") },
  ];

  const result = await select({
    message: "Select customer",
    options: options as Array<{ value: string; label: string; hint?: string }>,
  });

  return result === "new" ? "new" : parseInt(result);
}

// Custom: Money input with formatting
export async function money(options: {
  message: string;
  placeholder?: string;
  defaultValue?: number;
}): Promise<number> {
  const result = await text({
    message: options.message,
    placeholder: options.placeholder || "0.00",
    defaultValue: options.defaultValue?.toFixed(2),
    validate: (value) => {
      const cleaned = value.replace(/[$,]/g, "");
      const num = parseFloat(cleaned);
      if (isNaN(num)) return "Please enter a valid amount";
      if (num < 0) return "Amount must be positive";
    },
  });

  return parseFloat(result.replace(/[$,]/g, ""));
}

// Custom: Invoice item entry
export interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
}

export async function invoiceItems(): Promise<InvoiceItem[]> {
  const items: InvoiceItem[] = [];

  let addMore = true;
  while (addMore) {
    const description = await text({
      message: items.length === 0 ? "Item description" : "Next item description",
      placeholder: "e.g., Consulting services",
    });

    const quantity = await number({
      message: "Quantity",
      defaultValue: 1,
      min: 1,
    });

    const unit_price = await money({
      message: "Unit price",
      placeholder: "100.00",
    });

    items.push({ description, quantity, unit_price });

    // Show running total
    const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
    log.step(`Subtotal: ${formatCurrency(subtotal)}`);

    addMore = await confirm({
      message: "Add another item?",
      initialValue: false,
    });
  }

  return items;
}
