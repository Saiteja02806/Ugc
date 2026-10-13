"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LoaderCircle, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { withReadDeadline } from "@/lib/http/read-deadline";
import { readBackgroundAudioFile } from "@/lib/explore/background-audio-client";
import type { BackgroundAudioLibrary, BackgroundAudioTrack } from "@/lib/explore/background-audio-types";
import type { WorkflowAttachment } from "./hook-workflow-media-controls";
import quietScrollbar from "@/components/ui/quiet-scrollbar.module.css";

type Props = {
  ownerId: string | null;
  attachment: WorkflowAttachment;
  onChoose: (file: File, playback: "once" | "repeat") => Promise<boolean>;
  disabled?: boolean;
  localPreview?: boolean;
};

export function WorkflowBackgroundAudioPicker(props: Props) {
  return <BackgroundAudioLibrarySession key={`${props.ownerId}:${props.localPreview === true}`} {...props} />;
}

function BackgroundAudioLibrarySession({ ownerId, attachment, onChoose, disabled = false, localPreview = false }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const player = useRef<{ audio: HTMLAudioElement; url: string } | null>(null);
  const previewRequest = useRef<AbortController | null>(null);
  const selectionRequest = useRef<AbortController | null>(null);
  const active = useRef(true);
  function releasePlayer() {
    if (player.current) {
      player.current.audio.pause();
      player.current.audio.removeAttribute("src");
      player.current.audio.load();
      URL.revokeObjectURL(player.current.url);
      player.current = null;
    }
  }
  function stopPreview() {
    previewRequest.current?.abort(); previewRequest.current = null;
    releasePlayer(); setPlaying(null); setPreviewing(null);
  }
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; previewRequest.current?.abort(); selectionRequest.current?.abort(); releasePlayer(); };
  }, []);
  const library = useQuery<BackgroundAudioLibrary>({
    queryKey: ["explore-background-audio-library", ownerId], enabled: open && !!ownerId && !localPreview,
    staleTime: 5 * 60_000, gcTime: 30 * 60_000, retry: false, refetchOnWindowFocus: false,
    queryFn: ({ signal }) => withReadDeadline(async bounded => {
      const token = await getCurrentUserIdToken(ownerId ?? undefined);
      if (!token) throw new Error("Sign in to choose background audio.");
      bounded.throwIfAborted();
      const response = await fetch("/api/explore/background-audio", { cache: "no-store", headers: { Authorization: `Bearer ${token}` }, signal: bounded });
      const value = await response.json();
      if (!response.ok || !Array.isArray(value.tracks)) throw new Error(typeof value.error === "string" ? value.error : "Could not load background music.");
      return value as BackgroundAudioLibrary;
    }, signal),
  });
  async function read(track: BackgroundAudioTrack, controller: AbortController) {
    return withReadDeadline(async signal => {
      const token = await getCurrentUserIdToken(ownerId ?? undefined);
      if (!token) throw new Error("Sign in to choose background audio.");
      signal.throwIfAborted();
      return readBackgroundAudioFile(track, token, signal);
    }, controller.signal, 35_000);
  }
  async function preview(track: BackgroundAudioTrack) {
    if (selecting || disabled || attachment.loading) return;
    const key = `${track.source}:${track.id}`;
    const stop = playing === key || previewing === key;
    stopPreview(); if (stop) return;
    const controller = new AbortController(); previewRequest.current = controller;
    setPreviewing(key); setError(null);
    try {
      const { file } = await read(track, controller);
      if (controller.signal.aborted || !active.current) return;
      const url = URL.createObjectURL(file), audio = new Audio(url);
      player.current = { audio, url };
      audio.onended = () => { if (player.current?.audio === audio) { releasePlayer(); setPlaying(null); } };
      await audio.play();
      if (player.current?.audio === audio) setPlaying(key);
    } catch (cause) {
      if (!controller.signal.aborted && active.current) { releasePlayer(); setError(cause instanceof Error ? cause.message : "This track could not be played."); }
    } finally {
      if (previewRequest.current === controller) { previewRequest.current = null; if (active.current) setPreviewing(null); }
    }
  }
  async function select(track: BackgroundAudioTrack) {
    if (selectionRequest.current || disabled || attachment.loading || !ownerId || localPreview) return;
    stopPreview(); setError(null);
    const controller = new AbortController(); selectionRequest.current = controller;
    setSelecting(`${track.source}:${track.id}`);
    let playback: "once" | "repeat" = "once";
    try {
      const accepted = await attachment.chooseRemote(async () => {
        const result = await read(track, controller); playback = result.playback;
        if (!active.current) throw new Error("This audio selection was interrupted. Choose it again.");
        return result.file;
      }, { signal: controller.signal }, file => onChoose(file, playback));
      if (accepted && active.current) setOpen(false);
    } catch (cause) {
      if (!controller.signal.aborted && active.current) setError(cause instanceof Error ? cause.message : "Could not select background audio.");
    } finally {
      if (selectionRequest.current === controller) selectionRequest.current = null;
      if (active.current) setSelecting(null);
    }
  }
  const tracks = library.data?.tracks ?? [];
  const filter = search.trim().toLowerCase();
  const visible = tracks.filter(track => [track.name, track.source, track.energy, ...track.moods].join(" ").toLowerCase().includes(filter));
  const busy = disabled || !!selecting || attachment.loading;
  const loadError = library.error instanceof Error ? library.error.message : null;
  return <Popover open={open} onOpenChange={next => { if (!next) stopPreview(); else setError(null); setOpen(next); }}>
    <PopoverTrigger render={<Button type="button" variant="outline" disabled={busy} className="h-10 px-3 text-sm" />}>Audio Library</PopoverTrigger>
    <PopoverContent align="start" className="w-[25rem] max-w-[calc(100vw-32px)] space-y-3 p-4">
      <PopoverTitle>Background audio library</PopoverTitle>
      {localPreview ? <p className="text-xs leading-5 text-muted">Sign in to the app to browse background music. This local preview doesn&apos;t load the library.</p>
        : !ownerId ? <p className="text-xs leading-5 text-muted">Sign in to browse background music.</p> : <>
          <p className="text-xs leading-5 text-muted">Choose background music for your video. Preview a track before adding it.</p>
          {library.isPending ? <p role="status" className="text-xs text-muted">Loading background music…</p> : null}
          {library.data ? <>
            <input type="search" aria-label="Search background audio" placeholder="Search tracks, moods or energy…" value={search} onChange={event => setSearch(event.target.value)} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-primary" />
            <p role="status" className="text-xs text-muted">{visible.length} {visible.length === 1 ? "track" : "tracks"}</p>
            {visible.length ? <ul aria-label="Background music tracks" className={`${quietScrollbar.surface} max-h-72 space-y-1 overflow-auto`}>
              {visible.map(track => { const key = `${track.source}:${track.id}`; return <li key={key} className="flex items-center gap-2 rounded-lg p-1">
                <Button type="button" variant="ghost" size="icon-sm" disabled={busy} aria-label={`${playing === key || previewing === key ? "Stop" : "Preview"} ${track.name}`} onClick={() => void preview(track)}>
                  {previewing === key ? <LoaderCircle className="size-4 animate-spin" /> : playing === key ? <Pause className="size-4" /> : <Play className="size-4" />}
                </Button>
                <div className="min-w-0 flex-1"><p className="text-xs font-medium">{track.name}</p><p className="text-[11px] leading-4 text-muted">{Math.round(track.durationSeconds)}s · {track.moods.join(", ")} · {track.energy} energy{track.loopable ? " · Loopable" : ""}</p></div>
                <Button type="button" variant="outline" size="sm" disabled={busy} aria-label={`Use ${track.name}`} onClick={() => void select(track)}>{selecting === key ? <LoaderCircle className="size-3.5 animate-spin" /> : null}Use</Button>
              </li>; })}
            </ul> : <p className="text-xs leading-5 text-muted">{tracks.length ? "No tracks match your search." : "No background tracks are available right now. Refresh the library to try again."}</p>}
          </> : null}
          {loadError ? <p role="alert" className="text-xs leading-5 text-destructive">{loadError}</p> : null}
          {error || attachment.error ? <p role="alert" className="text-xs leading-5 text-destructive">{error ?? attachment.error}</p> : null}
          <Button type="button" variant="ghost" size="sm" disabled={busy || library.isFetching} onClick={() => { stopPreview(); setError(null); attachment.clearError(); void library.refetch(); }}>{library.isFetching ? "Refreshing…" : loadError ? "Retry loading music" : "Refresh library"}</Button>
        </>}
    </PopoverContent>
  </Popover>;
}
