"use client";

import { CREATOR_REFERENCES } from "@/lib/ai-studio/creator-references";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import type { MediaAsset } from "@/lib/media/types";

export const USER_REFERENCE_IMAGE_PROJECT = "explore-reference";
export const CATALOG_REFERENCE_IMAGE_PROJECT = "explore-catalog-reference";

const imageTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const catalogFileNames = new Set(CREATOR_REFERENCES.map(reference => reference.fileName));

export function isUserReferenceImage(asset: MediaAsset) {
  return asset.collection === "image" && asset.status === "ready" &&
    asset.sourceType === "upload" && imageTypes.has(asset.mimeType) &&
    asset.projectId !== CATALOG_REFERENCE_IMAGE_PROJECT &&
    // Older catalogue selections were copied into AI Studio's upload collection.
    !(asset.projectId === "ai-studio" && asset.fileName && catalogFileNames.has(asset.fileName));
}

export async function fetchFormatReferenceImages(ownerId: string, signal?: AbortSignal): Promise<MediaAsset[]> {
  const response = await fetch("/api/media?collection=image&sourceTypes=upload", {
    cache: "no-store", signal, headers: await ownerHeaders(ownerId),
  });
  const body = await response.json() as { ok?: boolean; assets?: MediaAsset[]; error?: string };
  if (!response.ok || !body.ok || !Array.isArray(body.assets)) {
    throw new Error(body.error || "Could not load your images.");
  }
  return body.assets.filter(isUserReferenceImage);
}

/** Resolve the current owned record before reusing a possibly stale gallery tile. */
export async function fetchFormatReferenceImage(assetId: string, ownerId: string): Promise<MediaAsset> {
  const response = await fetch(`/api/media/${encodeURIComponent(assetId)}`, {
    cache: "no-store", headers: await ownerHeaders(ownerId),
  });
  const body = await response.json() as { ok?: boolean; asset?: MediaAsset; error?: string };
  if (!response.ok || !body.ok || !body.asset || body.asset.id !== assetId || !isUserReferenceImage(body.asset)) {
    throw new Error(body.error || "This image is no longer available. Refresh your images and try again.");
  }
  return body.asset;
}

async function ownerHeaders(ownerId: string) {
  const token = await getCurrentUserIdToken(ownerId);
  if (!token) throw new Error("Sign in to use your saved images.");
  return { Authorization: `Bearer ${token}` };
}
