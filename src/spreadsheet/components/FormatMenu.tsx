/**
 * FormatMenu component - Cell formatting options
 */

import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { CellFormat } from "../core/types.js";

export interface FormatMenuProps {
  visible: boolean;
  onClose: () => void;
  onApplyFormat: (format: Partial<CellFormat>) => void;
  currentFormat?: CellFormat;
  width?: number;
}

interface FormatOption {
  key: string;
  label: string;
  format: Partial<CellFormat>;
}

const NUMBER_FORMATS: FormatOption[] = [
  { key: "g", label: "General", format: { numberFormat: "general" } },
  { key: "c", label: "Currency ($)", format: { numberFormat: "currency", decimals: 2 } },
  { key: "p", label: "Percent (%)", format: { numberFormat: "percent", decimals: 1 } },
  { key: "d", label: "Date", format: { numberFormat: "date" } },
  { key: "0", label: "0 decimals", format: { decimals: 0 } },
  { key: "2", label: "2 decimals", format: { decimals: 2 } },
];

const ALIGNMENT_OPTIONS: FormatOption[] = [
  { key: "l", label: "Left", format: { alignment: "left" } },
  { key: "m", label: "Center", format: { alignment: "center" } },
  { key: "r", label: "Right", format: { alignment: "right" } },
];

export function FormatMenu({
  visible,
  onClose,
  onApplyFormat,
  currentFormat,
  width = 40,
}: FormatMenuProps) {
  const [section, setSection] = useState<"number" | "alignment">("number");

  useInput((input, key) => {
    if (!visible) return;

    if (key.escape) {
      onClose();
      return;
    }

    // Tab to switch sections
    if (key.tab) {
      setSection((s) => (s === "number" ? "alignment" : "number"));
      return;
    }

    // Check number format keys
    if (section === "number") {
      const option = NUMBER_FORMATS.find((o) => o.key === input);
      if (option) {
        onApplyFormat(option.format);
        onClose();
        return;
      }
    }

    // Check alignment keys
    if (section === "alignment") {
      const option = ALIGNMENT_OPTIONS.find((o) => o.key === input);
      if (option) {
        onApplyFormat(option.format);
        onClose();
        return;
      }
    }
  }, { isActive: visible });

  if (!visible) return null;

  return (
    <Box
      flexDirection="column"
      width={width}
      borderStyle="round"
      borderColor="#f9e2af"
      paddingX={1}
      paddingY={1}
    >
      {/* Title */}
      <Box marginBottom={1}>
        <Text color="#cdd6f4" bold>◆ Format Cell</Text>
      </Box>

      {/* Section tabs */}
      <Box marginBottom={1}>
        <Text
          color={section === "number" ? "#89b4fa" : "#6c7086"}
          backgroundColor={section === "number" ? "#313244" : undefined}
          bold={section === "number"}
        >
          {" "}Number Format{" "}
        </Text>
        <Text color="#45475a"> │ </Text>
        <Text
          color={section === "alignment" ? "#89b4fa" : "#6c7086"}
          backgroundColor={section === "alignment" ? "#313244" : undefined}
          bold={section === "alignment"}
        >
          {" "}Alignment{" "}
        </Text>
      </Box>

      {/* Options */}
      <Box flexDirection="column">
        {section === "number" ? (
          NUMBER_FORMATS.map((option) => {
            const isActive = currentFormat?.numberFormat === option.format.numberFormat ||
                            (option.format.decimals !== undefined &&
                             currentFormat?.decimals === option.format.decimals);
            return (
              <Box key={option.key}>
                <Text color="#f9e2af">{option.key}</Text>
                <Text color="#6c7086"> → </Text>
                <Text color={isActive ? "#a6e3a1" : "#cdd6f4"}>
                  {option.label}
                  {isActive && " ✓"}
                </Text>
              </Box>
            );
          })
        ) : (
          ALIGNMENT_OPTIONS.map((option) => {
            const isActive = currentFormat?.alignment === option.format.alignment;
            return (
              <Box key={option.key}>
                <Text color="#f9e2af">{option.key}</Text>
                <Text color="#6c7086"> → </Text>
                <Text color={isActive ? "#a6e3a1" : "#cdd6f4"}>
                  {option.label}
                  {isActive && " ✓"}
                </Text>
              </Box>
            );
          })
        )}
      </Box>

      {/* Current format display */}
      {currentFormat && (
        <Box marginTop={1} borderStyle="single" borderColor="#313244" paddingX={1}>
          <Text color="#6c7086">
            Current: {currentFormat.numberFormat || "general"}
            {currentFormat.decimals !== undefined && `, ${currentFormat.decimals} dec`}
            {currentFormat.alignment && `, ${currentFormat.alignment}`}
          </Text>
        </Box>
      )}

      {/* Instructions */}
      <Box marginTop={1}>
        <Text color="#6c7086" dimColor>
          Tab: Switch │ Key: Apply │ Esc: Close
        </Text>
      </Box>
    </Box>
  );
}
