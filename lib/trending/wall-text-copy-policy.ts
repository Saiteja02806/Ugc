// This is the contract for new automated Wall-of-Text generation. A candidate
// also receives a duration-aware maximum so every overlay can be read during
// one native play with room to look at the video.
export const WALL_TEXT_GENERATION_WORD_RANGE = {
  minimum: 12,
  maximum: 26,
} as const;

export const WALL_TEXT_SOFT_WORD_RANGE = WALL_TEXT_GENERATION_WORD_RANGE;
export const WALL_TEXT_TARGET_WORDS = 18;
export const WALL_TEXT_READING_WORDS_PER_SECOND = 3.2;
export const WALL_TEXT_READING_CUSHION_RATIO = 0.85;

export function getWallTextGenerationWordBudget(params: {
  durationSeconds?: number;
  spatialMaximum?: number;
}) {
  const spatialMaximum = Math.min(
    WALL_TEXT_GENERATION_WORD_RANGE.maximum,
    params.spatialMaximum ?? WALL_TEXT_GENERATION_WORD_RANGE.maximum,
  );
  const durationMaximum = Number.isFinite(params.durationSeconds)
    ? Math.floor(
        Math.max(0, params.durationSeconds!) *
          WALL_TEXT_READING_WORDS_PER_SECOND *
          WALL_TEXT_READING_CUSHION_RATIO,
      )
    : spatialMaximum;
  const maximum = Math.max(
    10,
    Math.min(spatialMaximum, durationMaximum),
  );
  const minimum = Math.min(WALL_TEXT_GENERATION_WORD_RANGE.minimum, maximum);

  return {
    maximum,
    minimum,
    target: Math.round((minimum + maximum) / 2),
  } as const;
}
