/**
 * Cell component - Individual spreadsheet cell
 * Enhanced with formula indicators, error display, and reference highlighting
 */

import React from "react";
import { Box, Text } from "ink";
import { CellData } from "../core/types.js";

export interface CellProps {
  data: CellData;
  width: number;
  isActive: boolean;
  isSelected: boolean;
  isEditing: boolean;
  editValue?: string;
  referenceColor?: string | null; // Color if cell is referenced in current formula
}

export function Cell({
  data,
  width,
  isActive,
  isSelected,
  isEditing,
  editValue,
  referenceColor,
}: CellProps) {
  // Determine display content
  let displayContent = "";
  if (isEditing && isActive) {
    displayContent = editValue ?? "";
  } else {
    displayContent = data.displayValue ?? String(data.value ?? "");
  }

  // Check for errors
  const hasError = typeof data.value === "string" && data.value.startsWith("#");

  // Inner width accounting for cell padding
  const innerWidth = width - 1;

  // Truncate or pad to fit width
  let truncated = displayContent.slice(0, innerWidth);

  // Determine alignment
  const alignment = data.format?.alignment ??
    (typeof data.value === "number" ? "right" : "left");

  // Pad based on alignment
  if (truncated.length < innerWidth) {
    const padding = innerWidth - truncated.length;
    if (alignment === "right") {
      truncated = " ".repeat(padding) + truncated;
    } else if (alignment === "center") {
      const leftPad = Math.floor(padding / 2);
      const rightPad = padding - leftPad;
      truncated = " ".repeat(leftPad) + truncated + " ".repeat(rightPad);
    } else {
      truncated = truncated + " ".repeat(padding);
    }
  }

  // Determine colors based on state
  const getBgColor = () => {
    if (isActive) return "#89b4fa";
    if (isSelected) return "#45475a";
    if (referenceColor) return adjustColorOpacity(referenceColor, 0.2);
    if (hasError) return "#45293a";
    return undefined;
  };

  const getTextColor = () => {
    if (isActive) return "#1e1e2e";
    if (hasError) return "#f38ba8";
    if (referenceColor) return referenceColor;
    if (typeof data.value === "number") return "#a6e3a1";
    if (data.formula) return "#cba6f7";
    if (data.value === null || data.value === "") return "#6c7086";
    return "#cdd6f4";
  };

  // Border color for referenced cells
  const borderColor = referenceColor && !isActive ? referenceColor : undefined;

  // Formula indicator (small 'f' in corner for formula cells)
  const showFormulaIndicator = data.formula && !isActive && !isEditing && !referenceColor;

  return (
    <Box width={width} height={1}>
      {/* Reference indicator or formula indicator */}
      {referenceColor && !isActive ? (
        <Text color={referenceColor}>│</Text>
      ) : showFormulaIndicator ? (
        <Text color="#585b70" dimColor>ƒ</Text>
      ) : (
        <Text> </Text>
      )}

      {/* Cell content */}
      <Text
        backgroundColor={getBgColor()}
        color={getTextColor()}
        bold={isActive || data.style?.bold}
        italic={data.style?.italic}
        underline={!!referenceColor && !isActive}
      >
        {truncated || " ".repeat(innerWidth)}
      </Text>
    </Box>
  );
}

/**
 * Create a darker version of a color for backgrounds
 */
function adjustColorOpacity(hex: string, factor: number): string {
  // Simple darkening by mixing with black
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  const newR = Math.round(r * factor + 30 * (1 - factor));
  const newG = Math.round(g * factor + 30 * (1 - factor));
  const newB = Math.round(b * factor + 46 * (1 - factor));

  return `#${newR.toString(16).padStart(2, "0")}${newG.toString(16).padStart(2, "0")}${newB.toString(16).padStart(2, "0")}`;
}
