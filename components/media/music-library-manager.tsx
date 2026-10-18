"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Music2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { imageLibraryRequest } from "@/lib/media/image-library-client";
import { uploadAIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";
import { isLibraryMusic, MUSIC_LIBRARY_MAX_BYTES, MUSIC_LIBRARY_TYPES } from "@/lib/media/music-library";
import type { MediaAsset } from "@/lib/media/types";
import styles from "./image-library.module.css";

function musicDuration(value: number | null) {
  const seconds = Math.round(value ?? 0);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function MusicLibraryManager({ owner, active = true, onBusyChange }: { owner: string; active?: boolean; onBusyChange?: (busy: boolean) => void }) {
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false), [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryFiles, setRetryFiles] = useState<File[]>([]);
  const players = useRef(new Map<string, HTMLAudioElement>());
  const working = useRef(false), alive = useRef(true), input = useRef<HTMLInputElement>(null);
  const cache = useQueryClient();
  const busyCallback = useRef(onBusyChange);
  useEffect(() => { busyCallback.current = onBusyChange; }, [onBusyChange]);
  useEffect(() => { if (!active) players.current.forEach(player => player.pause()); }, [active]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; busyCallback.current?.(false); }; }, []);
  const tracks = useQuery({ queryKey: ["media-library-music", owner], staleTime: 0,
    queryFn: async ({ signal }) => (await imageLibraryRequest<{ assets: MediaAsset[] }>(owner, "/api/media?collection=audio&sourceTypes=upload", { signal })).assets.filter(isLibraryMusic) });
  async function upload(files: File[]) {
    if (working.current || !files.length) return;
    if (files.length > 20) { setError("Upload up to 20 tracks at a time."); return; }
    working.current = true; setBusy(true); onBusyChange?.(true); setError(null); setRetryFiles([]);
    const failures: string[] = [], failedFiles: File[] = []; let successes = 0;
    try {
      for (let index = 0; index < files.length; index++) {
        if (!alive.current) return;
        const file = files[index]; setMessage(`Uploading ${index + 1} of ${files.length}: ${file.name}`);
        try {
          if (!MUSIC_LIBRARY_TYPES.includes(file.type) || !file.size || file.size > MUSIC_LIBRARY_MAX_BYTES) throw new Error("Choose a supported audio file up to 25 MB.");
          await uploadAIStudioReferenceMedia(file, "audio", 120, owner, { purpose: "music-library", maxAudioDurationSeconds: 600 }); successes++;
        } catch (cause) { failedFiles.push(file); failures.push(`${file.name}: ${cause instanceof Error ? cause.message : "Upload failed. Retry this file."}`); }
      }
      if (!alive.current) return;
      await Promise.all([cache.invalidateQueries({ queryKey: ["media-library-music", owner] }), cache.invalidateQueries({ queryKey: ["explore-saved-media-audio", owner] })]);
      setRetryFiles(failedFiles); setMessage(`${successes} track${successes === 1 ? "" : "s"} saved to library. Choose a track in the audio controls to attach it.`);
      if (failures.length) setError(failures.join("\n"));
    } finally { working.current = false; if (alive.current) { setBusy(false); onBusyChange?.(false); } }
  }
  const visible = (tracks.data ?? []).filter(asset => `${asset.title} ${asset.fileName ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  return <section className={styles.library} aria-label="Music library"><div className={styles.heading}><div><h3>Your music</h3><p>Save tracks for reuse in the audio controls. Uploading keeps your current edit unchanged.</p></div><Button type="button" disabled={busy} onClick={() => input.current?.click()}><Upload aria-hidden="true" />Upload music</Button></div>
    <input ref={input} type="file" accept={MUSIC_LIBRARY_TYPES.join(",")} multiple className="sr-only" aria-label="Upload library music" disabled={busy} onChange={event => { const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ""; void upload(files); }} />
    <p className="text-xs text-muted">MP3, WAV, M4A, OGG or WebM · up to 25 MB and 10 minutes per track.</p>
    <div className={styles.filters}><input aria-label="Search library music" placeholder="Search music…" value={search} onChange={event => setSearch(event.target.value)} /><Button type="button" variant="outline" disabled={busy || tracks.isFetching} onClick={() => void tracks.refetch()}>Refresh music</Button></div>
    {tracks.isPending ? <p role="status">Loading your music…</p> : tracks.isError ? <p role="alert">Could not load music. Use Refresh music to try again.</p> : visible.length ? <ul className="space-y-3">{visible.map(asset => <li key={asset.id} className="space-y-2 rounded-xl border border-border p-3"><div className="flex min-w-0 items-center gap-2 text-sm"><Music2 className="size-4 shrink-0" aria-hidden="true" /><strong className="min-w-0 flex-1 truncate" title={asset.title}>{asset.title}</strong><span className="text-xs text-muted">{musicDuration(asset.durationSeconds)}</span></div><audio ref={element => { if (element) players.current.set(asset.id, element); else players.current.delete(asset.id); }} onPlay={event => players.current.forEach(player => { if (player !== event.currentTarget) player.pause(); })} controls preload="none" src={asset.url} aria-label={`Preview music ${asset.title}`} className="h-9 w-full" /></li>)}</ul> : <p className={styles.empty}>{search ? "No matching tracks." : "Upload your first music track."}</p>}
    {message ? <p role="status" className={styles.notice}>{message}</p> : null}{error ? <p role="alert" className="whitespace-pre-line text-sm text-destructive">{error}</p> : null}
    {retryFiles.length ? <Button type="button" variant="outline" disabled={busy} onClick={() => void upload(retryFiles)}>Retry failed music</Button> : null}
  </section>;
}
