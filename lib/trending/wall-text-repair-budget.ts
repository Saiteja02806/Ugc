// Fit failures need a measurably smaller rewrite, not another response at the
// same target. Keep the candidate's duration-aware minimum and the existing
// two-repair limit.
export function getWallTextRepairBudget(candidate: {
  maxWords: number;
  minWords?: number;
  targetWords: number;
}) {
  const minimumWords = candidate.minWords ?? 12;
  const maxWords = Math.max(
    minimumWords,
    Math.min(candidate.maxWords, candidate.targetWords) - 4,
  );
  return {maxWords, targetWords: maxWords};
}
