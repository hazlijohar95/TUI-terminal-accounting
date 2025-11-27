import React from "react";
import { Box, Text } from "ink";
import { colors } from "../themes/colors.js";

type OutputProps = {
  content: string;
  type?: "info" | "success" | "error" | "warning";
};

export function Output({ content, type = "info" }: OutputProps) {
  const colorMap = {
    info: colors.text,
    success: colors.success,
    error: colors.error,
    warning: colors.warning,
  };

  if (!content) {
    return (
      <Box marginY={1}>
        <Text color={colors.textDimmed}>
          Type a command or question below...
        </Text>
      </Box>
    );
  }

  return (
    <Box marginY={1} flexDirection="column">
      <Text color={colorMap[type]}>{content}</Text>
    </Box>
  );
}
