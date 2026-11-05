"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { uploadAIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";
import { fetchUploadedStartingFrame, fetchUploadedStartingFrames } from "@/lib/explore/format-reference-images";
import { validateReferenceImageFiles } from "@/lib/explore/reference-image-batch";
import { UPLOADED_STARTING_FRAME_PROJECT, uploadedStartingFrameSelection, type UploadedStartingFrameSelection } from "@/lib/explore/uploaded-starting-frame";
import { imagePickerThumbnailUrl } from "@/lib/media/image-picker";
import type { MediaAsset } from "@/lib/media/types";
import picker from "./format-person-image-picker.module.css";

export function useStartingFrameUploads({ active, ownerId, disabled, maxBytes, selectedId, onSelect, onPendingChange, onErrorChange }: {
  active: boolean; ownerId?: string | null; disabled: boolean; maxBytes: number; selectedId?: string;
  onSelect: (frame: UploadedStartingFrameSelection) => boolean | void;
  onPendingChange?: (pending: boolean) => void;
  onErrorChange?: (error: string | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const operation = useRef<AbortController | null>(null);
  const pendingCallback = useRef(onPendingChange);
  useEffect(() => { pendingCallback.current = onPendingChange; }, [onPendingChange]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const client = useQueryClient();
  const key = ["uploaded-starting-frames", ownerId] as const;
  const query = useQuery({
    queryKey: key, queryFn: ({ signal }) => fetchUploadedStartingFrames(ownerId!, signal),
    enabled: active && Boolean(ownerId), staleTime: 0,
  });
  useEffect(() => () => {
    if (operation.current) {
      operation.current.abort();
      operation.current = null;
      pendingCallback.current?.(false);
    }
  }, [ownerId, active]);

  async function choose(fileOrId: File | string) {
    if (!active || !ownerId || disabled || operation.current) return;
    const request = new AbortController();
    operation.current = request;
    setError(null);
    onErrorChange?.(null);
    setPending(true);
    onPendingChange?.(true);
    try {
      let frame;
      if (typeof fileOrId === "string") {
        frame = await fetchUploadedStartingFrame(fileOrId, ownerId, request.signal);
      } else {
        validateReferenceImageFiles([fileOrId], 1, maxBytes);
        const { asset } = await uploadAIStudioReferenceMedia(fileOrId, "image", 10, ownerId, { purpose: UPLOADED_STARTING_FRAME_PROJECT });
        if (request.signal.aborted) return;
        frame = uploadedStartingFrameSelection(asset, ownerId);
        client.setQueryData<MediaAsset[]>(key, previous => [asset, ...(previous ?? []).filter(item => item.id !== asset.id)]);
        void client.invalidateQueries({ queryKey: key });
      }
      if (!request.signal.aborted && onSelect(frame) === false) throw new Error("Could not select this starting frame. Try again.");
    } catch (cause) {
      if (!request.signal.aborted) {
        const message = cause instanceof Error ? cause.message : "Could not add this starting frame.";
        setError(message);
        onErrorChange?.(message);
      }
    } finally {
      if (operation.current === request) {
        operation.current = null;
        setPending(false);
        onPendingChange?.(false);
      } else if (request.signal.aborted && !operation.current) {
        setPending(false);
      }
    }
  }

  const upload = active ? <>
    <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" aria-label="Choose a starting frame to upload"
      disabled={!ownerId || disabled || pending} onChange={event => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = "";
        if (file) void choose(file);
      }} />
    <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 px-3 text-xs" disabled={!ownerId || disabled || pending}
      onClick={() => input.current?.click()}><Plus className="size-3.5" aria-hidden="true" />Upload starting frame</Button>
  </> : null;
  const library = active ? <>
    {pending ? <p role="status">Preparing your starting frame…</p> : null}
    {error ? <p role="alert" className="text-destructive">{error}</p> : null}
    {query.isError ? <p role="alert">Could not load your uploaded starting frames. Use Refresh to try again.</p> : null}
    {query.data?.length ? <div className={picker.libraryGrid}>{query.data.map(asset => <Button key={asset.id} type="button" variant="ghost"
      className={picker.libraryPhoto} aria-label={`Use uploaded starting frame ${asset.fileName ?? asset.title}`} aria-pressed={selectedId === asset.id}
      disabled={disabled || pending} onClick={() => void choose(asset.id)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Matches the existing owned thumbnail delivery. */}
      <img src={imagePickerThumbnailUrl(asset.thumbnailUrl ?? asset.url)} alt="" width={128} height={170} loading="lazy" decoding="async" className="aspect-[3/4] w-full object-cover" />
    </Button>)}</div> : null}
  </> : null;
  return { upload, library, pending, refreshing: query.isFetching, hasUploads: Boolean(query.data?.length), refresh: () => void query.refetch() };
}
