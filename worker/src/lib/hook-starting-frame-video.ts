/** App animation limits; each route receives one literal first frame. */
export function isHookStartingFrameVideoModel(model: unknown): model is "google_omni" | "seedance_2_5" | "wan_3_0" {
  return model === "google_omni" || model === "seedance_2_5" || model === "wan_3_0";
}

export function hookStartingFrameVideoProvider(model: unknown) {
  return model === "google_omni" ? "gemini" as const
    : model === "seedance_2_5" || model === "wan_3_0" ? "reapi" as const : null;
}

export function hookStartingFrameVideoDurations(model: unknown): number[] {
  const minimum = model === "seedance_2_5" ? 4 : 3;
  return isHookStartingFrameVideoModel(model)
    ? Array.from({ length: (model === "google_omni" ? 10 : 15) - minimum + 1 }, (_, index) => index + minimum) : [];
}

/** Initial choice only; explicit duration selections remain editable. */
export function hookStartingFrameDefaultDuration(model: unknown): 3 | 4 {
  return model === "seedance_2_5" ? 4 : 3;
}

/** Only Omni's connected route documents literal first-frame + appearance roles.
 * Five optional photos keeps the total under its ten-image family limit. */
export function hookStartingFrameFaceReferenceLimit(model: unknown): number {
  return model === "google_omni" ? 5 : 0;
}
export function supportsHookStartingFrameFaceReferences(model: unknown): boolean {
  return hookStartingFrameFaceReferenceLimit(model) > 0;
}

/** New Hook drafts use the smallest supported duration covering the source.
 * Legacy frames without measured duration retain their existing default. */
export function hookStartingFrameSourceDuration(model: unknown, sourceDurationSeconds?: number, legacyDurationSeconds?: number): number {
  const durations = hookStartingFrameVideoDurations(model);
  if (Number.isFinite(sourceDurationSeconds) && sourceDurationSeconds! > 0) {
    return durations.find(duration => duration + .001 >= sourceDurationSeconds!) ?? durations.at(-1) ?? hookStartingFrameDefaultDuration(model);
  }
  return legacyDurationSeconds === 6 ? 6 : hookStartingFrameDefaultDuration(model);
}
