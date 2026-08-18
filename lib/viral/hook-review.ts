export const MAX_HOOK_END_SECONDS = 3_600;

export type ViralReviewTiming = {
  hookEndMs: number;
  hookStartMs: 0;
  reviewedAt: string;
};

export type ViralReviewItem = {
  embedHtml: string;
  embedStatus: "active";
  id: string;
  importedAt: string;
  publishStatus: "pending_review";
  sourceUrl: string;
  timing: ViralReviewTiming | null;
};

export type ViralReviewPage = {
  items: Array<ViralReviewItem>;
  nextCursor: string | null;
};

export class ViralHookTimingInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ViralHookTimingInputError";
  }
}

export function normalizeHookEndSeconds(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ViralHookTimingInputError("Enter a valid ending time in seconds.");
  }

  if (value <= 0) {
    throw new ViralHookTimingInputError(
      "The ending time must be later than 0 seconds.",
    );
  }

  if (value > MAX_HOOK_END_SECONDS) {
    throw new ViralHookTimingInputError(
      `The ending time must be ${MAX_HOOK_END_SECONDS} seconds or less.`,
    );
  }

  const milliseconds = Math.round(value * 1_000);
  if (milliseconds < 1) {
    throw new ViralHookTimingInputError(
      "Use an ending time of at least 0.001 seconds.",
    );
  }

  return milliseconds;
}

export function formatHookEndSeconds(milliseconds: number): string {
  if (!Number.isSafeInteger(milliseconds) || milliseconds < 1) {
    throw new ViralHookTimingInputError("The saved ending time is invalid.");
  }

  return (milliseconds / 1_000)
    .toFixed(3)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*?[1-9])0+$/, "$1");
}

export function getInstagramReelShortcode(sourceUrl: string): string {
  try {
    const segments = new URL(sourceUrl).pathname.split("/").filter(Boolean);
    return segments[0] === "reel" && segments[1] ? segments[1] : "Instagram Reel";
  } catch {
    return "Instagram Reel";
  }
}
