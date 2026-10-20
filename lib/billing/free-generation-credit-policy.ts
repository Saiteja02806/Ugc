export const ONE_TIME_FREE_GENERATION_CREDITS = 2;

export type FreeGenerationCredits = {
  granted: number;
  remaining: number;
  reserved: number;
  used: number;
};

export function emptyFreeGenerationCredits(): FreeGenerationCredits {
  return { granted: 0, remaining: 0, reserved: 0, used: 0 };
}
