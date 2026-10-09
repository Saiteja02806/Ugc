import { ProviderRequestNotSubmittedError } from "./generation-provider.js";
import { generateOpenRouterVideoBuffer, type OpenRouterVideoClientOptions, type OpenRouterVideoOperation } from "./openrouter-video.js";

export const OPENROUTER_SEEDANCE_MODEL = "bytedance/seedance-2.5";

type SeedanceInput = {
  aspectRatio: "9:16" | "16:9";
  durationSeconds: number;
  prompt: string;
  referenceImageUrl?: string;
  referenceImageUrls?: string[];
  referenceAudioUrls?: string[];
  referenceVideoUrl?: string;
  resolution: "480p" | "720p" | "1080p";
};

export function buildOpenRouterSeedanceRequest(input: SeedanceInput) {
  if (!Number.isInteger(input.durationSeconds) || input.durationSeconds < 4 || input.durationSeconds > 30) {
    throw new ProviderRequestNotSubmittedError("Seedance 2.5 duration must be between 4 and 30 seconds.");
  }
  if (input.resolution !== "480p" && input.resolution !== "720p") {
    throw new ProviderRequestNotSubmittedError("Seedance 2.5 supports 480p or 720p video quality.");
  }
  if (input.aspectRatio !== "9:16" && input.aspectRatio !== "16:9") {
    throw new ProviderRequestNotSubmittedError("Choose a supported Seedance 2.5 aspect ratio.");
  }
  const prompt = input.prompt.trim();
  if (!prompt || prompt.length > 10_000) {
    throw new ProviderRequestNotSubmittedError("Add a prompt within the supported video input length.");
  }
  const images = input.referenceImageUrls?.length
    ? input.referenceImageUrls : input.referenceImageUrl ? [input.referenceImageUrl] : [];
  if (images.length > 6 || new Set(images).size !== images.length || images.some((url) => !isHttpsUrl(url))) {
    throw new ProviderRequestNotSubmittedError("Seedance 2.5 accepts up to six distinct uploaded image references in UGC Pilot.");
  }
  const audio = input.referenceAudioUrls ?? [];
  const media = [...images, ...audio, ...(input.referenceVideoUrl ? [input.referenceVideoUrl] : [])];
  if (media.length > 6 || audio.length > 1 || media.some(url => !isHttpsUrl(url)) || new Set(media).size !== media.length) {
    throw new ProviderRequestNotSubmittedError("Use up to six distinct HTTPS references, including one audio and one video reference, in UGC Pilot.");
  }
  // OpenRouter Seedance 2.5 accepts all three input_references modalities.
  // These guide generation; there is no soundtrack mixing or demo append here.
  const inputReferences = [
    ...images.map(url => ({ type: "image_url" as const, image_url: { url } })),
    ...audio.map(url => ({ type: "audio_url" as const, audio_url: { url } })),
    ...(input.referenceVideoUrl ? [{ type: "video_url" as const, video_url: { url: input.referenceVideoUrl } }] : []),
  ];
  return {
    model: OPENROUTER_SEEDANCE_MODEL,
    prompt,
    duration: input.durationSeconds,
    resolution: input.resolution,
    aspect_ratio: input.aspectRatio,
    generate_audio: true,
    ...(inputReferences.length ? { input_references: inputReferences } : {}),
  };
}

export async function generateOpenRouterSeedanceVideoBuffer(
  input: SeedanceInput & OpenRouterVideoOperation,
  options: OpenRouterVideoClientOptions = {},
) {
  return generateOpenRouterVideoBuffer(input, {
    buildRequest: () => buildOpenRouterSeedanceRequest(input),
    // OpenRouter authorizes at least $2 for requests with video references.
    estimatedCostUsd: () => Math.max(input.referenceVideoUrl ? 2 : 0,
      estimateOpenRouterSeedanceCost(input.resolution as "480p" | "720p", input.durationSeconds)),
  }, options);
}

export function estimateOpenRouterSeedanceCost(resolution: "480p" | "720p", seconds: number) {
  const pixels = resolution === "480p" ? 480 * 854 : 720 * 1280;
  return pixels * 24 * seconds / 1024 * 0.0000107;
}

function isHttpsUrl(value: string) { try { return new URL(value).protocol === "https:"; } catch { return false; } }
