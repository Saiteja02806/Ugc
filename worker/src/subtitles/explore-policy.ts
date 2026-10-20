/** Approved Explore launch scope; independent of the older subtitle lab limits. */
export const EXPLORE_SUBTITLE_LANGUAGE = "en" as const;
export const EXPLORE_SUBTITLE_MAX_DURATION_MS = 60_000;
export const EXPLORE_SUBTITLE_SCOPE_LABEL = "English · up to 60 seconds total";

export class ExploreSubtitleScopeError extends Error {
  constructor(public readonly code: "SUBTITLE_LANGUAGE_UNSUPPORTED" | "SUBTITLE_DURATION_UNSUPPORTED", message: string) {
    super(message);
    this.name = "ExploreSubtitleScopeError";
  }
}

/** Check the measured COMPLETE hook/phone + demo sequence, never just one clip. */
export function assertExploreSubtitleScope(language: unknown, durationMs: unknown): asserts durationMs is number {
  if (language !== EXPLORE_SUBTITLE_LANGUAGE) {
    throw new ExploreSubtitleScopeError("SUBTITLE_LANGUAGE_UNSUPPORTED", "Auto subtitles support English only in this release.");
  }
  if (typeof durationMs !== "number" || !Number.isFinite(durationMs) || durationMs <= 0 || durationMs > EXPLORE_SUBTITLE_MAX_DURATION_MS) {
    throw new ExploreSubtitleScopeError("SUBTITLE_DURATION_UNSUPPORTED", "Auto subtitles support a finished video up to 60 seconds total. Turn subtitles off or choose a shorter demo; nothing is trimmed automatically.");
  }
}
