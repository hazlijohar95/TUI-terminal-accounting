/**
 * FormulaBar component - Shows current cell reference and formula/value
 * With syntax highlighting for formulas
 */

import React from "react";
import { Box, Text } from "ink";
import { CellData } from "../core/types.js";

export interface FormulaBarProps {
  cellRef: string;
  cellData: CellData;
  isEditing: boolean;
  editValue: string;
  width: number;
}

/**
 * Parse and highlight formula syntax
 */
function highlightFormula(formula: string, isEditing: boolean): React.ReactNode[] {
  if (!formula.startsWith("=")) {
    return [<Text key="value" color={isEditing ? "#f5e0dc" : "#cdd6f4"}>{formula}</Text>];
  }

  const elements: React.ReactNode[] = [];
  let i = 0;
  const text = formula;

  // Known functions for highlighting
  const functions = [
    "SUM", "AVG", "AVERAGE", "MIN", "MAX", "COUNT", "COUNTA", "COUNTIF",
    "IF", "AND", "OR", "NOT", "TRUE", "FALSE",
    "ROUND", "FLOOR", "CEIL", "ABS", "SQRT", "POWER", "MOD",
    "CONCATENATE", "LEFT", "RIGHT", "MID", "LEN", "TRIM", "UPPER", "LOWER",
    "TODAY", "NOW", "DATE", "YEAR", "MONTH", "DAY",
    "NPV", "IRR", "PMT", "PV", "FV", "RATE",
    "VLOOKUP", "HLOOKUP", "INDEX", "MATCH",
  ];

  // Regex patterns
  const cellRefPattern = /\$?[A-Z]+\$?\d+/i;
  const rangePattern = /\$?[A-Z]+\$?\d+:\$?[A-Z]+\$?\d+/i;
  const numberPattern = /^-?\d+\.?\d*/;
  const functionPattern = new RegExp(`^(${functions.join("|")})\\(`, "i");

  while (i < text.length) {
    const remaining = text.slice(i);

    // Equals sign at start
    if (i === 0 && remaining[0] === "=") {
      elements.push(<Text key={`eq-${i}`} color="#f9e2af" bold>=</Text>);
      i++;
      continue;
    }

    // Check for range first (A1:B10)
    const rangeMatch = remaining.match(rangePattern);
    if (rangeMatch && rangeMatch.index === 0) {
      elements.push(
        <Text key={`range-${i}`} color="#89dceb">{rangeMatch[0]}</Text>
      );
      i += rangeMatch[0].length;
      continue;
    }

    // Check for function names
    const funcMatch = remaining.match(functionPattern);
    if (funcMatch) {
      const funcName = funcMatch[1];
      elements.push(
        <Text key={`func-${i}`} color="#cba6f7" bold>{funcName}</Text>
      );
      elements.push(<Text key={`paren-${i}`} color="#f9e2af">(</Text>);
      i += funcName.length + 1;
      continue;
    }

    // Check for cell reference (A1, $B$2)
    const cellMatch = remaining.match(cellRefPattern);
    if (cellMatch && cellMatch.index === 0) {
      elements.push(
        <Text key={`cell-${i}`} color="#89b4fa">{cellMatch[0]}</Text>
      );
      i += cellMatch[0].length;
      continue;
    }

    // Check for numbers
    const numMatch = remaining.match(numberPattern);
    if (numMatch && numMatch.index === 0) {
      elements.push(
        <Text key={`num-${i}`} color="#a6e3a1">{numMatch[0]}</Text>
      );
      i += numMatch[0].length;
      continue;
    }

    // Operators and parentheses
    if ("+-*/^%".includes(remaining[0])) {
      elements.push(
        <Text key={`op-${i}`} color="#fab387">{remaining[0]}</Text>
      );
      i++;
      continue;
    }

    if ("()".includes(remaining[0])) {
      elements.push(
        <Text key={`paren-${i}`} color="#f9e2af">{remaining[0]}</Text>
      );
      i++;
      continue;
    }

    if (remaining[0] === ",") {
      elements.push(
        <Text key={`comma-${i}`} color="#9399b2">{remaining[0]}</Text>
      );
      i++;
      continue;
    }

    // String literals
    if (remaining[0] === '"') {
      let end = remaining.indexOf('"', 1);
      if (end === -1) end = remaining.length - 1;
      const str = remaining.slice(0, end + 1);
      elements.push(
        <Text key={`str-${i}`} color="#a6e3a1">{str}</Text>
      );
      i += str.length;
      continue;
    }

    // Default - just output the character
    elements.push(
      <Text key={`char-${i}`} color="#cdd6f4">{remaining[0]}</Text>
    );
    i++;
  }

  return elements;
}

/**
 * Get formula help text based on current input
 */
function getFormulaHint(editValue: string): string | null {
  if (!editValue.startsWith("=")) return null;

  const upper = editValue.toUpperCase();

  // Check what function is being typed
  if (upper.includes("SUM(") && !upper.includes(")")) {
    return "SUM(range) - Add numbers. Ex: =SUM(A1:A10)";
  }
  if (upper.includes("AVG(") || upper.includes("AVERAGE(")) {
    return "AVERAGE(range) - Calculate mean. Ex: =AVERAGE(B1:B5)";
  }
  if (upper.includes("IF(")) {
    return "IF(condition, true_val, false_val). Ex: =IF(A1>100,\"High\",\"Low\")";
  }
  if (upper.includes("COUNT(")) {
    return "COUNT(range) - Count numbers. Ex: =COUNT(A1:A10)";
  }
  if (upper.includes("MAX(")) {
    return "MAX(range) - Largest value. Ex: =MAX(A1:A10)";
  }
  if (upper.includes("MIN(")) {
    return "MIN(range) - Smallest value. Ex: =MIN(A1:A10)";
  }
  if (upper.includes("ROUND(")) {
    return "ROUND(number, decimals). Ex: =ROUND(A1, 2)";
  }
  if (upper.includes("PMT(")) {
    return "PMT(rate, periods, pv) - Payment calculation";
  }
  if (upper.includes("NPV(")) {
    return "NPV(rate, values...) - Net present value";
  }

  // Just started typing a formula
  if (editValue === "=" || editValue === "=S" || editValue === "=A" || editValue === "=I") {
    return "Type a formula: SUM, AVERAGE, IF, MAX, MIN, COUNT...";
  }

  return null;
}

export function FormulaBar({
  cellRef,
  cellData,
  isEditing,
  editValue,
  width,
}: FormulaBarProps) {
  // Show formula if exists, otherwise show value
  const displayContent = isEditing
    ? editValue
    : cellData.formula ?? String(cellData.value ?? "");

  const inputWidth = width - 10;
  const hint = isEditing ? getFormulaHint(editValue) : null;

  // Check for errors
  const hasError = typeof cellData.value === "string" && cellData.value.startsWith("#");

  return (
    <Box flexDirection="column" width={width}>
      <Box
        borderStyle="single"
        borderColor={hasError ? "#f38ba8" : "#45475a"}
        paddingX={1}
      >
        {/* Cell reference */}
        <Box width={6}>
          <Text color="#f9e2af" bold>
            {cellRef.padEnd(5)}
          </Text>
        </Box>

        <Text color="#6c7086">│</Text>

        {/* Formula/Value input with syntax highlighting */}
        <Box width={inputWidth} marginLeft={1}>
          {highlightFormula(displayContent.slice(0, inputWidth - 1), isEditing)}
          {isEditing && <Text color="#89b4fa">▌</Text>}
        </Box>
      </Box>

      {/* Status line with hints */}
      <Box paddingLeft={1} justifyContent="space-between">
        <Box>
          <Text color={isEditing ? "#f9e2af" : "#a6e3a1"} bold>
            {isEditing ? "EDIT" : "READY"}
          </Text>
          <Text color="#6c7086"> │ </Text>
          {cellData.formula ? (
            <Text color="#cba6f7">ƒx Formula</Text>
          ) : (
            <Text color="#6c7086">Value</Text>
          )}
          {cellData.format?.numberFormat && (
            <>
              <Text color="#6c7086"> │ </Text>
              <Text color="#89b4fa">{cellData.format.numberFormat}</Text>
            </>
          )}
          {hasError && (
            <>
              <Text color="#6c7086"> │ </Text>
              <Text color="#f38ba8">Error: {cellData.value}</Text>
            </>
          )}
        </Box>

        {/* Formula hint */}
        {hint && (
          <Text color="#6c7086" dimColor>
            {hint.slice(0, 50)}
          </Text>
        )}
      </Box>
    </Box>
  );
}
