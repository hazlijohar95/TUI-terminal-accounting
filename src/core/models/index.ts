// Core accounting data models

export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface Invoice {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  date: string;
  dueDate: string;
  lineItems: LineItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  payments: string[]; // Payment IDs
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Vendor {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  date: string;
  amount: number;
  type: "received" | "sent";
  method: "cash" | "bank" | "card" | "check" | "other";
  reference?: string;
  // For received payments
  customerId?: string;
  customerName?: string;
  invoiceId?: string;
  // For sent payments
  vendorId?: string;
  vendorName?: string;
  expenseCategory?: string;
  description?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Expense {
  id: string;
  date: string;
  vendorId?: string;
  vendorName?: string;
  category: string;
  description: string;
  amount: number;
  paymentId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// Account types for chart of accounts
export interface Account {
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "income" | "expense";
  parent?: string;
}

// Storage structure
export interface AccountingData {
  invoices: Invoice[];
  vendors: Vendor[];
  customers: Customer[];
  payments: Payment[];
  expenses: Expense[];
  accounts: Account[];
  settings: {
    currency: string;
    taxRate: number;
    invoicePrefix: string;
    nextInvoiceNumber: number;
  };
}

// Helper to generate IDs
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Helper to get current timestamp
export function timestamp(): string {
  return new Date().toISOString();
}
