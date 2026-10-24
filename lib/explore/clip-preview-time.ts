/** A paused endpoint still displays the last frame of this clip. */
export function clipPreviewTextTimeMs(timeMs: number, durationMs: number) {
  return Math.max(0, Math.min(timeMs, durationMs - .001));
}
