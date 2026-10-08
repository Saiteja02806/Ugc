"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import type { WorkflowAttachment } from "@/components/explore/hook-workflow-media-controls";
import type { AudioAsset, AudioHistory } from "@/lib/audio/types";

/** Only explicitly selected, owned, ready commercial audio becomes an attachment. */
export function WorkflowSavedAudioPicker({ ownerId, attachment, disabled = false }: { ownerId: string | null; attachment: WorkflowAttachment; disabled?: boolean }) {
  const [open, setOpen] = useState(false), [assets, setAssets] = useState<AudioAsset[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => {
    if (!open || !ownerId) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const token = await getCurrentUserIdToken(ownerId); if (!token) throw new Error("Sign in to select saved audio.");
        const response = await fetch("/api/audio/history", { cache: "no-store", headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
        const value = await response.json() as AudioHistory;
        if (!response.ok || !Array.isArray(value.assets)) throw new Error("Could not load your saved audio.");
        if (!controller.signal.aborted && active.current) { setAssets(value.assets.filter(a => a.status === "ready" && a.testOnly === false && (a.purpose === "generated" || a.purpose === "exact"))); setError(null); }
      } catch (e) { if (!controller.signal.aborted && active.current) setError(e instanceof Error ? e.message : "Could not load saved audio."); }
    })();
    return () => controller.abort();
  }, [open, ownerId]);
  async function select(asset: AudioAsset) {
    if (busy || !ownerId || disabled) return;
    setBusy(true); setError(null);
    try {
      const token = await getCurrentUserIdToken(ownerId); if (!token || !active.current) throw new Error("Sign in to select audio.");
      const response = await fetch(`/api/audio/assets/${encodeURIComponent(asset.id)}?forExplore=1`, { cache: "no-store", headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok || Number(response.headers.get("content-length")) > 12 * 1024 * 1024) throw new Error("This recording is no longer available for Explore.");
      const blob = await response.blob(); if (!active.current) return;
      if (!blob.size || blob.size > 12 * 1024 * 1024 || !blob.type.startsWith("audio/")) throw new Error("Choose a complete saved audio recording.");
      const extension = blob.type.includes("wav") ? "wav" : blob.type.includes("mp4") || blob.type.includes("m4a") ? "m4a" : blob.type.includes("ogg") ? "ogg" : blob.type.includes("webm") ? "webm" : "mp3";
      if (await attachment.choose(new File([blob], `saved-audio-${asset.id}.${extension}`, { type: blob.type }))) setOpen(false);
    } catch (e) { if (active.current) setError(e instanceof Error ? e.message : "Could not select saved audio."); }
    finally { if (active.current) setBusy(false); }
  }
  return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger render={<Button type="button" variant="ghost" disabled={disabled || !ownerId || attachment.loading} className="h-8 text-xs" />}>Choose saved audio</PopoverTrigger>
    <PopoverContent className="w-72"><PopoverTitle>Your audio Library</PopoverTitle>
      {assets.length ? <div className="max-h-64 space-y-1 overflow-auto">{assets.map(a => <Button key={a.id} type="button" variant="ghost" disabled={busy} className="w-full justify-start truncate text-sm" onClick={() => { void select(a); }}>{a.name}</Button>)}</div> : <p className="text-xs text-muted">No ready audio yet. Free-plan test audio and private voice recordings are not offered for posting.</p>}
      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
    </PopoverContent></Popover>;
}
