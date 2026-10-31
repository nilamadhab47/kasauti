import { dimensionCell, type Cell } from "../../core/src/index.ts";

/**
 * Below this, the cell is not acted on.
 * The first three clinic calls scored 0 or 1 with confidence mostly between 0.45 and 0.82,
 * so the 0.8 citation-check bar hid every failure. 0.35 keeps a coin-flip grey
 * and lets a moderately sure score count.
 */
export const CONFIDENCE_FLOOR = 0.35;

function passMass(probabilities?: Record<string, number>): number {
  if (!probabilities) return 0;
  return ["3", "4", "5"].reduce((sum, key) => sum + (Number(probabilities[key]) || 0), 0);
}

export function settleScore(
  raw: number,
  confidence: number,
  probabilities?: Record<string, number>,
): { rounded: number; score: number | null; cell: Cell } {
  const rounded = Math.min(5, Math.max(0, Math.round(raw)));
  if (confidence < CONFIDENCE_FLOOR) {
    if (rounded >= 3 && passMass(probabilities) >= 0.7) return { rounded, score: rounded, cell: dimensionCell(rounded) };
    return { rounded, score: null, cell: "grey" };
  }
  return { rounded, score: rounded, cell: dimensionCell(rounded) };
}
