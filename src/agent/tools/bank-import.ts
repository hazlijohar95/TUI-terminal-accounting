import { readFileSync, existsSync } from "node:fs";
import { agentLogger } from "../../core/logger.js";

export type BankTransaction = {
  date: string;
  description: string;
  amount: number;
  category?: string;
  account?: string;
};

export type ImportResult = {
  success: boolean;
  transactions?: BankTransaction[];
  summary?: {
    total: number;
    income: number;
    expenses: number;
    dateRange: { from: string; to: string };
  };
  error?: string;
};

export type CSVMapping = {
  dateColumn: number;
  descriptionColumn: number;
  amountColumn: number;
  dateFormat?: string;
  skipHeader?: boolean;
};

const DEFAULT_MAPPING: CSVMapping = {
  dateColumn: 0,
  descriptionColumn: 1,
  amountColumn: 2,
  skipHeader: true,
};

export function importCSV(path: string, mapping: Partial<CSVMapping> = {}): ImportResult {
  agentLogger.debug({ path }, "Importing CSV");

  try {
    if (!existsSync(path)) {
      return { success: false, error: `File not found: ${path}` };
    }

    const config = { ...DEFAULT_MAPPING, ...mapping };
    const content = readFileSync(path, "utf-8");
    const lines = content.split("\n").filter(l => l.trim());

    const transactions: BankTransaction[] = [];
    const startIndex = config.skipHeader ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const parts = parseCSVLine(lines[i]);

      if (parts.length <= Math.max(config.dateColumn, config.descriptionColumn, config.amountColumn)) {
        continue;
      }

      const date = parseDate(parts[config.dateColumn], config.dateFormat);
      const description = parts[config.descriptionColumn].trim();
      const amount = parseAmount(parts[config.amountColumn]);

      if (date && !isNaN(amount)) {
        transactions.push({ date, description, amount });
      }
    }

    // Calculate summary
    let income = 0;
    let expenses = 0;
    for (const tx of transactions) {
      if (tx.amount > 0) income += tx.amount;
      else expenses += Math.abs(tx.amount);
    }

    const dates = transactions.map(t => t.date).sort();

    agentLogger.info({ count: transactions.length, income, expenses }, "CSV imported");

    return {
      success: true,
      transactions,
      summary: {
        total: transactions.length,
        income,
        expenses,
        dateRange: {
          from: dates[0] || "",
          to: dates[dates.length - 1] || "",
        },
      },
    };
  } catch (err) {
    agentLogger.error({ err, path }, "Failed to import CSV");
    return { success: false, error: (err as Error).message };
  }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function parseDate(dateStr: string, format?: string): string {
  const cleaned = dateStr.trim().replace(/["']/g, "");

  // Try ISO format first
  if (/^\d{4}-\d{2}-\d{2}/.test(cleaned)) {
    return cleaned.substring(0, 10);
  }

  // Try MM/DD/YYYY
  const usMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usMatch) {
    const month = usMatch[1].padStart(2, "0");
    const day = usMatch[2].padStart(2, "0");
    return `${usMatch[3]}-${month}-${day}`;
  }

  // Try DD/MM/YYYY
  const euMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (euMatch && format === "DD/MM/YYYY") {
    const day = euMatch[1].padStart(2, "0");
    const month = euMatch[2].padStart(2, "0");
    return `${euMatch[3]}-${month}-${day}`;
  }

  return cleaned;
}

function parseAmount(amountStr: string): number {
  const cleaned = amountStr
    .trim()
    .replace(/["']/g, "")
    .replace(/[,$]/g, "")
    .replace(/\s/g, "");

  return parseFloat(cleaned);
}

// Auto-categorization based on description
const CATEGORY_RULES: Array<{ pattern: RegExp; category: string; account: string }> = [
  { pattern: /salary|payroll|wages/i, category: "Income", account: "Income:Salary" },
  { pattern: /interest/i, category: "Income", account: "Income:Interest" },
  { pattern: /grocery|supermarket|walmart|costco/i, category: "Food", account: "Expenses:Food:Groceries" },
  { pattern: /restaurant|cafe|coffee|starbucks/i, category: "Food", account: "Expenses:Food:Dining" },
  { pattern: /uber|lyft|taxi|grab/i, category: "Transport", account: "Expenses:Transport:Rideshare" },
  { pattern: /gas|petrol|shell|chevron/i, category: "Transport", account: "Expenses:Transport:Fuel" },
  { pattern: /electric|utility|water|internet/i, category: "Utilities", account: "Expenses:Utilities" },
  { pattern: /rent|mortgage/i, category: "Housing", account: "Expenses:Housing:Rent" },
  { pattern: /amazon|shopping/i, category: "Shopping", account: "Expenses:Shopping" },
  { pattern: /netflix|spotify|subscription/i, category: "Entertainment", account: "Expenses:Entertainment:Subscriptions" },
  { pattern: /transfer|payment/i, category: "Transfer", account: "Assets:Checking" },
];

export function autoCategorize(transactions: BankTransaction[]): BankTransaction[] {
  return transactions.map(tx => {
    for (const rule of CATEGORY_RULES) {
      if (rule.pattern.test(tx.description)) {
        return {
          ...tx,
          category: rule.category,
          account: rule.account,
        };
      }
    }
    // Default category
    return {
      ...tx,
      category: tx.amount > 0 ? "Income" : "Expense",
      account: tx.amount > 0 ? "Income:Other" : "Expenses:Other",
    };
  });
}

export function previewImport(transactions: BankTransaction[]): string {
  const lines = [
    `Preview: ${transactions.length} transactions`,
    "",
    "Date       | Amount     | Description",
    "-".repeat(50),
  ];

  for (const tx of transactions.slice(0, 10)) {
    const amount = tx.amount >= 0
      ? `+${tx.amount.toFixed(2)}`.padStart(10)
      : tx.amount.toFixed(2).padStart(10);
    const desc = tx.description.length > 25
      ? tx.description.substring(0, 22) + "..."
      : tx.description;
    lines.push(`${tx.date} | ${amount} | ${desc}`);
  }

  if (transactions.length > 10) {
    lines.push(`... and ${transactions.length - 10} more`);
  }

  return lines.join("\n");
}
