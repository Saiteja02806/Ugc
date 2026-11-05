"use client";

import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import type { MediaAsset } from "@/lib/media/types";
import { withReadDeadline } from "@/lib/http/read-deadline";
import { isUploadedStartingFrame, UPLOADED_STARTING_FRAME_PROJECT, uploadedStartingFrameSelection } from "./uploaded-starting-frame";

export const USER_REFERENCE_IMAGE_PROJECT = "explore-reference";
export const CATALOG_REFERENCE_IMAGE_PROJECT = "explore-catalog-reference";

const imageTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

export function isUserReferenceImage(asset: MediaAsset) {
  return asset.collection === "image" && asset.status === "ready" &&
    asset.sourceType === "upload" && imageTypes.has(asset.mimeType) &&
    // Positive provenance: unrelated uploads and unclassified legacy files stay
    // in the media library, but must not leak into Explore's reference picker.
    asset.projectId === USER_REFERENCE_IMAGE_PROJECT;
}

export async function fetchFormatReferenceImages(ownerId: string, signal?: AbortSignal): Promise<MediaAsset[]> {
  return fetchOwnedImageUploads(ownerId, USER_REFERENCE_IMAGE_PROJECT, isUserReferenceImage, signal);
}

export function fetchUploadedStartingFrames(ownerId: string, signal?: AbortSignal) {
  return fetchOwnedImageUploads(ownerId, UPLOADED_STARTING_FRAME_PROJECT, isUploadedStartingFrame, signal);
}

async function fetchOwnedImageUploads(ownerId: string, project: string, filter: (asset: MediaAsset) => boolean, signal?: AbortSignal) {
  return withReadDeadline(async bounded => {
    const headers = await ownerHeaders(ownerId);
    bounded.throwIfAborted();
    const response = await fetch(`/api/media?collection=image&sourceTypes=upload&projectId=${project}`, {
      cache: "no-store", signal: bounded, headers,
    });
    const body = await response.json() as { ok?: boolean; assets?: MediaAsset[]; error?: string };
    if (!response.ok || !body.ok || !Array.isArray(body.assets)) {
      throw new Error(body.error || "Could not load your images.");
    }
    return body.assets.filter(filter);
  }, signal);
}

/** Resolve the current owned record before reusing a possibly stale gallery tile. */
export async function fetchFormatReferenceImage(assetId: string, ownerId: string): Promise<MediaAsset> {
  return fetchOwnedImageUpload(assetId, ownerId, isUserReferenceImage);
}

export async function fetchUploadedStartingFrame(assetId: string, ownerId: string, signal?: AbortSignal) {
  const asset = await fetchOwnedImageUpload(assetId, ownerId, isUploadedStartingFrame, signal);
  return uploadedStartingFrameSelection(asset, ownerId);
}

function fetchOwnedImageUpload(assetId: string, ownerId: string, filter: (asset: MediaAsset) => boolean, signal?: AbortSignal) {
  return withReadDeadline(async bounded => {
    const headers = await ownerHeaders(ownerId);
    bounded.throwIfAborted();
    const response = await fetch(`/api/media/${encodeURIComponent(assetId)}`, {
      cache: "no-store", signal: bounded, headers,
    });
    const body = await response.json() as { ok?: boolean; asset?: MediaAsset; error?: string };
    if (!response.ok || !body.ok || !body.asset || body.asset.id !== assetId || !filter(body.asset)) {
      throw new Error(body.error || "This image is no longer available. Refresh your images and try again.");
    }
    return body.asset;
  }, signal);
}

async function ownerHeaders(ownerId: string) {
  const token = await getCurrentUserIdToken(ownerId);
  if (!token) throw new Error("Sign in to use your saved images.");
  return { Authorization: `Bearer ${token}` };
}
