"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import type { WorkflowAttachment } from "@/components/explore/hook-workflow-media-controls";
import type { AudioAsset, AudioHistory } from "@/lib/audio/types";
import { withReadDeadline } from "@/lib/http/read-deadline";
import quietScrollbar from "@/components/ui/quiet-scrollbar.module.css";
import secondary from "@/components/explore/workflow-secondary-action.module.css";
import { MediaLibraryButton } from "@/components/media/media-library-dialog";
import { imageLibraryRequest } from "@/lib/media/image-library-client";
import { isLibraryMusic, MUSIC_LIBRARY_MAX_BYTES } from "@/lib/media/music-library";
import type { MediaAsset } from "@/lib/media/types";

/** Only explicitly selected, owned, ready commercial audio becomes an attachment. */
export function WorkflowSavedAudioPicker(props: { ownerId: string | null; attachment: WorkflowAttachment; disabled?: boolean; buttonLabel?: string; localPreview?: boolean }) {
  // A new account gets a fresh library and cancels the previous account's work.
  return <SavedAudioLibrary key={`${props.ownerId}:${props.localPreview === true}`} {...props} />;
}

function SavedAudioLibrary({ ownerId, attachment, disabled = false, buttonLabel = "Choose saved audio", localPreview = false }: { ownerId: string | null; attachment: WorkflowAttachment; disabled?: boolean; buttonLabel?: string; localPreview?: boolean }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const active = useRef(true);
  const selecting = useRef(false);
  function changeOpen(next: boolean) {
    if (next) setError(null);
    setOpen(next);
  }
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const library = useQuery<AudioAsset[]>({
    queryKey: ["explore-saved-audio", ownerId], enabled: open && !!ownerId && !localPreview,
    staleTime: 30_000, gcTime: 5 * 60_000, retry: false, refetchOnWindowFocus: false,
    queryFn: ({ signal }) => withReadDeadline(async bounded => {
        const token = await getCurrentUserIdToken(ownerId ?? undefined); if (!token) throw new Error("Sign in to select saved audio.");
        bounded.throwIfAborted();
        const response = await fetch("/api/audio/history", { cache: "no-store", headers: { Authorization: `Bearer ${token}` }, signal: bounded });
        const value = await response.json() as AudioHistory;
        if (!response.ok || !Array.isArray(value.assets)) throw new Error("Could not load your saved audio.");
        return value.assets.filter(a => a.status === "ready" && a.testOnly === false && (a.purpose === "generated" || a.purpose === "exact"));
    }, signal),
  });
  const assets = library.data ?? [];
  const music = useQuery({ queryKey: ["explore-saved-media-audio", ownerId], enabled: open && !!ownerId && !localPreview, staleTime: 0,
    queryFn: async ({ signal }) => (await imageLibraryRequest<{ assets: MediaAsset[] }>(ownerId!, "/api/media?collection=audio&sourceTypes=upload", { signal })).assets.filter(isLibraryMusic) });
  const loaded = library.data !== undefined;
  const loading = library.isPending && !loaded;
  const loadError = library.isError ? library.error.message : null;
  async function select(asset: AudioAsset) {
    if (selecting.current || !ownerId || disabled || localPreview || attachment.loading) return;
    selecting.current = true;
    setBusy(true); setError(null);
    try {
      const accepted = await attachment.chooseRemote(async () => {
        const blob = await withReadDeadline(async signal => {
          const token = await getCurrentUserIdToken(ownerId); if (!token) throw new Error("Sign in to select audio.");
          signal.throwIfAborted();
          const response = await fetch(`/api/audio/assets/${encodeURIComponent(asset.id)}?forExplore=1`, { cache: "no-store", headers: { Authorization: `Bearer ${token}` }, signal });
          if (!response.ok || Number(response.headers.get("content-length")) > 12 * 1024 * 1024) throw new Error("This recording is no longer available for Explore.");
          return response.blob();
        });
        if (!active.current) throw new Error("This audio selection was interrupted. Choose it again or remove the audio.");
        if (!blob.size || blob.size > 12 * 1024 * 1024 || !blob.type.startsWith("audio/")) throw new Error("Choose a complete saved audio recording.");
        const extension = blob.type.includes("wav") ? "wav" : blob.type.includes("mp4") || blob.type.includes("m4a") ? "m4a" : blob.type.includes("ogg") ? "ogg" : blob.type.includes("webm") ? "webm" : "mp3";
        return new File([blob], `saved-audio-${asset.id}.${extension}`, { type: blob.type });
      }, {}, file => attachment.choose(file));
      if (accepted && active.current) setOpen(false);
    } catch (e) { if (active.current) setError(e instanceof Error ? e.message : "Could not select saved audio."); }
    finally { selecting.current = false; if (active.current) setBusy(false); }
  }
  async function selectMusic(tile: MediaAsset) {
    if (selecting.current || !ownerId || disabled || localPreview || attachment.loading) return;
    selecting.current = true; setBusy(true); setError(null);
    try {
      const accepted = attachment.chooseOwnedAudio ? await attachment.chooseOwnedAudio(tile.id) : await attachment.chooseRemote(async () => {
        const { asset } = await imageLibraryRequest<{ asset: MediaAsset }>(ownerId, `/api/media/${tile.id}`);
        if (!active.current || asset.id !== tile.id || !isLibraryMusic(asset)) throw new Error("This music is no longer available.");
        const blob = await withReadDeadline(async signal => {
          const headers = new Headers();
          if (new URL(asset.url, window.location.href).origin === window.location.origin) {
            const token = await getCurrentUserIdToken(ownerId); if (!token) throw new Error("Sign in to select music."); headers.set("Authorization", `Bearer ${token}`);
          }
          const response = await fetch(asset.url, { signal, headers, redirect: "error" });
          if (!response.ok || Number(response.headers.get("content-length")) > MUSIC_LIBRARY_MAX_BYTES) throw new Error("Could not load this music.");
          return response.blob();
        });
        if (!active.current || !blob.size || blob.size > MUSIC_LIBRARY_MAX_BYTES || !blob.type.startsWith("audio/")) throw new Error("Choose a complete music file up to 25 MB.");
        return new File([blob], asset.fileName ?? "library-music.mp3", { type: blob.type });
      }, { maxBytes: MUSIC_LIBRARY_MAX_BYTES, maxDuration: 600 }, file => attachment.choose(file));
      if (accepted && active.current) setOpen(false);
    } catch (cause) { if (active.current) setError(cause instanceof Error ? cause.message : "Could not choose this music. Your previous track is kept."); }
    finally { selecting.current = false; if (active.current) setBusy(false); }
  }
  return <Popover open={open} onOpenChange={changeOpen}><PopoverTrigger render={<Button type="button" variant="outline" disabled={disabled || busy || attachment.loading} className={secondary.action} />}>{buttonLabel}</PopoverTrigger>
    <PopoverContent align="start" className="w-72 max-w-[calc(100vw-32px)] p-3"><PopoverTitle>Audio library</PopoverTitle>
      {!localPreview && ownerId ? <MediaLibraryButton label="Add music to library" initialTab="music" disabled={busy || attachment.loading} className="mb-2" /> : null}
      {localPreview ? <p className="text-xs leading-5 text-muted">Saved tracks appear here when you sign in to the app. This local preview doesn&apos;t load your account library.</p> : !ownerId ? <p className="text-xs leading-5 text-muted">Sign in to choose audio from your library.</p> : <>
        {music.isPending ? <p role="status" className="text-xs text-muted">Loading library music…</p> : music.isError ? <p role="alert" className="text-xs text-destructive">Could not load library music. <button type="button" onClick={() => void music.refetch()}>Retry</button></p> : music.data?.length ? <div className="mb-2 max-h-48 overflow-auto"><p className="text-xs font-medium">Your music</p>{music.data.map(asset => <Button type="button" key={asset.id} variant="ghost" disabled={disabled || busy || attachment.loading} className="h-auto w-full justify-start whitespace-normal text-left text-xs" onClick={() => void selectMusic(asset)}>{asset.title}</Button>)}</div> : null}
        {loading ? <p role="status" className="text-xs text-muted">Loading your audio…</p> : assets.length ? <div className={`${quietScrollbar.surface} max-h-64 space-y-1 overflow-auto`}>{assets.map(a => <Button key={a.id} type="button" variant="ghost" disabled={disabled || busy || attachment.loading} className="h-auto min-h-9 w-full justify-start whitespace-normal break-words px-2 py-2 text-left text-xs" onClick={() => { void select(a); }}>{a.name}</Button>)}</div> : !loadError ? <>
          <p className="text-xs leading-5 text-muted">No saved tracks yet. Create audio or upload a track in Audio generation to use it here.</p>
          <Link href="/audio-generation" className="text-xs text-primary underline-offset-4 hover:underline focus-visible:underline">Open Audio generation</Link>
        </> : null}
        {loaded ? <p className="text-xs leading-5 text-muted">Ready tracks only. Test audio and private voice references stay out of this library.</p> : null}
        {loaded ? <Button type="button" variant="ghost" size="sm" disabled={busy || library.isFetching} onClick={() => void library.refetch()}>{library.isFetching ? "Refreshing audio…" : "Refresh library"}</Button> : null}
        {error || attachment.error || loadError ? <div className="space-y-2"><p role="alert" className="text-xs leading-5 text-destructive">{error ?? attachment.error ?? loadError}</p>{loadError ? <Button type="button" variant="outline" size="sm" disabled={busy || library.isFetching} onClick={() => void library.refetch()}>Retry loading audio</Button> : null}</div> : null}
      </>}
    </PopoverContent></Popover>;
}
