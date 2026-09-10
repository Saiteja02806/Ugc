import { WALL_TEXT_GENERATION_WORD_RANGE } from "./wall-text-copy-policy.ts";

// Fit failures need a measurably smaller rewrite, not another response at the
// same target. Keep the product's minimum and the existing two-repair limit.
export function getWallTextRepairBudget(candidate: {maxWords: number; targetWords: number}) {
  const maxWords = Math.max(
    WALL_TEXT_GENERATION_WORD_RANGE.minimum,
    Math.min(candidate.maxWords, candidate.targetWords) - 4,
  );
  return {maxWords, targetWords: maxWords};
}
