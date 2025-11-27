/**
 * User-Friendly Error Handling
 *
 * Provides clear error messages with actionable suggestions.
 */

export interface UserFriendlyError {
  /** Short title for the error */
  title: string;
  /** Detailed explanation */
  message: string;
  /** Suggested actions to fix the issue */
  suggestions: string[];
  /** Error code for debugging */
  code?: string;
  /** Original error for logging */
  originalError?: Error;
}

/**
 * Common error patterns and their user-friendly messages
 */
const ERROR_PATTERNS: Array<{
  pattern: RegExp | string;
  handler: (match: RegExpMatchArray | null, error: Error) => UserFriendlyError;
}> = [
  // Database errors
  {
    pattern: /SQLITE_CONSTRAINT.*UNIQUE/i,
    handler: () => ({
      title: "Duplicate Entry",
      message: "This item already exists in the database.",
      suggestions: [
        "Check if a similar record already exists",
        "Use a different identifier (e.g., invoice number)",
        "Edit the existing record instead of creating a new one",
      ],
    }),
  },
  {
    pattern: /SQLITE_CONSTRAINT.*NOT NULL/i,
    handler: () => ({
      title: "Missing Required Field",
      message: "A required field was not provided.",
      suggestions: [
        "Fill in all required fields (marked with *)",
        "Check the form for any empty fields",
      ],
    }),
  },
  {
    pattern: /SQLITE_CONSTRAINT.*CHECK/i,
    handler: () => ({
      title: "Invalid Value",
      message: "One of the values doesn't meet the required criteria.",
      suggestions: [
        "Ensure amounts are positive numbers",
        "Check that quantities are greater than 0",
        "Verify dates are in the correct format (YYYY-MM-DD)",
      ],
    }),
  },
  {
    pattern: /no such table/i,
    handler: () => ({
      title: "Database Not Initialized",
      message: "The database tables haven't been created yet.",
      suggestions: [
        "Run 'oa init' to set up the database",
        "Check if the database file exists",
        "Try restarting the application",
      ],
      code: "DB_NOT_INIT",
    }),
  },

  // Invoice errors
  {
    pattern: /cannot.*draft.*invoice.*paid/i,
    handler: () => ({
      title: "Invalid Invoice Status",
      message: "Draft invoices cannot be marked as paid directly.",
      suggestions: [
        "First mark the invoice as 'sent'",
        "Then record a payment against it",
      ],
    }),
  },
  {
    pattern: /due date.*before.*invoice date/i,
    handler: () => ({
      title: "Invalid Due Date",
      message: "The due date cannot be before the invoice date.",
      suggestions: [
        "Set the due date to be on or after the invoice date",
        "Check your payment terms setting",
      ],
    }),
  },
  {
    pattern: /payment.*exceeds.*remaining.*balance/i,
    handler: (_, error) => ({
      title: "Payment Too Large",
      message: error.message,
      suggestions: [
        "Enter a smaller payment amount",
        "Check the invoice's outstanding balance",
        "For overpayments, record a credit note instead",
      ],
    }),
  },
  {
    pattern: /credit.*note.*72.*hour/i,
    handler: () => ({
      title: "Credit Note Window Expired",
      message: "Credit notes for validated e-invoices must be issued within 72 hours.",
      suggestions: [
        "Contact LHDN for manual cancellation",
        "Create an adjusting journal entry instead",
        "Issue a new invoice with corrections",
      ],
      code: "LHDN_72HR",
    }),
  },

  // Customer/Vendor errors
  {
    pattern: /customer.*not.*found/i,
    handler: () => ({
      title: "Customer Not Found",
      message: "The specified customer doesn't exist.",
      suggestions: [
        "Create the customer first using 'oa add cust'",
        "Check the customer name spelling",
        "Use the customer list to find available customers",
      ],
    }),
  },
  {
    pattern: /vendor.*not.*found/i,
    handler: () => ({
      title: "Vendor Not Found",
      message: "The specified vendor doesn't exist.",
      suggestions: [
        "Create the vendor first",
        "Check the vendor name spelling",
      ],
    }),
  },

  // Account errors
  {
    pattern: /account.*\(\d+\).*not.*found/i,
    handler: () => ({
      title: "Account Not Found",
      message: "A required ledger account is missing.",
      suggestions: [
        "Run 'oa init' to set up the chart of accounts",
        "Check the Accounting menu to verify accounts exist",
        "Create the missing account manually",
      ],
      code: "ACCT_MISSING",
    }),
  },
  {
    pattern: /expense.*category.*not.*found/i,
    handler: (_, error) => ({
      title: "Unknown Expense Category",
      message: error.message,
      suggestions: [
        "Use one of the suggested account names",
        "Create a new expense account in Accounting menu",
        "Check 'oa report expenses' for available categories",
      ],
    }),
  },

  // LHDN/E-Invoice errors
  {
    pattern: /TIN.*required|TIN.*invalid/i,
    handler: () => ({
      title: "Invalid TIN",
      message: "Tax Identification Number is invalid or missing.",
      suggestions: [
        "Company TIN: C followed by 10 digits (e.g., C1234567890)",
        "Individual TIN: 12 digits",
        "Update in LHDN Settings (press 'l')",
      ],
      code: "LHDN_TIN",
    }),
  },
  {
    pattern: /MSIC.*code.*not.*found/i,
    handler: (_, error) => ({
      title: "Invalid MSIC Code",
      message: error.message,
      suggestions: [
        "Use a valid 5-digit MSIC code",
        "Common codes: 62010 (IT services), 46900 (Trading)",
        "Check LHDN Settings for code suggestions",
      ],
      code: "LHDN_MSIC",
    }),
  },
  {
    pattern: /e-?invoice.*not.*configured/i,
    handler: () => ({
      title: "E-Invoice Not Configured",
      message: "LHDN e-Invoice settings are incomplete.",
      suggestions: [
        "Press 'l' to open LHDN Settings",
        "Fill in TIN, BRN, and business details",
        "Configure API credentials for submission",
      ],
      code: "LHDN_CONFIG",
    }),
  },

  // Network/API errors
  {
    pattern: /network.*error|ECONNREFUSED|ETIMEDOUT/i,
    handler: () => ({
      title: "Network Error",
      message: "Unable to connect to the server.",
      suggestions: [
        "Check your internet connection",
        "The service might be temporarily unavailable",
        "Try again in a few minutes",
      ],
      code: "NETWORK",
    }),
  },
  {
    pattern: /api.*key.*invalid|unauthorized|401/i,
    handler: () => ({
      title: "Authentication Failed",
      message: "The API key is invalid or expired.",
      suggestions: [
        "Check your API key in settings",
        "Generate a new API key if needed",
        "Ensure the key has the required permissions",
      ],
      code: "AUTH",
    }),
  },

  // Amount/Validation errors
  {
    pattern: /amount.*must.*greater.*0|amount.*positive/i,
    handler: () => ({
      title: "Invalid Amount",
      message: "Amount must be a positive number.",
      suggestions: [
        "Enter a number greater than 0",
        "For credits/refunds, use a credit note instead",
      ],
    }),
  },
  {
    pattern: /quantity.*greater.*0/i,
    handler: () => ({
      title: "Invalid Quantity",
      message: "Quantity must be greater than zero.",
      suggestions: [
        "Enter a positive quantity",
        "Minimum quantity is 1",
      ],
    }),
  },
];

/**
 * Convert an error to a user-friendly format
 */
export function toUserFriendlyError(error: unknown): UserFriendlyError {
  const err = error instanceof Error ? error : new Error(String(error));
  const message = err.message;

  // Try to match against known patterns
  for (const { pattern, handler } of ERROR_PATTERNS) {
    const regex = typeof pattern === "string" ? new RegExp(pattern, "i") : pattern;
    const match = message.match(regex);
    if (match) {
      const result = handler(match, err);
      result.originalError = err;
      return result;
    }
  }

  // Default fallback
  return {
    title: "Error",
    message: message || "An unexpected error occurred.",
    suggestions: [
      "Try the operation again",
      "Check your input for any issues",
      "If the problem persists, check the logs",
    ],
    originalError: err,
  };
}

/**
 * Format error for display in CLI
 */
export function formatErrorForCLI(error: unknown): string {
  const friendly = toUserFriendlyError(error);
  const lines: string[] = [];

  lines.push(`\x1b[1m\x1b[31m${friendly.title}\x1b[0m`);
  lines.push(`  ${friendly.message}`);

  if (friendly.suggestions.length > 0) {
    lines.push("");
    lines.push("\x1b[33mSuggestions:\x1b[0m");
    for (const suggestion of friendly.suggestions) {
      lines.push(`  \x1b[2m•\x1b[0m ${suggestion}`);
    }
  }

  if (friendly.code) {
    lines.push("");
    lines.push(`\x1b[2mError code: ${friendly.code}\x1b[0m`);
  }

  return lines.join("\n");
}

/**
 * Format error for TUI display (returns structured data)
 */
export function formatErrorForTUI(error: unknown): {
  title: string;
  message: string;
  suggestions: string[];
  code?: string;
} {
  const friendly = toUserFriendlyError(error);
  return {
    title: friendly.title,
    message: friendly.message,
    suggestions: friendly.suggestions,
    code: friendly.code,
  };
}

/**
 * Wrap an async function with user-friendly error handling
 */
export async function withFriendlyErrors<T>(
  fn: () => Promise<T>,
  onError?: (error: UserFriendlyError) => void
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    const friendly = toUserFriendlyError(error);
    if (onError) {
      onError(friendly);
    }
    return null;
  }
}

/**
 * Wrap a sync function with user-friendly error handling
 */
export function withFriendlyErrorsSync<T>(
  fn: () => T,
  onError?: (error: UserFriendlyError) => void
): T | null {
  try {
    return fn();
  } catch (error) {
    const friendly = toUserFriendlyError(error);
    if (onError) {
      onError(friendly);
    }
    return null;
  }
}
