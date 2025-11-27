/**
 * EnhancedMarkdown Component
 *
 * Clean, minimal markdown rendering for terminal UI.
 * Supports headers, lists, tables, code, and currency formatting.
 */

import React from "react";
import { Box, Text } from "ink";
import { getEnhancedTheme } from "../design/theme.js";
import { indicators } from "../design/tokens.js";

export interface EnhancedMarkdownProps {
  text: string;
  compact?: boolean;
}

export function EnhancedMarkdown({ text, compact = false }: EnhancedMarkdownProps) {
  const theme = getEnhancedTheme();
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check for tables (markdown tables with | separators)
    if (trimmed.includes("|") && trimmed.startsWith("|")) {
      const tableLines: string[] = [line];
      i++;
      // Collect all consecutive table lines
      while (i < lines.length && lines[i].trim().includes("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      elements.push(<React.Fragment key={elements.length}><MarkdownTable lines={tableLines} /></React.Fragment>);
      continue;
    }

    // Check for progress bars: [====    ] 50%
    if (trimmed.match(/\[=+\s*\]\s*\d+%/)) {
      elements.push(<React.Fragment key={elements.length}><ProgressBarLine line={line} /></React.Fragment>);
      i++;
      continue;
    }

    // Check for key-value pairs (Key: Value format in a group)
    if (trimmed.includes(":") && !trimmed.startsWith("-") && !trimmed.startsWith("•")) {
      const kvLines: string[] = [line];
      i++;
      // Collect consecutive key-value lines
      while (
        i < lines.length &&
        lines[i].trim().includes(":") &&
        !lines[i].trim().startsWith("-") &&
        !lines[i].trim().startsWith("•") &&
        lines[i].trim().length > 0
      ) {
        kvLines.push(lines[i]);
        i++;
      }
      // Only treat as key-value box if we have 2+ lines
      if (kvLines.length >= 2) {
        elements.push(<React.Fragment key={elements.length}><KeyValueBox lines={kvLines} /></React.Fragment>);
        continue;
      } else {
        // Single line, just format normally
        elements.push(
          <Box key={elements.length}>
            <FormattedLine line={kvLines[0]} />
          </Box>
        );
        continue;
      }
    }

    // Check for headers
    if (trimmed.startsWith("###")) {
      elements.push(<React.Fragment key={elements.length}><Header level={3} text={trimmed.replace(/^###\s*/, "")} /></React.Fragment>);
      i++;
      continue;
    }
    if (trimmed.startsWith("##")) {
      elements.push(<React.Fragment key={elements.length}><Header level={2} text={trimmed.replace(/^##\s*/, "")} /></React.Fragment>);
      i++;
      continue;
    }
    if (trimmed.startsWith("#")) {
      elements.push(<React.Fragment key={elements.length}><Header level={1} text={trimmed.replace(/^#\s*/, "")} /></React.Fragment>);
      i++;
      continue;
    }

    // Check for horizontal rules
    if (trimmed.match(/^[-*_]{3,}$/)) {
      elements.push(<React.Fragment key={elements.length}><HorizontalRule /></React.Fragment>);
      i++;
      continue;
    }

    // Regular line
    elements.push(
      <Box key={elements.length}>
        <FormattedLine line={line} />
      </Box>
    );
    i++;
  }

  return <Box flexDirection="column">{elements}</Box>;
}

// Header component - cleaner with more whitespace
function Header({ level, text }: { level: number; text: string }) {
  const theme = getEnhancedTheme();
  // Use blue for all headers, differentiate by weight/style
  const color = level === 1 ? theme.semantic.info : theme.semantic.textPrimary;

  return (
    <Box marginTop={1} marginBottom={level === 1 ? 1 : 0}>
      <Text bold color={color}>
        {level === 1 ? text.toUpperCase() : text}
      </Text>
    </Box>
  );
}

// Horizontal rule - subtle
function HorizontalRule() {
  const theme = getEnhancedTheme();
  return (
    <Box marginY={1}>
      <Text color={theme.semantic.border} dimColor>{indicators.dividerH.repeat(40)}</Text>
    </Box>
  );
}

// Key-value box - minimal, no border
function KeyValueBox({ lines }: { lines: string[] }) {
  const theme = getEnhancedTheme();

  return (
    <Box flexDirection="column" paddingLeft={2} marginY={1}>
      {lines.map((line, i) => {
        const [key, ...valueParts] = line.split(":");
        const value = valueParts.join(":").trim();

        return (
          <Box key={i}>
            <Text color={theme.semantic.textMuted}>{key.trim()}: </Text>
            <Text color={theme.semantic.textPrimary}>{formatInlineContent(value)}</Text>
          </Box>
        );
      })}
    </Box>
  );
}

// Progress bar
function ProgressBarLine({ line }: { line: string }) {
  const theme = getEnhancedTheme();
  const match = line.match(/\[([=\s]+)\]\s*(\d+)%/);
  if (!match) return <FormattedLine line={line} />;

  const [, bar, percentStr] = match;
  const percent = parseInt(percentStr, 10);
  const label = line.split("[")[0].trim();

  const barWidth = 20;
  const filled = Math.round((percent / 100) * barWidth);
  const progressBar = "█".repeat(filled) + "░".repeat(barWidth - filled);

  const barColor = percent >= 75 ? theme.semantic.success : percent >= 50 ? theme.semantic.warning : percent >= 25 ? theme.semantic.expense : theme.semantic.error;

  return (
    <Box marginY={1}>
      {label && <Text color={theme.semantic.textPrimary}>{label} </Text>}
      <Text color={barColor}>{progressBar}</Text>
      <Text color={theme.semantic.textMuted}> {percent}%</Text>
    </Box>
  );
}

// Markdown table - clean, minimal styling
function MarkdownTable({ lines }: { lines: string[] }) {
  const theme = getEnhancedTheme();

  if (lines.length < 2) return null;

  // Parse table
  const rows = lines.map((line) =>
    line
      .split("|")
      .map((cell) => cell.trim())
      .filter((cell) => cell.length > 0)
  );

  const headers = rows[0];
  const dataRows = rows.slice(2); // Skip separator line
  const colWidth = 14;

  return (
    <Box flexDirection="column" marginY={1} paddingLeft={2}>
      {/* Header row */}
      <Box>
        {headers.map((header, i) => (
          <React.Fragment key={i}>
            <Text bold color={theme.semantic.textMuted}>
              {header.padEnd(colWidth).slice(0, colWidth)}
            </Text>
            {i < headers.length - 1 && <Text color={theme.semantic.border} dimColor> │ </Text>}
          </React.Fragment>
        ))}
      </Box>

      {/* Separator */}
      <Box>
        {headers.map((_, i) => (
          <React.Fragment key={i}>
            <Text color={theme.semantic.border} dimColor>{indicators.dividerH.repeat(colWidth)}</Text>
            {i < headers.length - 1 && <Text color={theme.semantic.border} dimColor>─┼─</Text>}
          </React.Fragment>
        ))}
      </Box>

      {/* Data rows */}
      {dataRows.map((row, i) => (
        <Box key={i}>
          {row.map((cell, j) => (
            <React.Fragment key={j}>
              <Text color={theme.semantic.textPrimary}>
                {cell.padEnd(colWidth).slice(0, colWidth)}
              </Text>
              {j < row.length - 1 && <Text color={theme.semantic.border} dimColor> │ </Text>}
            </React.Fragment>
          ))}
        </Box>
      ))}
    </Box>
  );
}

// Format a single line with markdown
function FormattedLine({ line }: { line: string }) {
  const theme = getEnhancedTheme();
  const trimmed = line.trim();

  // Check for bullet points - use subtle bullet
  if (trimmed.startsWith("•") || trimmed.startsWith("-") || trimmed.startsWith("*")) {
    const content = line.replace(/^[\s]*[•\-\*][\s]*/, "");
    return (
      <>
        <Text color={theme.semantic.textMuted}>  {indicators.bullet} </Text>
        <Text wrap="wrap">{formatInlineContent(content)}</Text>
      </>
    );
  }

  // Check for numbered lists - subtle number
  if (trimmed.match(/^\d+\./)) {
    const match = trimmed.match(/^(\d+\.)\s*(.*)$/);
    if (match) {
      return (
        <>
          <Text color={theme.semantic.textMuted}>  {match[1]} </Text>
          <Text wrap="wrap">{formatInlineContent(match[2])}</Text>
        </>
      );
    }
  }

  // Check for warning/attention markers
  if (trimmed.startsWith("⚠") || trimmed.startsWith("!")) {
    return (
      <>
        <Text color={theme.semantic.warning}>  {indicators.warning} </Text>
        <Text wrap="wrap" color={theme.semantic.textPrimary}>{formatInlineContent(trimmed.replace(/^[⚠!]\s*/, ""))}</Text>
      </>
    );
  }

  // Check for success/tip markers
  if (trimmed.startsWith("✓") || trimmed.startsWith("💡")) {
    return (
      <>
        <Text color={theme.semantic.success}>  {indicators.check} </Text>
        <Text wrap="wrap" color={theme.semantic.textPrimary}>{formatInlineContent(trimmed.replace(/^[✓💡]\s*/, ""))}</Text>
      </>
    );
  }

  return <Text wrap="wrap">{formatInlineContent(line)}</Text>;
}

// Format inline content (bold, italic, code, currency)
function formatInlineContent(text: string): React.ReactNode {
  const theme = getEnhancedTheme();

  // Parse markdown: **bold**, *italic*, `code`, and $currency
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\$[\d,]+\.?\d*)/g;
  const parts = text.split(pattern);

  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null;

        // Bold text
        if (part.startsWith("**") && part.endsWith("**")) {
          const content = part.slice(2, -2);
          return (
            <React.Fragment key={i}>
              <Text bold color={theme.semantic.textPrimary}>
                {content}
              </Text>
            </React.Fragment>
          );
        }

        // Italic text
        if (part.startsWith("*") && part.endsWith("*") && !part.startsWith("**")) {
          const content = part.slice(1, -1);
          return (
            <React.Fragment key={i}>
              <Text italic color={theme.semantic.textPrimary}>
                {content}
              </Text>
            </React.Fragment>
          );
        }

        // Inline code
        if (part.startsWith("`") && part.endsWith("`")) {
          const content = part.slice(1, -1);
          return (
            <React.Fragment key={i}>
              <Text color={theme.semantic.expense}>{content}</Text>
            </React.Fragment>
          );
        }

        // Currency amount
        if (part.match(/^\$[\d,]+\.?\d*$/)) {
          const amount = parseFloat(part.replace(/[$,]/g, ""));
          const color = amount >= 0 ? theme.semantic.success : theme.semantic.error;
          return (
            <React.Fragment key={i}>
              <Text color={color} bold>
                {part}
              </Text>
            </React.Fragment>
          );
        }

        return (
          <React.Fragment key={i}>
            <Text color={theme.semantic.textPrimary}>{part}</Text>
          </React.Fragment>
        );
      })}
    </>
  );
}
