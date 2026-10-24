import type { MediaAsset, MediaCollection, MediaSourceType } from "@/lib/media/types";
import { withReadDeadline } from "@/lib/http/read-deadline";

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
  signal?: AbortSignal;
}) {
  return withReadDeadline(async signal => {
    const searchParams = new URLSearchParams({
      collection: params.collection,
      sourceTypes: params.sourceType,
    });
    const response = await fetch(`/api/media?${searchParams.toString()}`, {
      cache: "no-store",
      signal,
      headers: { Authorization: `Bearer ${params.token}` },
    });
    const data = (await response.json()) as MediaListResponse;

    if (!response.ok || data.ok !== true) {
      throw new Error(getMediaApiError(data, "Could not load AI Studio results."));
    }

    return data.assets;
  }, params.signal);
}

export async function fetchAIStudioMediaAsset(assetId: string, token: string, options?: { signal?: AbortSignal; remixSource?: boolean; generationDetails?: boolean }) {
  return withReadDeadline(async signal => {
    const query = new URLSearchParams();
    if (options?.remixSource) query.set("remixSource", "1");
    if (options?.generationDetails) query.set("generationDetails", "1");
    const response = await fetch(`/api/media/${encodeURIComponent(assetId)}${query.size ? `?${query}` : ""}`, {
      cache: "no-store",
      signal,
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await response.json()) as MediaDetailResponse;

    if (!response.ok || data.ok !== true || !data.asset || data.asset.id !== assetId) {
      throw new Error(getMediaApiError(data, "Could not load the generated asset."));
    }

    return data.asset;
  }, options?.signal);
}

function getMediaApiError(value: unknown, fallback: string) {
  return value &&
    typeof value === "object" &&
    "error" in value &&
    typeof value.error === "string"
    ? value.error
    : fallback;
}
