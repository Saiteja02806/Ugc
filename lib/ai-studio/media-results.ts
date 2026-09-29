import type { MediaAsset } from "../media/types.ts";

export type AIStudioImageResult = {
  aspectRatio: "1:1" | "4:5" | "9:16" | "16:9";
  createdAt: string;
  id: string;
  title: string;
  url: string;
};

export type AIStudioVideoResult = {
  createdAt: string;
  durationSeconds: number | null;
  id: string;
  mediaAssetId: string | null;
  modelLabel: string | null;
  prompt: string;
  ratio: "1:1" | "4:5" | "9:16" | "16:9";
  resolution: "480p" | "720p" | "1080p" | null;
  status: "Ready";
  thumbnailUrl: string | null;
  title: string;
  url: string;
};

const supportedRatios = new Set(["1:1", "4:5", "9:16", "16:9"]);

export function getAIStudioImageResults(
  assets: MediaAsset[],
  limit = 24,
): AIStudioImageResult[] {
  return assets
    .filter(
      (asset) =>
        asset.collection === "image" &&
        asset.sourceType === "generated_image" &&
        asset.status === "ready" &&
        Boolean(asset.url),
    )
    .slice(0, limit)
    .map((asset) => ({
      aspectRatio: toSupportedRatio(asset.ratio, "4:5"),
      createdAt: asset.createdAt,
      id: asset.id,
      title: asset.title || "Generated image",
      url: asset.url,
    }));
}

export function getAIStudioVideoResults(
  assets: MediaAsset[],
  limit = 24,
): AIStudioVideoResult[] {
  return assets
    .filter(
      (asset) =>
        asset.collection === "video" &&
        asset.sourceType === "generated_video" &&
        asset.status === "ready" &&
        Boolean(asset.url),
    )
    .slice(0, limit)
    .map((asset) => ({
      createdAt: asset.createdAt,
      durationSeconds: asset.durationSeconds,
      id: asset.id,
      mediaAssetId: asset.id,
      modelLabel: getVideoModelLabel(asset.metadata),
      prompt: getVideoPrompt(asset),
      ratio: toSupportedRatio(asset.ratio, "9:16"),
      resolution: getVideoResolution(asset.metadata),
      status: "Ready",
      thumbnailUrl: asset.thumbnailUrl,
      title: asset.title || "Generated video",
      url: asset.url,
    }));
}

function getVideoPrompt(asset: MediaAsset) {
  const prompt = getMetadataString(asset.metadata, "prompt") ??
    getMetadataString(asset.metadata, "hookIdea");

  return prompt || asset.title || "Generated video";
}

function getVideoModelLabel(metadata: MediaAsset["metadata"]) {
  const model = getMetadataString(metadata, "model");

  if (model === "seedance_2_5") return "Seedance 2.5";
  if (model === "google_omni") return "Google Omni";

  const provider = getMetadataString(metadata, "provider");

  if (provider === "higgsfield") return "Seedance 2.5";
  if (provider === "gemini") return "Google Omni";
  if (provider === "runway") return "Runway";

  return null;
}

function getVideoResolution(metadata: MediaAsset["metadata"]) {
  const resolution = getMetadataString(metadata, "resolution");

  return resolution === "480p" || resolution === "720p" || resolution === "1080p"
    ? resolution
    : null;
}

function getMetadataString(
  metadata: MediaAsset["metadata"],
  key: string,
) {
  const value = metadata[key];

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function upsertAIStudioResult<T extends { id: string }>(
  results: T[],
  result: T,
  limit = 24,
) {
  return [result, ...results.filter((candidate) => candidate.id !== result.id)].slice(
    0,
    limit,
  );
}

function toSupportedRatio<T extends "1:1" | "4:5" | "9:16" | "16:9">(
  ratio: string,
  fallback: T,
) {
  return (supportedRatios.has(ratio) ? ratio : fallback) as
    | "1:1"
    | "4:5"
    | "9:16"
    | "16:9";
}
