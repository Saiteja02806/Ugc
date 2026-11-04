"use client";

/* eslint-disable @next/next/no-img-element */
import { Loader2, Upload, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { fetchFormatReferenceImages } from "@/lib/explore/format-reference-images";
import { fetchInfluencerPhotoLibrary } from "@/lib/characters/photo-library-client";
import { mergeCharacterHistoryPages } from "@/lib/characters/history";
import { uploadAIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";
import { cn } from "@/lib/utils";

export type SlideshowFacePhoto = { id: string; url: string; title: string };
export type SlideshowFaceChoiceValue = SlideshowFacePhoto & { referencePhotos?: SlideshowFacePhoto[] };
export const MAX_SLIDESHOW_FACE_PHOTOS = 4;

export function SlideshowFaceChoice({ ownerId, selected, disabled, onSelect, onBusyChange }: {
  ownerId?: string | null;
  selected: SlideshowFaceChoiceValue | null;
  disabled?: boolean;
  onSelect: (face: SlideshowFaceChoiceValue | null) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploadLock = useRef(false);
  const uploadScope = useRef({ active: true });
  const busyCallback = useRef(onBusyChange);
  useEffect(() => { busyCallback.current = onBusyChange; }, [onBusyChange]);
  useEffect(() => {
    const scope = { active: true };
    uploadScope.current = scope;
    return () => { scope.active = false; if (uploadLock.current) busyCallback.current?.(false); };
  }, []);
  const selectedPhotos = selected ? [selected, ...(selected.referencePhotos ?? [])] : [];
  function toggle(face: SlideshowFacePhoto) {
    const next = selectedPhotos.some(photo => photo.id === face.id)
      ? selectedPhotos.filter(photo => photo.id !== face.id)
      : [...selectedPhotos, face].slice(0, MAX_SLIDESHOW_FACE_PHOTOS);
    onSelect(next.length ? { id: next[0].id, url: next[0].url, title: next[0].title, referencePhotos: next.slice(1).map(({ id, url, title }) => ({ id, url, title })) } : null);
  }
  const influencers = useInfiniteQuery({
    queryKey: ["hook-influencer-history", ownerId ?? "signed-out"],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => fetchInfluencerPhotoLibrary(ownerId!, pageParam, signal),
    getNextPageParam: page => page.nextCursor ?? undefined,
    enabled: Boolean(ownerId),
    staleTime: 60_000,
  });
  const uploads = useQuery({
    queryKey: ["explore-reference-images", ownerId ?? "signed-out", "explore-only-v2"],
    queryFn: ({ signal }) => fetchFormatReferenceImages(ownerId!, signal),
    enabled: Boolean(ownerId),
    staleTime: 60_000,
  });
  const faces = [
    ...mergeCharacterHistoryPages(influencers.data?.pages ?? []).map((image, index) => ({ id: image.mediaAssetId, url: image.url, title: `AI influencer ${index + 1}` })),
    ...(uploads.data ?? []).map(asset => ({ id: asset.id, url: asset.url, title: asset.fileName || asset.title || "Uploaded photo" })),
  ].filter(face => face.id && face.url);

  async function upload(files: File[]) {
    if (!ownerId || disabled || uploading || uploadLock.current || !files.length) return;
    if (files.length > MAX_SLIDESHOW_FACE_PHOTOS - selectedPhotos.length) {
      setUploadError(`Choose up to ${MAX_SLIDESHOW_FACE_PHOTOS - selectedPhotos.length} more photos of the same person.`);
      if (input.current) input.current.value = "";
      return;
    }
    const scope = uploadScope.current;
    uploadLock.current = true;
    setUploading(true);
    onBusyChange?.(true);
    setUploadError(null);
    try {
      const added: SlideshowFacePhoto[] = [];
      const failures: string[] = [];
      for (const file of files) {
        try {
          const media = await uploadAIStudioReferenceMedia(file, "image", 3, ownerId, { purpose: "explore-reference" });
          if (!scope.active) return;
          added.push({ id: media.asset.id, url: media.asset.url, title: media.asset.fileName || "Uploaded photo" });
        } catch (error) {
          if (!scope.active) return;
          failures.push(error instanceof Error ? error.message : "Could not upload that photo. Try another.");
        }
      }
      const next = [...new Map([...selectedPhotos, ...added].map(photo => [photo.id, photo])).values()];
      if (added.length) onSelect({ id: next[0].id, url: next[0].url, title: next[0].title, referencePhotos: next.slice(1).map(({ id, url, title }) => ({ id, url, title })) });
      if (failures.length) setUploadError(`${added.length ? `${added.length} photo${added.length === 1 ? "" : "s"} added and selected. ` : ""}${failures.join(" ")}`);
    } finally {
      uploadLock.current = false;
      if (scope.active) {
        setUploading(false);
        onBusyChange?.(false);
        void uploads.refetch();
        if (input.current) input.current.value = "";
      }
    }
  }

  return <div data-face-swap-control="" className="grid min-w-0 gap-2">
    <div className="flex items-center justify-between gap-2">

      <Button type="button" variant="outline" size="sm" disabled={disabled || uploading || !ownerId || selectedPhotos.length >= MAX_SLIDESHOW_FACE_PHOTOS} onClick={() => input.current?.click()}>
        {uploading ? <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Upload className="size-3.5" aria-hidden="true" />}
        Upload photo
      </Button>
      <input ref={input} className="sr-only" type="file" multiple tabIndex={-1} disabled={disabled || uploading || !ownerId} accept="image/png,image/jpeg,image/webp" aria-label="Upload face photos" onChange={event => { const files = Array.from(event.currentTarget.files ?? []); if (files.length) void upload(files); }} />
    </div>
    <p className="text-xs text-muted">{selectedPhotos.length} of {MAX_SLIDESHOW_FACE_PHOTOS} photos selected. Use photos of the same person. The first is primary.</p>
    {uploadError ? <p role="alert" className="text-xs leading-5 text-destructive">{uploadError}</p> : null}
    {influencers.isError ? <div role="alert" className="space-y-1 text-xs">
      <p>Could not load your saved faces. Your current selection is kept.</p>
      <Button type="button" variant="outline" size="sm" disabled={disabled || uploading || influencers.isFetching} onClick={() => void influencers.refetch()}>{influencers.isFetching ? "Retrying saved faces…" : "Retry saved faces"}</Button>
    </div> : null}
    {uploads.isError ? <div role="alert" className="space-y-1 text-xs">
      <p>Could not load your uploaded portraits. Your current selection is kept.</p>
      <Button type="button" variant="outline" size="sm" disabled={disabled || uploading || uploads.isFetching} onClick={() => void uploads.refetch()}>{uploads.isFetching ? "Retrying portraits…" : "Retry uploaded portraits"}</Button>
    </div> : null}
    {influencers.isLoading || uploads.isLoading ? <p role="status" className="text-xs text-muted">Loading your faces…</p> : null}
    {faces.length || selectedPhotos.length ? <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" role="listbox" aria-multiselectable="true" aria-label="Faces for the selected slides">
      {[...new Map([...selectedPhotos, ...faces].map(face => [face.id, face])).values()].map(face => {
        const selectedIndex = selectedPhotos.findIndex(photo => photo.id === face.id);
        const pressed = selectedIndex >= 0;
        return <button key={face.id} type="button" role="option" aria-selected={pressed} aria-label={face.title} title={face.title} disabled={disabled || uploading || !pressed && selectedPhotos.length >= MAX_SLIDESHOW_FACE_PHOTOS} onClick={() => toggle(face)} className={cn("relative aspect-square w-full overflow-hidden rounded-lg border bg-background focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-50", pressed ? "border-primary ring-2 ring-primary" : "border-border")}>
          <img src={face.url} alt="" width={80} height={80} className="size-full object-cover" />
          {pressed ? <span className="absolute inset-x-0 bottom-0 bg-background/90 text-[10px] leading-5">{selectedIndex === 0 ? "Primary" : `Photo ${selectedIndex + 1}`}</span> : null}
        </button>;
      })}
    </div> : !influencers.isError && !uploads.isError && !influencers.isLoading && !uploads.isLoading ? <p className="flex items-center gap-2 text-xs text-muted"><UserRound className="size-4" aria-hidden="true" />Upload a portrait or save an influencer to use as the face.</p> : null}
    {influencers.hasNextPage ? <Button type="button" variant="ghost" size="sm" disabled={influencers.isFetchingNextPage} onClick={() => void influencers.fetchNextPage()}>Load more faces</Button> : null}
  </div>;
}
