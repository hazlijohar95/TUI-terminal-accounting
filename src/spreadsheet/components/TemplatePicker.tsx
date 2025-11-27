/**
 * TemplatePicker component - Select from pre-built financial templates
 */

import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { ALL_TEMPLATES, SpreadsheetTemplate } from "../templates/index.js";

export interface TemplatePickerProps {
  visible: boolean;
  onClose: () => void;
  onSelectTemplate: (template: SpreadsheetTemplate) => void;
  width?: number;
}

export function TemplatePicker({
  visible,
  onClose,
  onSelectTemplate,
  width = 60,
}: TemplatePickerProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [confirmNew, setConfirmNew] = useState(false);

  useInput((input, key) => {
    if (!visible) return;

    if (key.escape) {
      if (confirmNew) {
        setConfirmNew(false);
      } else {
        onClose();
      }
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((i) => (i - 1 + ALL_TEMPLATES.length + 1) % (ALL_TEMPLATES.length + 1));
      return;
    }

    if (key.downArrow) {
      setSelectedIndex((i) => (i + 1) % (ALL_TEMPLATES.length + 1));
      return;
    }

    if (key.return) {
      if (selectedIndex === 0) {
        // New blank spreadsheet
        setConfirmNew(true);
        onClose();
        return;
      }
      const template = ALL_TEMPLATES[selectedIndex - 1];
      onSelectTemplate(template);
      onClose();
      return;
    }
  }, { isActive: visible });

  if (!visible) return null;

  const selected = selectedIndex === 0 ? null : ALL_TEMPLATES[selectedIndex - 1];

  return (
    <Box
      flexDirection="column"
      width={width}
      borderStyle="round"
      borderColor="#89b4fa"
      paddingX={1}
      paddingY={1}
    >
      {/* Title */}
      <Box marginBottom={1}>
        <Text color="#cdd6f4" bold>◆ Choose a Template</Text>
      </Box>

      <Box flexDirection="row">
        {/* Template list */}
        <Box flexDirection="column" width={25}>
          {/* Blank option */}
          <Box>
            <Text
              color={selectedIndex === 0 ? "#cdd6f4" : "#9399b2"}
              backgroundColor={selectedIndex === 0 ? "#45475a" : undefined}
            >
              {selectedIndex === 0 ? "▸ " : "  "}📄 Blank Spreadsheet
            </Text>
          </Box>

          {/* Separator */}
          <Box marginY={1}>
            <Text color="#45475a">─────────────────────</Text>
          </Box>

          {/* Templates */}
          {ALL_TEMPLATES.map((template, i) => {
            const isSelected = selectedIndex === i + 1;
            return (
              <Box key={template.id}>
                <Text
                  color={isSelected ? "#cdd6f4" : "#9399b2"}
                  backgroundColor={isSelected ? "#45475a" : undefined}
                >
                  {isSelected ? "▸ " : "  "}{template.icon} {template.name}
                </Text>
              </Box>
            );
          })}
        </Box>

        {/* Preview/Description */}
        <Box flexDirection="column" marginLeft={2} flexGrow={1}>
          {selectedIndex === 0 ? (
            <>
              <Text color="#cba6f7" bold>Blank Spreadsheet</Text>
              <Box marginTop={1}>
                <Text color="#9399b2">Start with an empty spreadsheet.</Text>
              </Box>
              <Box marginTop={1}>
                <Text color="#6c7086">
                  Create your own financial model from scratch.
                </Text>
              </Box>
            </>
          ) : selected && (
            <>
              <Text color="#cba6f7" bold>{selected.name}</Text>
              <Box marginTop={1}>
                <Text color="#9399b2">{selected.description}</Text>
              </Box>
              <Box marginTop={1}>
                <Text color="#6c7086">
                  Category: <Text color="#89b4fa">{selected.category}</Text>
                </Text>
              </Box>
              <Box marginTop={1}>
                <Text color="#6c7086">
                  {Object.keys(selected.cells).length} pre-filled cells with formulas
                </Text>
              </Box>
            </>
          )}
        </Box>
      </Box>

      {/* Instructions */}
      <Box marginTop={1} borderStyle="single" borderColor="#313244" paddingX={1}>
        <Text color="#6c7086" dimColor>
          ↑↓ Navigate │ Enter Select │ Esc Cancel
        </Text>
      </Box>
    </Box>
  );
}
