"use client";

/* eslint-disable @next/next/no-img-element */
import { Loader2, Upload, UserRound } from "lucide-react";
import { useRef, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { fetchFormatReferenceImages } from "@/lib/explore/format-reference-images";
import { fetchInfluencerPhotoLibrary } from "@/lib/characters/photo-library-client";
import { mergeCharacterHistoryPages } from "@/lib/characters/history";
import { uploadAIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";
import { cn } from "@/lib/utils";

export type SlideshowFaceChoiceValue = { id: string; url: string; title: string };

export function SlideshowFaceChoice({ ownerId, selected, disabled, onSelect }: {
  ownerId?: string | null;
  selected: SlideshowFaceChoiceValue | null;
  disabled?: boolean;
  onSelect: (face: SlideshowFaceChoiceValue | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
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

  async function upload(file: File) {
    if (!ownerId || disabled || uploading) return;
    setUploading(true);
    setUploadError(null);
    try {
      const media = await uploadAIStudioReferenceMedia(file, "image", 3, ownerId, { purpose: "explore-reference" });
      onSelect({ id: media.asset.id, url: media.asset.url, title: media.asset.fileName || "Uploaded photo" });
      void uploads.refetch();
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Could not upload that photo. Try another.");
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  return <div data-face-swap-control="" className="grid min-w-0 gap-2">
    <div className="flex items-center justify-between gap-2">

      <Button type="button" variant="outline" size="sm" disabled={disabled || uploading || !ownerId} onClick={() => input.current?.click()}>
        {uploading ? <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Upload className="size-3.5" aria-hidden="true" />}
        Upload photo
      </Button>
      <input ref={input} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" aria-label="Upload a face photo" onChange={event => { const file = event.currentTarget.files?.[0]; if (file) void upload(file); }} />
    </div>
    {selected ? <p className="text-xs text-muted">Selected: {selected.title}</p> : null}
    {uploadError ? <p role="alert" className="text-xs leading-5 text-destructive">{uploadError}</p> : null}
    {influencers.isError ? <div role="alert" className="space-y-1 text-xs">
      <p>Could not load your saved faces. Your current selection is kept.</p>
      <Button type="button" variant="outline" size="sm" disabled={disabled || uploading || influencers.isFetching} onClick={() => void influencers.refetch()}>{influencers.isFetching ? "Retrying saved faces…" : "Retry saved faces"}</Button>
    </div> : null}
    {uploads.isError ? <div role="alert" className="space-y-1 text-xs">
      <p>Could not load your uploaded portraits. Your current selection is kept.</p>
      <Button type="button" variant="outline" size="sm" disabled={disabled || uploading || uploads.isFetching} onClick={() => void uploads.refetch()}>{uploads.isFetching ? "Retrying portraits…" : "Retry uploaded portraits"}</Button>
    </div> : null}
    {influencers.isLoading || uploads.isLoading ? <p role="status" className="text-xs text-muted">Loading your faces…</p> : faces.length ? <div className="flex gap-2 overflow-x-auto py-1" role="listbox" aria-label="Faces for the selected slides">
      {faces.map(face => {
        const pressed = selected?.id === face.id;
        return <button key={face.id} type="button" role="option" aria-selected={pressed} aria-label={face.title} title={face.title} disabled={disabled} onClick={() => onSelect(pressed ? null : face)} className={cn("relative size-14 shrink-0 overflow-hidden rounded-lg border bg-background focus-visible:outline-2 focus-visible:outline-focus", pressed ? "border-foreground" : "border-border")}>
          <img src={face.url} alt="" width={56} height={56} className="size-full object-cover" />
        </button>;
      })}
    </div> : !influencers.isError && !uploads.isError ? <p className="flex items-center gap-2 text-xs text-muted"><UserRound className="size-4" aria-hidden="true" />Upload a portrait or save an influencer to use as the face.</p> : null}
    {influencers.hasNextPage ? <Button type="button" variant="ghost" size="sm" disabled={influencers.isFetchingNextPage} onClick={() => void influencers.fetchNextPage()}>Load more faces</Button> : null}
  </div>;
}
