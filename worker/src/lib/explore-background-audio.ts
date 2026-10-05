/** Pure timing policy shared by the Explore UI and its isolated composition helper. */
export type ExploreBackgroundPlayback = "once" | "repeat";
export const EXPLORE_BACKGROUND_AUDIO_MAX_DURATION_MS = 600_000;
export const EXPLORE_BACKGROUND_AUDIO_MAX_BYTES = 50 * 1024 * 1024;
const MAX_SEQUENCE_DURATION_MS = 240_000;

export class ExploreBackgroundAudioError extends Error {
  readonly code = "COMPOSITION_AUDIO_INVALID";
  constructor(message: string) {
    super(message);
    this.name = "ExploreBackgroundAudioError";
  }
}

/** Fit only the added soundtrack. Never shorten/stretch the video or original speech. */
export function planExploreBackgroundAudio(sourceDurationMs: number, targetDurationMs: number, playback: ExploreBackgroundPlayback = "once") {
  if (!Number.isFinite(sourceDurationMs) || sourceDurationMs <= 0 || sourceDurationMs > EXPLORE_BACKGROUND_AUDIO_MAX_DURATION_MS) {
    throw new ExploreBackgroundAudioError("Choose background audio up to 10 minutes long.");
  }
  if (!Number.isFinite(targetDurationMs) || targetDurationMs <= 0 || targetDurationMs > MAX_SEQUENCE_DURATION_MS) {
    throw new ExploreBackgroundAudioError("The background audio needs a valid video duration.");
  }
  if (playback !== "once" && playback !== "repeat") {
    throw new ExploreBackgroundAudioError("Choose Play once or Repeat music for the background audio.");
  }
  const repeat = playback === "repeat" && sourceDurationMs < targetDurationMs;
  const audibleDurationMs = repeat ? targetDurationMs : Math.min(sourceDurationMs, targetDurationMs);
  return {
    playback,
    repeat,
    fit: repeat ? "loop" as const : sourceDurationMs > targetDurationMs ? "trim" as const : sourceDurationMs < targetDurationMs ? "pad" as const : "exact" as const,
    sourceDurationMs,
    targetDurationMs,
    audibleDurationMs,
    fadeDurationMs: Math.min(200, audibleDurationMs / 2),
  };
}
