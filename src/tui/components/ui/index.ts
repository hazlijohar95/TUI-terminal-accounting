/**
 * UI Component Library
 *
 * Reusable components for building consistent, polished TUI interfaces.
 */

// Layout components
export { Panel, PanelDivider, PanelSection, type PanelProps, type PanelSectionProps } from "./Panel.js";
export { Stack, HStack, VStack, Spacer, Gap, type StackProps, type GapProps } from "./Stack.js";
export { SplitView, ThreePanelLayout, ResponsiveSplit, type SplitViewProps, type ThreePanelLayoutProps, type ResponsiveSplitProps } from "./SplitView.js";

// Interactive components
export { FocusableList, ListItem, EmptyState, type FocusableListProps, type ListItemProps, type EmptyStateProps } from "./FocusableList.js";
export { FormField, TextAreaField, CheckboxField, FormSection, type FormFieldProps, type TextAreaFieldProps, type CheckboxFieldProps, type FormSectionProps } from "./FormField.js";
export { Selector, SimpleSelect, TabBar, RadioGroup, type SelectorProps, type SelectorOption, type SimpleSelectProps, type TabBarProps, type RadioGroupProps } from "./Selector.js";
export { DataTable, SimpleTable, type DataTableProps, type Column, type SimpleTableProps } from "./DataTable.js";

// Display components
export { Badge, StatusBadge, EInvoiceBadge, CountBadge, Tag, Pill, type BadgeProps, type CountBadgeProps, type TagProps, type PillProps } from "./Badge.js";
export { StatusIndicator, LoadingIndicator, ConnectionStatus, SyncStatus, ValidationStatus, type StatusIndicatorProps, type StatusType, type LoadingIndicatorProps, type ConnectionStatusProps, type SyncStatusProps, type ValidationStatusProps } from "./StatusIndicator.js";
export { KeyValue, KeyValueGroup, FinancialRow, DefinitionList, type KeyValueProps, type KeyValueGroupProps, type FinancialRowProps, type DefinitionListProps } from "./KeyValue.js";

// Feedback components
export { Toast, ToastProvider, useToast, ToastContainer, Notification, type ToastProps, type ToastType, type NotificationProps } from "./Toast.js";
export { LoadingOverlay, InlineLoader, Skeleton, LoadingState, type LoadingOverlayProps, type InlineLoaderProps, type SkeletonProps, type LoadingStateProps } from "./LoadingOverlay.js";
export { ConfirmDialog, PromptDialog, AlertDialog, type ConfirmDialogProps, type PromptDialogProps, type AlertDialogProps } from "./ConfirmDialog.js";
export { ProgressBar, StepProgress, CircularProgress, TransferProgress, type ProgressBarProps, type StepProgressProps, type CircularProgressProps, type TransferProgressProps } from "./ProgressBar.js";
export { KeyboardHelp, KeyboardHintBar, commonShortcuts, invoiceShortcuts, contactShortcuts, chatShortcuts, dashboardShortcuts, type KeyboardHelpProps, type KeyboardShortcut, type KeyboardHintBarProps } from "./KeyboardHelp.js";

// Charts and visualization
export {
  Sparkline,
  ProgressBar as ChartProgressBar,
  HorizontalBarChart,
  MiniDonut,
  Gauge,
  TrendIndicator,
  HealthIndicator,
  CalendarHeat,
  BigNumber,
  type SparklineProps,
  type HorizontalBarChartProps,
  type GaugeProps,
  type TrendIndicatorProps,
  type HealthIndicatorProps,
  type BigNumberProps,
} from "./Charts.js";

// Enhanced Empty States
export {
  EmptyState as RichEmptyState,
  NoInvoicesEmptyState,
  NoCustomersEmptyState,
  NoExpensesEmptyState,
  NoDocumentsEmptyState,
  NoReportsEmptyState,
  NoSearchResultsEmptyState,
  FilteredEmptyState,
  ConnectionErrorEmptyState,
  FeatureComingSoonEmptyState,
  type EmptyStateProps as RichEmptyStateProps,
  type EmptyStateAction,
} from "./EmptyState.js";
