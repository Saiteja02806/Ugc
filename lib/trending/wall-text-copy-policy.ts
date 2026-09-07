// This is the contract for new automated Wall-of-Text generation. The
// numeric midpoint is stored with generation assignments for compatibility,
// while server-side validation makes the range a real acceptance rule.
// Historical cards keep their version-specific 15–50-word validation.
export const WALL_TEXT_GENERATION_WORD_RANGE = {
  minimum: 24,
  maximum: 40,
} as const;

// Keep the prompt-field name stable. It now communicates the current
// generation contract rather than the previous 18–30 soft preference.
export const WALL_TEXT_SOFT_WORD_RANGE = WALL_TEXT_GENERATION_WORD_RANGE;
export const WALL_TEXT_TARGET_WORDS =
  (WALL_TEXT_SOFT_WORD_RANGE.minimum + WALL_TEXT_SOFT_WORD_RANGE.maximum) / 2;
