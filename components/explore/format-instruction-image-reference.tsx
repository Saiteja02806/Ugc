"use client";

/* eslint-disable @next/next/no-img-element -- Owned upload previews may use local object URLs. */

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Plus, RefreshCw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { fetchFormatReferenceImage, fetchFormatReferenceImages, USER_REFERENCE_IMAGE_PROJECT } from "@/lib/explore/format-reference-images";
import { readAIStudioReferenceMetadata, uploadAIStudioReferenceMedia, type AIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";
import type { MediaAsset } from "@/lib/media/types";

/** One owned supplemental image; the selected slideshow remains the first reference. */
export function FormatInstructionImageReference({ selection, onChange, onPendingChange, onErrorChange, ownerId, disabled, active = true, preview = false }: {
  selection: AIStudioReferenceMedia | null;
  onChange: (selection: AIStudioReferenceMedia | null) => void;
  onPendingChange: (pending: boolean) => void;
  onErrorChange: (error: string | null) => void;
  ownerId?: string;
  disabled: boolean;
  active?: boolean;
  preview?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const revision = useRef(0);
  const localUrl = useRef<string | null>(null);
  const pendingCallback = useRef(onPendingChange);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wasActive, setWasActive] = useState(active);
  if (wasActive !== active) { setWasActive(active); setOpen(false); }
  const queryClient = useQueryClient();
  const queryKey = ["explore-reference-images", ownerId ?? "signed-out"] as const;
  const images = useQuery({ queryKey, queryFn: ({ signal }) => fetchFormatReferenceImages(ownerId!, signal), enabled: active && open && !preview && Boolean(ownerId), staleTime: 0 });
  useEffect(() => { pendingCallback.current = onPendingChange; }, [onPendingChange]);
  useEffect(() => () => {
    revision.current += 1;
    pendingCallback.current(false);
    if (localUrl.current) URL.revokeObjectURL(localUrl.current);
  }, [ownerId]);

  async function choose(file?: File, saved?: MediaAsset) {
    if (disabled || pending) return;
    const request = ++revision.current;
    setPending(true); onPendingChange(true); setError(null); onErrorChange(null);
    try {
      let next: AIStudioReferenceMedia;
      if (saved) {
        if (!ownerId || preview) throw new Error("Sign in before reusing your image.");
        next = { kind: "image", asset: await fetchFormatReferenceImage(saved.id, ownerId) };
      } else {
        if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.type) || !file.size || file.size > 25 * 1024 * 1024) throw new Error("Choose a JPG, PNG or WebP image up to 25 MB.");
        if (preview) {
          const metadata = await readAIStudioReferenceMetadata(file, "image");
          if (request !== revision.current) return;
          const url = URL.createObjectURL(file);
          if (localUrl.current) URL.revokeObjectURL(localUrl.current);
          localUrl.current = url;
          next = { kind: "image", asset: { id: `local:${url}`, collection: "image", status: "ready", sourceType: "upload", url, title: file.name, fileName: file.name, mimeType: file.type, fileSizeBytes: file.size, width: metadata.width, height: metadata.height, ratio: metadata.ratio, durationSeconds: null, projectId: USER_REFERENCE_IMAGE_PROJECT, createdAt: "", updatedAt: "", metadata: { preview: true }, sourceRecordId: null, parentAssetId: null, thumbnailUrl: null } };
        } else {
          if (!ownerId) throw new Error("Sign in before attaching your image.");
          next = await uploadAIStudioReferenceMedia(file, "image", 3, ownerId, { purpose: USER_REFERENCE_IMAGE_PROJECT });
        }
      }
      if (request !== revision.current) return;
      if (!preview) {
        await queryClient.cancelQueries({ queryKey });
        if (request !== revision.current) return;
        queryClient.setQueryData<MediaAsset[]>(queryKey, previous => [next.asset, ...(previous ?? []).filter(asset => asset.id !== next.asset.id)]);
      }
      onChange(next); setOpen(false);
    } catch (cause) {
      if (request === revision.current) {
        const message = cause instanceof Error ? cause.message : "Could not attach your image.";
        setError(message); onErrorChange(message);
      }
    } finally {
      if (request === revision.current) { setPending(false); onPendingChange(false); }
    }
  }
  function clear() {
    if (disabled || pending) return;
    onChange(null); setError(null); onErrorChange(null);
    if (localUrl.current) { URL.revokeObjectURL(localUrl.current); localUrl.current = null; }
  }
  function dismissError() { setError(null); onErrorChange(null); }

  return <div className="absolute inset-x-2 bottom-2 flex min-w-0 items-center gap-2">
    <input ref={input} type="file" className="hidden" aria-label="Choose instruction reference image" accept="image/jpeg,image/png,image/webp" disabled={disabled || pending} onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void choose(file); }} />
    <Popover open={active && open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button type="button" variant="outline" size="icon-sm" className="shrink-0 rounded-lg" aria-label="Add image to your instructions" aria-busy={pending} title="Attach a product, person or style image" disabled={disabled || pending} />}>
        {pending ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="max-h-[min(30rem,calc(100dvh-2rem))] w-[min(320px,calc(100vw-2rem))] overflow-y-auto">
        <PopoverTitle>Attach an image</PopoverTitle>
        <p className="text-xs leading-5 text-muted">Add one product, person or style image. Your selected slideshow keeps guiding the layout. Explain how to use your attached image in your instructions.</p>
        <div className="flex gap-2"><Button type="button" variant="outline" size="sm" disabled={disabled || pending} onClick={() => input.current?.click()}>Upload image</Button>
          {!preview && ownerId ? <Button type="button" variant="ghost" size="icon-sm" aria-label="Refresh your images" disabled={pending || images.isFetching} onClick={() => void images.refetch()}><RefreshCw className="size-4" aria-hidden="true" /></Button> : null}</div>
        {!preview && ownerId ? images.isPending ? <p role="status" className="text-xs text-muted">Loading your images…</p> : images.isError ? <p role="alert" className="text-xs text-destructive">Could not load your images. Refresh or upload an image.</p> : images.data?.length ? <div className="grid grid-cols-4 gap-2">{images.data.map(asset => <Button key={asset.id} type="button" variant="ghost" className="relative h-auto overflow-hidden rounded-lg p-0" aria-label={`Attach your image ${asset.fileName ?? asset.title}`} disabled={disabled || pending} onClick={() => void choose(undefined, asset)}>
          <img src={asset.thumbnailUrl ?? asset.url} alt="" width={64} height={64} loading="lazy" className="aspect-square w-full object-cover" />
          {selection?.asset.id === asset.id ? <Check className="absolute right-1 top-1 size-4 text-primary" aria-hidden="true" /> : null}
        </Button>)}</div> : <p className="text-xs text-muted">Your uploaded images will appear here.</p> : null}
      </PopoverContent>
    </Popover>
    {selection ? <span className="flex min-w-0 items-center gap-1.5 rounded-lg border border-border bg-card px-1.5 py-1 text-xs">
      <img src={selection.asset.url} alt="Attached reference" width={28} height={28} className="size-7 shrink-0 rounded object-cover" />
      <span className="truncate">{selection.asset.fileName ?? selection.asset.title}</span><Button type="button" variant="ghost" size="icon-sm" className="size-6 shrink-0" aria-label="Remove instruction reference image" disabled={disabled || pending} onClick={clear}><X className="size-3" aria-hidden="true" /></Button>
    </span> : null}
    {pending ? <span role="status" className="text-xs text-muted">Preparing image…</span> : error ? <span className="flex min-w-0 items-center gap-1"><span role="alert" className="line-clamp-2 text-xs text-destructive">{error}</span><Button type="button" variant="ghost" size="icon-sm" aria-label="Dismiss image upload error" onClick={dismissError}><X className="size-3" aria-hidden="true" /></Button></span> : null}
  </div>;
}
