/** Explicit semantics for new Hook/Wall jobs. Missing means a historical job. */
export type ExploreGenerationContract = {
  version: 1;
  operation: "source_edit" | "generate";
  sound: "off" | "on";
};

export function parseExploreGenerationContract(value: unknown): ExploreGenerationContract | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Choose valid video operation and sound settings.");
  const input = value as Record<string, unknown>;
  if (input.version !== 1 || !["source_edit", "generate"].includes(String(input.operation)) || !["off", "on"].includes(String(input.sound))) {
    throw new Error("Choose valid video operation and sound settings.");
  }
  return { version: 1, operation: input.operation as ExploreGenerationContract["operation"], sound: input.sound as ExploreGenerationContract["sound"] };
}

export function exploreGenerationCompatibility(model: string, hasVideo: boolean, seconds?: number | null): string | null {
  if (!hasVideo) return ["google_omni", "seedance_2_5", "wan_3_0"].includes(model) ? null : "Choose a supported video model.";
  if (model === "wan_3_0") return "WAN 3.0 creates new clips from references here. Choose a model that edits the source video, or remove the video to create a new clip.";
  if (model !== "google_omni" && model !== "seedance_2_5") return "Choose a model that supports editing the source video.";
  if (seconds == null) return "Wait for the source video's duration to load.";
  if (!Number.isFinite(seconds) || seconds <= 0) return "Choose a source video with a valid duration.";
  if (model === "google_omni" && seconds > 10) return "Omni source edits support videos up to 10 seconds. Choose another compatible model or source.";
  if (model === "seedance_2_5" && (seconds < 4 || seconds > 30)) return "Seedance source edits require a 4–30 second source video. Choose a compatible model or source; the clip will not be padded or shortened.";
  return null;
}

export function buildExploreGenerationPrompt(prompt: string, contract: ExploreGenerationContract, imageCount: number) {
  const roles = imageCount ? ` Image references ${Array.from({ length: imageCount }, (_, i) => `Image ${i + 1}`).join(", ")} are supplied in that order.` : "";
  const operation = contract.operation === "source_edit"
    ? "Edit Video 1 directly. Preserve its scene, framing, lighting, body performance, camera movements and timing except for the user's requested changes. Remove existing captions and text overlays, reconstructing the background beneath them." +
      (imageCount ? " Use portrait references for the replacement facial appearance only; preserve the source clothing, hairstyle and body unless the user explicitly requests another change." : "")
    : "Create a new video from the user's instructions and attached images. There is no source video to preserve. Use the images according to the user's stated appearance or product roles.";
  return `${operation}${roles}${contract.sound === "off" ? " Return a silent video with no speech, dialogue, music or sound effects." : " Include sound according to the user's instructions."}\n\nUser instructions:\n${prompt.trim()}`;
}

/** Explicit new silence takes priority over legacy soundtrack provenance. */
export function hasSilentExploreGeneration(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  const value = metadata as Record<string, unknown>;
  const render = value.render && typeof value.render === "object" ? value.render as Record<string, unknown> : {};
  const contract = value.exploreGeneration ?? render.exploreGeneration;
  return !!contract && typeof contract === "object" && (contract as ExploreGenerationContract).version === 1 && (contract as ExploreGenerationContract).sound === "off";
}
