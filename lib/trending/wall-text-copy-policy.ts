// The writer receives a range, while the numeric midpoint remains compatible
// with existing generation-assignment storage. Neither is a hard word limit.
export const WALL_TEXT_SOFT_WORD_RANGE = { minimum: 18, maximum: 30 } as const;
export const WALL_TEXT_TARGET_WORDS =
  (WALL_TEXT_SOFT_WORD_RANGE.minimum + WALL_TEXT_SOFT_WORD_RANGE.maximum) / 2;
