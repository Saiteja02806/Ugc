"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AudioLines,
  Bookmark,
  Check,
  Pause,
  Play,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { BlocksSpinner } from "@/components/ui/blocks-spinner";

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

/** The default sample voices guests and the audio popover offer. Names and URLs come from the provider's
 *  public premade catalogue (verified 13 November 2026); durations are 2.5–4.1s, so sample attachment uses
 *  the provider's 2-second floor instead of the 5-second upload minimum. */
export const CURATED_FAST_VOICES: AudioVoice[] = [
  {
    id: "EXAVITQu4vr4xnSDxMaL",
    name: "Sarah",
    category: "premade",
    labels: { accent: "American", gender: "Female", age: "young", use_case: "conversational" },
    description: "Mature, reassuring, confident",
    private: false,
    available: true,
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/EXAVITQu4vr4xnSDxMaL/01a3e33c-6e99-4ee7-8543-ff2216a32186.mp3",
  },
  {
    id: "cgSgspJ2msm6clMCkdW9",
    name: "Jessica",
    category: "premade",
    labels: { accent: "American", gender: "Female", age: "young", use_case: "conversational" },
    description: "Playful, bright, warm",
    private: false,
    available: true,
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/cgSgspJ2msm6clMCkdW9/56a97bf8-b69b-448f-846c-c3a11683d45a.mp3",
  },
  {
    id: "iP95p4xoKVk53GoZ742B",
    name: "Chris",
    category: "premade",
    labels: { accent: "American", gender: "Male", age: "middle aged", use_case: "conversational" },
    description: "Charming, down-to-earth",
    private: false,
    available: true,
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/iP95p4xoKVk53GoZ742B/3f4bde72-cc48-40dd-829f-57fbf906f4d7.mp3",
  },
  {
    id: "TX3LPaxmHKxFdv7VOQHJ",
    name: "Liam",
    category: "premade",
    labels: { accent: "American", gender: "Male", age: "young", use_case: "social media" },
    description: "Energetic social media creator",
    private: false,
    available: true,
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/TX3LPaxmHKxFdv7VOQHJ/63148076-6363-42db-aea8-31424308b92c.mp3",
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
  // Prefer the live provider catalogue so the samples stay current; the static list only covers outages.
  const bookmarked = new Set(bookmarks.ids);
  const catalogueSamples = voices.filter(voice => voice.category === "premade" && voice.previewUrl && voice.id !== selected?.id && !bookmarked.has(voice.id)).slice(0, 4);
  const defaultSamples = catalogueSamples.length >= 4 ? catalogueSamples : CURATED_FAST_VOICES.filter(voice => voice.id !== selected?.id);
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
      }, { minDuration: voice ? Math.min(minDuration, 2) : minDuration, maxDuration, signal: controller.signal });
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
      <Button type="button" variant="outline" disabled={!voice.previewUrl || busy} title="Attach this voice sample as a reference" aria-label={`Use ${voice.name} sample as voice reference`} className={styles.useButton} onClick={() => void attach(`/api/audio/voices/${encodeURIComponent(voice.id)}/sample`, voice.id, `${voice.name} voice sample`, true)}>
        {attaching === voice.id ? <BlocksSpinner size={14}  /> : chosen ? <Check size={14} /> : null}Use sample
      </Button>
    </li>;
  }
  return <div className={styles.library} aria-label="Saved audio choices">
    {library.isPending ? <p role="status" className="text-xs text-muted">Loading your voices and audio…</p> : null}
    {loadError ? <p role="alert" className={styles.error}>{loadError}<button type="button" onClick={refresh}><RefreshCw size={13} />Retry saved choices</button></p> : null}
    {selected ? <section aria-label="Selected voice"><h4 className={styles.heading}><AudioLines size={14} />Your selected voice</h4><ul className={styles.list}>{voiceRow(selected, true)}</ul></section> : null}
    <section aria-label="Bookmarked voices"><h4 className={styles.heading}><Bookmark size={14} />Bookmarked voices</h4>
      {saved.length ? (
        <ul className={styles.list}>{saved.map(voice => voiceRow(voice))}</ul>
      ) : !bookmarks.loading && !bookmarks.error ? (
        <>
          <p className="text-xs leading-5 text-muted">{selected && bookmarks.ids.has(selected.id) ? "Your selected voice is also bookmarked." : "Bookmark voices in Audio generation, or pick from the default sample voices below:"}</p>
          <ul className={styles.list} aria-label="Default sample voices">
            {defaultSamples.map(voice => voiceRow(voice))}
          </ul>
        </>
      ) : null}
      {unavailable && library.isSuccess ? <p className="text-xs text-muted">{unavailable} saved {unavailable === 1 ? "voice is" : "voices are"} currently unavailable.</p> : null}
    </section>
    <details className={styles.recordings}><summary>Choose saved audio <span>{recordings.length}</span></summary>
      {recordings.length ? <ul className={styles.list}>{recordings.map(asset => <li key={asset.id} className={styles.voiceRow}>
        <AudioLines size={17} className="shrink-0 text-muted" /><div className={styles.details}><strong>{asset.name}</strong><span>{asset.duration ? `${Math.round(asset.duration)}s · ` : ""}{asset.purpose === "generated" ? "Generated audio" : "Recording"}</span></div>
        <Button type="button" variant="outline" className={styles.useButton} disabled={busy} aria-label={`Choose saved audio ${asset.name}`} onClick={() => void attach(`/api/audio/assets/${asset.id}?forExplore=1`, asset.id, asset.name, false)}>{attaching === asset.id ? <BlocksSpinner size={14}  /> : null}Choose</Button>
      </li>)}</ul> : <p className="text-xs text-muted">No saved recordings available.</p>}
    </details>
    {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    <Link href="/audio-generation" className={styles.link}>Open voice library →</Link>
  </div>;
}
