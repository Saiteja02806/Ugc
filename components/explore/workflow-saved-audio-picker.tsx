"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import type { WorkflowAttachment } from "@/components/explore/hook-workflow-media-controls";
import type { AudioAsset, AudioHistory } from "@/lib/audio/types";
import quietScrollbar from "@/components/ui/quiet-scrollbar.module.css";

/** Only explicitly selected, owned, ready commercial audio becomes an attachment. */
export function WorkflowSavedAudioPicker(props: { ownerId: string | null; attachment: WorkflowAttachment; disabled?: boolean; buttonLabel?: string; localPreview?: boolean }) {
  // A new account gets a fresh library and cancels the previous account's work.
  return <SavedAudioLibrary key={`${props.ownerId}:${props.localPreview === true}`} {...props} />;
}

function SavedAudioLibrary({ ownerId, attachment, disabled = false, buttonLabel = "Choose saved audio", localPreview = false }: { ownerId: string | null; attachment: WorkflowAttachment; disabled?: boolean; buttonLabel?: string; localPreview?: boolean }) {
  const [open, setOpen] = useState(false), [assets, setAssets] = useState<AudioAsset[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false), [loaded, setLoaded] = useState(false), [attempt, setAttempt] = useState(0);
  const active = useRef(true);
  const selecting = useRef(false);
  function beginLoad() { setLoading(true); setLoaded(false); setAssets([]); setError(null); }
  function changeOpen(next: boolean) {
    if (next && ownerId && !localPreview) beginLoad();
    setOpen(next);
  }
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => {
    if (!open || !ownerId || localPreview) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const token = await getCurrentUserIdToken(ownerId); if (!token) throw new Error("Sign in to select saved audio.");
        if (controller.signal.aborted || !active.current) return;
        const response = await fetch("/api/audio/history", { cache: "no-store", headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
        const value = await response.json() as AudioHistory;
        if (!response.ok || !Array.isArray(value.assets)) throw new Error("Could not load your saved audio.");
        if (!controller.signal.aborted && active.current) { setAssets(value.assets.filter(a => a.status === "ready" && a.testOnly === false && (a.purpose === "generated" || a.purpose === "exact"))); setLoaded(true); }
      } catch (e) { if (!controller.signal.aborted && active.current) setError(e instanceof Error ? e.message : "Could not load saved audio."); }
      finally { if (!controller.signal.aborted && active.current) setLoading(false); }
    })();
    return () => controller.abort();
  }, [open, ownerId, localPreview, attempt]);
  async function select(asset: AudioAsset) {
    if (selecting.current || !ownerId || disabled || localPreview || attachment.loading) return;
    selecting.current = true;
    setBusy(true); setError(null);
    try {
      const token = await getCurrentUserIdToken(ownerId); if (!token) throw new Error("Sign in to select audio.");
      if (!active.current) return;
      const response = await fetch(`/api/audio/assets/${encodeURIComponent(asset.id)}?forExplore=1`, { cache: "no-store", headers: { Authorization: `Bearer ${token}` } });
      if (!active.current) return;
      if (!response.ok || Number(response.headers.get("content-length")) > 12 * 1024 * 1024) throw new Error("This recording is no longer available for Explore.");
      const blob = await response.blob(); if (!active.current) return;
      if (!blob.size || blob.size > 12 * 1024 * 1024 || !blob.type.startsWith("audio/")) throw new Error("Choose a complete saved audio recording.");
      const extension = blob.type.includes("wav") ? "wav" : blob.type.includes("mp4") || blob.type.includes("m4a") ? "m4a" : blob.type.includes("ogg") ? "ogg" : blob.type.includes("webm") ? "webm" : "mp3";
      if (await attachment.choose(new File([blob], `saved-audio-${asset.id}.${extension}`, { type: blob.type })) && active.current) setOpen(false);
    } catch (e) { if (active.current) setError(e instanceof Error ? e.message : "Could not select saved audio."); }
    finally { selecting.current = false; if (active.current) setBusy(false); }
  }
  return <Popover open={open} onOpenChange={changeOpen}><PopoverTrigger render={<Button type="button" variant="outline" disabled={disabled || busy || attachment.loading} className="h-9 text-xs" />}>{buttonLabel}</PopoverTrigger>
    <PopoverContent align="start" className="w-72 max-w-[calc(100vw-32px)] p-3"><PopoverTitle>Audio library</PopoverTitle>
      {localPreview ? <p className="text-xs leading-5 text-muted">Saved tracks appear here when you sign in to the app. This local preview doesn&apos;t load your account library.</p> : !ownerId ? <p className="text-xs leading-5 text-muted">Sign in to choose audio from your library.</p> : <>
        {loading || !loaded && !error ? <p role="status" className="text-xs text-muted">Loading your audio…</p> : assets.length ? <div className={`${quietScrollbar.surface} max-h-64 space-y-1 overflow-auto`}>{assets.map(a => <Button key={a.id} type="button" variant="ghost" disabled={disabled || busy || attachment.loading} className="h-auto min-h-9 w-full justify-start whitespace-normal break-words px-2 py-2 text-left text-xs" onClick={() => { void select(a); }}>{a.name}</Button>)}</div> : !error ? <>
          <p className="text-xs leading-5 text-muted">No saved tracks yet. Create audio or upload a track in Audio generation to use it here.</p>
          <Link href="/audio-generation" className="text-xs text-primary underline-offset-4 hover:underline focus-visible:underline">Open Audio generation</Link>
        </> : null}
        {loaded ? <p className="text-xs leading-5 text-muted">Ready tracks only. Test audio and private voice references stay out of this library.</p> : null}
        {error ? <div className="space-y-2"><p role="alert" className="text-xs leading-5 text-destructive">{error}</p><Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => { beginLoad(); setAttempt(n => n + 1); }}>Retry loading audio</Button></div> : null}
      </>}
    </PopoverContent></Popover>;
}
