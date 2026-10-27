"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { FormatGenerationReferences } from "./format-generation-references";
import { fetchAIStudioMediaAsset } from "@/lib/ai-studio/media-client";
import type { AIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";
import { mergeCharacterHistoryPages } from "@/lib/characters/history";
import type { CharacterHistoryImage, CharacterHistoryPage } from "@/lib/characters/types";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { withReadDeadline } from "@/lib/http/read-deadline";
import type { MediaAsset } from "@/lib/media/types";
import type { HookStartingFrameSelection } from "@/lib/explore/hook-keyframe-client";
import { hookStartingFrameFaceReferenceLimit } from "@/worker/src/lib/hook-starting-frame-video";
import styles from "./starting-frame-animation-references.module.css";

export function StartingFrameAnimationReferences({ frame, model, photos, onPhotosChange, onSelectFrame, onClearFrame, previewFrames, previewInfluencers, ownerId, preview, active = true, disabled, onPendingChange, onErrorChange, frameControl }: {
  frame: HookStartingFrameSelection; model: string; photos: AIStudioReferenceMedia[];
  onPhotosChange: (photos: AIStudioReferenceMedia[]) => void;
  onSelectFrame?: (frame: HookStartingFrameSelection) => void; onClearFrame?: () => void;
  previewFrames?: HookStartingFrameSelection[]; previewInfluencers?: MediaAsset[];
  ownerId?: string; preview: boolean; active?: boolean; disabled: boolean;
  onPendingChange: (pending: boolean) => void; onErrorChange: (error: string | null) => void;
  frameControl?: ReactNode;
}) {
  const limit = hookStartingFrameFaceReferenceLimit(model);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const pending = useRef(false), revision = useRef(0), selectionRequest = useRef<AbortController | null>(null);
  const pendingCallback = useRef(onPendingChange);
  useEffect(() => { pendingCallback.current = onPendingChange; }, [onPendingChange]);
  useEffect(() => () => {
    revision.current += 1; selectionRequest.current?.abort(); selectionRequest.current = null;
    pending.current = false; pendingCallback.current(false);
  }, [ownerId, frame.assetId, model]);
  const history = useInfiniteQuery({
    queryKey: ["hook-influencer-history", ownerId ?? "signed-out"],
    enabled: active && Boolean(ownerId) && !preview && limit > 0, retry: false, staleTime: 60_000,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => withReadDeadline(async bounded => {
      const token = await getCurrentUserIdToken(ownerId);
      bounded.throwIfAborted();
      if (!token) throw new Error("Sign in to choose your saved influencer.");
      const response = await fetch(`/api/characters/history${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ""}`, {
        cache: "no-store", signal: bounded, headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json() as CharacterHistoryPage & { error?: string };
      if (!response.ok || !body.ok || !Array.isArray(body.images)) throw new Error(body.error || "Your influencer images could not be loaded.");
      return body;
    }, signal),
    getNextPageParam: page => page.nextCursor ?? undefined,
  });
  const sampleImages = preview && process.env.NODE_ENV === "development" ? previewInfluencers ?? [] : [];
  const historyImages: CharacterHistoryImage[] = preview ? sampleImages.map(asset => ({ jobId: asset.id, generationId: asset.id, mediaAssetId: asset.id, url: asset.url, model: "nano_banana_2", prompt: null, createdAt: asset.createdAt, saved: true })) : mergeCharacterHistoryPages(history.data?.pages ?? []);
  async function selectInfluencer(image: CharacterHistoryImage) {
    if (disabled || pending.current || !limit) return false;
    const request = ++revision.current;
    const controller = new AbortController(); selectionRequest.current?.abort(); selectionRequest.current = controller;
    pending.current = true; setSelectionError(null); onPendingChange(true); onErrorChange(null);
    try {
      if (image.mediaAssetId === frame.assetId) throw new Error("Choose a separate face photo; the starting frame is already selected.");
      if (photos.some(photo => photo.asset.id === image.mediaAssetId)) return true;
      if (photos.length >= limit) throw new Error(`Use up to ${limit} face references.`);
      const asset = preview ? sampleImages.find(asset => asset.id === image.mediaAssetId) : await withReadDeadline(async signal => {
        const token = await getCurrentUserIdToken(ownerId);
        signal.throwIfAborted();
        if (!token) throw new Error("Sign in to use your saved influencer.");
        return fetchAIStudioMediaAsset(image.mediaAssetId, token, { signal });
      }, controller.signal);
      if (request !== revision.current) return false;
      if (!asset || asset.id !== image.mediaAssetId || asset.status !== "ready" || !["image", "influencer"].includes(asset.collection) || asset.sourceType !== "generated_image" || !["image/png", "image/jpeg", "image/webp"].includes(asset.mimeType)) throw new Error("This influencer photo is unavailable. Choose another photo.");
      onPhotosChange([...photos, { kind: "image", asset }]); return true;
    } catch (cause) {
      if (request === revision.current) { const message = cause instanceof Error ? cause.message : "Could not select this photo."; setSelectionError(message); onErrorChange(message); }
      return false;
    } finally {
      if (selectionRequest.current === controller) selectionRequest.current = null;
      if (request === revision.current) { pending.current = false; onPendingChange(false); }
    }
  }
  return <div className={styles.root} data-starting-frame-references>
    {frameControl ?? <FormatGenerationReferences startingFrame={frame} startingFramesOnly onSelectStartingFrame={onSelectFrame} onClearStartingFrame={onClearFrame} previewStartingFrames={previewFrames}
      heading="Starting frame" selection={null} imageSelections={[]} imagePurpose="general" videoInputEnabled={false} audioInputEnabled={false}
      active={active} ownerId={ownerId} preview={preview} disabled={disabled} onChange={() => {}} onPendingChange={onPendingChange} onErrorChange={onErrorChange} />}
    <div className={styles.faces}>
      <FormatGenerationReferences heading="Your photos" inlineImagePicker imagePresentation="person-strip" imagePurpose="person" imagePickerDisabled={!limit}
        selection={photos[0] ?? null} imageSelections={photos} onImagesChange={onPhotosChange} maxImages={limit || hookStartingFrameFaceReferenceLimit("google_omni")}
        active={active} ownerId={ownerId} preview={preview} disabled={disabled} videoInputEnabled={false} audioInputEnabled={false}
        influencerLibrary={{ images: historyImages, loading: !preview && history.isPending, error: history.error, selectionError, hasMore: history.hasNextPage,
          loadingMore: history.isFetchingNextPage, onRetry: () => void history.refetch(), onLoadMore: () => void history.fetchNextPage(), onSelect: selectInfluencer }}
        onChange={selection => onPhotosChange(selection?.kind === "image" ? [...photos.filter(photo => photo.asset.id !== selection.asset.id), selection] : [])}
        onPendingChange={onPendingChange} onErrorChange={onErrorChange} />
      <p className={styles.hint}>{limit ? "Add clear photos of the same person for facial guidance. Your starting frame keeps the scene, clothing and pose." : "Choose Omni Flash 1.1 to add face references alongside the starting frame. Existing face photos are kept; remove them to use this model."}</p>
    </div>
  </div>;
}
