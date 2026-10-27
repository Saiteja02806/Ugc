"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { Video } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { isWorkflowSourceVideo, workflowSourceVideoError } from "@/lib/explore/workflow-source-video";
import type { MediaAsset } from "@/lib/media/types";
import { withReadDeadline } from "@/lib/http/read-deadline";

export function WorkflowVideoAssetPicker({ open, onOpenChange, ownerId, selectedId, onSelect, description = "Use an existing video as your opening segment.", previewAssets, library: surface = "creative_assets" }: {
  open: boolean; onOpenChange: (open: boolean) => void; ownerId: string | null; selectedId?: string; onSelect: (asset: MediaAsset) => boolean; description?: string; previewAssets?: MediaAsset[]; library?: "creative_assets" | "content" | "generation_history";
}) {
  const name = surface === "content" ? "Demo" : surface === "generation_history" ? "Generation history" : "Creative Assets";
  const eligible = (asset: unknown): asset is MediaAsset => isWorkflowSourceVideo(asset) &&
    (surface === "content" ? asset.sourceType === "demo_upload" : surface === "generation_history" ? asset.sourceType === "generated_video" : asset.sourceType !== "demo_upload");
  const library = useQuery<MediaAsset[]>({
    queryKey: ["explore-source-videos", ownerId, surface], enabled: open && !!ownerId && !previewAssets,
    staleTime: 30_000, gcTime: 5 * 60_000, retry: false, refetchOnWindowFocus: false,
    queryFn: ({ signal }) => withReadDeadline(async bounded => {
        const token = await getCurrentUserIdToken(ownerId ?? undefined);
        if (!token) throw new Error("Sign in to choose your video.");
        bounded.throwIfAborted();
        const response = await fetch(surface === "content" ? "/api/demo/sources" : surface === "generation_history" ? "/api/media?collection=video&sourceTypes=generated_video" : "/api/media?collection=video", { cache: "no-store", headers: { Authorization: `Bearer ${token}` }, signal: bounded });
        const value = await response.json();
        if (!response.ok || value?.ok !== true || !Array.isArray(value.assets)) throw new Error(`Could not load ${name}.`);
        return value.assets.filter(eligible);
    }, signal),
  });
  const visibleAssets = previewAssets?.filter(eligible) ?? library.data ?? [];
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className={surface === "generation_history" ? "inset-y-0 left-auto right-0 top-0 content-start h-dvh w-full max-w-[460px] translate-x-0 translate-y-0 overflow-y-auto overscroll-contain rounded-none sm:max-w-[460px]" : "max-h-[min(640px,90dvh)] overflow-y-auto overscroll-contain sm:max-w-lg"}>
    <DialogHeader><DialogTitle>{surface === "generation_history" ? "Generation history" : `Choose from ${name}`}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
    {!ownerId && !previewAssets ? <p className="text-sm text-muted">Sign in to choose from {name}.</p>
      : !previewAssets && !library.data && library.isPending ? <p role="status" className="text-sm text-muted">Loading your videos…</p>
      : !previewAssets && !library.data && library.isError ? <div role="alert" className="space-y-3"><p>{library.error.message}</p><Button type="button" variant="outline" onClick={() => void library.refetch()}>Retry</Button></div>
      : !visibleAssets.length ? <p className="text-sm text-muted">{surface === "content" ? "No ready demos yet. Upload a video on the Demo screen, then choose it here." : surface === "generation_history" ? "No completed generations yet. Generate a video in Create to get started." : "No ready videos yet. Upload a video in Create to get started."}</p>
      : <div className="grid gap-2">{visibleAssets.map(asset => {
        const problem = workflowSourceVideoError(asset);
        return <Button key={asset.id} type="button" variant="outline" aria-pressed={asset.id === selectedId} disabled={!!problem} title={problem ?? asset.title}
          className="h-auto min-h-24 w-full min-w-0 justify-start gap-3 overflow-hidden px-3 py-2 text-left whitespace-normal" onClick={() => { if (onSelect(asset)) onOpenChange(false); }}>
          <VideoAssetThumbnail key={`${asset.id}:${asset.url}:${asset.thumbnailUrl}`} asset={asset} />
          <span className="min-w-0 flex-1"><span className="block line-clamp-2 break-words text-sm font-medium">{asset.title}</span><span className="mt-1 block text-xs text-muted">{problem ?? (asset.durationSeconds !== null ? `${Math.round(asset.durationSeconds * 10) / 10} sec · ${asset.ratio}` : "Video")}</span></span>
        </Button>;
      })}</div>}
    {!previewAssets && ownerId && library.data ? <div className="space-y-2"><Button type="button" variant="ghost" size="sm" disabled={library.isFetching} onClick={() => void library.refetch()}>{library.isFetching ? "Refreshing videos…" : "Refresh library"}</Button>{library.isError ? <p role="alert" className="text-xs text-destructive">Could not refresh. Your previous videos are still shown.</p> : null}</div> : null}
  </DialogContent></Dialog>;
}

/** Only visible rows load footage; an absent poster should not hide identity. */
function VideoAssetThumbnail({ asset }: { asset: MediaAsset }) {
  const host = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false), [posterFailed, setPosterFailed] = useState(false), [failed, setFailed] = useState(false);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") {
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: "80px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <span ref={host} data-video-asset-thumbnail className="relative flex h-20 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black/30" aria-hidden="true">
    <Video className="absolute size-5 text-muted" />
    {visible && asset.thumbnailUrl && !posterFailed ? <Image src={asset.thumbnailUrl} alt="" width={56} height={80} unoptimized onError={() => setPosterFailed(true)} className="relative size-full object-cover" />
      : visible && !failed ? <video src={asset.url} muted playsInline preload="metadata" tabIndex={-1} disablePictureInPicture disableRemotePlayback onContextMenu={event => event.preventDefault()}
        onLoadedMetadata={event => { const player = event.currentTarget; if (Number.isFinite(player.duration) && player.duration > 0) player.currentTime = Math.min(.01, player.duration / 2); }}
        onError={() => setFailed(true)} className="relative size-full object-cover" /> : null}
  </span>;
}
