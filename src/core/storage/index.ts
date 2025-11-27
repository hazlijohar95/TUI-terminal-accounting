import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import type {
  AccountingData,
  Invoice,
  Vendor,
  Customer,
  Payment,
  Expense,
} from "../models/index.js";

const DATA_FILE = "oa-data.json";

// Default data structure
function getDefaultData(): AccountingData {
  return {
    invoices: [],
    vendors: [],
    customers: [],
    payments: [],
    expenses: [],
    accounts: [
      { code: "1000", name: "Assets:Bank:Checking", type: "asset" },
      { code: "1100", name: "Assets:Receivables", type: "asset" },
      { code: "2000", name: "Liabilities:Payables", type: "liability" },
      { code: "3000", name: "Equity:Opening", type: "equity" },
      { code: "4000", name: "Income:Sales", type: "income" },
      { code: "4100", name: "Income:Services", type: "income" },
      { code: "5000", name: "Expenses:Operating", type: "expense" },
      { code: "5100", name: "Expenses:Software", type: "expense" },
      { code: "5200", name: "Expenses:Office", type: "expense" },
    ],
    settings: {
      currency: "USD",
      taxRate: 0,
      invoicePrefix: "INV",
      nextInvoiceNumber: 1,
    },
  };
}

// Load data from file
export function loadData(): AccountingData {
  if (!existsSync(DATA_FILE)) {
    return getDefaultData();
  }

  try {
    const content = readFileSync(DATA_FILE, "utf-8");
    return JSON.parse(content) as AccountingData;
  } catch {
    return getDefaultData();
  }
}

// Save data to file
export function saveData(data: AccountingData): void {
  const dir = dirname(DATA_FILE);
  if (dir && dir !== "." && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Invoice operations
export function getInvoices(): Invoice[] {
  return loadData().invoices;
}

export function getInvoice(id: string): Invoice | undefined {
  return loadData().invoices.find((i) => i.id === id || i.number === id);
}

export function saveInvoice(invoice: Invoice): void {
  const data = loadData();
  const index = data.invoices.findIndex((i) => i.id === invoice.id);
  if (index >= 0) {
    data.invoices[index] = invoice;
  } else {
    data.invoices.push(invoice);
  }
  saveData(data);
}

export function deleteInvoice(id: string): boolean {
  const data = loadData();
  const index = data.invoices.findIndex((i) => i.id === id);
  if (index >= 0) {
    data.invoices.splice(index, 1);
    saveData(data);
    return true;
  }
  return false;
}

export function getNextInvoiceNumber(): string {
  const data = loadData();
  const number = `${data.settings.invoicePrefix}-${String(data.settings.nextInvoiceNumber).padStart(4, "0")}`;
  data.settings.nextInvoiceNumber++;
  saveData(data);
  return number;
}

// Vendor operations
export function getVendors(): Vendor[] {
  return loadData().vendors;
}

export function getVendor(id: string): Vendor | undefined {
  const data = loadData();
  return data.vendors.find((v) => v.id === id || v.name.toLowerCase() === id.toLowerCase());
}

export function saveVendor(vendor: Vendor): void {
  const data = loadData();
  const index = data.vendors.findIndex((v) => v.id === vendor.id);
  if (index >= 0) {
    data.vendors[index] = vendor;
  } else {
    data.vendors.push(vendor);
  }
  saveData(data);
}

export function deleteVendor(id: string): boolean {
  const data = loadData();
  const index = data.vendors.findIndex((v) => v.id === id);
  if (index >= 0) {
    data.vendors.splice(index, 1);
    saveData(data);
    return true;
  }
  return false;
}

// Customer operations
export function getCustomers(): Customer[] {
  return loadData().customers;
}

export function getCustomer(id: string): Customer | undefined {
  const data = loadData();
  return data.customers.find((c) => c.id === id || c.name.toLowerCase() === id.toLowerCase());
}

export function saveCustomer(customer: Customer): void {
  const data = loadData();
  const index = data.customers.findIndex((c) => c.id === customer.id);
  if (index >= 0) {
    data.customers[index] = customer;
  } else {
    data.customers.push(customer);
  }
  saveData(data);
}

export function deleteCustomer(id: string): boolean {
  const data = loadData();
  const index = data.customers.findIndex((c) => c.id === id);
  if (index >= 0) {
    data.customers.splice(index, 1);
    saveData(data);
    return true;
  }
  return false;
}

// Payment operations
export function getPayments(): Payment[] {
  return loadData().payments;
}

export function getPayment(id: string): Payment | undefined {
  return loadData().payments.find((p) => p.id === id);
}

export function savePayment(payment: Payment): void {
  const data = loadData();
  const index = data.payments.findIndex((p) => p.id === payment.id);
  if (index >= 0) {
    data.payments[index] = payment;
  } else {
    data.payments.push(payment);
  }
  saveData(data);
}

// Expense operations
export function getExpenses(): Expense[] {
  return loadData().expenses;
}

export function saveExpense(expense: Expense): void {
  const data = loadData();
  const index = data.expenses.findIndex((e) => e.id === expense.id);
  if (index >= 0) {
    data.expenses[index] = expense;
  } else {
    data.expenses.push(expense);
  }
  saveData(data);
}

// Settings
export function getSettings() {
  return loadData().settings;
}

export function updateSettings(settings: Partial<AccountingData["settings"]>): void {
  const data = loadData();
  data.settings = { ...data.settings, ...settings };
  saveData(data);
}
