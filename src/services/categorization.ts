import { getDb } from "../db/index.js";
import { matchExpense, learnFromCorrection, type MatchResult } from "../domain/categorization-rules.js";

export interface CategorySuggestion {
  accountId: number;
  accountCode: string;
  accountName: string;
  confidence: number;
  reason: string;
  source: "rule" | "keyword" | "vendor" | "ai";
}

interface ExpenseAccount {
  id: number;
  code: string;
  name: string;
  keywords: string[];
}

/**
 * Get all expense accounts with associated keywords for matching
 */
function getExpenseAccounts(): ExpenseAccount[] {
  const db = getDb();

  const accounts = db.prepare(`
    SELECT id, code, name FROM accounts WHERE type = 'expense' AND is_active = 1 ORDER BY code
  `).all() as Array<{ id: number; code: string; name: string }>;

  // Add keywords based on account names
  return accounts.map(account => {
    const name = account.name.toLowerCase();
    const keywords: string[] = [];

    // Extract keywords from account name
    const words = name.split(/\s+/).filter(w => w.length > 2);
    keywords.push(...words);

    // Add common variations based on account type
    if (name.includes("advertising") || name.includes("marketing")) {
      keywords.push("ads", "google", "facebook", "meta", "instagram", "linkedin", "promotion", "campaign");
    }
    if (name.includes("bank")) {
      keywords.push("fee", "charge", "interest", "wire", "transfer");
    }
    if (name.includes("insurance")) {
      keywords.push("premium", "coverage", "policy", "health", "liability");
    }
    if (name.includes("office")) {
      keywords.push("supplies", "stationery", "printer", "paper", "ink", "desk", "chair");
    }
    if (name.includes("professional") || name.includes("services")) {
      keywords.push("consulting", "legal", "accounting", "audit", "lawyer", "attorney", "accountant");
    }
    if (name.includes("rent")) {
      keywords.push("lease", "property", "office space", "warehouse");
    }
    if (name.includes("software") || name.includes("subscription")) {
      keywords.push("saas", "cloud", "license", "annual", "monthly", "github", "aws", "azure", "google cloud", "slack", "zoom");
    }
    if (name.includes("travel")) {
      keywords.push("flight", "hotel", "uber", "grab", "taxi", "airbnb", "airline", "accommodation", "transport");
    }
    if (name.includes("utilities")) {
      keywords.push("electric", "water", "gas", "internet", "phone", "mobile", "telco", "power");
    }
    if (name.includes("meals") || name.includes("entertainment")) {
      keywords.push("restaurant", "food", "lunch", "dinner", "coffee", "catering", "client meal");
    }

    return { ...account, keywords };
  });
}

/**
 * Suggest category for an expense based on description and vendor
 * Uses a multi-layered approach:
 * 1. Check existing categorization rules
 * 2. Keyword matching against expense accounts
 * 3. Vendor name matching
 */
export function suggestCategory(
  description: string,
  vendorName?: string,
  amount?: number
): CategorySuggestion[] {
  const suggestions: CategorySuggestion[] = [];

  // Layer 1: Check categorization rules first
  const ruleMatch = matchExpense(description, vendorName);
  if (ruleMatch) {
    suggestions.push({
      accountId: ruleMatch.rule.account_id,
      accountCode: ruleMatch.rule.account_code || "",
      accountName: ruleMatch.rule.account_name || "",
      confidence: ruleMatch.confidence,
      reason: `Matched rule: "${ruleMatch.rule.pattern}"${ruleMatch.rule.vendor_pattern ? ` + vendor "${ruleMatch.rule.vendor_pattern}"` : ""}`,
      source: "rule",
    });
  }

  // Layer 2: Keyword matching against expense accounts
  const expenseAccounts = getExpenseAccounts();
  const descLower = description.toLowerCase();
  const vendorLower = vendorName?.toLowerCase() || "";

  for (const account of expenseAccounts) {
    // Skip if already suggested by rule
    if (suggestions.some(s => s.accountId === account.id)) continue;

    let matchScore = 0;
    const matchedKeywords: string[] = [];

    for (const keyword of account.keywords) {
      if (descLower.includes(keyword)) {
        matchScore += 0.3;
        matchedKeywords.push(keyword);
      }
      if (vendorLower.includes(keyword)) {
        matchScore += 0.2;
        matchedKeywords.push(`vendor:${keyword}`);
      }
    }

    // Check if account name itself matches
    const accountNameLower = account.name.toLowerCase();
    if (descLower.includes(accountNameLower) || vendorLower.includes(accountNameLower)) {
      matchScore += 0.4;
      matchedKeywords.push(account.name);
    }

    if (matchScore > 0.2 && matchedKeywords.length > 0) {
      suggestions.push({
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        confidence: Math.min(matchScore, 0.9),
        reason: `Matched keywords: ${matchedKeywords.slice(0, 3).join(", ")}`,
        source: "keyword",
      });
    }
  }

  // Sort by confidence descending
  suggestions.sort((a, b) => b.confidence - a.confidence);

  // Return top 3 suggestions
  return suggestions.slice(0, 3);
}

/**
 * Auto-categorize an expense if confidence is high enough
 * Returns the account_id if auto-categorization is possible, null otherwise
 */
export function autoCategorize(
  description: string,
  vendorName?: string,
  minConfidence: number = 0.8
): { accountId: number; accountName: string; confidence: number } | null {
  const suggestions = suggestCategory(description, vendorName);

  if (suggestions.length > 0 && suggestions[0].confidence >= minConfidence) {
    return {
      accountId: suggestions[0].accountId,
      accountName: suggestions[0].accountName,
      confidence: suggestions[0].confidence,
    };
  }

  return null;
}

/**
 * Get uncategorized or poorly categorized expenses
 * Returns expenses that were assigned to "Other Expenses" or similar default accounts
 */
export function getUncategorizedExpenses(limit: number = 50): Array<{
  id: number;
  date: string;
  description: string;
  vendor_name?: string;
  amount: number;
  current_account_id: number;
  current_account_name: string;
  suggestions: CategorySuggestion[];
}> {
  const db = getDb();

  // Find expenses in "Other" or default categories
  const expenses = db.prepare(`
    SELECT
      e.id,
      e.date,
      e.description,
      v.name as vendor_name,
      e.amount,
      e.account_id as current_account_id,
      a.name as current_account_name
    FROM expenses e
    LEFT JOIN vendors v ON e.vendor_id = v.id
    JOIN accounts a ON e.account_id = a.id
    WHERE a.name LIKE '%Other%' OR a.code = '6100'
    ORDER BY e.date DESC
    LIMIT ?
  `).all(limit) as Array<{
    id: number;
    date: string;
    description: string;
    vendor_name?: string;
    amount: number;
    current_account_id: number;
    current_account_name: string;
  }>;

  return expenses.map(expense => ({
    ...expense,
    suggestions: suggestCategory(expense.description || "", expense.vendor_name),
  }));
}

/**
 * Recategorize an expense and learn from the correction
 */
export function recategorizeExpense(
  expenseId: number,
  newAccountId: number,
  learnFromThis: boolean = true
): boolean {
  const db = getDb();

  // Get current expense
  const expense = db.prepare(`
    SELECT e.*, v.name as vendor_name
    FROM expenses e
    LEFT JOIN vendors v ON e.vendor_id = v.id
    WHERE e.id = ?
  `).get(expenseId) as { id: number; description: string; vendor_name?: string; account_id: number } | undefined;

  if (!expense) return false;

  // Update the expense account
  db.prepare("UPDATE expenses SET account_id = ? WHERE id = ?").run(newAccountId, expenseId);

  // Learn from the correction if requested
  if (learnFromThis && expense.description) {
    learnFromCorrection(expense.description, expense.vendor_name, newAccountId);
  }

  return true;
}

/**
 * Batch auto-categorize uncategorized expenses
 * Returns statistics about what was categorized
 */
export function batchAutoCategorize(minConfidence: number = 0.85): {
  processed: number;
  categorized: number;
  skipped: number;
  results: Array<{
    expense_id: number;
    description: string;
    old_account: string;
    new_account: string;
    confidence: number;
  }>;
} {
  const uncategorized = getUncategorizedExpenses(100);
  const results: Array<{
    expense_id: number;
    description: string;
    old_account: string;
    new_account: string;
    confidence: number;
  }> = [];

  let categorized = 0;
  let skipped = 0;

  for (const expense of uncategorized) {
    if (expense.suggestions.length > 0 && expense.suggestions[0].confidence >= minConfidence) {
      const bestSuggestion = expense.suggestions[0];

      // Apply the categorization
      const success = recategorizeExpense(expense.id, bestSuggestion.accountId, true);

      if (success) {
        categorized++;
        results.push({
          expense_id: expense.id,
          description: expense.description || "",
          old_account: expense.current_account_name,
          new_account: bestSuggestion.accountName,
          confidence: bestSuggestion.confidence,
        });
      } else {
        skipped++;
      }
    } else {
      skipped++;
    }
  }

  return {
    processed: uncategorized.length,
    categorized,
    skipped,
    results,
  };
}

/**
 * Get categorization statistics
 */
export function getCategorizationStats(): {
  total_expenses: number;
  uncategorized_count: number;
  auto_categorizable_count: number;
  categories_used: Array<{ name: string; count: number; percentage: number }>;
} {
  const db = getDb();

  const total = db.prepare("SELECT COUNT(*) as count FROM expenses").get() as { count: number };

  const uncategorized = db.prepare(`
    SELECT COUNT(*) as count FROM expenses e
    JOIN accounts a ON e.account_id = a.id
    WHERE a.name LIKE '%Other%' OR a.code = '6100'
  `).get() as { count: number };

  // Check how many could be auto-categorized
  const uncategorizedExpenses = getUncategorizedExpenses(100);
  const autoCategorizable = uncategorizedExpenses.filter(
    e => e.suggestions.length > 0 && e.suggestions[0].confidence >= 0.8
  ).length;

  // Get category distribution
  const categories = db.prepare(`
    SELECT a.name, COUNT(*) as count
    FROM expenses e
    JOIN accounts a ON e.account_id = a.id
    GROUP BY a.id, a.name
    ORDER BY count DESC
  `).all() as Array<{ name: string; count: number }>;

  return {
    total_expenses: total.count,
    uncategorized_count: uncategorized.count,
    auto_categorizable_count: autoCategorizable,
    categories_used: categories.map(c => ({
      name: c.name,
      count: c.count,
      percentage: total.count > 0 ? Math.round((c.count / total.count) * 100) : 0,
    })),
  };
}
