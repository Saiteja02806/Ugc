"use client";

import { useQuery } from "@tanstack/react-query";
import { AudioLines, Bookmark, Check, LoaderCircle, Pause, Play, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { createAudioApi, createAudioFetch } from "@/lib/audio/client";
import { audioLibraryQueryOptions } from "@/lib/audio/library-query";
import type { AudioBootstrap, AudioVoice } from "@/lib/audio/types";
import { useAudioBookmarks } from "@/components/audio/use-audio-bookmarks";
import { useAudioVoiceSelection } from "@/components/audio/use-audio-voice-selection";
import { VoiceOrb } from "@/components/audio/voice-orb";
import { Button } from "@/components/ui/button";
import type { WorkflowAttachment } from "./hook-workflow-media-controls";
import styles from "./workflow-saved-audio.module.css";

export function WorkflowSavedAudioChoices({ ownerId, audio, onVoiceReference }: { ownerId: string; audio: WorkflowAttachment; onVoiceReference: () => void }) {
  const { user, loading } = useAuth();
  if (loading) return <p role="status" className="text-xs text-muted">Loading your saved voices…</p>;
  if (!user) return <p className="text-xs text-muted">Sign in to see your saved voices and recordings.</p>;
  if (user.uid !== ownerId) return <p role="status" className="text-xs text-muted">Loading your saved voices…</p>;
  return <SavedAudioSession key={user.uid} uid={user.uid} audio={audio} onVoiceReference={onVoiceReference} />;
}

function SavedAudioSession({ uid, audio, onVoiceReference }: { uid: string; audio: WorkflowAttachment; onVoiceReference: () => void }) {
  const api = useMemo(() => createAudioApi(uid), [uid]);
  const bookmarks = useAudioBookmarks(uid, api);
  const selection = useAudioVoiceSelection(uid, api);
  const library = useQuery(audioLibraryQueryOptions({ userId: uid, load: signal => api<AudioBootstrap>("/api/audio/bootstrap", { signal }) }));
  const [playing, setPlaying] = useState<string | null>(null);
  const [attaching, setAttaching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const transfer = useRef<AbortController | null>(null);
  useEffect(() => () => { const previous = player.current; player.current = null; previous?.pause(); transfer.current?.abort(); }, []);
  const voices = library.data?.voices ?? [];
  const selected = voices.find(voice => voice.id === selection.voiceId);
  const saved = [...bookmarks.ids].map(id => voices.find(voice => voice.id === id)).filter((voice): voice is AudioVoice => Boolean(voice) && voice?.id !== selected?.id);
  const unavailable = [...bookmarks.ids].filter(id => !voices.some(voice => voice.id === id)).length;
  const recordings = library.data?.assets.filter(asset => asset.status === "ready" && !asset.testOnly && (asset.purpose === "generated" || asset.purpose === "exact") && (asset.duration === null || asset.duration <= 30)) ?? [];

  function preview(voice: AudioVoice) {
    const previous = player.current; player.current = null; previous?.pause();
    if (playing === voice.id) { setPlaying(null); return; }
    if (!voice.previewUrl) return;
    const next = new Audio(voice.previewUrl); player.current = next; setPlaying(voice.id);
    next.onended = () => { if (player.current === next) setPlaying(null); };
    void next.play().catch(() => { if (player.current === next) { setPlaying(null); setError("This sample could not be played. Try another voice."); } });
  }
  async function attach(path: string, id: string, name: string, voice: boolean) {
    if (transfer.current || audio.loading) return;
    const controller = new AbortController(); transfer.current = controller;
    const previous = player.current; player.current = null; previous?.pause();
    setAttaching(id); setError(null); setPlaying(null);
    try {
      const response = await createAudioFetch(uid)(path, { signal: controller.signal });
      if (Number(response.headers.get("Content-Length")) > 12 * 1024 * 1024) throw new Error("This recording is too large for an audio reference.");
      const blob = await response.blob();
      if (!blob.size || blob.size > 12 * 1024 * 1024 || !blob.type.startsWith("audio/")) throw new Error("Choose a complete audio recording up to 30 seconds.");
      const extension = blob.type.includes("wav") ? "wav" : blob.type.includes("mp4") || blob.type.includes("m4a") ? "m4a" : blob.type.includes("ogg") ? "ogg" : blob.type.includes("webm") ? "webm" : "mp3";
      const file = new File([blob], `${name}.${extension}`, { type: blob.type });
      if (controller.signal.aborted) return;
      if (await audio.choose(file, { maxDuration: 30, signal: controller.signal }) && !controller.signal.aborted && voice) onVoiceReference();
    } catch (error) {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Audio could not be selected. Try again.");
    } finally {
      if (!controller.signal.aborted) setAttaching(null);
      if (transfer.current === controller) transfer.current = null;
    }
  }
  function refresh() { bookmarks.refresh(); selection.refresh(); void library.refetch(); }
  const loadError = library.error instanceof Error ? library.error.message : bookmarks.error || selection.error;
  const busy = Boolean(attaching) || audio.loading;
  function voiceRow(voice: AudioVoice, chosen = false) {
    return <li key={voice.id} className={styles.voiceRow} data-selected={chosen || undefined}>
      <button type="button" className={styles.preview} aria-label={`${playing === voice.id ? "Pause" : "Play"} ${voice.name} sample`} disabled={!voice.previewUrl} onClick={() => preview(voice)}>
        <VoiceOrb id={voice.id} /><span className={styles.playIcon}>{playing === voice.id ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}</span>
      </button>
      <div className={styles.details}><strong title={voice.name}>{voice.name}</strong><span>{voice.labels.accent || voice.labels.use_case || "Voice sample"}{chosen ? " · Selected with Use It" : ""}</span></div>
      <Button type="button" variant="outline" disabled={!voice.previewUrl || !library.data?.account?.paid || busy} title={library.data?.account?.paid ? "Attach this voice sample as a reference" : "This voice is currently available for preview only"} aria-label={`Use ${voice.name} sample as voice reference`} className={styles.useButton} onClick={() => void attach(`/api/audio/voices/${encodeURIComponent(voice.id)}/sample`, voice.id, `${voice.name} voice sample`, true)}>
        {attaching === voice.id ? <LoaderCircle size={14} className="animate-spin" /> : chosen ? <Check size={14} /> : null}Use sample
      </Button>
    </li>;
  }
  return <div className={styles.library} aria-label="Saved audio choices">
    {library.isPending ? <p role="status" className="text-xs text-muted">Loading your voices and audio…</p> : null}
    {loadError ? <p role="alert" className={styles.error}>{loadError}<button type="button" onClick={refresh}><RefreshCw size={13} />Retry saved choices</button></p> : null}
    {selected ? <section aria-label="Selected voice"><h4 className={styles.heading}><AudioLines size={14} />Your selected voice</h4><ul className={styles.list}>{voiceRow(selected, true)}</ul></section> : null}
    <section aria-label="Bookmarked voices"><h4 className={styles.heading}><Bookmark size={14} />Bookmarked voices</h4>
      {saved.length ? <ul className={styles.list}>{saved.map(voice => voiceRow(voice))}</ul> : !bookmarks.loading && !bookmarks.error ? <p className="text-xs leading-5 text-muted">{selected && bookmarks.ids.has(selected.id) ? "Your selected voice is also bookmarked." : "Bookmark voices in Audio generation to see them here."}</p> : null}
      {unavailable && library.isSuccess ? <p className="text-xs text-muted">{unavailable} saved {unavailable === 1 ? "voice is" : "voices are"} currently unavailable.</p> : null}
    </section>
    <details className={styles.recordings}><summary>Choose saved audio <span>{recordings.length}</span></summary>
      {recordings.length ? <ul className={styles.list}>{recordings.map(asset => <li key={asset.id} className={styles.voiceRow}>
        <AudioLines size={17} className="shrink-0 text-muted" /><div className={styles.details}><strong>{asset.name}</strong><span>{asset.duration ? `${Math.round(asset.duration)}s · ` : ""}{asset.purpose === "generated" ? "Generated audio" : "Recording"}</span></div>
        <Button type="button" variant="outline" className={styles.useButton} disabled={busy} aria-label={`Choose saved audio ${asset.name}`} onClick={() => void attach(`/api/audio/assets/${asset.id}?forExplore=1`, asset.id, asset.name, false)}>{attaching === asset.id ? <LoaderCircle size={14} className="animate-spin" /> : null}Choose</Button>
      </li>)}</ul> : <p className="text-xs text-muted">No saved recordings available.</p>}
    </details>
    {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    <Link href="/audio-generation" className={styles.link}>Open voice library →</Link>
  </div>;
}
