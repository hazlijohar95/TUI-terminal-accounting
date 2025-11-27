import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { getEnhancedTheme } from "../design/theme.js";
import { borderStyles } from "../design/tokens.js";

interface CommandBarProps {
  active: boolean;
  onSubmit: (command: string) => void;
  onCancel: () => void;
  width: number;
}

export function CommandBar({ active, onSubmit, onCancel, width }: CommandBarProps) {
  const theme = getEnhancedTheme();
  const [input, setInput] = useState("");

  useInput(
    (char, key) => {
      if (!active) return;

      if (key.escape) {
        setInput("");
        onCancel();
        return;
      }

      if (key.return) {
        const cmd = input;
        setInput("");
        onSubmit(cmd);
        return;
      }

      if (key.backspace || key.delete) {
        setInput((prev) => prev.slice(0, -1));
        return;
      }

      // Regular character
      if (char && !key.ctrl && !key.meta) {
        setInput((prev) => prev + char);
      }
    },
    { isActive: active }
  );

  return (
    <Box
      width={width}
      height={1}
      borderStyle={borderStyles.input}
      borderColor={active ? theme.semantic.focusBorder : theme.semantic.border}
      paddingX={1}
    >
      {active ? (
        <Box>
          <Text color={theme.semantic.focusBorder}>:</Text>
          <Text color={theme.semantic.textPrimary}>{input}</Text>
          <Text backgroundColor={theme.semantic.focusBorder}> </Text>
        </Box>
      ) : (
        <Text color={theme.semantic.textMuted}>Press : for command mode</Text>
      )}
    </Box>
  );
}
