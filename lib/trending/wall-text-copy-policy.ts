// Automated Wall copy uses the general word range and available layout space.
// Video duration does not restrict how much text a card can contain.
export const WALL_TEXT_GENERATION_WORD_RANGE = {
  minimum: 24,
  maximum: 48,
} as const;

export const WALL_TEXT_SOFT_WORD_RANGE = WALL_TEXT_GENERATION_WORD_RANGE;
export const WALL_TEXT_TARGET_WORDS = 36;
export function getWallTextGenerationWordBudget(params: {
  spatialMaximum?: number;
}) {
  const spatialMaximum = Math.min(
    WALL_TEXT_GENERATION_WORD_RANGE.maximum,
    params.spatialMaximum ?? WALL_TEXT_GENERATION_WORD_RANGE.maximum,
  );
  const maximum = Math.max(10, spatialMaximum);
  const minimum = Math.min(WALL_TEXT_GENERATION_WORD_RANGE.minimum, maximum);
  // Keep the production writing target consistent for every account. A tighter
  // measured layout may lower the maximum, but must never ask the Writer for
  // more words than that particular fixed 52px canvas can safely render.
  const target = Math.max(
    minimum,
    Math.min(WALL_TEXT_TARGET_WORDS, maximum),
  );

  return {
    maximum,
    minimum,
    target,
  } as const;
}
