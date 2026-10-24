import { getAIStudioVideoModelLabel, type AIStudioVideoModel } from "./generation-settings";

export type VideoReferencePolicyOptions = { allowOmniVideo?: boolean; hasTimedReferences?: boolean };

/** Limits of the connected generation routes, shared by pickers and submission. */
export function getVideoReferencePolicy(model: AIStudioVideoModel, options: VideoReferencePolicyOptions = {}) {
  const timed = model === "seedance_2_5" || model === "wan_3_0";
  const omniVideo = model === "google_omni" && options.allowOmniVideo === true;
  // Image capacity is independent of the one video / one audio supported by
  // this application. A source clip must not consume a face-photo slot.
  // Google's Omni 1.1 Enterprise model card documents ten images per prompt:
  // https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/omni-1-1-flash
  // The direct Gemini stable route does not publish a separate numeric ceiling;
  // ten is our supported cap based on that model-family specification, not a
  // claim of a paid acceptance test or a guarantee about facial fidelity.
  const maxImages = model === "seedance_2_5" ? 30 : model === "kling_3_0" ? 2 : 10;
  return {
    allowedKinds: ["image", ...(timed || omniVideo ? ["video"] : []), ...(timed ? ["audio"] : [])] as ("image" | "video" | "audio")[],
    maxImages,
    maxFiles: maxImages + (timed ? 2 : omniVideo ? 1 : 0),
    maxImageBytes: (model === "wan_3_0" && options.hasTimedReferences ? 16 : 20) * 1024 ** 2,
    maxVideoDuration: model === "wan_3_0" ? 15 : omniVideo ? 10 : 30,
    maxAudioDuration: model === "wan_3_0" ? 15 : 30,
    maxVideoBytes: (model === "wan_3_0" || omniVideo ? 32 : model === "seedance_2_5" ? 200 : 250) * 1024 ** 2,
    maxAudioBytes: (timed ? 15 : 25) * 1024 ** 2,
  };
}

export function getVideoReferenceTypeError(model: AIStudioVideoModel, hasVideo: boolean, hasAudio: boolean, options: VideoReferencePolicyOptions = {}) {
  const policy = getVideoReferencePolicy(model, options);
  if ((hasAudio && !policy.allowedKinds.includes("audio")) || (hasVideo && !policy.allowedKinds.includes("video"))) {
    return "Choose Seedance 2.5 or WAN 3.0 to use audio or video references, or remove the unsupported reference.";
  }
  return null;
}

export function getVideoTimedReferenceError(model: AIStudioVideoModel, kind: "video" | "audio", duration: number | null | undefined, size?: number, options: VideoReferencePolicyOptions = {}) {
  const typeError = getVideoReferenceTypeError(model, kind === "video", kind === "audio", options);
  if (typeError) return typeError;
  const policy = getVideoReferencePolicy(model, options);
  const maxDuration = kind === "video" ? policy.maxVideoDuration : policy.maxAudioDuration;
  const minDuration = model === "seedance_2_5" ? 2 : model === "wan_3_0" ? 1 : 0;
  const maxBytes = kind === "video" ? policy.maxVideoBytes : policy.maxAudioBytes;
  if (!Number.isFinite(duration) || !duration || duration <= 0 || duration > maxDuration) {
    return `Choose a reference ${kind} up to ${maxDuration} seconds for ${getAIStudioVideoModelLabel(model)}.`;
  }
  if (duration < minDuration) return `Choose a reference ${kind} of at least ${minDuration} seconds for ${getAIStudioVideoModelLabel(model)}.`;
  if (size !== undefined && (!Number.isFinite(size) || size <= 0 || size > maxBytes)) {
    return `Choose a reference ${kind} up to ${maxBytes / 1024 ** 2} MB for ${getAIStudioVideoModelLabel(model)}.`;
  }
  return null;
}
