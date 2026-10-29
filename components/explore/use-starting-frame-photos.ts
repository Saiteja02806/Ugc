"use client";
import { useEffect, useRef, useState } from "react";
import { fetchAIStudioMediaAsset } from "@/lib/ai-studio/media-client";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import type { HookStartingFrameSelection } from "@/lib/explore/hook-keyframe-client";
import type { AIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";
import { hookStartingFrameFaceReferenceLimit } from "@/worker/src/lib/hook-starting-frame-video";
import { startingFramePhotoKey, readStartingFramePhotos, serializeStartingFramePhotos } from "@/lib/explore/starting-frame-photo-selection";

const photoStore = (tabScoped: boolean) => tabScoped ? sessionStorage : localStorage;

/** Restore once per frame/model, cancel stale reads, and never reinsert photos
 * after an explicit edit. Every URL is refreshed through the owned media GET. */
export function useStartingFramePhotos(frame: HookStartingFrameSelection | undefined, model: string, enabled: boolean,
  apply: (photos: AIStudioReferenceMedia[]) => void, tabScoped = false) {
  const key = frame ? startingFramePhotoKey(frame) : null;
  const limit = hookStartingFrameFaceReferenceLimit(model);
  const loadKey = enabled && key && limit ? `${key}:${model}:${tabScoped ? "tab" : "shared"}` : null;
  const [state, setState] = useState<{ key: string | null; pending: boolean; error: string | null }>({ key: null, pending: false, error: null });
  const applyRef = useRef(apply), revision = useRef(0);
  useEffect(() => { applyRef.current = apply; }, [apply]);
  const ownerId = frame?.ownerId, jobId = frame?.jobId, assetId = frame?.assetId;
  const idsJson = JSON.stringify(frame?.identityAssetIds ?? []);
  useEffect(() => {
    const controller = new AbortController(), current = ++revision.current;
    if (!loadKey || !ownerId || !jobId || !assetId) return () => controller.abort();
    const scope = { ownerId, jobId, assetId };
    void (async () => {
      await Promise.resolve();
      if (controller.signal.aborted) return;
      setState({ key: loadKey, pending: true, error: null });
      try {
        const photoKey = startingFramePhotoKey(scope), raw = photoStore(tabScoped).getItem(photoKey);
        // Snapshot existing explicit choices once; later edits belong to this tab.
        const prior = tabScoped && raw === null ? localStorage.getItem(photoKey) : raw;
        const ids = readStartingFramePhotos(prior, scope) ?? JSON.parse(idsJson) as string[];
        if (tabScoped && raw === null) photoStore(true).setItem(photoKey, serializeStartingFramePhotos(ids, scope));
        // Validate the receipt-derived fallback through the same bounded parser.
        serializeStartingFramePhotos(ids, scope);
        if (ids.length > limit) throw new Error("Review your selected face photos before generating.");
        const token = ids.length ? await getCurrentUserIdToken(ownerId) : null;
        if (ids.length && !token) throw new Error("Sign in to restore your selected face photos.");
        const photos = await Promise.all(ids.map(async id => {
          const asset = await fetchAIStudioMediaAsset(id, token!, { signal: controller.signal });
          if (asset.id !== id || asset.status !== "ready" || !["image", "influencer"].includes(asset.collection) ||
            !["image/png", "image/jpeg", "image/webp"].includes(asset.mimeType)) throw new Error("A selected face photo is unavailable. Choose it again.");
          return { kind: "image" as const, asset };
        }));
        if (!controller.signal.aborted && revision.current === current) {
          applyRef.current(photos);
          setState({ key: loadKey, pending: false, error: null });
        }
      } catch (error) {
        if (!controller.signal.aborted && revision.current === current) setState({ key: loadKey, pending: false,
          error: error instanceof Error ? error.message : "Could not restore your selected face photos." });
      }
    })();
    return () => controller.abort();
  }, [loadKey, ownerId, jobId, assetId, idsJson, limit, tabScoped]);
  function remember(photos: AIStudioReferenceMedia[]) {
    if (!frame || !loadKey) return;
    revision.current += 1;
    try {
      photoStore(tabScoped).setItem(startingFramePhotoKey(frame), serializeStartingFramePhotos(photos.map(photo => photo.asset.id), frame));
      setState({ key: loadKey, pending: false, error: null });
    } catch { setState({ key: loadKey, pending: false, error: "Your browser could not save this photo selection. Allow site storage before generating." }); }
  }
  return { pending: Boolean(loadKey && (state.key !== loadKey || state.pending)), error: state.key === loadKey ? state.error : null, remember };
}
