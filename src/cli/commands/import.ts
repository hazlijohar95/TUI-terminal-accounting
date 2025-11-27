import { readFileSync, appendFileSync, existsSync } from "fs";
import { loadWorkspaceConfig } from "../../core/workspace.js";
import { parseAnyLedgerFormat } from "../../core/ledger-parser.js";
import { cliLogger } from "../../core/logger.js";

type ImportedTransaction = {
  date: string;
  description: string;
  amount: number;
  category: string;
  isDuplicate: boolean;
  confidence: number;
};

type ImportResult = {
  success: boolean;
  message: string;
  transactions: ImportedTransaction[];
  duplicateCount: number;
  categorizedCount: number;
};

type CSVMapping = {
  dateColumn: number;
  descriptionColumn: number;
  amountColumn: number;
  dateFormat: string;
  hasHeader: boolean;
  delimiter: string;
};

// Auto-detect CSV format
function detectCSVFormat(lines: string[]): CSVMapping {
  const firstLine = lines[0];
  const delimiter = firstLine.includes("\t") ? "\t" : ",";
  const columns = firstLine.split(delimiter);

  // Detect if first line is header
  const hasHeader = columns.some(col =>
    /date|description|amount|debit|credit|memo/i.test(col)
  );

  // Find column indices
  let dateColumn = 0;
  let descriptionColumn = 1;
  let amountColumn = 2;

  if (hasHeader) {
    const lower = columns.map(c => c.toLowerCase().trim());
    dateColumn = lower.findIndex(c => /date|posted/.test(c));
    descriptionColumn = lower.findIndex(c => /description|memo|payee|merchant/.test(c));
    amountColumn = lower.findIndex(c => /amount|debit|credit/.test(c));

    if (dateColumn === -1) dateColumn = 0;
    if (descriptionColumn === -1) descriptionColumn = 1;
    if (amountColumn === -1) amountColumn = 2;
  }

  // Detect date format from sample
  const sampleLine = hasHeader ? lines[1] : lines[0];
  const sampleCols = sampleLine?.split(delimiter) || [];
  const sampleDate = sampleCols[dateColumn] || "";

  let dateFormat = "MM/DD/YYYY";
  if (/^\d{4}-\d{2}-\d{2}/.test(sampleDate)) {
    dateFormat = "YYYY-MM-DD";
  } else if (/^\d{2}\/\d{2}\/\d{4}/.test(sampleDate)) {
    dateFormat = "MM/DD/YYYY";
  } else if (/^\d{2}-\d{2}-\d{4}/.test(sampleDate)) {
    dateFormat = "DD-MM-YYYY";
  }

  return {
    dateColumn,
    descriptionColumn,
    amountColumn,
    dateFormat,
    hasHeader,
    delimiter,
  };
}

function parseDate(dateStr: string, format: string): string {
  const cleaned = dateStr.replace(/"/g, "").trim();

  if (format === "YYYY-MM-DD") {
    const [y, m, d] = cleaned.split("-");
    return `${y}/${m}/${d}`;
  } else if (format === "MM/DD/YYYY") {
    const [m, d, y] = cleaned.split("/");
    return `${y}/${m.padStart(2, "0")}/${d.padStart(2, "0")}`;
  } else if (format === "DD-MM-YYYY") {
    const [d, m, y] = cleaned.split("-");
    return `${y}/${m}/${d}`;
  }

  return cleaned;
}

// Category keywords for auto-categorization
const CATEGORY_PATTERNS: Array<{ pattern: RegExp; category: string; confidence: number }> = [
  // Food & Dining
  { pattern: /starbucks|dunkin|coffee/i, category: "Expenses:Food:Coffee", confidence: 95 },
  { pattern: /mcdonald|burger king|wendy|chipotle|subway/i, category: "Expenses:Food:FastFood", confidence: 95 },
  { pattern: /uber\s*eats|doordash|grubhub|postmates/i, category: "Expenses:Food:Delivery", confidence: 95 },
  { pattern: /restaurant|cafe|diner|grill|pizza|sushi|thai|chinese/i, category: "Expenses:Food:Restaurants", confidence: 85 },
  { pattern: /grocery|whole foods|trader joe|safeway|kroger|publix|aldi/i, category: "Expenses:Food:Groceries", confidence: 95 },

  // Transport
  { pattern: /uber(?!\s*eats)|lyft/i, category: "Expenses:Transport:Rideshare", confidence: 95 },
  { pattern: /shell|chevron|exxon|bp\s|gas\s|fuel/i, category: "Expenses:Transport:Gas", confidence: 90 },
  { pattern: /parking|parkme|spothero/i, category: "Expenses:Transport:Parking", confidence: 90 },

  // Shopping
  { pattern: /amazon|amzn/i, category: "Expenses:Shopping:Amazon", confidence: 90 },
  { pattern: /target|walmart|costco/i, category: "Expenses:Shopping:Retail", confidence: 85 },

  // Utilities & Bills
  { pattern: /electric|pg&e|conedison|power/i, category: "Expenses:Utilities:Electric", confidence: 90 },
  { pattern: /comcast|xfinity|verizon|at&t|t-mobile|spectrum|internet/i, category: "Expenses:Utilities:Internet", confidence: 90 },
  { pattern: /netflix|spotify|hulu|disney\+|hbo|apple\s*(tv|music)/i, category: "Expenses:Entertainment:Streaming", confidence: 95 },

  // Health
  { pattern: /pharmacy|cvs|walgreens|rite aid/i, category: "Expenses:Health:Pharmacy", confidence: 90 },
  { pattern: /doctor|medical|clinic|hospital/i, category: "Expenses:Health:Medical", confidence: 85 },
  { pattern: /gym|fitness|planet|equinox|crossfit/i, category: "Expenses:Health:Fitness", confidence: 90 },

  // Income
  { pattern: /payroll|direct dep|salary|wages/i, category: "Income:Salary", confidence: 95 },
  { pattern: /interest|dividend/i, category: "Income:Investment", confidence: 90 },
  { pattern: /refund|rebate/i, category: "Income:Other", confidence: 80 },

  // Transfers (usually should be excluded)
  { pattern: /transfer|zelle|venmo|paypal/i, category: "Transfer", confidence: 75 },
];

function categorizeDescription(description: string): { category: string; confidence: number } {
  for (const { pattern, category, confidence } of CATEGORY_PATTERNS) {
    if (pattern.test(description)) {
      return { category, confidence };
    }
  }

  // Default categorization based on amount sign will be handled separately
  return { category: "Expenses:Uncategorized", confidence: 50 };
}

function checkForDuplicates(
  transaction: { date: string; description: string; amount: number },
  existingEntries: Array<{ date: string; description: string; amount: number }>
): boolean {
  return existingEntries.some(existing =>
    existing.date === transaction.date &&
    Math.abs(existing.amount - transaction.amount) < 0.01 &&
    (existing.description.toLowerCase().includes(transaction.description.toLowerCase().substring(0, 10)) ||
     transaction.description.toLowerCase().includes(existing.description.toLowerCase().substring(0, 10)))
  );
}

export function analyzeCSVImport(csvPath: string): ImportResult {
  try {
    if (!existsSync(csvPath)) {
      return {
        success: false,
        message: `File not found: ${csvPath}`,
        transactions: [],
        duplicateCount: 0,
        categorizedCount: 0,
      };
    }

    const workspace = loadWorkspaceConfig();
    const existingEntries = parseAnyLedgerFormat(workspace.ledger.path);

    const content = readFileSync(csvPath, "utf-8");
    const lines = content.trim().split("\n").filter(l => l.trim());

    if (lines.length === 0) {
      return {
        success: false,
        message: "CSV file is empty",
        transactions: [],
        duplicateCount: 0,
        categorizedCount: 0,
      };
    }

    const mapping = detectCSVFormat(lines);
    const startIndex = mapping.hasHeader ? 1 : 0;

    const transactions: ImportedTransaction[] = [];
    let duplicateCount = 0;
    let categorizedCount = 0;

    for (let i = startIndex; i < lines.length; i++) {
      const cols = lines[i].split(mapping.delimiter).map(c => c.replace(/"/g, "").trim());

      const dateStr = cols[mapping.dateColumn];
      const description = cols[mapping.descriptionColumn];
      const amountStr = cols[mapping.amountColumn];

      if (!dateStr || !description || !amountStr) continue;

      const date = parseDate(dateStr, mapping.dateFormat);
      const amount = parseFloat(amountStr.replace(/[$,]/g, ""));

      if (isNaN(amount)) continue;

      const { category, confidence } = categorizeDescription(description);
      const isDuplicate = checkForDuplicates(
        { date, description, amount },
        existingEntries
      );

      if (isDuplicate) duplicateCount++;
      if (confidence >= 80) categorizedCount++;

      transactions.push({
        date,
        description,
        amount,
        category: amount > 0 && !category.startsWith("Income:") ? "Income:Other" : category,
        isDuplicate,
        confidence,
      });
    }

    cliLogger.info({
      csvPath,
      total: transactions.length,
      duplicates: duplicateCount,
      categorized: categorizedCount,
    }, "CSV analyzed");

    return {
      success: true,
      message: `Analyzed ${transactions.length} transactions (${duplicateCount} duplicates, ${categorizedCount} auto-categorized)`,
      transactions,
      duplicateCount,
      categorizedCount,
    };
  } catch (err) {
    return {
      success: false,
      message: `Import error: ${(err as Error).message}`,
      transactions: [],
      duplicateCount: 0,
      categorizedCount: 0,
    };
  }
}

export function commitImport(transactions: ImportedTransaction[]): { success: boolean; message: string; count: number } {
  try {
    const workspace = loadWorkspaceConfig();

    // Filter out duplicates and transfers
    const toImport = transactions.filter(t =>
      !t.isDuplicate && t.category !== "Transfer"
    );

    if (toImport.length === 0) {
      return {
        success: false,
        message: "No new transactions to import",
        count: 0,
      };
    }

    let ledgerContent = "";

    for (const tx of toImport) {
      const amountStr = Math.abs(tx.amount).toFixed(2);

      if (tx.amount > 0) {
        ledgerContent += `
${tx.date} ${tx.description}
    Assets:Checking  $${amountStr}
    ${tx.category}
`;
      } else {
        ledgerContent += `
${tx.date} ${tx.description}
    ${tx.category}  $${amountStr}
    Assets:Checking
`;
      }
    }

    appendFileSync(workspace.ledger.path, ledgerContent);

    cliLogger.info({ count: toImport.length }, "Transactions imported");

    return {
      success: true,
      message: `Successfully imported ${toImport.length} transactions`,
      count: toImport.length,
    };
  } catch (err) {
    return {
      success: false,
      message: `Commit error: ${(err as Error).message}`,
      count: 0,
    };
  }
}

export function printImportAnalysis(csvPath: string): void {
  const result = analyzeCSVImport(csvPath);

  if (!result.success) {
    console.error(`\x1b[31m${result.message}\x1b[0m`);
    return;
  }

  console.log(`\n\x1b[1m📊 Import Analysis\x1b[0m`);
  console.log(`─────────────────────────────────────`);
  console.log(`Total transactions: ${result.transactions.length}`);
  console.log(`Duplicates found: \x1b[33m${result.duplicateCount}\x1b[0m`);
  console.log(`Auto-categorized: \x1b[32m${result.categorizedCount}\x1b[0m`);
  console.log(`Needs review: \x1b[36m${result.transactions.length - result.categorizedCount}\x1b[0m`);
  console.log();

  // Show first 5 transactions
  console.log(`\x1b[1mPreview (first 5):\x1b[0m`);
  for (const tx of result.transactions.slice(0, 5)) {
    const status = tx.isDuplicate ? "\x1b[33m[DUP]\x1b[0m" : "";
    const confidence = tx.confidence >= 80 ? "\x1b[32m✓\x1b[0m" : "\x1b[36m?\x1b[0m";
    const amountColor = tx.amount > 0 ? "\x1b[32m" : "\x1b[31m";
    console.log(`  ${confidence} ${tx.date} ${tx.description.substring(0, 25).padEnd(25)} ${amountColor}$${Math.abs(tx.amount).toFixed(2)}\x1b[0m → ${tx.category} ${status}`);
  }

  if (result.transactions.length > 5) {
    console.log(`  ... and ${result.transactions.length - 5} more`);
  }

  console.log();
  console.log(`Use \x1b[36moa import commit ${csvPath}\x1b[0m to import non-duplicate transactions`);
}
