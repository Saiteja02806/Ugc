"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { isWorkflowSourceVideo, workflowSourceVideoError } from "@/lib/explore/workflow-source-video";
import type { MediaAsset } from "@/lib/media/types";
import { withReadDeadline } from "@/lib/http/read-deadline";

export function WorkflowVideoAssetPicker({ open, onOpenChange, ownerId, selectedId, onSelect, description = "Use an existing video as your opening segment.", previewAssets }: {
  open: boolean; onOpenChange: (open: boolean) => void; ownerId: string | null; selectedId?: string; onSelect: (asset: MediaAsset) => boolean; description?: string; previewAssets?: MediaAsset[];
}) {
  const library = useQuery<MediaAsset[]>({
    queryKey: ["explore-source-videos", ownerId], enabled: open && !!ownerId && !previewAssets,
    staleTime: 30_000, gcTime: 5 * 60_000, retry: false, refetchOnWindowFocus: false,
    queryFn: ({ signal }) => withReadDeadline(async bounded => {
        const token = await getCurrentUserIdToken(ownerId ?? undefined);
        if (!token) throw new Error("Sign in to choose your video.");
        bounded.throwIfAborted();
        const response = await fetch("/api/media?collection=video", { cache: "no-store", headers: { Authorization: `Bearer ${token}` }, signal: bounded });
        const value = await response.json();
        if (!response.ok || value?.ok !== true || !Array.isArray(value.assets)) throw new Error("Could not load Creative Assets.");
        return value.assets.filter(isWorkflowSourceVideo);
    }, signal),
  });
  const visibleAssets = previewAssets?.filter(isWorkflowSourceVideo) ?? library.data ?? [];
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[min(640px,90dvh)] overflow-y-auto overscroll-contain sm:max-w-lg">
    <DialogHeader><DialogTitle>Choose from Creative Assets</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
    {!ownerId && !previewAssets ? <p className="text-sm text-muted">Sign in to choose from Creative Assets.</p>
      : !previewAssets && !library.data && library.isPending ? <p role="status" className="text-sm text-muted">Loading your videos…</p>
      : !previewAssets && !library.data && library.isError ? <div role="alert" className="space-y-3"><p>{library.error.message}</p><Button type="button" variant="outline" onClick={() => void library.refetch()}>Retry</Button></div>
      : !visibleAssets.length ? <p className="text-sm text-muted">No ready videos yet. Upload a video in Create to get started.</p>
      : <div className="grid gap-2">{visibleAssets.map(asset => {
        const problem = workflowSourceVideoError(asset);
        return <Button key={asset.id} type="button" variant="outline" aria-pressed={asset.id === selectedId} disabled={!!problem} title={problem ?? asset.title}
          className="h-auto min-h-20 w-full justify-start gap-3 px-3 py-2 text-left" onClick={() => { if (onSelect(asset)) onOpenChange(false); }}>
          {asset.thumbnailUrl ? <Image src={asset.thumbnailUrl} alt="" width={48} height={60} unoptimized className="h-14 w-12 shrink-0 rounded object-cover" /> : <Video className="size-6 shrink-0 text-muted" aria-hidden="true" />}
          <span className="min-w-0"><span className="block truncate text-sm font-medium">{asset.title}</span><span className="block text-xs text-muted">{problem ?? (asset.durationSeconds !== null ? `${Math.round(asset.durationSeconds * 10) / 10} sec · ${asset.ratio}` : "Video")}</span></span>
        </Button>;
      })}</div>}
    {!previewAssets && ownerId && library.data ? <div className="space-y-2"><Button type="button" variant="ghost" size="sm" disabled={library.isFetching} onClick={() => void library.refetch()}>{library.isFetching ? "Refreshing videos…" : "Refresh library"}</Button>{library.isError ? <p role="alert" className="text-xs text-destructive">Could not refresh. Your previous videos are still shown.</p> : null}</div> : null}
  </DialogContent></Dialog>;
}
