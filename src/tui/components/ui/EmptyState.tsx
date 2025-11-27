/**
 * EmptyState Component
 *
 * Displays helpful messages when lists or views are empty,
 * with contextual suggestions and call-to-action buttons.
 */

import React from "react";
import { Box, Text } from "ink";
import { getEnhancedTheme } from "../../design/theme.js";
import { indicators } from "../../design/tokens.js";

export interface EmptyStateAction {
  /** Key to press */
  key: string;
  /** Action label */
  label: string;
  /** Action description */
  description?: string;
}

export interface EmptyStateProps {
  /** Icon to display (emoji or unicode) */
  icon?: string;
  /** Main title */
  title: string;
  /** Descriptive message */
  message?: string;
  /** Actions user can take */
  actions?: EmptyStateAction[];
  /** Additional hints */
  hints?: string[];
  /** Compact mode for inline use */
  compact?: boolean;
  /** Width */
  width?: number;
}

export function EmptyState({
  icon,
  title,
  message,
  actions = [],
  hints = [],
  compact = false,
  width,
}: EmptyStateProps) {
  const theme = getEnhancedTheme();

  if (compact) {
    return (
      <Box flexDirection="column" alignItems="center" paddingY={1}>
        <Text color={theme.semantic.textMuted}>
          {icon && `${icon} `}
          {title}
        </Text>
        {actions.length > 0 && (
          <Text color={theme.semantic.textMuted} dimColor>
            Press <Text color={theme.semantic.primary}>{actions[0].key}</Text> to {actions[0].label.toLowerCase()}
          </Text>
        )}
      </Box>
    );
  }

  return (
    <Box
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      paddingY={2}
      paddingX={3}
      width={width}
    >
      {/* Icon */}
      {icon && (
        <Box marginBottom={1}>
          <Text color={theme.semantic.textMuted} dimColor>
            {icon}
          </Text>
        </Box>
      )}

      {/* Title */}
      <Text bold color={theme.semantic.textSecondary}>
        {title}
      </Text>

      {/* Message */}
      {message && (
        <Box marginTop={1}>
          <Text color={theme.semantic.textMuted}>{message}</Text>
        </Box>
      )}

      {/* Actions */}
      {actions.length > 0 && (
        <Box flexDirection="column" marginTop={2} alignItems="center">
          <Text color={theme.semantic.textMuted} dimColor>
            ─── Quick Actions ───
          </Text>
          <Box marginTop={1} flexDirection="column">
            {actions.map((action, i) => (
              <Box key={i}>
                <Text color={theme.semantic.primary} bold>
                  {action.key}
                </Text>
                <Text color={theme.semantic.textPrimary}> {action.label}</Text>
                {action.description && (
                  <Text color={theme.semantic.textMuted} dimColor>
                    {" "}
                    - {action.description}
                  </Text>
                )}
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* Hints */}
      {hints.length > 0 && (
        <Box flexDirection="column" marginTop={2}>
          {hints.map((hint, i) => (
            <Text key={i} color={theme.semantic.textMuted} dimColor>
              {indicators.bullet} {hint}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
}

/**
 * Pre-configured empty states for common scenarios
 */

export function NoInvoicesEmptyState() {
  return (
    <EmptyState
      icon="📄"
      title="No invoices yet"
      message="Create your first invoice to get started"
      actions={[
        { key: "n", label: "New invoice", description: "Create a new invoice" },
        { key: "c", label: "AI Chat", description: "Ask AI to create one" },
      ]}
      hints={[
        "Tip: Add customers first for faster invoicing",
        "Press ? for all keyboard shortcuts",
      ]}
    />
  );
}

export function NoCustomersEmptyState() {
  return (
    <EmptyState
      icon="👥"
      title="No customers yet"
      message="Add your first customer to start invoicing"
      actions={[
        { key: "n", label: "Add customer" },
      ]}
      hints={[
        "Customers are required for creating invoices",
        "Add TIN for e-invoice compliance",
      ]}
    />
  );
}

export function NoExpensesEmptyState() {
  return (
    <EmptyState
      icon="💸"
      title="No expenses recorded"
      message="Track your business expenses here"
      actions={[
        { key: "n", label: "Add expense" },
        { key: "c", label: "AI Chat", description: "Describe expense to AI" },
      ]}
      hints={[
        "Categorize expenses for accurate reporting",
        "Attach receipts in the Vault",
      ]}
    />
  );
}

export function NoDocumentsEmptyState() {
  return (
    <EmptyState
      icon="📁"
      title="Vault is empty"
      message="Upload receipts, statements, and documents"
      actions={[
        { key: "n", label: "Upload document" },
      ]}
      hints={[
        "Supported: PDF, images, CSV bank statements",
        "Documents can be linked to invoices and expenses",
      ]}
    />
  );
}

export function NoReportsEmptyState() {
  return (
    <EmptyState
      icon="📊"
      title="No data for reports"
      message="Reports will appear once you have transactions"
      actions={[
        { key: "i", label: "Create invoice" },
        { key: "e", label: "Add expense" },
      ]}
      hints={[
        "Financial reports require at least one transaction",
        "Start with an invoice or expense entry",
      ]}
    />
  );
}

export function NoSearchResultsEmptyState({ query }: { query: string }) {
  return (
    <EmptyState
      icon="🔍"
      title="No results found"
      message={`No matches for "${query}"`}
      hints={[
        "Try a different search term",
        "Check for typos in your search",
        "Use fewer or broader keywords",
      ]}
    />
  );
}

export function FilteredEmptyState({ filter }: { filter: string }) {
  return (
    <EmptyState
      icon="🔽"
      title="No matching items"
      message={`No items match the "${filter}" filter`}
      actions={[
        { key: "f", label: "Change filter" },
      ]}
      hints={[
        "Try a different filter or date range",
        "Check if items exist with other statuses",
      ]}
    />
  );
}

export function ConnectionErrorEmptyState({ retry }: { retry?: () => void }) {
  return (
    <EmptyState
      icon="⚠️"
      title="Connection Error"
      message="Unable to load data"
      actions={retry ? [{ key: "R", label: "Retry" }] : []}
      hints={[
        "Check your internet connection",
        "The service may be temporarily unavailable",
      ]}
    />
  );
}

export function FeatureComingSoonEmptyState({ feature }: { feature: string }) {
  return (
    <EmptyState
      icon="🚧"
      title="Coming Soon"
      message={`${feature} is under development`}
      hints={[
        "This feature will be available in a future update",
        "Check back soon!",
      ]}
    />
  );
}
