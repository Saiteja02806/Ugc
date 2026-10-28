import { getCurrentUserIdToken } from "../firebase/auth";
import { fetchAIStudioMediaAsset } from "../ai-studio/media-client";
import { withReadDeadline } from "../http/read-deadline";
import type { CharacterHistoryPage } from "./types";

/** Read the existing owned Build AI Influencer history; never generate media. */
export function fetchInfluencerPhotoLibrary(ownerId: string, cursor: string | null, signal?: AbortSignal) {
  return withReadDeadline(async bounded => {
    const token = await getCurrentUserIdToken(ownerId);
    bounded.throwIfAborted();
    if (!token) throw new Error("Sign in to see your influencers.");
    const response = await fetch(`/api/characters/history${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, {
      cache: "no-store", signal: bounded, headers: { Authorization: `Bearer ${token}` },
    });
    const body = await response.json() as CharacterHistoryPage & { error?: string };
    if (!response.ok || !body.ok || !Array.isArray(body.images)) throw new Error(body.error || "Your influencer images could not be loaded.");
    return body;
  }, signal);
}

export function resolveInfluencerPhoto(ownerId: string, assetId: string, signal?: AbortSignal) {
  return withReadDeadline(async bounded => {
    const token = await getCurrentUserIdToken(ownerId);
    bounded.throwIfAborted();
    if (!token) throw new Error("Sign in to use your saved influencer.");
    const asset = await fetchAIStudioMediaAsset(assetId, token, { signal: bounded });
    if (asset.id !== assetId || asset.status !== "ready" || !["image", "influencer"].includes(asset.collection) ||
      asset.sourceType !== "generated_image" || !["image/png", "image/jpeg", "image/webp"].includes(asset.mimeType)) {
      throw new Error("This influencer photo is unavailable. Choose another photo.");
    }
    return asset;
  }, signal);
}
