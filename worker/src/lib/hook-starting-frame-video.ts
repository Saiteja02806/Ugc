/** App animation limits; each route receives one literal first frame. */
export function isHookStartingFrameVideoModel(model: unknown): model is "google_omni" | "seedance_2_5" | "wan_3_0" | "kling_3_0" | "kling_4_0" | "flux_3" {
  return model === "google_omni" || model === "seedance_2_5" || model === "wan_3_0" || model === "kling_3_0" || model === "kling_4_0" || model === "flux_3";
}

export function hookStartingFrameVideoProvider(model: unknown, mode?: unknown) {
  if (mode === "first_frame_with_identity" && model === "google_omni") return "gemini" as const;
  return isHookStartingFrameVideoModel(model) ? "reapi" as const : null;
}

export function hookStartingFrameVideoDurations(model: unknown): number[] {
  if (model === "google_omni") return [4, 6, 8, 10];
  if (model === "flux_3") return Array.from({ length: 16 }, (_, index) => index + 5);
  const minimum = model === "seedance_2_5" ? 4 : 3;
  const maximum = model === "kling_4_0" ? 30 : 15;
  return isHookStartingFrameVideoModel(model)
    ? Array.from({ length: maximum - minimum + 1 }, (_, index) => index + minimum) : [];
}

/** Initial choice only; explicit duration selections remain editable. */
export function hookStartingFrameDefaultDuration(model: unknown): 3 | 4 | 5 {
  return model === "wan_3_0" ? 3 : model === "flux_3" ? 5 : 4;
}

/** Identity photos the app accepts beside an approved starting frame. */
export function hookStartingFrameFaceReferenceLimit(model: unknown, mode?: unknown): number {
  if (!isHookStartingFrameVideoModel(model)) return 0;
  // FLUX 3 treats every image_url as an ordered keyframe, not an identity
  // reference. Only the approved starting frame is sent.
  if (model === "flux_3") return 0;
  // The direct Gemini route needs its explicit identity mode; the ReAPI routes
  // carry the frame as the first image of a reference job.
  if (model === "google_omni") return mode === "first_frame_with_identity" ? 5 : 0;
  return 5;
}

/**
 * How the frame and the identity photos reach the provider.
 * `frame_and_references` sends both. `frame_only` can only animate the approved
 * frame (Kling 3.0 exposes a first and a last frame slot and has no reference
 * mode), so the photos shaped the frame during preparation instead.
 */
export function hookStartingFrameFaceReferenceRoute(model: unknown, mode?: unknown): "frame_and_references" | "frame_only" {
  if (!isHookStartingFrameVideoModel(model)) return "frame_only";
  if (!hookStartingFrameFaceReferenceLimit(model, mode)) return "frame_only";
  return model === "kling_3_0" ? "frame_only" : "frame_and_references";
}
export function supportsHookStartingFrameFaceReferences(model: unknown): boolean {
  return hookStartingFrameFaceReferenceLimit(model) > 0;
}

/** New Hook drafts round the measured source to the nearest whole second,
 * then use the smallest supported duration at or above that value
 * (4.1s → 4s; 4.6s → 5s; Google Omni 4.6s → 6s).
 * Legacy frames without measured duration retain their existing default. */
export function hookStartingFrameSourceDuration(model: unknown, sourceDurationSeconds?: number, legacyDurationSeconds?: number): number {
  const durations = hookStartingFrameVideoDurations(model);
  if (Number.isFinite(sourceDurationSeconds) && sourceDurationSeconds! > 0) {
    const roundedSeconds = Math.round(sourceDurationSeconds!);
    return durations.find(duration => duration >= roundedSeconds) ?? durations.at(-1) ?? hookStartingFrameDefaultDuration(model);
  }
  return legacyDurationSeconds === 6 ? 6 : hookStartingFrameDefaultDuration(model);
}
