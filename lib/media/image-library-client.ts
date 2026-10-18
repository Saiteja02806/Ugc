"use client";

import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { isAvailableLibraryImage } from "./image-library";
import type { MediaAsset } from "./types";

export async function imageLibraryRequest<T>(owner: string, path: string, init: RequestInit = {}): Promise<T> {
  const token = await getCurrentUserIdToken(owner);
  if (!token) throw new Error("Sign in to use your image library.");
  const response = await fetch(path, { ...init, cache: "no-store", signal: init.signal ?? AbortSignal.timeout(30_000),
    headers: { ...init.headers, Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.error || "Could not update your image library. Try again.");
  return data as T;
}

/** Recheck every chosen source before making one atomic local draft change. */
export async function resolveLibraryImages(owner: string, ids: readonly string[]) {
  const unique = [...new Set(ids)];
  if (!unique.length || unique.length > 100) throw new Error("Choose between 1 and 100 images.");
  const assets: MediaAsset[] = [];
  // Bound parallel reads; all must succeed before the caller changes its draft.
  for (let index = 0; index < unique.length; index += 4) {
    assets.push(...await Promise.all(unique.slice(index, index + 4).map(async id => {
      const data = await imageLibraryRequest<{ asset: MediaAsset }>(owner, `/api/media/${encodeURIComponent(id)}?remixSource=1`);
      if (data.asset?.id !== id || !isAvailableLibraryImage(data.asset)) throw new Error("An image is no longer available. Refresh the library and choose again.");
      return data.asset;
    })));
  }
  return new Map(assets.map(asset => [asset.id, asset]));
}
