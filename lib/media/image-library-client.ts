"use client";

import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { isAvailableLibraryImage } from "./image-library";
import type { MediaAsset } from "./types";
import { withReadDeadline } from "@/lib/http/read-deadline";

export async function imageLibraryRequest<T>(owner: string, path: string, init: RequestInit = {}): Promise<T> {
  return withReadDeadline(async signal => {
    const token = await getCurrentUserIdToken(owner);
    signal.throwIfAborted();
    if (!token) throw new Error("Sign in to use your image library.");
    const response = await fetch(path, { ...init, cache: "no-store", signal,
      headers: { ...init.headers, Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "Could not update your image library. Try again.");
    return data as T;
  }, init.signal ?? undefined, 30_000);
}

/** Recheck every chosen source before making one atomic local draft change. */
export async function resolveLibraryImages(owner: string, ids: readonly string[]) {
  const unique = [...new Set(ids)];
  if (!unique.length || unique.length > 100) throw new Error("Choose between 1 and 100 images.");
  const assets: MediaAsset[] = [];
  // One authenticated DB lookup per 20 images, rather than one request per tile.
  for (let index = 0; index < unique.length; index += 20) {
    const batch = unique.slice(index, index + 20);
    const data = await imageLibraryRequest<{ assets: MediaAsset[] }>(owner, "/api/media/image-library/resolve", {
      method: "POST", body: JSON.stringify({ mediaAssetIds: batch }),
    });
    const byId = new Map((data.assets ?? []).map(asset => [asset.id, asset]));
    for (const id of batch) {
      const asset = byId.get(id);
      if (!asset || !isAvailableLibraryImage(asset)) throw new Error("An image is no longer available. Refresh the library and choose again.");
      assets.push(asset);
    }
  }
  return new Map(assets.map(asset => [asset.id, asset]));
}
