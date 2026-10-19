"use client";

/* eslint-disable @next/next/no-img-element -- Shared public thumbnail URL; private URLs retain protected delivery. */
import { Tabs } from "@base-ui/react/tabs";
import { useQuery } from "@tanstack/react-query";
import { Check, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { fetchFormatReferenceImages } from "@/lib/explore/format-reference-images";
import { imagePickerThumbnailUrl, REFERENCE_IMAGE_PAGE_SIZE, REFERENCE_IMAGE_STALE_MS } from "@/lib/media/image-picker";
import type { MediaAsset } from "@/lib/media/types";

/** Saved images use the same owned inventory as Hook Video and Wall of Text. */
export function WorkflowImageLibrary({ ownerId, open, disabled, selectedIds, onSelect, onDeselect, limitReached = false, children }: {
  ownerId?: string | null; open: boolean; disabled: boolean; selectedIds: (string | undefined)[];
  onSelect: (asset: MediaAsset) => Promise<boolean>; onDeselect?: (id: string) => void; limitReached?: boolean; children: ReactNode;
}) {
  const [tab, setTab] = useState<"user" | "catalog" | null>(null);
  const [imagePages, setImagePages] = useState(1);
  const [pending, setPending] = useState(false), [error, setError] = useState<string | null>(null);
  const revision = useRef(0);
  useEffect(() => { const requests = revision; return () => { requests.current++; }; }, [ownerId]);
  const images = useQuery({ queryKey: ["explore-reference-images", ownerId ?? "signed-out"],
    queryFn: ({ signal }) => fetchFormatReferenceImages(ownerId!, signal), enabled: open && Boolean(ownerId), staleTime: REFERENCE_IMAGE_STALE_MS });
  async function choose(id: string) {
    if (!ownerId || disabled || pending) return;
    if (selectedIds.includes(id)) { onDeselect?.(id); return; }
    if (limitReached) return;
    const request = ++revision.current;
    setPending(true); setError(null);
    try {
      const asset = images.data?.find(image => image.id === id);
      if (!asset) throw new Error("Refresh your images and choose this image again.");
      await onSelect(asset);
    } catch (cause) {
      if (request === revision.current) setError(cause instanceof Error ? cause.message : "Could not use this image. Refresh and try again.");
    } finally { if (request === revision.current) setPending(false); }
  }
  const currentTab = tab ?? (ownerId && (images.isPending || images.data?.length) ? "user" : "catalog");
  const tabClass = "min-w-0 flex-1 rounded-xl border border-border px-2 py-2 text-xs font-medium text-muted transition-colors hover:bg-card-muted hover:text-foreground-strong focus-visible:outline-2 focus-visible:outline-focus data-[active]:border-primary/50 data-[active]:bg-card-muted data-[active]:text-foreground-strong";
  return <Tabs.Root value={currentTab} onValueChange={value => { if (value === "user" || value === "catalog") setTab(value); }} className="space-y-3">
    <div className="flex items-center gap-2"><Tabs.List aria-label="Image sources" className="flex min-w-0 flex-1 gap-2"><Tabs.Tab value="user" className={tabClass}>Your images</Tabs.Tab><Tabs.Tab value="catalog" className={tabClass}>UGC Pilot images</Tabs.Tab></Tabs.List><Button type="button" size="icon-sm" variant="ghost" aria-label="Refresh your images" disabled={!ownerId || pending || images.isFetching} onClick={() => void images.refetch()}><RefreshCw className="size-4" aria-hidden="true" /></Button></div>
    <Tabs.Panel value="user" keepMounted aria-label="Your images" className="max-h-60 overflow-y-auto p-1">
      {!ownerId ? <p className="text-xs text-muted">Sign in to save and reuse your images.</p> : images.isPending ? <p role="status" className="text-xs text-muted">Loading your images…</p> : images.isError ? <p role="alert" className="text-xs text-destructive">Could not load your images. Use Refresh to try again.</p> : images.data?.length ? <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">{images.data.slice(0, imagePages * REFERENCE_IMAGE_PAGE_SIZE).map(asset => <Button key={asset.id} type="button" variant="ghost" title={asset.fileName ?? asset.title} aria-label={`Use your image ${asset.fileName ?? asset.title}`} aria-pressed={selectedIds.includes(asset.id)} disabled={disabled || pending || (selectedIds.includes(asset.id) ? !onDeselect : limitReached)} className="relative h-auto overflow-hidden rounded-2xl p-0" onClick={() => void choose(asset.id)}><img src={currentTab === "user" ? imagePickerThumbnailUrl(asset.thumbnailUrl ?? asset.url) : undefined} alt="" width={64} height={84} loading="lazy" decoding="async" className="aspect-[3/4] w-full object-cover" /><span aria-hidden="true" className={`pointer-events-none absolute right-1 top-1 flex size-5 items-center justify-center rounded-md border-2 shadow-sm ${selectedIds.includes(asset.id) ? "border-primary bg-primary text-primary-foreground" : "border-white bg-black/60"}`}>{selectedIds.includes(asset.id) ? <Check className="size-3.5" /> : null}</span></Button>)}</div> : <p className="text-xs text-muted">Upload an image to keep it here for next time.</p>}
      {images.data && images.data.length > imagePages * REFERENCE_IMAGE_PAGE_SIZE ? <Button type="button" variant="outline" size="sm" onClick={() => setImagePages(value => value + 1)}>Load more images</Button> : null}
      {pending ? <p role="status" className="mt-2 text-xs text-muted">Preparing your image…</p> : null}{error ? <p role="alert" className="mt-2 text-xs text-destructive">{error}</p> : null}
    </Tabs.Panel>
    <Tabs.Panel value="catalog" keepMounted aria-label="UGC Pilot images">{currentTab === "catalog" ? children : null}</Tabs.Panel>
  </Tabs.Root>;
}
