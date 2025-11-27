/**
 * Financial Templates Index
 */

export { burnRateTemplate } from "./burn-rate.js";
export { marginCalcTemplate } from "./margin-calc.js";
export { cashFlowTemplate } from "./cash-flow.js";
export type { SpreadsheetTemplate, TemplateCell } from "./types.js";
export { applyTemplate } from "./types.js";

import { burnRateTemplate } from "./burn-rate.js";
import { marginCalcTemplate } from "./margin-calc.js";
import { cashFlowTemplate } from "./cash-flow.js";
import type { SpreadsheetTemplate } from "./types.js";

/**
 * All available templates
 */
export const ALL_TEMPLATES: SpreadsheetTemplate[] = [
  burnRateTemplate,
  marginCalcTemplate,
  cashFlowTemplate,
];

/**
 * Get template by ID
 */
export function getTemplateById(id: string): SpreadsheetTemplate | undefined {
  return ALL_TEMPLATES.find((t) => t.id === id);
}
