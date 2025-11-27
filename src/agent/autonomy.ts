import { getDb, logAudit } from "../db/index.js";

/**
 * Risk levels for agent actions
 */
export type RiskLevel = "none" | "low" | "medium" | "high" | "critical";

/**
 * Action categories for classification
 */
export type ActionCategory = "read" | "create" | "update" | "delete" | "external" | "financial";

/**
 * Agent action log entry
 */
export interface AgentAction {
  id: number;
  session_id: string;
  tool_name: string;
  category: ActionCategory;
  risk_level: RiskLevel;
  input_summary: string;
  output_summary: string;
  success: boolean;
  error_message?: string;
  execution_time_ms: number;
  requires_review: boolean;
  reviewed_at?: string;
  reviewed_by?: string;
  created_at: string;
}

/**
 * Classification rules for agent tools
 */
interface ToolClassification {
  category: ActionCategory;
  risk_level: RiskLevel;
  description: string;
  requiresReview: boolean;
}

/**
 * Tool risk classifications
 */
const TOOL_CLASSIFICATIONS: Record<string, ToolClassification> = {
  // Read operations - no risk
  list_invoices: { category: "read", risk_level: "none", description: "List invoices", requiresReview: false },
  list_documents: { category: "read", risk_level: "none", description: "List documents", requiresReview: false },
  get_financial_summary: { category: "read", risk_level: "none", description: "Get financial summary", requiresReview: false },
  check_einvoice_status: { category: "read", risk_level: "none", description: "Check e-invoice status", requiresReview: false },
  list_pending_einvoices: { category: "read", risk_level: "none", description: "List pending e-invoices", requiresReview: false },
  get_einvoice_errors: { category: "read", risk_level: "none", description: "Get e-invoice errors", requiresReview: false },
  suggest_expense_category: { category: "read", risk_level: "none", description: "Suggest expense category", requiresReview: false },
  get_uncategorized_expenses: { category: "read", risk_level: "none", description: "Get uncategorized expenses", requiresReview: false },
  list_categorization_rules: { category: "read", risk_level: "none", description: "List categorization rules", requiresReview: false },
  get_categorization_stats: { category: "read", risk_level: "none", description: "Get categorization stats", requiresReview: false },
  get_unreconciled_payments: { category: "read", risk_level: "none", description: "Get unreconciled payments", requiresReview: false },
  get_reconciliation_summary: { category: "read", risk_level: "none", description: "Get reconciliation summary", requiresReview: false },
  list_bank_statements: { category: "read", risk_level: "none", description: "List bank statements", requiresReview: false },
  list_bank_transactions: { category: "read", risk_level: "none", description: "List bank transactions", requiresReview: false },
  find_transaction_matches: { category: "read", risk_level: "none", description: "Find transaction matches", requiresReview: false },
  get_statement_progress: { category: "read", risk_level: "none", description: "Get statement progress", requiresReview: false },
  get_bank_reconciliation_stats: { category: "read", risk_level: "none", description: "Get bank reconciliation stats", requiresReview: false },

  // Create operations - low to medium risk
  create_customer: { category: "create", risk_level: "low", description: "Create customer", requiresReview: false },
  create_categorization_rule: { category: "create", risk_level: "low", description: "Create categorization rule", requiresReview: false },
  import_bank_statement: { category: "create", risk_level: "low", description: "Import bank statement", requiresReview: false },

  // Financial create operations - medium risk
  create_invoice: { category: "financial", risk_level: "medium", description: "Create invoice", requiresReview: false },
  record_payment: { category: "financial", risk_level: "medium", description: "Record payment", requiresReview: false },
  record_expense: { category: "financial", risk_level: "medium", description: "Record expense", requiresReview: false },
  create_expense_from_document: { category: "financial", risk_level: "medium", description: "Create expense from document", requiresReview: false },

  // Update operations - medium risk
  send_invoice: { category: "update", risk_level: "medium", description: "Send invoice", requiresReview: false },
  mark_invoice_paid: { category: "update", risk_level: "medium", description: "Mark invoice paid", requiresReview: false },
  recategorize_expense: { category: "update", risk_level: "medium", description: "Recategorize expense", requiresReview: false },
  mark_payment_cleared: { category: "update", risk_level: "low", description: "Mark payment cleared", requiresReview: false },
  reconcile_payment: { category: "update", risk_level: "low", description: "Reconcile payment", requiresReview: false },
  match_transaction: { category: "update", risk_level: "low", description: "Match transaction", requiresReview: false },
  unmatch_transaction: { category: "update", risk_level: "low", description: "Unmatch transaction", requiresReview: false },
  ignore_transaction: { category: "update", risk_level: "low", description: "Ignore transaction", requiresReview: false },
  finalize_reconciliation: { category: "update", risk_level: "medium", description: "Finalize reconciliation", requiresReview: false },

  // Batch operations - medium to high risk
  auto_categorize_expenses: { category: "update", risk_level: "medium", description: "Auto-categorize expenses", requiresReview: true },
  auto_match_transactions: { category: "update", risk_level: "medium", description: "Auto-match transactions", requiresReview: true },
  process_document: { category: "update", risk_level: "low", description: "Process document", requiresReview: false },

  // External operations - high risk
  submit_einvoice: { category: "external", risk_level: "high", description: "Submit e-invoice to LHDN", requiresReview: true },
  cancel_einvoice: { category: "external", risk_level: "critical", description: "Cancel e-invoice", requiresReview: true },
};

/**
 * Get the risk classification for a tool
 */
export function getToolClassification(toolName: string): ToolClassification {
  return TOOL_CLASSIFICATIONS[toolName] || {
    category: "read",
    risk_level: "low",
    description: toolName,
    requiresReview: false,
  };
}

/**
 * Log an agent action
 */
export function logAgentAction(
  sessionId: string,
  toolName: string,
  input: Record<string, any>,
  output: { success: boolean; result: string; data?: any },
  executionTimeMs: number
): AgentAction {
  const db = getDb();
  const classification = getToolClassification(toolName);

  // Create summary of input (truncate long values)
  const inputSummary = Object.entries(input)
    .map(([k, v]) => {
      const val = typeof v === "object" ? JSON.stringify(v) : String(v);
      return `${k}: ${val.length > 50 ? val.slice(0, 50) + "..." : val}`;
    })
    .join(", ");

  // Create summary of output
  const outputSummary = output.result.length > 200
    ? output.result.slice(0, 200) + "..."
    : output.result;

  const result = db.prepare(`
    INSERT INTO agent_actions (
      session_id, tool_name, category, risk_level, input_summary, output_summary,
      success, error_message, execution_time_ms, requires_review
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    sessionId,
    toolName,
    classification.category,
    classification.risk_level,
    inputSummary,
    outputSummary,
    output.success ? 1 : 0,
    output.success ? null : output.result,
    executionTimeMs,
    classification.requiresReview ? 1 : 0
  );

  // Also log to audit if it's a high-risk action
  if (classification.risk_level === "high" || classification.risk_level === "critical") {
    logAudit("agent_action", "agent", result.lastInsertRowid as number, null, {
      tool: toolName,
      risk: classification.risk_level,
      input: inputSummary,
    });
  }

  return getAgentAction(result.lastInsertRowid as number)!;
}

/**
 * Get an agent action by ID
 */
export function getAgentAction(id: number): AgentAction | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM agent_actions WHERE id = ?").get(id) as AgentAction | undefined;
}

/**
 * Get recent agent actions
 */
export function getRecentActions(sessionId?: string, limit: number = 50): AgentAction[] {
  const db = getDb();

  if (sessionId) {
    return db.prepare(`
      SELECT * FROM agent_actions
      WHERE session_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(sessionId, limit) as AgentAction[];
  }

  return db.prepare(`
    SELECT * FROM agent_actions
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit) as AgentAction[];
}

/**
 * Get actions pending review
 */
export function getActionsPendingReview(): AgentAction[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM agent_actions
    WHERE requires_review = 1 AND reviewed_at IS NULL
    ORDER BY created_at DESC
  `).all() as AgentAction[];
}

/**
 * Mark an action as reviewed
 */
export function markActionReviewed(actionId: number, reviewedBy: string = "user"): boolean {
  const db = getDb();
  const result = db.prepare(`
    UPDATE agent_actions
    SET reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ?
    WHERE id = ?
  `).run(reviewedBy, actionId);

  return result.changes > 0;
}

/**
 * Get agent action statistics
 */
export function getAgentStats(fromDate?: string): {
  total_actions: number;
  successful_actions: number;
  failed_actions: number;
  actions_by_category: Record<string, number>;
  actions_by_risk: Record<string, number>;
  pending_review: number;
  avg_execution_time_ms: number;
  most_used_tools: Array<{ tool: string; count: number }>;
} {
  const db = getDb();

  let whereClause = "";
  const params: string[] = [];
  if (fromDate) {
    whereClause = " WHERE created_at >= ?";
    params.push(fromDate);
  }

  const totals = db.prepare(`
    SELECT
      COUNT(*) as total_actions,
      SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_actions,
      SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed_actions,
      SUM(CASE WHEN requires_review = 1 AND reviewed_at IS NULL THEN 1 ELSE 0 END) as pending_review,
      AVG(execution_time_ms) as avg_execution_time_ms
    FROM agent_actions${whereClause}
  `).get(...params) as {
    total_actions: number;
    successful_actions: number;
    failed_actions: number;
    pending_review: number;
    avg_execution_time_ms: number;
  };

  const byCategory = db.prepare(`
    SELECT category, COUNT(*) as count
    FROM agent_actions${whereClause}
    GROUP BY category
  `).all(...params) as Array<{ category: string; count: number }>;

  const byRisk = db.prepare(`
    SELECT risk_level, COUNT(*) as count
    FROM agent_actions${whereClause}
    GROUP BY risk_level
  `).all(...params) as Array<{ risk_level: string; count: number }>;

  const topTools = db.prepare(`
    SELECT tool_name as tool, COUNT(*) as count
    FROM agent_actions${whereClause}
    GROUP BY tool_name
    ORDER BY count DESC
    LIMIT 10
  `).all(...params) as Array<{ tool: string; count: number }>;

  return {
    total_actions: totals.total_actions || 0,
    successful_actions: totals.successful_actions || 0,
    failed_actions: totals.failed_actions || 0,
    actions_by_category: Object.fromEntries(byCategory.map(c => [c.category, c.count])),
    actions_by_risk: Object.fromEntries(byRisk.map(r => [r.risk_level, r.count])),
    pending_review: totals.pending_review || 0,
    avg_execution_time_ms: Math.round(totals.avg_execution_time_ms || 0),
    most_used_tools: topTools,
  };
}

/**
 * Proactive suggestions based on current state
 */
export interface ProactiveSuggestion {
  id: string;
  priority: "low" | "medium" | "high";
  category: string;
  title: string;
  description: string;
  suggestedTool: string;
  suggestedArgs?: Record<string, any>;
  reason: string;
}

/**
 * Generate proactive suggestions based on current accounting state
 */
export function generateProactiveSuggestions(): ProactiveSuggestion[] {
  const db = getDb();
  const suggestions: ProactiveSuggestion[] = [];

  // Check for overdue invoices
  const overdueInvoices = db.prepare(`
    SELECT COUNT(*) as count, SUM(total - amount_paid) as total_amount
    FROM invoices
    WHERE status IN ('sent', 'partial') AND due_date < date('now')
  `).get() as { count: number; total_amount: number };

  if (overdueInvoices.count > 0) {
    suggestions.push({
      id: "overdue-invoices",
      priority: "high",
      category: "receivables",
      title: `${overdueInvoices.count} overdue invoice(s)`,
      description: `$${(overdueInvoices.total_amount || 0).toFixed(2)} in overdue receivables`,
      suggestedTool: "list_invoices",
      suggestedArgs: { status: "overdue" },
      reason: "Overdue invoices impact cash flow and may need follow-up",
    });
  }

  // Check for unreconciled payments
  const unreconciledPayments = db.prepare(`
    SELECT COUNT(*) as count, SUM(amount) as total_amount
    FROM payments
    WHERE reconciled = 0
  `).get() as { count: number; total_amount: number };

  if (unreconciledPayments.count > 5) {
    suggestions.push({
      id: "unreconciled-payments",
      priority: "medium",
      category: "reconciliation",
      title: `${unreconciledPayments.count} unreconciled payments`,
      description: `$${(unreconciledPayments.total_amount || 0).toFixed(2)} in unreconciled transactions`,
      suggestedTool: "get_unreconciled_payments",
      reason: "Regular reconciliation ensures accurate financial records",
    });
  }

  // Check for uncategorized expenses
  const uncategorizedExpenses = db.prepare(`
    SELECT COUNT(*) as count, SUM(e.amount) as total_amount
    FROM expenses e
    JOIN accounts a ON e.account_id = a.id
    WHERE a.name LIKE '%Other%' OR a.code = '6100'
  `).get() as { count: number; total_amount: number };

  if (uncategorizedExpenses.count > 0) {
    suggestions.push({
      id: "uncategorized-expenses",
      priority: "low",
      category: "categorization",
      title: `${uncategorizedExpenses.count} uncategorized expense(s)`,
      description: `$${(uncategorizedExpenses.total_amount || 0).toFixed(2)} in "Other Expenses"`,
      suggestedTool: "get_uncategorized_expenses",
      reason: "Proper categorization improves expense tracking and tax reporting",
    });
  }

  // Check for pending e-invoices (Malaysia compliance)
  const pendingEinvoices = db.prepare(`
    SELECT COUNT(*) as count
    FROM invoices
    WHERE status IN ('sent', 'partial', 'paid')
    AND (einvoice_status IS NULL OR einvoice_status = 'none')
  `).get() as { count: number };

  if (pendingEinvoices.count > 0) {
    suggestions.push({
      id: "pending-einvoices",
      priority: "medium",
      category: "compliance",
      title: `${pendingEinvoices.count} invoice(s) need e-invoice submission`,
      description: "Invoices ready for LHDN e-invoice submission",
      suggestedTool: "list_pending_einvoices",
      reason: "E-invoice compliance is required for Malaysian businesses",
    });
  }

  // Check for unprocessed documents
  const unprocessedDocs = db.prepare(`
    SELECT COUNT(*) as count
    FROM documents
    WHERE status = 'pending'
  `).get() as { count: number };

  if (unprocessedDocs.count > 0) {
    suggestions.push({
      id: "unprocessed-documents",
      priority: "low",
      category: "documents",
      title: `${unprocessedDocs.count} document(s) to process`,
      description: "Uploaded documents waiting for data extraction",
      suggestedTool: "list_documents",
      suggestedArgs: { status: "pending" },
      reason: "Processing documents helps capture expenses accurately",
    });
  }

  // Check for bank statements needing reconciliation
  const pendingStatements = db.prepare(`
    SELECT COUNT(*) as count
    FROM bank_statements
    WHERE status IN ('pending', 'reconciling')
  `).get() as { count: number };

  if (pendingStatements.count > 0) {
    suggestions.push({
      id: "pending-statements",
      priority: "medium",
      category: "reconciliation",
      title: `${pendingStatements.count} bank statement(s) need reconciliation`,
      description: "Bank statements in progress",
      suggestedTool: "list_bank_statements",
      reason: "Completing reconciliation ensures accurate bank balances",
    });
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return suggestions;
}

/**
 * Check if an action requires user confirmation based on risk and context
 */
export function requiresConfirmation(
  toolName: string,
  args: Record<string, any>,
  context?: { totalValue?: number; batchSize?: number }
): { required: boolean; reason?: string } {
  const classification = getToolClassification(toolName);

  // Critical actions always require confirmation
  if (classification.risk_level === "critical") {
    return { required: true, reason: `${classification.description} is a critical operation` };
  }

  // High-risk external operations
  if (classification.risk_level === "high" && classification.category === "external") {
    return { required: true, reason: `${classification.description} will interact with external systems` };
  }

  // Batch operations over a threshold
  if (context?.batchSize && context.batchSize > 10) {
    return { required: true, reason: `This will affect ${context.batchSize} items` };
  }

  // High-value financial operations
  if (context?.totalValue && context.totalValue > 10000) {
    return { required: true, reason: `This involves $${context.totalValue.toFixed(2)}` };
  }

  // Actions that require review
  if (classification.requiresReview) {
    return { required: true, reason: `${classification.description} requires review` };
  }

  return { required: false };
}
