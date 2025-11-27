/**
 * FormulaHelper component - Shows available functions and their syntax
 * Activated when user types '=' and presses a help key
 */

import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

export interface FormulaCategory {
  name: string;
  icon: string;
  functions: FormulaInfo[];
}

export interface FormulaInfo {
  name: string;
  syntax: string;
  description: string;
  example: string;
}

const FORMULA_CATEGORIES: FormulaCategory[] = [
  {
    name: "Math",
    icon: "∑",
    functions: [
      { name: "SUM", syntax: "SUM(range)", description: "Add all numbers in range", example: "=SUM(A1:A10)" },
      { name: "AVERAGE", syntax: "AVERAGE(range)", description: "Calculate mean", example: "=AVERAGE(B1:B5)" },
      { name: "MIN", syntax: "MIN(range)", description: "Smallest value", example: "=MIN(A1:A10)" },
      { name: "MAX", syntax: "MAX(range)", description: "Largest value", example: "=MAX(A1:A10)" },
      { name: "ROUND", syntax: "ROUND(num, decimals)", description: "Round to decimals", example: "=ROUND(A1, 2)" },
      { name: "ABS", syntax: "ABS(number)", description: "Absolute value", example: "=ABS(A1)" },
      { name: "SQRT", syntax: "SQRT(number)", description: "Square root", example: "=SQRT(16)" },
      { name: "POWER", syntax: "POWER(base, exp)", description: "Power function", example: "=POWER(2, 8)" },
    ],
  },
  {
    name: "Logic",
    icon: "⊃",
    functions: [
      { name: "IF", syntax: "IF(test, true, false)", description: "Conditional logic", example: "=IF(A1>100,\"High\",\"Low\")" },
      { name: "AND", syntax: "AND(cond1, cond2...)", description: "All conditions true", example: "=AND(A1>0, B1<100)" },
      { name: "OR", syntax: "OR(cond1, cond2...)", description: "Any condition true", example: "=OR(A1>0, B1>0)" },
      { name: "NOT", syntax: "NOT(condition)", description: "Negate condition", example: "=NOT(A1>100)" },
      { name: "IFERROR", syntax: "IFERROR(value, error_val)", description: "Handle errors", example: "=IFERROR(A1/B1, 0)" },
    ],
  },
  {
    name: "Stats",
    icon: "σ",
    functions: [
      { name: "COUNT", syntax: "COUNT(range)", description: "Count numbers", example: "=COUNT(A1:A10)" },
      { name: "COUNTA", syntax: "COUNTA(range)", description: "Count non-empty", example: "=COUNTA(A1:A10)" },
      { name: "COUNTIF", syntax: "COUNTIF(range, criteria)", description: "Count if matches", example: "=COUNTIF(A1:A10, \">100\")" },
      { name: "SUMIF", syntax: "SUMIF(range, criteria)", description: "Sum if matches", example: "=SUMIF(A1:A10, \">0\")" },
    ],
  },
  {
    name: "Financial",
    icon: "$",
    functions: [
      { name: "PMT", syntax: "PMT(rate, nper, pv)", description: "Payment amount", example: "=PMT(0.05/12, 360, 200000)" },
      { name: "PV", syntax: "PV(rate, nper, pmt)", description: "Present value", example: "=PV(0.08, 5, 1000)" },
      { name: "FV", syntax: "FV(rate, nper, pmt)", description: "Future value", example: "=FV(0.06, 10, -1000)" },
      { name: "NPV", syntax: "NPV(rate, values...)", description: "Net present value", example: "=NPV(0.1, A1:A5)" },
      { name: "IRR", syntax: "IRR(values)", description: "Internal rate of return", example: "=IRR(A1:A10)" },
    ],
  },
  {
    name: "Text",
    icon: "T",
    functions: [
      { name: "CONCATENATE", syntax: "CONCATENATE(text1, text2)", description: "Join text", example: "=CONCATENATE(A1, \" \", B1)" },
      { name: "LEFT", syntax: "LEFT(text, n)", description: "First n chars", example: "=LEFT(A1, 3)" },
      { name: "RIGHT", syntax: "RIGHT(text, n)", description: "Last n chars", example: "=RIGHT(A1, 3)" },
      { name: "LEN", syntax: "LEN(text)", description: "Text length", example: "=LEN(A1)" },
      { name: "UPPER", syntax: "UPPER(text)", description: "Uppercase", example: "=UPPER(A1)" },
      { name: "LOWER", syntax: "LOWER(text)", description: "Lowercase", example: "=LOWER(A1)" },
    ],
  },
  {
    name: "Date",
    icon: "◷",
    functions: [
      { name: "TODAY", syntax: "TODAY()", description: "Current date", example: "=TODAY()" },
      { name: "NOW", syntax: "NOW()", description: "Current date/time", example: "=NOW()" },
      { name: "DATE", syntax: "DATE(year, month, day)", description: "Create date", example: "=DATE(2024, 12, 25)" },
      { name: "YEAR", syntax: "YEAR(date)", description: "Extract year", example: "=YEAR(A1)" },
      { name: "MONTH", syntax: "MONTH(date)", description: "Extract month", example: "=MONTH(A1)" },
      { name: "DAY", syntax: "DAY(date)", description: "Extract day", example: "=DAY(A1)" },
    ],
  },
];

export interface FormulaHelperProps {
  visible: boolean;
  onClose: () => void;
  onSelectFormula: (formula: string) => void;
  width?: number;
}

export function FormulaHelper({
  visible,
  onClose,
  onSelectFormula,
  width = 60,
}: FormulaHelperProps) {
  const [selectedCategory, setSelectedCategory] = useState(0);
  const [selectedFunction, setSelectedFunction] = useState(0);

  useInput((input, key) => {
    if (!visible) return;

    if (key.escape) {
      onClose();
      return;
    }

    // Tab to switch categories
    if (key.tab) {
      if (key.shift) {
        setSelectedCategory((c) => (c - 1 + FORMULA_CATEGORIES.length) % FORMULA_CATEGORIES.length);
      } else {
        setSelectedCategory((c) => (c + 1) % FORMULA_CATEGORIES.length);
      }
      setSelectedFunction(0);
      return;
    }

    // Arrow keys to navigate functions
    if (key.upArrow) {
      const maxFuncs = FORMULA_CATEGORIES[selectedCategory].functions.length;
      setSelectedFunction((f) => (f - 1 + maxFuncs) % maxFuncs);
      return;
    }

    if (key.downArrow) {
      const maxFuncs = FORMULA_CATEGORIES[selectedCategory].functions.length;
      setSelectedFunction((f) => (f + 1) % maxFuncs);
      return;
    }

    // Enter to select
    if (key.return) {
      const func = FORMULA_CATEGORIES[selectedCategory].functions[selectedFunction];
      onSelectFormula(`=${func.name}(`);
      onClose();
      return;
    }
  }, { isActive: visible });

  if (!visible) return null;

  const category = FORMULA_CATEGORIES[selectedCategory];
  const func = category.functions[selectedFunction];

  return (
    <Box
      flexDirection="column"
      width={width}
      borderStyle="round"
      borderColor="#89b4fa"
      paddingX={1}
    >
      {/* Title */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Text color="#cdd6f4" bold>Formula Reference</Text>
        <Text color="#6c7086" dimColor>Tab: Category │ ↑↓: Select │ Enter: Insert │ Esc: Close</Text>
      </Box>

      {/* Category tabs */}
      <Box marginBottom={1}>
        {FORMULA_CATEGORIES.map((cat, i) => (
          <Box key={cat.name} marginRight={1}>
            <Text
              color={i === selectedCategory ? "#89b4fa" : "#6c7086"}
              backgroundColor={i === selectedCategory ? "#313244" : undefined}
              bold={i === selectedCategory}
            >
              {" "}{cat.icon} {cat.name}{" "}
            </Text>
          </Box>
        ))}
      </Box>

      {/* Function list and detail */}
      <Box flexDirection="row">
        {/* Function list */}
        <Box flexDirection="column" width={20}>
          {category.functions.map((f, i) => (
            <Text
              key={f.name}
              color={i === selectedFunction ? "#cdd6f4" : "#9399b2"}
              backgroundColor={i === selectedFunction ? "#45475a" : undefined}
            >
              {i === selectedFunction ? "▸ " : "  "}{f.name}
            </Text>
          ))}
        </Box>

        {/* Function detail */}
        <Box flexDirection="column" marginLeft={2} flexGrow={1}>
          <Text color="#cba6f7" bold>{func.name}</Text>
          <Text color="#9399b2">{func.syntax}</Text>
          <Box marginTop={1}>
            <Text color="#cdd6f4">{func.description}</Text>
          </Box>
          <Box marginTop={1}>
            <Text color="#6c7086">Example: </Text>
            <Text color="#a6e3a1">{func.example}</Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

/**
 * Quick formula suggestions based on current input
 */
export function getFormulaSuggestions(input: string): FormulaInfo[] {
  if (!input.startsWith("=") || input.length < 2) return [];

  const search = input.slice(1).toUpperCase();
  const suggestions: FormulaInfo[] = [];

  for (const category of FORMULA_CATEGORIES) {
    for (const func of category.functions) {
      if (func.name.startsWith(search)) {
        suggestions.push(func);
        if (suggestions.length >= 5) return suggestions;
      }
    }
  }

  return suggestions;
}
