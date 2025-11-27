import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { agentLogger } from "../../core/logger.js";
import { parseLedgerCliFormat, type Transaction, type Posting } from "../../core/ledger-parser.js";

export type TransactionInput = {
  date: string;
  description: string;
  postings: Array<{
    account: string;
    amount: number;
    currency?: string;
  }>;
};

export type TransactionResult = {
  success: boolean;
  data?: unknown;
  error?: string;
};

export function createTransaction(
  ledgerPath: string,
  input: TransactionInput
): TransactionResult {
  agentLogger.debug({ date: input.date, description: input.description }, "Creating transaction");

  try {
    // Validate postings balance
    const total = input.postings.reduce((sum, p) => sum + p.amount, 0);
    if (Math.abs(total) > 0.01) {
      return {
        success: false,
        error: `Postings don't balance. Sum: ${total.toFixed(2)} (should be 0)`,
      };
    }

    // Format the transaction
    const lines = [
      "",
      `${input.date} ${input.description}`,
    ];

    for (const posting of input.postings) {
      const currency = posting.currency || "USD";
      const amountStr = posting.amount >= 0
        ? `${currency} ${posting.amount.toFixed(2)}`
        : `${currency} ${posting.amount.toFixed(2)}`;
      lines.push(`    ${posting.account.padEnd(30)} ${amountStr}`);
    }

    // Append to ledger file
    let content = "";
    if (existsSync(ledgerPath)) {
      content = readFileSync(ledgerPath, "utf-8");
    }

    content += lines.join("\n") + "\n";
    writeFileSync(ledgerPath, content, "utf-8");

    agentLogger.info({ date: input.date }, "Transaction created");

    return {
      success: true,
      data: {
        date: input.date,
        description: input.description,
        postings: input.postings.length,
        formatted: lines.join("\n"),
      },
    };
  } catch (err) {
    agentLogger.error({ err }, "Failed to create transaction");
    return { success: false, error: (err as Error).message };
  }
}

export function searchTransactions(
  ledgerPath: string,
  query: string,
  options?: {
    dateFrom?: string;
    dateTo?: string;
    account?: string;
    limit?: number;
  }
): TransactionResult {
  agentLogger.debug({ query, options }, "Searching transactions");

  try {
    if (!existsSync(ledgerPath)) {
      return { success: false, error: "Ledger file not found" };
    }

    const transactions = parseLedgerCliFormat(ledgerPath);
    const lowerQuery = query.toLowerCase();

    let filtered = transactions.filter(tx => {
      // Search in description
      if (tx.description.toLowerCase().includes(lowerQuery)) {
        return true;
      }
      // Search in account names
      return tx.postings.some(p =>
        p.account.toLowerCase().includes(lowerQuery)
      );
    });

    // Apply date filters
    if (options?.dateFrom) {
      filtered = filtered.filter(tx => tx.date >= options.dateFrom!);
    }
    if (options?.dateTo) {
      filtered = filtered.filter(tx => tx.date <= options.dateTo!);
    }

    // Apply account filter
    if (options?.account) {
      const accountLower = options.account.toLowerCase();
      filtered = filtered.filter(tx =>
        tx.postings.some(p => p.account.toLowerCase().includes(accountLower))
      );
    }

    // Apply limit
    const limit = options?.limit || 20;
    const results = filtered.slice(0, limit);

    return {
      success: true,
      data: {
        total: filtered.length,
        returned: results.length,
        transactions: results,
      },
    };
  } catch (err) {
    agentLogger.error({ err, query }, "Failed to search transactions");
    return { success: false, error: (err as Error).message };
  }
}

export function updateTransaction(
  ledgerPath: string,
  searchDate: string,
  searchDescription: string,
  updates: Partial<TransactionInput>
): TransactionResult {
  agentLogger.debug({ searchDate, searchDescription }, "Updating transaction");

  try {
    if (!existsSync(ledgerPath)) {
      return { success: false, error: "Ledger file not found" };
    }

    const content = readFileSync(ledgerPath, "utf-8");
    const lines = content.split("\n");

    // Find the transaction
    let found = false;
    let startLine = -1;
    let endLine = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/^(\d{4}-\d{2}-\d{2})\s+(.+)$/);

      if (match) {
        if (found && startLine !== -1) {
          endLine = i;
          break;
        }

        if (match[1] === searchDate && match[2].includes(searchDescription)) {
          found = true;
          startLine = i;
        }
      }
    }

    if (!found) {
      return {
        success: false,
        error: `Transaction not found: ${searchDate} ${searchDescription}`,
      };
    }

    if (endLine === -1) {
      // Find end by looking for empty line or end of file
      for (let i = startLine + 1; i < lines.length; i++) {
        if (!lines[i].trim() || /^\d{4}-\d{2}-\d{2}/.test(lines[i])) {
          endLine = i;
          break;
        }
      }
      if (endLine === -1) endLine = lines.length;
    }

    // Build updated transaction
    const newDate = updates.date || searchDate;
    const newDesc = updates.description || searchDescription;
    const newLines = [`${newDate} ${newDesc}`];

    if (updates.postings) {
      for (const posting of updates.postings) {
        const currency = posting.currency || "USD";
        const amountStr = `${currency} ${posting.amount.toFixed(2)}`;
        newLines.push(`    ${posting.account.padEnd(30)} ${amountStr}`);
      }
    } else {
      // Keep original postings
      for (let i = startLine + 1; i < endLine; i++) {
        if (lines[i].trim()) {
          newLines.push(lines[i]);
        }
      }
    }

    // Replace in content
    const resultLines = [
      ...lines.slice(0, startLine),
      ...newLines,
      ...lines.slice(endLine),
    ];

    writeFileSync(ledgerPath, resultLines.join("\n"), "utf-8");

    agentLogger.info({ searchDate, searchDescription }, "Transaction updated");

    return {
      success: true,
      data: {
        original: { date: searchDate, description: searchDescription },
        updated: { date: newDate, description: newDesc },
      },
    };
  } catch (err) {
    agentLogger.error({ err }, "Failed to update transaction");
    return { success: false, error: (err as Error).message };
  }
}

export function deleteTransaction(
  ledgerPath: string,
  date: string,
  description: string
): TransactionResult {
  agentLogger.debug({ date, description }, "Deleting transaction");

  try {
    if (!existsSync(ledgerPath)) {
      return { success: false, error: "Ledger file not found" };
    }

    const content = readFileSync(ledgerPath, "utf-8");
    const lines = content.split("\n");

    // Find and remove the transaction
    let found = false;
    let startLine = -1;
    let endLine = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/^(\d{4}-\d{2}-\d{2})\s+(.+)$/);

      if (match) {
        if (found && startLine !== -1) {
          endLine = i;
          break;
        }

        if (match[1] === date && match[2].includes(description)) {
          found = true;
          startLine = i;
        }
      }
    }

    if (!found) {
      return {
        success: false,
        error: `Transaction not found: ${date} ${description}`,
      };
    }

    if (endLine === -1) {
      for (let i = startLine + 1; i < lines.length; i++) {
        if (!lines[i].trim() || /^\d{4}-\d{2}-\d{2}/.test(lines[i])) {
          endLine = i;
          break;
        }
      }
      if (endLine === -1) endLine = lines.length;
    }

    // Remove transaction
    const resultLines = [
      ...lines.slice(0, startLine),
      ...lines.slice(endLine),
    ];

    writeFileSync(ledgerPath, resultLines.join("\n"), "utf-8");

    agentLogger.info({ date, description }, "Transaction deleted");

    return {
      success: true,
      data: {
        deleted: { date, description },
        linesRemoved: endLine - startLine,
      },
    };
  } catch (err) {
    agentLogger.error({ err }, "Failed to delete transaction");
    return { success: false, error: (err as Error).message };
  }
}
