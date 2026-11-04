"use client";

import { useQuery } from "@tanstack/react-query";
import { AudioLines, Bookmark, Check, LoaderCircle, Pause, Play, RefreshCw, Sparkles } from "lucide-react";
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

const CURATED_FAST_VOICES: AudioVoice[] = [
  {
    id: "21m00Tcm4TlvDq8ikWAM",
    name: "Anna",
    category: "premade",
    labels: { accent: "American", gender: "Female", age: "young", use_case: "conversational" },
    description: "Conversational female voice",
    private: false,
    available: true,
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/21m00Tcm4TlvDq8ikWAM/df6788f9-1965-4720-94f6-7b447814b628.mp3",
  },
  {
    id: "TxGEqnHWrfWFTfGW9XjX",
    name: "Josh",
    category: "premade",
    labels: { accent: "American", gender: "Male", age: "young", use_case: "founder" },
    description: "Energetic founder voice",
    private: false,
    available: true,
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/TxGEqnHWrfWFTfGW9XjX/3a34a179-883a-4424-ab04-f655b3bc919b.mp3",
  },
  {
    id: "EXAVITQu4vr4xnSDxMaL",
    name: "Chloe",
    category: "premade",
    labels: { accent: "American", gender: "Female", age: "young", use_case: "ugc creator" },
    description: "Authentic UGC creator voice",
    private: false,
    available: true,
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/EXAVITQu4vr4xnSDxMaL/0152fdf5-94f1-4ae4-b374-90d160432740.mp3",
  },
  {
    id: "VR6AewLTigWG4xSOukaG",
    name: "Kobbie",
    category: "premade",
    labels: { accent: "British", gender: "Male", age: "middle aged", use_case: "storyteller" },
    description: "Deep narrative storyteller voice",
    private: false,
    available: true,
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/VR6AewLTigWG4xSOukaG/66e83dc2-6543-4897-9283-e18e3a890479.mp3",
  },
  {
    id: "pNInz6obpgDQGcFmaJgB",
    name: "Wilder",
    category: "premade",
    labels: { accent: "American", gender: "Male", age: "middle aged", use_case: "authority" },
    description: "Confident authoritative voice",
    private: false,
    available: true,
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/pNInz6obpgDQGcFmaJgB/67341770-466d-473d-82d2-282136e05367.mp3",
  },
];

export function WorkflowSavedAudioChoices({ ownerId, audio, onVoiceReference, minDuration = 0, maxDuration = 30 }: { ownerId: string; audio: WorkflowAttachment; onVoiceReference: () => void; minDuration?: number; maxDuration?: number }) {
  const { user, loading } = useAuth();
  if (loading) return <p role="status" className="text-xs text-muted">Loading your saved voices…</p>;
  if (!user) return <p className="text-xs text-muted">Sign in to see your saved voices and recordings.</p>;
  if (user.uid !== ownerId) return <p role="status" className="text-xs text-muted">Loading your saved voices…</p>;
  return <SavedAudioSession key={user.uid} uid={user.uid} audio={audio} minDuration={minDuration} maxDuration={maxDuration} onVoiceReference={onVoiceReference} />;
}

function SavedAudioSession({ uid, audio, onVoiceReference, minDuration, maxDuration }: { uid: string; audio: WorkflowAttachment; onVoiceReference: () => void; minDuration: number; maxDuration: number }) {
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
  const recordings = library.data?.assets.filter(asset => asset.status === "ready" && !asset.testOnly && (asset.purpose === "generated" || asset.purpose === "exact") && (asset.duration === null || asset.duration <= maxDuration)) ?? [];

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
      const accepted = await audio.chooseRemote(async () => {
        const response = await createAudioFetch(uid)(path, { signal: controller.signal });
        if (Number(response.headers.get("Content-Length")) > 12 * 1024 * 1024) throw new Error("This recording is too large for an audio reference.");
        const blob = await response.blob();
        if (!blob.size || blob.size > 12 * 1024 * 1024 || !blob.type.startsWith("audio/")) throw new Error(`Choose a complete audio recording up to ${maxDuration} seconds.`);
        const extension = blob.type.includes("wav") ? "wav" : blob.type.includes("mp4") || blob.type.includes("m4a") ? "m4a" : blob.type.includes("ogg") ? "ogg" : blob.type.includes("webm") ? "webm" : "mp3";
        return new File([blob], `${name}.${extension}`, { type: blob.type });
      }, { minDuration, maxDuration, signal: controller.signal });
      if (accepted && !controller.signal.aborted && voice) onVoiceReference();
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
      <div className={styles.details}>
        <div className={styles.voiceTitle}>
          <strong title={voice.name}>{voice.name}</strong>
          <span className={styles.soundwaveBars} data-playing={playing === voice.id ? "true" : undefined} aria-hidden="true">
            <span /><span /><span /><span />
          </span>
        </div>
        <div className={styles.voiceMeta}>
          {voice.labels.gender ? <span className={styles.tagPill}>{voice.labels.gender}</span> : null}
          <span>{voice.labels.accent || voice.labels.use_case || "Voice sample"}{chosen ? " · Selected with Use It" : ""}</span>
        </div>
      </div>
      <Button type="button" variant="outline" disabled={!voice.previewUrl || !library.data?.account?.paid || busy} title={library.data?.account?.paid ? "Attach this voice sample as a reference" : "This voice is currently available for preview only"} aria-label={`Use ${voice.name} sample as voice reference`} className={styles.useButton} onClick={() => void attach(`/api/audio/voices/${encodeURIComponent(voice.id)}/sample`, voice.id, `${voice.name} voice sample`, true)}>
        {attaching === voice.id ? <LoaderCircle size={14} className="animate-spin" /> : chosen ? <Check size={14} /> : null}Use sample
      </Button>
    </li>;
  }
  return <div className={styles.library} aria-label="Saved audio choices">
    {library.isPending ? <p role="status" className="text-xs text-muted">Loading your voices and audio…</p> : null}
    {loadError ? <p role="alert" className={styles.error}>{loadError}<button type="button" onClick={refresh}><RefreshCw size={13} />Retry saved choices</button></p> : null}
    {library.isSuccess && !library.data?.account?.paid ? <div role="status" className={styles.availability}>
      <p>{library.data?.account
        ? "These samples are preview-only on the connected voice service. You can listen, upload your own audio, or choose a saved recording."
        : "Voice sample selection is unavailable because the voice service is not connected or its account details could not be loaded. You can still listen, upload audio, or choose a saved recording."}</p>
      <button type="button" disabled={library.isFetching} onClick={refresh}><RefreshCw size={13} />{library.isFetching ? "Checking voice service…" : "Retry voice service"}</button>
    </div> : null}
    {selected ? <section aria-label="Selected voice"><h4 className={styles.heading}><AudioLines size={14} />Your selected voice</h4><ul className={styles.list}>{voiceRow(selected, true)}</ul></section> : null}
    <section aria-label="Bookmarked voices"><h4 className={styles.heading}><Bookmark size={14} />Bookmarked voices</h4>
      {saved.length ? (
        <ul className={styles.list}>{saved.map(voice => voiceRow(voice))}</ul>
      ) : !bookmarks.loading && !bookmarks.error ? (
        <>
          <p className="text-xs leading-5 text-muted">{selected && bookmarks.ids.has(selected.id) ? "Your selected voice is also bookmarked." : "Bookmark voices in Audio generation, or pick from popular creator voices below:"}</p>
          <ul className={styles.list} aria-label="Curated creator voices">
            {CURATED_FAST_VOICES.filter(v => v.id !== selected?.id).map(voice => voiceRow(voice))}
          </ul>
        </>
      ) : null}
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
