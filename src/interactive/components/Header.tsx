import React from "react";
import { Box, Text } from "ink";
import Gradient from "ink-gradient";
import { colors, gradientColors } from "../themes/colors.js";

export function Header() {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Gradient colors={gradientColors}>
        <Text bold>OpenAccounting.dev</Text>
      </Gradient>
      <Text color={colors.textDimmed}>
        AI-powered accounting assistant
      </Text>
    </Box>
  );
}
