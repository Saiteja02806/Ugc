import { WALL_TEXT_GENERATION_WORD_RANGE } from "./wall-text-copy-policy";

// Fit failures need a measurably smaller rewrite, not another response at the
// same target. Keep the candidate's general copy minimum and the existing
// two-repair limit.
export function getWallTextRepairBudget(candidate: {
  maxWords: number;
  minWords?: number;
  targetWords: number;
}) {
  const minimumWords = candidate.minWords ?? WALL_TEXT_GENERATION_WORD_RANGE.minimum;
  const maxWords = Math.max(
    minimumWords,
    Math.min(candidate.maxWords, candidate.targetWords) - 4,
  );
  return {maxWords, targetWords: maxWords};
}
