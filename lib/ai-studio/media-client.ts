import type { MediaAsset, MediaCollection, MediaSourceType } from "@/lib/media/types";

type MediaListResponse =
  | { assets: MediaAsset[]; ok: true }
  | { error?: string; ok?: false };

type MediaDetailResponse =
  | { asset: MediaAsset | null; ok: true }
  | { error?: string; ok?: false };

export async function fetchAIStudioMediaAssets(params: {
  collection: MediaCollection;
  sourceType: MediaSourceType;
  token: string;
}) {
  const searchParams = new URLSearchParams({
    collection: params.collection,
    sourceTypes: params.sourceType,
  });
  const response = await fetch(`/api/media?${searchParams.toString()}`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${params.token}` },
  });
  const data = (await response.json()) as MediaListResponse;

  if (!response.ok || data.ok !== true) {
    throw new Error(getMediaApiError(data, "Could not load AI Studio results."));
  }

  return data.assets;
}

export async function fetchAIStudioMediaAsset(assetId: string, token: string) {
  const response = await fetch(`/api/media/${encodeURIComponent(assetId)}`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await response.json()) as MediaDetailResponse;

  if (!response.ok || data.ok !== true || !data.asset) {
    throw new Error(getMediaApiError(data, "Could not load the generated asset."));
  }

  return data.asset;
}

function getMediaApiError(value: unknown, fallback: string) {
  return value &&
    typeof value === "object" &&
    "error" in value &&
    typeof value.error === "string"
    ? value.error
    : fallback;
}
