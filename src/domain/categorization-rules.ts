import { getDb, logAudit } from "../db/index.js";

export interface CategorizationRule {
  id: number;
  pattern: string;
  vendor_pattern?: string;
  account_id: number;
  account_name?: string;
  account_code?: string;
  priority: number;
  match_count: number;
  last_matched_at?: string;
  created_at: string;
}

export interface CreateRuleData {
  pattern: string;
  vendor_pattern?: string;
  account_id: number;
  priority?: number;
}

/**
 * Create a new categorization rule
 */
export function createRule(data: CreateRuleData): CategorizationRule {
  const db = getDb();

  // Verify account exists
  const account = db.prepare("SELECT id, code, name FROM accounts WHERE id = ?").get(data.account_id) as { id: number; code: string; name: string } | undefined;
  if (!account) {
    throw new Error(`Account with ID ${data.account_id} not found`);
  }

  const result = db.prepare(`
    INSERT INTO categorization_rules (pattern, vendor_pattern, account_id, priority)
    VALUES (?, ?, ?, ?)
  `).run(
    data.pattern.toLowerCase(),
    data.vendor_pattern?.toLowerCase() || null,
    data.account_id,
    data.priority ?? 0
  );

  const ruleId = result.lastInsertRowid as number;
  const rule = getRule(ruleId)!;

  logAudit("create", "categorization_rule", rule.id, null, rule);

  return rule;
}

/**
 * Get a categorization rule by ID
 */
export function getRule(id: number): CategorizationRule | undefined {
  const db = getDb();

  return db.prepare(`
    SELECT r.*, a.name as account_name, a.code as account_code
    FROM categorization_rules r
    JOIN accounts a ON r.account_id = a.id
    WHERE r.id = ?
  `).get(id) as CategorizationRule | undefined;
}

/**
 * List all categorization rules
 */
export function listRules(accountId?: number): CategorizationRule[] {
  const db = getDb();

  let sql = `
    SELECT r.*, a.name as account_name, a.code as account_code
    FROM categorization_rules r
    JOIN accounts a ON r.account_id = a.id
  `;
  const params: unknown[] = [];

  if (accountId) {
    sql += " WHERE r.account_id = ?";
    params.push(accountId);
  }

  sql += " ORDER BY r.priority DESC, r.match_count DESC";

  return db.prepare(sql).all(...params) as CategorizationRule[];
}

/**
 * Delete a categorization rule
 */
export function deleteRule(id: number): boolean {
  const db = getDb();

  const old = getRule(id);
  if (!old) return false;

  db.prepare("DELETE FROM categorization_rules WHERE id = ?").run(id);

  logAudit("delete", "categorization_rule", id, old, null);

  return true;
}

/**
 * Update a categorization rule
 */
export function updateRule(id: number, updates: Partial<CreateRuleData>): CategorizationRule | undefined {
  const db = getDb();

  const old = getRule(id);
  if (!old) return undefined;

  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.pattern !== undefined) {
    fields.push("pattern = ?");
    values.push(updates.pattern.toLowerCase());
  }
  if (updates.vendor_pattern !== undefined) {
    fields.push("vendor_pattern = ?");
    values.push(updates.vendor_pattern?.toLowerCase() || null);
  }
  if (updates.account_id !== undefined) {
    fields.push("account_id = ?");
    values.push(updates.account_id);
  }
  if (updates.priority !== undefined) {
    fields.push("priority = ?");
    values.push(updates.priority);
  }

  if (fields.length === 0) return old;

  values.push(id);
  db.prepare(`UPDATE categorization_rules SET ${fields.join(", ")} WHERE id = ?`).run(...values);

  const updated = getRule(id)!;
  logAudit("update", "categorization_rule", id, old, updated);

  return updated;
}

export interface MatchResult {
  rule: CategorizationRule;
  matched_on: "pattern" | "vendor" | "both";
  confidence: number;
}

/**
 * Find matching categorization rule for an expense
 * Returns the best matching rule based on priority and match type
 */
export function matchExpense(description: string, vendorName?: string): MatchResult | null {
  const db = getDb();

  const rules = db.prepare(`
    SELECT r.*, a.name as account_name, a.code as account_code
    FROM categorization_rules r
    JOIN accounts a ON r.account_id = a.id
    ORDER BY r.priority DESC, r.match_count DESC
  `).all() as CategorizationRule[];

  const descLower = description.toLowerCase();
  const vendorLower = vendorName?.toLowerCase();

  let bestMatch: MatchResult | null = null;

  for (const rule of rules) {
    const patternMatch = descLower.includes(rule.pattern);
    const vendorMatch = rule.vendor_pattern && vendorLower && vendorLower.includes(rule.vendor_pattern);

    if (patternMatch && vendorMatch) {
      // Both match - highest confidence
      const result: MatchResult = {
        rule,
        matched_on: "both",
        confidence: 0.95,
      };
      if (!bestMatch || result.confidence > bestMatch.confidence) {
        bestMatch = result;
      }
    } else if (patternMatch) {
      const result: MatchResult = {
        rule,
        matched_on: "pattern",
        confidence: 0.8,
      };
      if (!bestMatch || result.confidence > bestMatch.confidence) {
        bestMatch = result;
      }
    } else if (vendorMatch) {
      const result: MatchResult = {
        rule,
        matched_on: "vendor",
        confidence: 0.7,
      };
      if (!bestMatch || result.confidence > bestMatch.confidence) {
        bestMatch = result;
      }
    }
  }

  // Update match count if we found a match
  if (bestMatch) {
    db.prepare(`
      UPDATE categorization_rules
      SET match_count = match_count + 1, last_matched_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(bestMatch.rule.id);
  }

  return bestMatch;
}

/**
 * Learn from a user correction - create or update a rule
 * This is called when a user recategorizes an expense
 */
export function learnFromCorrection(
  description: string,
  vendorName: string | undefined,
  newAccountId: number
): CategorizationRule {
  const db = getDb();

  // Extract keywords from description (simple approach - use significant words)
  const words = description.toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 3);

  // Find the most distinctive word(s) to use as pattern
  let pattern = words[0] || description.toLowerCase().substring(0, 20);

  // Check if a similar rule already exists for this account
  const existingRule = db.prepare(`
    SELECT * FROM categorization_rules
    WHERE account_id = ? AND (pattern = ? OR vendor_pattern = ?)
  `).get(newAccountId, pattern, vendorName?.toLowerCase()) as CategorizationRule | undefined;

  if (existingRule) {
    // Increase priority of existing rule
    db.prepare(`
      UPDATE categorization_rules
      SET priority = priority + 1, match_count = match_count + 1
      WHERE id = ?
    `).run(existingRule.id);

    return getRule(existingRule.id)!;
  }

  // Create a new rule
  return createRule({
    pattern,
    vendor_pattern: vendorName,
    account_id: newAccountId,
    priority: 1,
  });
}

/**
 * Get category suggestions for uncategorized expenses
 * Returns expenses with suggested categories
 */
export function getCategorizationSuggestions(limit: number = 20): Array<{
  expense_id: number;
  description: string;
  vendor_name?: string;
  amount: number;
  current_account_id: number;
  current_account_name: string;
  suggested_account_id?: number;
  suggested_account_name?: string;
  confidence?: number;
}> {
  const db = getDb();

  // Get recent expenses
  const expenses = db.prepare(`
    SELECT
      e.id as expense_id,
      e.description,
      v.name as vendor_name,
      e.amount,
      e.account_id as current_account_id,
      a.name as current_account_name
    FROM expenses e
    LEFT JOIN vendors v ON e.vendor_id = v.id
    JOIN accounts a ON e.account_id = a.id
    ORDER BY e.created_at DESC
    LIMIT ?
  `).all(limit) as Array<{
    expense_id: number;
    description: string;
    vendor_name?: string;
    amount: number;
    current_account_id: number;
    current_account_name: string;
  }>;

  return expenses.map(expense => {
    const match = matchExpense(expense.description || "", expense.vendor_name);

    if (match && match.rule.account_id !== expense.current_account_id) {
      return {
        ...expense,
        suggested_account_id: match.rule.account_id,
        suggested_account_name: match.rule.account_name,
        confidence: match.confidence,
      };
    }

    return expense;
  });
}

/**
 * Get rule statistics
 */
export function getRuleStats(): {
  total_rules: number;
  rules_with_matches: number;
  total_matches: number;
  top_rules: Array<{ pattern: string; account_name: string; match_count: number }>;
} {
  const db = getDb();

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total_rules,
      SUM(CASE WHEN match_count > 0 THEN 1 ELSE 0 END) as rules_with_matches,
      SUM(match_count) as total_matches
    FROM categorization_rules
  `).get() as { total_rules: number; rules_with_matches: number; total_matches: number };

  const topRules = db.prepare(`
    SELECT r.pattern, a.name as account_name, r.match_count
    FROM categorization_rules r
    JOIN accounts a ON r.account_id = a.id
    WHERE r.match_count > 0
    ORDER BY r.match_count DESC
    LIMIT 10
  `).all() as Array<{ pattern: string; account_name: string; match_count: number }>;

  return {
    ...stats,
    top_rules: topRules,
  };
}
