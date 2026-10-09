import { ProviderRequestNotSubmittedError } from "./generation-provider.js";
import { generateOpenRouterVideoBuffer, type OpenRouterVideoClientOptions, type OpenRouterVideoOperation } from "./openrouter-video.js";

export const OPENROUTER_WAN_MODEL = "alibaba/wan-3.0";
type WanInput = {
  aspectRatio: "9:16" | "16:9";
  durationSeconds: number;
  resolution: "480p" | "720p" | "1080p";
  prompt: string;
  referenceImageUrl?: string;
  referenceImageUrls?: string[];
  referenceAudioUrls?: string[];
  referenceVideoUrl?: string;
};

export function buildOpenRouterWanRequest(input: WanInput) {
  if (!Number.isInteger(input.durationSeconds) || input.durationSeconds < 2 || input.durationSeconds > 30) {
    throw new ProviderRequestNotSubmittedError("WAN 3.0 duration must be between 2 and 30 seconds.");
  }
  if (!["480p", "720p", "1080p"].includes(input.resolution)) {
    throw new ProviderRequestNotSubmittedError("WAN 3.0 supports 480p, 720p or 1080p video quality.");
  }
  if (input.aspectRatio !== "9:16" && input.aspectRatio !== "16:9") {
    throw new ProviderRequestNotSubmittedError("Choose portrait 9:16 or landscape 16:9 for WAN 3.0.");
  }
  const prompt = input.prompt.trim();
  if (!prompt || prompt.length > 10_000) {
    throw new ProviderRequestNotSubmittedError("Add a WAN 3.0 prompt of 1–10000 characters.");
  }
  if (input.referenceVideoUrl || input.referenceAudioUrls?.length) {
    throw new ProviderRequestNotSubmittedError("WAN 3.0 supports image references in UGC Pilot. Choose Seedance 2.5 for audio or video references.");
  }
  const images = input.referenceImageUrls?.length ? input.referenceImageUrls : input.referenceImageUrl ? [input.referenceImageUrl] : [];
  if (images.length > 6 || new Set(images).size !== images.length || images.some(url => !isHttpsUrl(url))) {
    throw new ProviderRequestNotSubmittedError("WAN 3.0 accepts up to six distinct uploaded image references in UGC Pilot.");
  }
  return {
    model: OPENROUTER_WAN_MODEL,
    prompt,
    duration: input.durationSeconds,
    resolution: input.resolution,
    aspect_ratio: input.aspectRatio,
    generate_audio: true,
    ...(images.length ? { input_references: images.map(url => ({ type: "image_url" as const, image_url: { url } })) } : {}),
  };
}

/** Undiscounted catalogue prices checked 2026-10-09; actual usage is saved separately. */
export function estimateOpenRouterWanCost(resolution: WanInput["resolution"], seconds: number) {
  return { "480p": 0.05, "720p": 0.1, "1080p": 0.2 }[resolution] * seconds;
}

export async function generateOpenRouterWanVideoBuffer(input: WanInput & OpenRouterVideoOperation, options: OpenRouterVideoClientOptions = {}) {
  return generateOpenRouterVideoBuffer(input, {
    buildRequest: () => buildOpenRouterWanRequest(input),
    estimatedCostUsd: () => estimateOpenRouterWanCost(input.resolution, input.durationSeconds),
  }, options);
}

function isHttpsUrl(value: string) {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}
