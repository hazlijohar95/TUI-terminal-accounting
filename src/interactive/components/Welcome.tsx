import React from "react";
import { Box, Text } from "ink";
import { colors } from "../themes/colors.js";

type WelcomeProps = {
  workspaceName?: string;
  transactionCount?: number;
  ledgerPath?: string;
};

export function Welcome({ workspaceName, transactionCount }: WelcomeProps) {
  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Minimal branded header */}
      <Box marginBottom={1}>
        <Text bold color={colors.primary}>Open</Text>
        <Text bold color={colors.secondary}>Accounting</Text>
        <Text color={colors.textDimmed}> — Your AI Financial Assistant</Text>
      </Box>

      {/* Status line */}
      {workspaceName && (
        <Box marginBottom={1}>
          <Text color={colors.success}>●</Text>
          <Text color={colors.textMuted}> {workspaceName}</Text>
          {transactionCount !== undefined && transactionCount > 0 && (
            <Text color={colors.textDimmed}> • {transactionCount} transactions</Text>
          )}
        </Box>
      )}

      {/* Conversational prompt */}
      <Box flexDirection="column" marginTop={1}>
        <Text color={colors.text}>What would you like to know about your finances?</Text>
      </Box>

      {/* Example suggestions */}
      <Box flexDirection="column" marginTop={2}>
        <Text color={colors.textDimmed}>Try asking:</Text>
        <Box marginTop={1} flexDirection="column">
          <Box>
            <Text color={colors.textMuted}>  "</Text>
            <Text color={colors.primary}>How am I doing this month?</Text>
            <Text color={colors.textMuted}>"</Text>
          </Box>
          <Box>
            <Text color={colors.textMuted}>  "</Text>
            <Text color={colors.primary}>Show my top expenses</Text>
            <Text color={colors.textMuted}>"</Text>
          </Box>
          <Box>
            <Text color={colors.textMuted}>  "</Text>
            <Text color={colors.primary}>Add coffee 5.50</Text>
            <Text color={colors.textMuted}>"</Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
