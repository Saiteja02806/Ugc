"use client";

/* eslint-disable @next/next/no-img-element -- Owned upload previews may use local object URLs. */

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PreviewCard } from "@base-ui/react/preview-card";
import { Check, Loader2, Plus, RefreshCw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { fetchFormatReferenceImage, fetchFormatReferenceImages, USER_REFERENCE_IMAGE_PROJECT } from "@/lib/explore/format-reference-images";
import { readAIStudioReferenceMetadata, uploadAIStudioReferenceMedia, type AIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";
import type { MediaAsset } from "@/lib/media/types";
import { MAX_IMAGE_REFERENCE_CONTEXT } from "@/worker/src/lib/image-reference-context";

/** Owned supplemental images follow the selected slideshow layout references. */
export function FormatInstructionImageReference({ selections, onChange, onPendingChange, onErrorChange, ownerId, disabled, maxImages = MAX_IMAGE_REFERENCE_CONTEXT, active = true, preview = false }: {
  selections: AIStudioReferenceMedia[];
  onChange: Dispatch<SetStateAction<AIStudioReferenceMedia[]>>;
  onPendingChange: (pending: boolean) => void;
  onErrorChange: (error: string | null) => void;
  ownerId?: string;
  disabled: boolean;
  maxImages?: number;
  active?: boolean;
  preview?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const revision = useRef(0);
  const localUrls = useRef(new Map<string, string>());
  const working = useRef(false);
  const pendingCallback = useRef(onPendingChange);
  const errorCallback = useRef(onErrorChange);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [wasActive, setWasActive] = useState(active);
  if (wasActive !== active) { setWasActive(active); setOpen(false); setPreviewId(null); }
  const queryClient = useQueryClient();
  const queryKey = ["explore-reference-images", ownerId ?? "signed-out"] as const;
  const limit = Math.max(0, Math.min(MAX_IMAGE_REFERENCE_CONTEXT, maxImages));
  const full = selections.length >= limit;
  const images = useQuery({ queryKey, queryFn: ({ signal }) => fetchFormatReferenceImages(ownerId!, signal), enabled: active && open && !preview && Boolean(ownerId), staleTime: 0 });
  useEffect(() => { pendingCallback.current = onPendingChange; }, [onPendingChange]);
  useEffect(() => { errorCallback.current = onErrorChange; }, [onErrorChange]);
  useEffect(() => {
    const ownedUrls = localUrls.current;
    errorCallback.current(null);
    return () => {
      revision.current += 1;
      pendingCallback.current(false);
      ownedUrls.forEach(url => URL.revokeObjectURL(url));
      ownedUrls.clear();
    };
  }, [ownerId]);

  async function choose(files?: File[], saved?: MediaAsset) {
    if (disabled || working.current) return;
    if (saved && selections.some(selection => selection.asset.id === saved.id)) return;
    const count = saved ? 1 : files?.length ?? 0;
    if (!count) return;
    if (selections.length + count > limit) {
      const message = `Use up to ${MAX_IMAGE_REFERENCE_CONTEXT} reference images in total. Select fewer slideshow references or remove an attached image before adding more.`;
      setError(message); onErrorChange(message); return;
    }
    if (files?.some(file => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || !file.size || file.size > 25 * 1024 * 1024)) {
      const message = "Choose JPG, PNG or WebP images up to 25 MB each.";
      setError(message); onErrorChange(message); return;
    }
    const attachmentBytes = selections.reduce((bytes, selection) => bytes + (selection.asset.fileSizeBytes ?? 0), 0) + (saved?.fileSizeBytes ?? files?.reduce((bytes, file) => bytes + file.size, 0) ?? 0);
    if (attachmentBytes > 50 * 1024 * 1024) {
      const message = "Use reference images up to 50 MB combined.";
      setError(message); onErrorChange(message); return;
    }
    const request = ++revision.current;
    working.current = true;
    setPending(true); onPendingChange(true); setError(null); onErrorChange(null);
    try {
      for (const file of saved ? [undefined] : files!) {
        let next: AIStudioReferenceMedia;
        if (saved) {
          if (!ownerId || preview) throw new Error("Sign in before reusing your image.");
          next = { kind: "image", asset: await fetchFormatReferenceImage(saved.id, ownerId) };
        } else {
          if (!file) throw new Error("Choose an image.");
          if (preview) {
            const metadata = await readAIStudioReferenceMetadata(file, "image");
            if (request !== revision.current) return;
            const url = URL.createObjectURL(file);
            localUrls.current.set(`local:${url}`, url);
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
        onChange(previous => previous.some(selection => selection.asset.id === next.asset.id) ? previous : [...previous, next]);
      }
      if (files) setOpen(false);
    } catch (cause) {
      if (request === revision.current) {
        const message = cause instanceof Error ? cause.message : "Could not attach your image.";
        setError(message); onErrorChange(message);
      }
    } finally {
      if (request === revision.current) { working.current = false; setPending(false); onPendingChange(false); }
    }
  }
  function clear(assetId: string) {
    if (disabled || pending) return;
    setPreviewId(null);
    onChange(previous => previous.filter(selection => selection.asset.id !== assetId)); setError(null); onErrorChange(null);
    const url = localUrls.current.get(assetId);
    if (url) { URL.revokeObjectURL(url); localUrls.current.delete(assetId); }
  }
  function dismissError() { setError(null); onErrorChange(null); }

  return <div className="absolute inset-x-3 bottom-3 flex min-w-0 flex-wrap items-center gap-2">
    <input ref={input} type="file" multiple className="hidden" aria-label="Choose instruction reference images" accept="image/jpeg,image/png,image/webp" disabled={disabled || pending || full} onChange={event => { const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ""; if (files.length) void choose(files); }} />
    <Popover open={active && open} onOpenChange={next => { setOpen(next); if (next) setPreviewId(null); }}>
      <PopoverTrigger render={<Button type="button" variant="outline" size="icon-sm" className="shrink-0 rounded-lg" aria-label="Add images to your instructions" aria-busy={pending} title="Attach reference images" disabled={disabled || pending} />}>
        {pending ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="max-h-[min(30rem,calc(100dvh-2rem))] w-[min(320px,calc(100vw-2rem))] overflow-y-auto">
        <PopoverTitle>Attach reference images</PopoverTitle>
        <p className="text-xs leading-5 text-muted">Add product, person or style images. Your selected slideshow keeps guiding the layout. Explain how to use each attached image in your instructions.</p>
        <p aria-live="polite" className="text-xs text-muted">{selections.length} attached · {limit} available with your slideshow references. Up to {MAX_IMAGE_REFERENCE_CONTEXT} images total, 25 MB each and 50 MB combined.</p>
        {selections.length ? <div className="grid grid-cols-4 gap-2" aria-label="Attached images">{selections.map((selection, index) => <Button key={selection.asset.id} type="button" variant="ghost" className="group relative h-auto overflow-hidden rounded-lg p-0" aria-label={`Remove reference ${index + 1}: ${selection.asset.fileName ?? selection.asset.title}`} disabled={disabled || pending} onClick={() => clear(selection.asset.id)}>
          <img src={selection.asset.thumbnailUrl ?? selection.asset.url} alt="" width={64} height={64} className="aspect-square w-full object-cover" /><span className="absolute right-1 top-1 rounded-full bg-background/90 p-0.5"><X className="size-3.5" aria-hidden="true" /></span>
        </Button>)}</div> : null}
        <div className="flex gap-2"><Button type="button" variant="outline" size="sm" disabled={disabled || pending || full} onClick={() => input.current?.click()}>Upload images</Button>
          {!preview && ownerId ? <Button type="button" variant="ghost" size="icon-sm" aria-label="Refresh your images" disabled={pending || images.isFetching} onClick={() => void images.refetch()}><RefreshCw className="size-4" aria-hidden="true" /></Button> : null}</div>
        {!preview && ownerId ? images.isPending ? <p role="status" className="text-xs text-muted">Loading your images…</p> : images.isError ? <p role="alert" className="text-xs text-destructive">Could not load your images. Refresh or upload an image.</p> : images.data?.length ? <div className="grid grid-cols-4 gap-2">{images.data.map(asset => <Button key={asset.id} type="button" variant="ghost" className="relative h-auto overflow-hidden rounded-lg p-0" aria-label={`Attach your image ${asset.fileName ?? asset.title}`} aria-pressed={selections.some(selection => selection.asset.id === asset.id)} disabled={disabled || pending || (full && !selections.some(selection => selection.asset.id === asset.id))} onClick={() => void choose(undefined, asset)}>
          <img src={asset.thumbnailUrl ?? asset.url} alt="" width={64} height={64} loading="lazy" className="aspect-square w-full object-cover" />
          {selections.some(selection => selection.asset.id === asset.id) ? <Check className="absolute right-1 top-1 size-4 text-primary" aria-hidden="true" /> : null}
        </Button>)}</div> : <p className="text-xs text-muted">Your uploaded images will appear here.</p> : null}
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Done</Button>
      </PopoverContent>
    </Popover>
    {selections.length ? <div className="flex min-w-0 items-center gap-2" role="group" aria-label="Images attached to your instructions">
      <div className="flex items-center -space-x-8 py-1">{selections.map((selection, index) => {
        const name = selection.asset.fileName ?? selection.asset.title;
        return <PreviewCard.Root key={selection.asset.id} open={active && !open && previewId === selection.asset.id} onOpenChange={next => setPreviewId(current => next ? selection.asset.id : current === selection.asset.id ? null : current)}>
          <PreviewCard.Trigger delay={180} closeDelay={150} render={<button type="button" />} aria-label={`Preview reference ${index + 1}: ${name}`} onClick={() => setPreviewId(current => current === selection.asset.id ? null : selection.asset.id)} style={{ zIndex: previewId === selection.asset.id ? 30 : index + 1 }} className="relative h-11 w-10 shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 border-card bg-background shadow-sm outline-none hover:z-30 focus-visible:z-30 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card motion-safe:transition-transform motion-safe:duration-150 motion-safe:hover:-translate-y-1 motion-safe:hover:rotate-0 motion-safe:hover:scale-110 motion-safe:focus-visible:-translate-y-1 odd:rotate-[-5deg] even:rotate-[4deg]">
            <img src={selection.asset.thumbnailUrl ?? selection.asset.url} alt="" width={40} height={44} className="size-full object-cover" />
          </PreviewCard.Trigger>
          <PreviewCard.Portal>
            <PreviewCard.Positioner side="top" align="start" sideOffset={12} collisionPadding={16} className="z-[70]">
              <PreviewCard.Popup className="w-fit rounded-lg shadow-xl outline-none">
                <img src={selection.asset.url} alt={`Reference ${index + 1}: ${name}`} width={160} height={200} className="h-auto max-h-[min(200px,35dvh)] w-auto max-w-[min(160px,calc(100vw-2rem))] rounded-lg" />
              </PreviewCard.Popup>
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>;
      })}</div>
      <span aria-live="polite" aria-label={`${selections.length} ${selections.length === 1 ? "image" : "images"}`} className="shrink-0 text-xs text-muted">{selections.length}{selections.length < 5 ? ` ${selections.length === 1 ? "image" : "images"}` : null}</span>
    </div> : null}
    {pending ? <span role="status" className="text-xs text-muted">Adding images…</span> : error ? <span className="flex w-full min-w-0 items-center gap-1"><span role="alert" className="line-clamp-2 text-xs text-destructive">{error}</span><Button type="button" variant="ghost" size="icon-sm" aria-label="Dismiss image upload error" onClick={dismissError}><X className="size-3" aria-hidden="true" /></Button></span> : null}
  </div>;
}
