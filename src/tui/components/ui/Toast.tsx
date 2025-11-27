/**
 * Toast Component
 *
 * Temporary notification messages that auto-dismiss.
 * Used for success messages, errors, and other feedback.
 */

import React, { useState, useEffect, createContext, useContext, useCallback } from "react";
import { Box, Text } from "ink";
import { getEnhancedTheme } from "../../design/theme.js";
import { indicators, borderStyles } from "../../design/tokens.js";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastProps {
  /** Toast type (determines styling) */
  type?: ToastType;
  /** Message to display */
  message: string;
  /** Duration in ms before auto-dismiss (0 = permanent) */
  duration?: number;
  /** Called when toast is dismissed */
  onDismiss?: () => void;
  /** Show dismiss hint */
  showDismiss?: boolean;
}

export function Toast({
  type = "info",
  message,
  duration = 3000,
  onDismiss,
  showDismiss = false,
}: ToastProps) {
  const theme = getEnhancedTheme();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setVisible(false);
        onDismiss?.();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onDismiss]);

  if (!visible) return null;

  // Get styling based on type
  const getTypeConfig = () => {
    switch (type) {
      case "success":
        return {
          icon: indicators.check,
          color: theme.semantic.success,
          bgColor: theme.semantic.surfaceSubtle,
        };
      case "error":
        return {
          icon: indicators.cross,
          color: theme.semantic.error,
          bgColor: theme.semantic.surfaceSubtle,
        };
      case "warning":
        return {
          icon: indicators.warning,
          color: theme.semantic.warning,
          bgColor: theme.semantic.surfaceSubtle,
        };
      case "info":
      default:
        return {
          icon: indicators.info,
          color: theme.semantic.info,
          bgColor: theme.semantic.surfaceSubtle,
        };
    }
  };

  const config = getTypeConfig();

  return (
    <Box
      borderStyle={borderStyles.panel}
      borderColor={config.color}
      paddingX={1}
    >
      <Text color={config.color}>{config.icon}</Text>
      <Text> </Text>
      <Text color={theme.semantic.textPrimary}>{message}</Text>
      {showDismiss && (
        <Text color={theme.semantic.textMuted}> (press any key)</Text>
      )}
    </Box>
  );
}

/**
 * Toast queue item
 */
interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
}

/**
 * Toast context for managing toast queue
 */
interface ToastContextValue {
  toasts: ToastItem[];
  addToast: (type: ToastType, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Toast provider component
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback(
    (type: ToastType, message: string, duration = 3000) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      setToasts((prev) => [...prev, { id, type, message, duration }]);
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const success = useCallback(
    (message: string, duration?: number) => addToast("success", message, duration),
    [addToast]
  );

  const error = useCallback(
    (message: string, duration?: number) => addToast("error", message, duration),
    [addToast]
  );

  const warning = useCallback(
    (message: string, duration?: number) => addToast("warning", message, duration),
    [addToast]
  );

  const info = useCallback(
    (message: string, duration?: number) => addToast("info", message, duration),
    [addToast]
  );

  return (
    <ToastContext.Provider
      value={{ toasts, addToast, removeToast, success, error, warning, info }}
    >
      {children}
    </ToastContext.Provider>
  );
}

/**
 * Hook to use toast notifications
 */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

/**
 * Toast container that renders all active toasts
 */
export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <Box flexDirection="column" position="absolute" marginTop={1}>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          type={toast.type}
          message={toast.message}
          duration={toast.duration}
          onDismiss={() => removeToast(toast.id)}
        />
      ))}
    </Box>
  );
}

/**
 * Inline notification (non-dismissing)
 */
export interface NotificationProps {
  type: ToastType;
  title?: string;
  message: string;
  actions?: React.ReactNode;
}

export function Notification({ type, title, message, actions }: NotificationProps) {
  const theme = getEnhancedTheme();

  const getIcon = () => {
    switch (type) {
      case "success":
        return { icon: indicators.check, color: theme.semantic.success };
      case "error":
        return { icon: indicators.cross, color: theme.semantic.error };
      case "warning":
        return { icon: indicators.warning, color: theme.semantic.warning };
      case "info":
      default:
        return { icon: indicators.info, color: theme.semantic.info };
    }
  };

  const { icon, color } = getIcon();

  return (
    <Box
      flexDirection="column"
      borderStyle={borderStyles.panel}
      borderColor={color}
      paddingX={1}
      paddingY={1}
    >
      <Box>
        <Text color={color}>{icon}</Text>
        <Text> </Text>
        {title && <Text bold color={color}>{title}</Text>}
      </Box>
      <Box paddingLeft={2}>
        <Text color={theme.semantic.textPrimary}>{message}</Text>
      </Box>
      {actions && (
        <Box paddingLeft={2} marginTop={1}>
          {actions}
        </Box>
      )}
    </Box>
  );
}
