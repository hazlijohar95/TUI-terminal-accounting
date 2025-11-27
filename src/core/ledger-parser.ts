import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { parserLogger } from "./logger.js";

export type Posting = {
  account: string;
  amount: number;
  currency: string;
};

export type Transaction = {
  date: string;
  description: string;
  postings: Posting[];
};

/**
 * Parse ledger content (shared logic for sync and async)
 */
function parseLedgerContent(content: string): Transaction[] {
  const lines = content.split("\n");
  const transactions: Transaction[] = [];

  let currentTransaction: Transaction | null = null;

  for (const line of lines) {
    // Skip empty lines and comments
    if (!line.trim() || line.trim().startsWith(";") || line.trim().startsWith("#")) {
      if (currentTransaction && currentTransaction.postings.length > 0) {
        transactions.push(currentTransaction);
        currentTransaction = null;
      }
      continue;
    }

    // Check if line starts with a date (transaction header)
    // Support both YYYY-MM-DD and YYYY/MM/DD formats
    const headerMatch = line.match(/^(\d{4}[-/]\d{2}[-/]\d{2})\s+(.+)$/);
    if (headerMatch) {
      // Save previous transaction
      if (currentTransaction && currentTransaction.postings.length > 0) {
        transactions.push(currentTransaction);
      }

      currentTransaction = {
        date: headerMatch[1],
        description: headerMatch[2].trim(),
        postings: [],
      };
      continue;
    }

    // Check if line is a posting (indented line with account and amount)
    if (currentTransaction && (line.startsWith(" ") || line.startsWith("\t"))) {
      const posting = parsePostingLine(line.trim());
      if (posting) {
        currentTransaction.postings.push(posting);
      }
    }
  }

  // Don't forget the last transaction
  if (currentTransaction && currentTransaction.postings.length > 0) {
    transactions.push(currentTransaction);
  }

  return transactions;
}

/**
 * Parse a real ledger-cli format file (sync)
 */
export function parseLedgerCliFormat(path: string): Transaction[] {
  parserLogger.debug({ path }, "Parsing ledger file (sync)");
  const content = readFileSync(path, "utf-8");
  const transactions = parseLedgerContent(content);
  parserLogger.debug({ path, count: transactions.length }, "Parsed transactions");
  return transactions;
}

/**
 * Parse a real ledger-cli format file (async)
 */
export async function parseLedgerCliFormatAsync(path: string): Promise<Transaction[]> {
  parserLogger.debug({ path }, "Parsing ledger file (async)");
  const content = await readFile(path, "utf-8");
  const transactions = parseLedgerContent(content);
  parserLogger.debug({ path, count: transactions.length }, "Parsed transactions");
  return transactions;
}

function parsePostingLine(line: string): Posting | null {
  // Match patterns like:
  // "Expenses:Food          $5.00"
  // "Expenses:Food          5.00 USD"
  // "Expenses:Food          RM 5.00"
  // "Assets:Bank           $-5.00"

  // Try to find amount at end of line
  const amountMatch = line.match(/^(.+?)\s+([A-Z]{2,3}\s*)?([+-]?\d+(?:,\d{3})*(?:\.\d+)?)\s*([A-Z]{2,3})?$/);

  if (amountMatch) {
    const account = amountMatch[1].trim();
    const currencyPrefix = amountMatch[2]?.trim() || "";
    const amountStr = amountMatch[3].replace(/,/g, "");
    const currencySuffix = amountMatch[4] || "";

    return {
      account,
      amount: parseFloat(amountStr),
      currency: currencyPrefix || currencySuffix || "USD",
    };
  }

  // Try pattern with $ symbol
  const dollarMatch = line.match(/^(.+?)\s+\$([+-]?\d+(?:,\d{3})*(?:\.\d+)?)$/);
  if (dollarMatch) {
    return {
      account: dollarMatch[1].trim(),
      amount: parseFloat(dollarMatch[2].replace(/,/g, "")),
      currency: "USD",
    };
  }

  // Just account name with no amount (for balancing)
  if (line.match(/^[A-Za-z]/)) {
    return {
      account: line.trim(),
      amount: 0,
      currency: "USD",
    };
  }

  return null;
}

/**
 * Convert ledger-cli transactions to flat entries (for compatibility with existing code)
 */
export function transactionsToEntries(transactions: Transaction[]): Array<{
  date: string;
  description: string;
  amount: number;
  account: string;
}> {
  const entries: Array<{
    date: string;
    description: string;
    amount: number;
    account: string;
  }> = [];

  for (const tx of transactions) {
    for (const posting of tx.postings) {
      entries.push({
        date: tx.date,
        description: tx.description,
        amount: posting.amount,
        account: posting.account,
      });
    }
  }

  return entries;
}

/**
 * Detect file format and parse accordingly
 */
export function parseAnyLedgerFormat(path: string): Array<{
  date: string;
  description: string;
  amount: number;
  account: string;
}> {
  const content = readFileSync(path, "utf-8");
  const firstLine = content.split("\n")[0] || "";

  // If first line has 4 comma-separated fields, it's CSV format
  if (firstLine.split(",").length === 4) {
    // Use CSV parser
    const lines = content.split("\n");
    const entries: Array<{
      date: string;
      description: string;
      amount: number;
      account: string;
    }> = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const parts = trimmed.split(",");
      if (parts.length !== 4) continue;

      const amount = parseFloat(parts[2].trim());
      if (isNaN(amount)) continue;

      entries.push({
        date: parts[0].trim(),
        description: parts[1].trim(),
        amount,
        account: parts[3].trim(),
      });
    }

    return entries;
  }

  // Otherwise, try ledger-cli format
  const transactions = parseLedgerCliFormat(path);
  return transactionsToEntries(transactions);
}
