/**
 * FormulaParser - Extract cell references from formulas
 * Used for highlighting referenced cells during editing
 */

import { CellAddress, refToAddress, CellRange } from "./types.js";

export interface ParsedReference {
  type: "cell" | "range";
  ref: string;
  address?: CellAddress;
  range?: CellRange;
  color: string;
}

// Colors for different references (rainbow style)
const REFERENCE_COLORS = [
  "#89b4fa", // Blue
  "#a6e3a1", // Green
  "#f9e2af", // Yellow
  "#fab387", // Peach
  "#cba6f7", // Mauve
  "#89dceb", // Sky
  "#f5c2e7", // Pink
  "#94e2d5", // Teal
];

/**
 * Extract all cell references from a formula
 */
export function extractCellReferences(formula: string): ParsedReference[] {
  if (!formula.startsWith("=")) return [];

  const references: ParsedReference[] = [];
  const seen = new Set<string>();

  // Match ranges first (A1:B10, $A$1:$B$10, etc.)
  const rangePattern = /(\$?[A-Z]+\$?\d+):(\$?[A-Z]+\$?\d+)/gi;
  let match: RegExpExecArray | null;

  while ((match = rangePattern.exec(formula)) !== null) {
    const fullRef = match[0];
    if (seen.has(fullRef.toUpperCase())) continue;
    seen.add(fullRef.toUpperCase());

    try {
      const startRef = match[1].replace(/\$/g, "");
      const endRef = match[2].replace(/\$/g, "");
      const startAddr = refToAddress(startRef);
      const endAddr = refToAddress(endRef);

      references.push({
        type: "range",
        ref: fullRef,
        range: { start: startAddr, end: endAddr },
        color: REFERENCE_COLORS[references.length % REFERENCE_COLORS.length],
      });
    } catch {
      // Invalid reference, skip
    }
  }

  // Match single cell references (A1, $A$1, etc.)
  // Exclude those that are part of ranges
  const cellPattern = /\$?[A-Z]+\$?\d+/gi;
  const rangeRefs = new Set(
    references.flatMap((r) => r.ref.toUpperCase().split(":"))
  );

  while ((match = cellPattern.exec(formula)) !== null) {
    const ref = match[0];
    const cleanRef = ref.replace(/\$/g, "").toUpperCase();

    // Skip if this is part of a range
    if (rangeRefs.has(cleanRef)) continue;
    if (seen.has(cleanRef)) continue;
    seen.add(cleanRef);

    try {
      const addr = refToAddress(cleanRef);
      references.push({
        type: "cell",
        ref,
        address: addr,
        color: REFERENCE_COLORS[references.length % REFERENCE_COLORS.length],
      });
    } catch {
      // Invalid reference, skip
    }
  }

  return references;
}

/**
 * Check if a cell address is within any of the parsed references
 */
export function getCellReferenceColor(
  addr: CellAddress,
  references: ParsedReference[]
): string | null {
  for (const ref of references) {
    if (ref.type === "cell" && ref.address) {
      if (ref.address.row === addr.row && ref.address.col === addr.col) {
        return ref.color;
      }
    } else if (ref.type === "range" && ref.range) {
      const minRow = Math.min(ref.range.start.row, ref.range.end.row);
      const maxRow = Math.max(ref.range.start.row, ref.range.end.row);
      const minCol = Math.min(ref.range.start.col, ref.range.end.col);
      const maxCol = Math.max(ref.range.start.col, ref.range.end.col);

      if (
        addr.row >= minRow &&
        addr.row <= maxRow &&
        addr.col >= minCol &&
        addr.col <= maxCol
      ) {
        return ref.color;
      }
    }
  }
  return null;
}

/**
 * Check if a cell is at the corner of a range (for border display)
 */
export function isRangeCorner(
  addr: CellAddress,
  references: ParsedReference[]
): { isCorner: boolean; position: string; color: string } | null {
  for (const ref of references) {
    if (ref.type !== "range" || !ref.range) continue;

    const minRow = Math.min(ref.range.start.row, ref.range.end.row);
    const maxRow = Math.max(ref.range.start.row, ref.range.end.row);
    const minCol = Math.min(ref.range.start.col, ref.range.end.col);
    const maxCol = Math.max(ref.range.start.col, ref.range.end.col);

    if (addr.row === minRow && addr.col === minCol) {
      return { isCorner: true, position: "top-left", color: ref.color };
    }
    if (addr.row === minRow && addr.col === maxCol) {
      return { isCorner: true, position: "top-right", color: ref.color };
    }
    if (addr.row === maxRow && addr.col === minCol) {
      return { isCorner: true, position: "bottom-left", color: ref.color };
    }
    if (addr.row === maxRow && addr.col === maxCol) {
      return { isCorner: true, position: "bottom-right", color: ref.color };
    }
  }
  return null;
}
