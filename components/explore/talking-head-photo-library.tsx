"use client";

/* eslint-disable @next/next/no-img-element -- Same protected thumbnail delivery as the Hook picker. */
import { Tabs } from "@base-ui/react/tabs";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Check, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { fetchFormatReferenceImages } from "@/lib/explore/format-reference-images";
import { fetchInfluencerPhotoLibrary } from "@/lib/characters/photo-library-client";
import { mergeCharacterHistoryPages } from "@/lib/characters/history";
import { fetchRecentStartingFrame, fetchRecentStartingFrames } from "@/lib/explore/hook-starting-frame-history-client";
import { imagePickerThumbnailUrl, REFERENCE_IMAGE_PAGE_SIZE, REFERENCE_IMAGE_STALE_MS } from "@/lib/media/image-picker";
import type { MediaAsset } from "@/lib/media/types";
import type { HookStartingFrameSelection } from "@/lib/explore/hook-keyframe-client";
import picker from "./format-person-image-picker.module.css";

/** Hook's owned sources, with Talking Head's existing reference callbacks. */
export function TalkingHeadPhotoLibrary({ ownerId, section, onSectionChange, disabled, selectedIds, limitReached, onSelectUpload, onSelectInfluencer, onDeselect, onSelectStartingFrame, uploadControl, children }: {
  ownerId?: string | null; section: "person" | "influencers"; onSectionChange: (section: "person" | "influencers") => void;
  disabled: boolean; selectedIds: (string | undefined)[]; limitReached: boolean;
  onSelectUpload: (asset: MediaAsset) => Promise<boolean>; onSelectInfluencer: (id: string) => Promise<boolean>;
  onDeselect: (id: string) => void; onSelectStartingFrame?: (frame: HookStartingFrameSelection) => boolean | void;
  uploadControl: ReactNode; children: ReactNode;
}) {
  const [source, setSource] = useState<"user" | "starting" | "catalog">("user");
  const [pages, setPages] = useState(1);
  const [pending, setPending] = useState(false), [error, setError] = useState<string | null>(null);
  const working = useRef(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const current = section === "influencers" && source !== "catalog" ? "influencers" : source;
  const uploads = useQuery({ queryKey: ["explore-reference-images", ownerId ?? "signed-out", "explore-only-v2"],
    queryFn: ({ signal }) => fetchFormatReferenceImages(ownerId!, signal), enabled: Boolean(ownerId) && current === "user", staleTime: REFERENCE_IMAGE_STALE_MS });
  const influencers = useInfiniteQuery({ queryKey: ["hook-influencer-history", ownerId ?? "signed-out"], initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => fetchInfluencerPhotoLibrary(ownerId!, pageParam, signal), getNextPageParam: page => page.nextCursor ?? undefined,
    enabled: Boolean(ownerId) && current === "influencers", staleTime: 60_000, retry: false });
  const frames = useQuery({ queryKey: ["hook-starting-frames", ownerId ?? "signed-out"],
    queryFn: ({ signal }) => fetchRecentStartingFrames(ownerId!, signal), enabled: Boolean(ownerId && onSelectStartingFrame) && current === "starting", staleTime: 0 });
  async function choose(id: string, action: () => Promise<boolean | void | HookStartingFrameSelection>, frame = false) {
    if (disabled || working.current) return;
    if (!frame && selectedIds.includes(id)) { onDeselect(id); return; }
    if (!frame && limitReached) return;
    working.current = true; setPending(true); setError(null);
    try {
      const result = await action();
      if (frame && active.current && result && typeof result === "object") onSelectStartingFrame?.(result);
    } catch (cause) { if (active.current) setError(cause instanceof Error ? cause.message : "Could not use this image. Refresh and try again."); }
    finally { working.current = false; if (active.current) setPending(false); }
  }
  function change(value: string) {
    if (value === "user" || value === "starting") { setSource(value); onSectionChange("person"); setPages(1); setError(null); }
  }
  const tabClass = "min-w-0 flex-1 rounded-xl border border-border px-2 py-2 text-xs font-medium text-muted hover:bg-card-muted focus-visible:outline-2 focus-visible:outline-focus data-[active]:border-foreground/30 data-[active]:text-foreground-strong";
  function photo(id: string, url: string, name: string, action: () => Promise<boolean | void | HookStartingFrameSelection>, frame = false) {
    const selected = !frame && selectedIds.includes(id);
    return <Button key={id} type="button" variant="ghost" aria-label={name} aria-pressed={selected} className={picker.libraryPhoto}
      disabled={disabled || pending || !frame && limitReached && !selected} onClick={() => void choose(id, action, frame)}>
      <img src={imagePickerThumbnailUrl(url)} alt="" width={128} height={170} loading="lazy" decoding="async" className="aspect-[3/4] w-full object-cover" />
      <span aria-hidden="true" className={`pointer-events-none absolute right-1 top-1 flex size-5 items-center justify-center rounded-md border-2 shadow-sm ${selected ? "border-white bg-black/70 text-white" : "border-white bg-black/60"}`}>{selected ? <Check className="size-3.5" /> : null}</span>
    </Button>;
  }
  const activeQuery = current === "influencers" ? influencers : current === "starting" ? frames : uploads;
  return <>
    <div className={picker.libraryHeading}><h3>Image library</h3>
      <Button type="button" variant="ghost" size="sm" className={picker.catalogControl} aria-pressed={current === "catalog"} disabled={pending} onClick={() => setSource(current === "catalog" ? "user" : "catalog")}>{current === "catalog" ? "Back to your library" : "Vidmake images"}</Button>
      {current !== "starting" ? uploadControl : null}
      <Button type="button" variant="ghost" size="icon-sm" aria-label={current === "influencers" ? "Refresh my influencers" : current === "starting" ? "Refresh starting frames" : "Refresh your images"} disabled={!ownerId || pending || activeQuery.isFetching} onClick={() => void activeQuery.refetch()}><RefreshCw className="size-3.5" /></Button>
    </div>
    <Tabs.Root value={current} onValueChange={change} className={picker.tabs}>
      {current !== "influencers" ? <Tabs.List aria-label="Image sources" className={picker.sourceTabs}>
        <Tabs.Tab value="user" className={tabClass}>Uploaded photos</Tabs.Tab>
        {onSelectStartingFrame ? <Tabs.Tab value="starting" className={tabClass}>Starting frames</Tabs.Tab> : null}
      </Tabs.List> : null}
      <Tabs.Panel value="user" keepMounted className={picker.libraryPanel} aria-label="Uploaded photos">
        <p className={picker.libraryHint}>Photos uploaded in Explore. Your other uploads remain in Creative Assets.</p>
        {!ownerId ? <p>Sign in to see your saved images.</p> : uploads.isPending ? <p role="status">Loading your images…</p> : uploads.isError ? <p role="alert">Could not load your images. Use Refresh to try again.</p> : uploads.data?.length ? <div className={picker.libraryGrid}>{uploads.data.slice(0, pages * REFERENCE_IMAGE_PAGE_SIZE).map(asset => photo(asset.id, asset.thumbnailUrl ?? asset.url, `Use your image ${asset.fileName ?? asset.title}`, () => onSelectUpload(asset)))}</div> : <p>No uploaded photos yet. Use Upload photos to add one.</p>}
        {uploads.data && uploads.data.length > pages * REFERENCE_IMAGE_PAGE_SIZE ? <Button onClick={() => setPages(value => value + 1)}>Load more images</Button> : null}
      </Tabs.Panel>
      <Tabs.Panel value="influencers" className={picker.libraryPanel} aria-label="My Influencers">
        <p className={picker.libraryHint}>Created in Build AI influencer. Choose photos of the same person.</p>
        {!ownerId ? <p>Sign in to see your influencers.</p> : influencers.isPending ? <p role="status">Loading your influencers…</p> : influencers.isError ? <p role="alert">Could not load your influencers. Use Refresh to try again.</p> : <div className={picker.libraryGrid}>{mergeCharacterHistoryPages(influencers.data?.pages ?? []).map((image, index) => photo(image.mediaAssetId, image.url, `Use saved influencer ${index + 1}`, () => onSelectInfluencer(image.mediaAssetId)))}</div>}
        {influencers.hasNextPage ? <Button disabled={influencers.isFetchingNextPage} onClick={() => void influencers.fetchNextPage()}>Load more influencers</Button> : null}
        {influencers.isSuccess && !mergeCharacterHistoryPages(influencers.data?.pages ?? []).length ? <p>No saved influencers yet.</p> : null}
      </Tabs.Panel>
      <Tabs.Panel value="starting" className={picker.libraryPanel} aria-label="Starting frames">
        {!ownerId ? <p>Sign in to see your starting frames.</p> : frames.isPending ? <p role="status">Loading starting frames…</p> : frames.isError ? <p role="alert">Could not load your starting frames. Use Refresh to try again.</p> : frames.data?.length ? <div className={picker.libraryGrid}>{frames.data.map((frame, index) => photo(frame.assetId, frame.url, `Use starting frame ${index + 1}`, () => fetchRecentStartingFrame(frame, ownerId!), true))}</div> : <p>No starting frames yet.</p>}
      </Tabs.Panel>
      <Tabs.Panel value="catalog" className={picker.libraryPanel} aria-label="Vidmake images">{children}</Tabs.Panel>
    </Tabs.Root>
    {pending ? <p role="status">Preparing your image…</p> : null}{error ? <p role="alert" className="text-destructive">{error}</p> : null}
  </>;
}
