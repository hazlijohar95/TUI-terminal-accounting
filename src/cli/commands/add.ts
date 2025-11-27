import { loadWorkspaceConfig } from "../../core/workspace.js";
import { appendFileSync } from "fs";
import { cliLogger } from "../../core/logger.js";

type ParsedTransaction = {
  description: string;
  amount: number;
  account: string;
  date: string;
};

// Category mapping based on keywords
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "Expenses:Food": ["coffee", "lunch", "dinner", "breakfast", "grocery", "groceries", "restaurant", "cafe", "food", "eat", "meal", "snack", "donut", "pizza", "burger", "sushi", "thai", "chinese", "mexican", "starbucks", "mcdonald"],
  "Expenses:Transport": ["uber", "lyft", "taxi", "gas", "fuel", "parking", "transit", "bus", "train", "metro", "subway", "toll", "car"],
  "Expenses:Shopping": ["amazon", "target", "walmart", "costco", "clothing", "clothes", "shoes", "electronics", "purchase", "buy", "shop"],
  "Expenses:Entertainment": ["netflix", "spotify", "movie", "movies", "theater", "concert", "game", "games", "subscription", "hulu", "disney"],
  "Expenses:Utilities": ["electric", "electricity", "water", "gas", "internet", "phone", "mobile", "utility", "utilities", "bill"],
  "Expenses:Health": ["doctor", "medical", "pharmacy", "medicine", "gym", "fitness", "health", "dental", "vision", "hospital"],
  "Expenses:Home": ["rent", "mortgage", "repair", "maintenance", "furniture", "appliance", "cleaning", "supplies"],
  "Income:Salary": ["salary", "paycheck", "wages", "pay"],
  "Income:Freelance": ["freelance", "consulting", "contract", "gig"],
  "Income:Other": ["refund", "rebate", "dividend", "interest"],
};

function categorizeTransaction(description: string): string {
  const lower = description.toLowerCase();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        return category;
      }
    }
  }

  return "Expenses:Uncategorized";
}

function parseAmount(input: string): number | null {
  // Remove currency symbols and commas
  const cleaned = input.replace(/[$,]/g, "").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

export function parseQuickAdd(input: string): ParsedTransaction | null {
  // Patterns:
  // "coffee 5.50" - description amount
  // "coffee $5.50" - description $amount
  // "5.50 coffee" - amount description
  // "$5.50 coffee" - $amount description

  const parts = input.trim().split(/\s+/);
  if (parts.length < 2) return null;

  let amount: number | null = null;
  let description = "";

  // Try first part as amount
  amount = parseAmount(parts[0]);
  if (amount !== null) {
    description = parts.slice(1).join(" ");
  } else {
    // Try last part as amount
    amount = parseAmount(parts[parts.length - 1]);
    if (amount !== null) {
      description = parts.slice(0, -1).join(" ");
    } else {
      // Try second to last (for "coffee shop 5.50")
      for (let i = parts.length - 1; i >= 1; i--) {
        amount = parseAmount(parts[i]);
        if (amount !== null) {
          description = parts.slice(0, i).join(" ");
          break;
        }
      }
    }
  }

  if (amount === null || !description) return null;

  const account = categorizeTransaction(description);
  const today = new Date();
  const date = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, "0")}/${String(today.getDate()).padStart(2, "0")}`;

  return {
    description: description.charAt(0).toUpperCase() + description.slice(1),
    amount,
    account,
    date,
  };
}

function formatLedgerEntry(tx: ParsedTransaction): string {
  const isIncome = tx.account.startsWith("Income:");
  const amountStr = tx.amount.toFixed(2);

  if (isIncome) {
    return `
${tx.date} ${tx.description}
    Assets:Checking  $${amountStr}
    ${tx.account}
`;
  } else {
    return `
${tx.date} ${tx.description}
    ${tx.account}  $${amountStr}
    Assets:Checking
`;
  }
}

export function quickAdd(input: string): { success: boolean; message: string; transaction?: ParsedTransaction } {
  try {
    const workspace = loadWorkspaceConfig();
    const parsed = parseQuickAdd(input);

    if (!parsed) {
      return {
        success: false,
        message: "Could not parse input. Use: add <description> <amount> or add <amount> <description>",
      };
    }

    const entry = formatLedgerEntry(parsed);
    appendFileSync(workspace.ledger.path, entry);

    cliLogger.info({ transaction: parsed }, "Transaction added");

    const typeLabel = parsed.account.startsWith("Income:") ? "income" : "expense";

    return {
      success: true,
      message: `✓ Added ${typeLabel}: ${parsed.description} → ${parsed.account} $${parsed.amount.toFixed(2)}`,
      transaction: parsed,
    };
  } catch (err) {
    return {
      success: false,
      message: `Error: ${(err as Error).message}`,
    };
  }
}

export function printQuickAdd(input: string): void {
  const result = quickAdd(input);

  if (result.success) {
    console.log(`\x1b[32m${result.message}\x1b[0m`);
  } else {
    console.error(`\x1b[31m${result.message}\x1b[0m`);
  }
}

// For showing category suggestions
export function suggestCategories(description: string): string[] {
  const lower = description.toLowerCase();
  const suggestions: string[] = [];

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        if (!suggestions.includes(category)) {
          suggestions.push(category);
        }
        break;
      }
    }
  }

  return suggestions.length > 0 ? suggestions : ["Expenses:Uncategorized"];
}
