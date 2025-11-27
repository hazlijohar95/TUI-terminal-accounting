import React from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { colors } from "../themes/colors.js";

type InputProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
};

export function Input({ value, onChange, onSubmit }: InputProps) {
  return (
    <Box>
      <Text color={colors.primary} bold>
        {"❯ "}
      </Text>
      <TextInput
        value={value}
        onChange={onChange}
        onSubmit={onSubmit}
        placeholder="Enter command (help, ask, propose, report, quit)"
        focus={true}
      />
    </Box>
  );
}
