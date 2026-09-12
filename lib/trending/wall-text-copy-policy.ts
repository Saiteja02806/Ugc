// Automated Wall copy uses the general word range and available layout space.
// Video duration does not restrict how much text a card can contain.
export const WALL_TEXT_GENERATION_WORD_RANGE = {
  minimum: 12,
  maximum: 26,
} as const;

export const WALL_TEXT_SOFT_WORD_RANGE = WALL_TEXT_GENERATION_WORD_RANGE;
export const WALL_TEXT_TARGET_WORDS = 18;
export function getWallTextGenerationWordBudget(params: {
  spatialMaximum?: number;
}) {
  const spatialMaximum = Math.min(
    WALL_TEXT_GENERATION_WORD_RANGE.maximum,
    params.spatialMaximum ?? WALL_TEXT_GENERATION_WORD_RANGE.maximum,
  );
  const maximum = Math.max(10, spatialMaximum);
  const minimum = Math.min(WALL_TEXT_GENERATION_WORD_RANGE.minimum, maximum);

  return {
    maximum,
    minimum,
    target: Math.round((minimum + maximum) / 2),
  } as const;
}
