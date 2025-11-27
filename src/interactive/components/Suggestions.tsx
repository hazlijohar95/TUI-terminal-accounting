import React from "react";
import { Box, Text } from "ink";
import { colors } from "../themes/colors.js";

type SuggestionsProps = {
  suggestions: string[];
};

export function Suggestions({ suggestions }: SuggestionsProps) {
  if (suggestions.length === 0) return null;

  return (
    <Box marginTop={1}>
      <Text color={colors.textDimmed}>Try: </Text>
      {suggestions.map((suggestion, index) => (
        <Box key={index}>
          {index > 0 && <Text color={colors.textDimmed}> | </Text>}
          <Text color={colors.primary}>{suggestion}</Text>
        </Box>
      ))}
    </Box>
  );
}

// Generate context-aware suggestions based on the last response
export function generateSuggestions(response: string, question: string): string[] {
  const lower = response.toLowerCase();
  const suggestions: string[] = [];

  // Based on content of response
  if (lower.includes("food") || lower.includes("restaurant") || lower.includes("grocery")) {
    suggestions.push("break down food costs");
    suggestions.push("compare to last month");
  } else if (lower.includes("expense") || lower.includes("spending")) {
    suggestions.push("show by category");
    suggestions.push("find largest expense");
  } else if (lower.includes("income") || lower.includes("salary")) {
    suggestions.push("show income sources");
    suggestions.push("calculate savings rate");
  } else if (lower.includes("month") || lower.includes("budget")) {
    suggestions.push("set a budget");
    suggestions.push("compare months");
  }

  // Default suggestions if none matched
  if (suggestions.length === 0) {
    suggestions.push("show dashboard");
    suggestions.push("add expense");
  }

  return suggestions.slice(0, 3);
}
