import React from "react";
import { Box, Text } from "ink";
import { colors } from "../themes/colors.js";

type MarkdownProps = {
  content: string;
};

// Simple markdown renderer for terminal
export function Markdown({ content }: MarkdownProps) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];

  let inCodeBlock = false;
  let codeLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block start/end
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <Box key={`code-${i}`} flexDirection="column" marginY={1}>
            <Box
              borderStyle="single"
              borderColor={colors.border}
              paddingX={1}
              flexDirection="column"
            >
              {codeLines.map((codeLine, j) => (
                <Box key={j}>
                  <Text color={colors.success}>
                    {codeLine}
                  </Text>
                </Box>
              ))}
            </Box>
          </Box>
        );
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // Headers
    if (line.startsWith("### ")) {
      elements.push(
        <Box key={i} marginTop={1}>
          <Text bold color={colors.primary}>
            {line.slice(4)}
          </Text>
        </Box>
      );
      continue;
    }

    if (line.startsWith("## ")) {
      elements.push(
        <Box key={i} marginTop={1}>
          <Text bold color={colors.primary}>
            {line.slice(3)}
          </Text>
        </Box>
      );
      continue;
    }

    if (line.startsWith("# ")) {
      elements.push(
        <Box key={i} marginTop={1}>
          <Text bold color={colors.primary}>
            {line.slice(2)}
          </Text>
        </Box>
      );
      continue;
    }

    // Bullet points
    if (line.match(/^[\s]*[-*]\s/)) {
      const indent = line.match(/^[\s]*/)?.[0].length || 0;
      const text = line.replace(/^[\s]*[-*]\s/, "");
      elements.push(
        <Box key={i} marginLeft={indent}>
          <Text>
            <Text color={colors.primary}>• </Text>
            {renderInlineFormatting(text)}
          </Text>
        </Box>
      );
      continue;
    }

    // Numbered lists
    if (line.match(/^[\s]*\d+\.\s/)) {
      const match = line.match(/^([\s]*)(\d+)\.\s(.*)$/);
      if (match) {
        const indent = match[1].length;
        const num = match[2];
        const text = match[3];
        elements.push(
          <Box key={i} marginLeft={indent}>
            <Text>
              <Text color={colors.primary}>{num}. </Text>
              {renderInlineFormatting(text)}
            </Text>
          </Box>
        );
        continue;
      }
    }

    // Horizontal rule
    if (line.match(/^[-=]{3,}$/)) {
      elements.push(
        <Box key={i} marginY={1}>
          <Text color={colors.border}>{"─".repeat(40)}</Text>
        </Box>
      );
      continue;
    }

    // Empty line
    if (!line.trim()) {
      elements.push(<Box key={i} height={1} />);
      continue;
    }

    // Regular paragraph
    elements.push(
      <Box key={i}>
        <Text>{renderInlineFormatting(line)}</Text>
      </Box>
    );
  }

  return <Box flexDirection="column">{elements}</Box>;
}

function renderInlineFormatting(text: string): React.ReactNode {
  // Simple inline formatting - strip markdown for simplicity
  let result = text;

  // Remove bold markers
  result = result.replace(/\*\*([^*]+)\*\*/g, "$1");

  // Remove italic markers
  result = result.replace(/\*([^*]+)\*/g, "$1");

  // Remove code markers
  result = result.replace(/`([^`]+)`/g, "$1");

  return result;
}
