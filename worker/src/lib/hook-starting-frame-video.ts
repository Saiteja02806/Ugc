/** App animation limits; each route receives one literal first frame. */
export function isHookStartingFrameVideoModel(model: unknown): model is "google_omni" | "seedance_2_5" | "wan_3_0" {
  return model === "google_omni" || model === "seedance_2_5" || model === "wan_3_0";
}

export function hookStartingFrameVideoProvider(model: unknown) {
  return model === "google_omni" ? "gemini" as const
    : model === "seedance_2_5" || model === "wan_3_0" ? "reapi" as const : null;
}

export function hookStartingFrameVideoDurations(model: unknown): number[] {
  return isHookStartingFrameVideoModel(model)
    ? Array.from({ length: (model === "google_omni" ? 10 : 15) - 3 }, (_, index) => index + 4) : [];
}
