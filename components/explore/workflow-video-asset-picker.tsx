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

export function WorkflowVideoAssetPicker({ open, onOpenChange, ownerId, selectedId, onSelect, description = "Use an existing video as your opening segment.", previewAssets, library: surface = "creative_assets", workflow }: {
  open: boolean; onOpenChange: (open: boolean) => void; ownerId: string | null; selectedId?: string; onSelect: (asset: MediaAsset) => boolean; description?: string; previewAssets?: MediaAsset[]; library?: "creative_assets" | "content" | "generation_history"; workflow?: string;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const name = surface === "content" ? "Demo" : surface === "generation_history" ? "Generation history" : "Creative Assets";
  const eligible = (asset: unknown): asset is MediaAsset => isWorkflowSourceVideo(asset) &&
    (surface === "content" ? asset.sourceType === "demo_upload"
      : surface === "generation_history"
      ? asset.sourceType === "generated_video" && (!workflow || asset.metadata?.workflow === workflow)
      : asset.sourceType !== "demo_upload");
  const library = useQuery<MediaAsset[]>({
    queryKey: ["explore-source-videos", ownerId, surface, ...(workflow ? [workflow] : [])], enabled: open && !!ownerId && !previewAssets,
    staleTime: 30_000, gcTime: 5 * 60_000, retry: false, refetchOnWindowFocus: false,
    queryFn: ({ signal }) => withReadDeadline(async bounded => {
        const token = await getCurrentUserIdToken(ownerId ?? undefined);
        if (!token) throw new Error("Sign in to choose your video.");
        bounded.throwIfAborted();
        const endpoint = surface === "content"
          ? "/api/demo/sources"
          : surface === "generation_history"
          ? `/api/media?collection=video&sourceTypes=generated_video${workflow ? `&workflow=${encodeURIComponent(workflow)}` : ""}`
          : "/api/media?collection=video";
        const response = await fetch(endpoint, { cache: "no-store", headers: { Authorization: `Bearer ${token}` }, signal: bounded });
        const value = await response.json();
        if (!response.ok || value?.ok !== true || !Array.isArray(value.assets)) throw new Error(`Could not load ${name}.`);
        return value.assets.filter(eligible);
    }, signal),
  });
  const rawAssets = previewAssets?.filter(eligible) ?? library.data ?? [];
  const query = searchQuery.trim().toLowerCase();
  const visibleAssets = query && surface === "generation_history"
    ? rawAssets.filter(asset => {
        const prompt = typeof asset.metadata?.prompt === "string" ? asset.metadata.prompt.toLowerCase() : "";
        const title = (asset.title || "").toLowerCase();
        return prompt.includes(query) || title.includes(query);
      })
    : rawAssets;

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className={surface === "generation_history" ? "inset-y-0 left-auto right-0 top-0 content-start h-dvh w-full max-w-[460px] translate-x-0 translate-y-0 overflow-y-auto overscroll-contain rounded-none border-l border-border bg-background p-6 shadow-2xl sm:max-w-[460px]" : "max-h-[min(640px,90dvh)] overflow-y-auto overscroll-contain sm:max-w-lg"}>
    <DialogHeader>
      <DialogTitle className="text-lg font-semibold tracking-tight text-foreground-strong">{surface === "generation_history" ? "Generation history" : `Choose from ${name}`}</DialogTitle>
      <DialogDescription className="text-xs text-muted">{description}</DialogDescription>
    </DialogHeader>
    {surface === "generation_history" && rawAssets.length > 0 ? (
      <div className="relative mt-2">
        <svg className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search by prompt or keywords…"
          aria-label="Search generation history"
          className="h-9 w-full rounded-lg border border-border bg-card px-3 pl-8 text-xs text-foreground placeholder:text-muted focus:border-white focus:outline-none focus:ring-1 focus:ring-white"
        />
      </div>
    ) : null}
    {!ownerId && !previewAssets ? <p className="text-sm text-muted">Sign in to choose from {name}.</p>
      : !previewAssets && !library.data && library.isPending ? <p role="status" className="text-sm text-muted">Loading your videos…</p>
      : !previewAssets && !library.data && library.isError ? <div role="alert" className="space-y-3"><p>{library.error.message}</p><Button type="button" variant="outline" onClick={() => void library.refetch()}>Retry</Button></div>
      : !visibleAssets.length ? <p className="text-sm text-muted">{query ? "No matching generations found." : surface === "content" ? "No ready demos yet. Upload a video on the Demo screen, then choose it here." : surface === "generation_history" ? "No completed generations yet. Generate a video in Create to get started." : "No ready videos yet. Upload a video in Create to get started."}</p>
      : <div className="grid gap-2">{visibleAssets.map(asset => {
        const problem = workflowSourceVideoError(asset);
        const prompt = typeof asset.metadata?.prompt === "string" && asset.metadata.prompt.trim()
          ? asset.metadata.prompt.trim()
          : null;
        const displayTitle = prompt ?? asset.title;
        const modelLabel = typeof asset.metadata?.model === "string" ? asset.metadata.model : null;
        const formattedDate = asset.createdAt ? new Date(asset.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : null;
        const isSelected = asset.id === selectedId;

        return <Button key={asset.id} type="button" variant="outline" aria-pressed={isSelected} disabled={!!problem} title={problem ?? displayTitle}
          className={`h-auto min-h-24 w-full min-w-0 justify-start gap-3.5 overflow-hidden rounded-xl border border-border/70 bg-card/60 p-3 text-left transition-colors hover:border-border hover:bg-card-muted/60 whitespace-normal ${
            isSelected ? "border-white ring-1 ring-white/40" : ""
          }`}
          onClick={() => { if (onSelect(asset)) onOpenChange(false); }}>
          <VideoAssetThumbnail key={`${asset.id}:${asset.url}:${asset.thumbnailUrl}`} asset={asset} />
          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 block text-sm font-medium leading-snug text-foreground">
              {displayTitle}
            </span>
            <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
              {problem ? <span className="text-destructive">{problem}</span> : (
                <>
                  {asset.durationSeconds !== null ? <span>{Math.round(asset.durationSeconds * 10) / 10}s · {asset.ratio}</span> : null}
                  {modelLabel ? <span className="rounded bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{modelLabel.replace(/_/g, " ")}</span> : null}
                  {formattedDate ? <span className="text-muted/80">{formattedDate}</span> : null}
                </>
              )}
            </span>
          </span>
        </Button>;
      })}</div>}
    {!previewAssets && ownerId && library.data ? <div className="space-y-2 pt-2"><Button type="button" variant="ghost" size="sm" disabled={library.isFetching} onClick={() => void library.refetch()}>{library.isFetching ? "Refreshing videos…" : "Refresh library"}</Button>{library.isError ? <p role="alert" className="text-xs text-destructive">Could not refresh. Your previous videos are still shown.</p> : null}</div> : null}
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
  return <span ref={host} data-video-asset-thumbnail className="relative flex h-20 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black/40" aria-hidden="true">
    <Video className="absolute size-5 text-muted" />
    {visible && asset.thumbnailUrl && !posterFailed ? <Image src={asset.thumbnailUrl} alt="" width={56} height={80} unoptimized onError={() => setPosterFailed(true)} className="relative size-full object-cover" />
      : visible && !failed ? <video src={asset.url} muted playsInline preload="metadata" tabIndex={-1} disablePictureInPicture disableRemotePlayback onContextMenu={event => event.preventDefault()}
        onLoadedMetadata={event => { const player = event.currentTarget; if (Number.isFinite(player.duration) && player.duration > 0) player.currentTime = Math.min(.01, player.duration / 2); }}
        onError={() => setFailed(true)} className="relative size-full object-cover" /> : null}
    {asset.durationSeconds ? (
      <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1 py-0.5 text-[9px] font-semibold tabular-nums text-white">
        {Math.round(asset.durationSeconds)}s
      </span>
    ) : null}
  </span>;
}
