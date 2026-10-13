"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Maximize, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { FormatVideoTextOverlay } from "@/components/explore/format-video-text-overlay";
import { Button } from "@/components/ui/button";
import styles from "@/components/explore/workflow-sequence-preview.module.css";
import { WorkflowCaptionOverlay, type SequenceCaptions } from "./workflow-caption-overlay";
import { createSequencePreviewTimeline, sequencePreviewAudioPosition, sequencePreviewOverlays, sequencePreviewPosition,
  sequencePreviewProjection, validateSequencePreviewAudio, type SequencePreviewAudio, type SequencePreviewSegment, type SequencePreviewTimeline } from "@/lib/explore/sequence-preview";

export type { SequencePreviewAudio, SequencePreviewSegment } from "@/lib/explore/sequence-preview";
type Props = { segments: readonly SequencePreviewSegment[]; backgroundAudio?: SequencePreviewAudio | null; active?: boolean;
  outputWidth?: number; outputHeight?: number; className?: string; onPlaybackStart?: () => void; playbackDisabledReason?: string | null; showDescription?: boolean; captions?: SequenceCaptions | null };
const stamp = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

/** Local playback never submits a render or changes publication readiness. */
export function WorkflowSequencePreview({ segments, backgroundAudio, active = true, outputWidth, outputHeight, className, onPlaybackStart, playbackDisabledReason, showDescription = true, captions }: Props) {
  let timeline: SequencePreviewTimeline;
  try { timeline = createSequencePreviewTimeline(segments); if (backgroundAudio) validateSequencePreviewAudio(backgroundAudio); }
  catch (error) { return <p role="alert" className="text-sm leading-6 text-destructive">{error instanceof Error ? error.message : "Choose your video again to preview it."}</p>; }
  const width = outputWidth ?? timeline.entries[0].width, height = outputHeight ?? timeline.entries[0].height;
  try { for (const entry of timeline.entries) sequencePreviewProjection(entry, entry.sourceStartMs, width, height); }
  catch (error) { return <p role="alert" className="text-sm leading-6 text-destructive">{error instanceof Error ? error.message : "Review your crop before previewing."}</p>; }
  // A changed draft gets a fresh paused session rather than continuing old media or timing.
  return <SequencePreviewSession key={JSON.stringify([segments, backgroundAudio, width, height, active])} timeline={timeline}
    backgroundAudio={backgroundAudio} active={active} width={width} height={height} className={className}
    onPlaybackStart={onPlaybackStart} playbackDisabledReason={playbackDisabledReason} showDescription={showDescription} captions={captions} />;
}

function SequencePreviewSession({ timeline, backgroundAudio, active, width, height, className, onPlaybackStart, playbackDisabledReason, showDescription, captions }: {
  timeline: SequencePreviewTimeline; backgroundAudio?: SequencePreviewAudio | null; active: boolean; width: number; height: number; className?: string;
  onPlaybackStart?: () => void; playbackDisabledReason?: string | null;
  showDescription?: boolean;
  captions?: SequenceCaptions | null;
}) {
  const videos = useRef<(HTMLVideoElement | null)[]>([]), layers = useRef<(HTMLDivElement | null)[]>([]);
  const addedAudio = useRef<(HTMLAudioElement | null)[]>([]), background = useRef<HTMLAudioElement | null>(null), surface = useRef<HTMLElement | null>(null);
  const referenceAudio = useRef<(HTMLAudioElement | null)[]>([]);
  const runtime = useRef({ index: 0, timeMs: 0, playing: false, buffering: false, epoch: 0, frame: 0, mounted: true, lastUi: -1000, overlayKey: "" });
  const [timeMs, setTimeMs] = useState(0), [playing, setPlaying] = useState(false), [waiting, setWaiting] = useState(false);
  const [muted, setMuted] = useState(false), [error, setError] = useState<string | null>(null);
  const position = sequencePreviewPosition(timeline, timeMs), visible = position.index;
  const mute = useRef(false);

  function pauseMedia() {
    runtime.current.playing = false; runtime.current.buffering = false; runtime.current.epoch++;
    cancelAnimationFrame(runtime.current.frame);
    for (const video of videos.current) video?.pause();
    for (const audio of addedAudio.current) audio?.pause();
    for (const audio of referenceAudio.current) audio?.pause();
    background.current?.pause();
  }
  function pause() { pauseMedia(); if (runtime.current.mounted) { setPlaying(false); setWaiting(false); } }
  function fail(message: string) { pause(); if (runtime.current.mounted) setError(message); }

  useEffect(() => {
    const current = runtime.current, players = videos.current, sounds = addedAudio.current, references = referenceAudio.current, music = background.current;
    current.mounted = true;
    const hidden = () => { if (document.hidden) pause(); };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      current.mounted = false; current.playing = false; current.epoch++; cancelAnimationFrame(current.frame);
      for (const player of players) player?.pause(); for (const sound of sounds) sound?.pause(); for (const sound of references) sound?.pause(); music?.pause();
      document.removeEventListener("visibilitychange", hidden);
    };
    // The keyed session owns an immutable draft. Changing the draft remounts it paused.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function syncSound(audio: HTMLAudioElement | null, track: SequencePreviewAudio | null | undefined, elapsed: number, target: number) {
    if (!audio || !track || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    if (audio.duration > 600) { fail("Choose preview audio up to 10 minutes long."); return; }
    const state = sequencePreviewAudioPosition(audio.duration * 1000, track.mixDurationMs ?? target, elapsed + (track.timelineOffsetMs ?? 0), track.playback);
    audio.volume = track.volume * state.gain; audio.muted = mute.current;
    if (!state.audible) { audio.pause(); return; }
    const seconds = state.positionMs / 1000;
    if (Math.abs(audio.currentTime - seconds) > .12) audio.currentTime = seconds;
    if (runtime.current.playing && !runtime.current.buffering && !videos.current[runtime.current.index]?.paused) {
      if (audio.paused) {
        const epoch = runtime.current.epoch;
        void audio.play().then(() => { if (epoch !== runtime.current.epoch || !runtime.current.playing) audio.pause(); })
          .catch(() => { if (epoch === runtime.current.epoch && runtime.current.mounted) fail("The selected audio could not play. Try again or choose another track."); });
      }
    } else audio.pause();
  }
  function draw(force = false) {
    const current = runtime.current, entry = timeline.entries[current.index], player = videos.current[current.index];
    if (!player) return;
    const elapsed = Math.max(0, Math.min(entry.durationMs, player.currentTime * 1000 - entry.sourceStartMs));
    current.timeMs = entry.startMs + elapsed;
    const style = sequencePreviewProjection(entry, player.currentTime * 1000, width, height), layer = layers.current[current.index];
    if (layer) { layer.style.left = `${style.left}%`; layer.style.top = `${style.top}%`; }
    player.volume = entry.editing?.originalVolume ?? 1; player.muted = mute.current;
    for (const [index, audio] of addedAudio.current.entries()) {
      if (index === current.index) syncSound(audio, entry.addedAudio, elapsed, entry.durationMs); else audio?.pause();
    }
    for (const [index, audio] of referenceAudio.current.entries()) {
      if (index === current.index) syncSound(audio, entry.referenceAudio, elapsed, entry.durationMs); else audio?.pause();
    }
    syncSound(background.current, backgroundAudio, current.timeMs, timeline.durationMs);
    const overlayKey = `${current.index}:${sequencePreviewOverlays(entry, elapsed).map(text => `${text.startMs}:${text.endMs}`).join(",")}`;
    if (force || current.timeMs - current.lastUi >= (captions ? 33 : 100) || current.overlayKey !== overlayKey) {
      current.lastUi = current.timeMs; current.overlayKey = overlayKey;
      if (current.mounted) setTimeMs(current.timeMs);
    }
  }
  async function playCurrent() {
    const current = runtime.current, player = videos.current[current.index];
    if (!active || playbackDisabledReason || !player || !current.mounted) return;
    const epoch = ++current.epoch;
    current.playing = true; current.buffering = false; setPlaying(true); setError(null);
    try {
      await player.play();
      if (epoch !== current.epoch || !current.playing || !active || !current.mounted) { player.pause(); return; }
      onPlaybackStart?.();
      draw(true); cancelAnimationFrame(current.frame); current.frame = requestAnimationFrame(tick);
    } catch {
      if (epoch === current.epoch && current.mounted) fail("This preview could not start. Try playing it again.");
    }
  }
  function finishSegment() {
    const current = runtime.current;
    if (!current.playing) return;
    videos.current[current.index]?.pause(); addedAudio.current[current.index]?.pause(); referenceAudio.current[current.index]?.pause();
    if (current.index + 1 >= timeline.entries.length) {
      pause(); current.timeMs = timeline.durationMs; setTimeMs(timeline.durationMs); return;
    }
    current.index++;
    const entry = timeline.entries[current.index], player = videos.current[current.index];
    current.timeMs = entry.startMs; setTimeMs(entry.startMs); current.lastUi = entry.startMs;
    if (player) player.currentTime = entry.sourceStartMs / 1000;
    void playCurrent();
  }
  function tick() {
    const current = runtime.current, player = videos.current[current.index], entry = timeline.entries[current.index];
    if (!current.mounted || !current.playing || !player) return;
    if (player.currentTime * 1000 >= entry.sourceEndMs - .5 || player.ended) { finishSegment(); return; }
    draw(); current.frame = requestAnimationFrame(tick);
  }
  function seek(nextMs: number) {
    const wasPlaying = runtime.current.playing;
    pauseMedia();
    const next = sequencePreviewPosition(timeline, nextMs);
    runtime.current.index = next.index; runtime.current.timeMs = next.timeMs; runtime.current.lastUi = next.timeMs;
    const player = videos.current[next.index];
    if (player) player.currentTime = next.sourceMs / 1000;
    setTimeMs(next.timeMs); draw(true);
    if (wasPlaying && !next.ended) void playCurrent(); else setPlaying(false);
  }
  function toggle() {
    if (runtime.current.playing) { pause(); return; }
    if (runtime.current.timeMs >= timeline.durationMs) seek(0);
    void playCurrent();
  }

  return <section ref={surface} data-sequence-preview className={`${styles.preview} ${className ?? ""}`} aria-label="Combined video preview" style={{ "--sequence-aspect": width / height } as CSSProperties}>
    <div className={styles.stage}>
      <div data-sequence-player className={styles.frame} aria-label={`${timeline.entries[visible].label} preview`}>
        {timeline.entries.map((entry, index) => {
          const projection = sequencePreviewProjection(entry, entry.sourceStartMs, width, height);
          const style: CSSProperties = { position: "absolute", left: `${projection.left}%`, top: `${projection.top}%`, width: `${projection.width}%`, height: `${projection.height}%` };
          return <div key={entry.id} ref={node => { layers.current[index] = node; }} hidden={visible !== index} style={style}>
            <video ref={node => { videos.current[index] = node; }} src={entry.url} preload="auto" playsInline aria-hidden="true" tabIndex={-1}
              className="size-full object-fill" onLoadedMetadata={event => {
                const player = event.currentTarget;
                if (!Number.isFinite(player.duration) || player.duration * 1000 + 50 < entry.sourceEndMs) { fail(`The ${entry.label.toLowerCase()} has changed. Choose it again to preview.`); return; }
                player.volume = entry.editing?.originalVolume ?? 1; player.muted = mute.current;
                player.currentTime = index === runtime.current.index ? sequencePreviewPosition(timeline, runtime.current.timeMs).sourceMs / 1000 : entry.sourceStartMs / 1000;
                if (index === runtime.current.index) draw(true);
              }} onSeeked={() => { if (index === runtime.current.index) draw(true); }}
              onWaiting={() => { if (index === runtime.current.index && runtime.current.playing) { runtime.current.buffering = true; setWaiting(true); background.current?.pause(); addedAudio.current[index]?.pause(); referenceAudio.current[index]?.pause(); } }}
              onPlaying={() => { if (index === runtime.current.index) { runtime.current.buffering = false; setWaiting(false); draw(true); } }}
              onPause={event => { if (index === runtime.current.index && runtime.current.playing && event.currentTarget.paused && !event.currentTarget.ended &&
                event.currentTarget.currentTime * 1000 < entry.sourceEndMs - .5) pause(); }}
              onEnded={() => { if (index === runtime.current.index) finishSegment(); }}
              onError={() => fail(`The ${entry.label.toLowerCase()} preview is unavailable. Choose this clip again.`)} />
            {index === visible ? sequencePreviewOverlays(entry, position.localMs).map((text, overlayIndex) =>
              <FormatVideoTextOverlay key={overlayIndex} label={`${entry.label} text overlay ${overlayIndex + 1}`} text={text} width={entry.width} height={entry.height} />) : null}
          </div>;
        })}
        {captions && Math.abs(captions.transcript.durationMs - timeline.durationMs) <= 150 ? <WorkflowCaptionOverlay captions={captions} timeMs={timeMs} width={width} height={height} /> : null}
        {waiting && active ? <div role="status" className="absolute inset-0 grid place-items-center bg-black/30 text-sm text-white">Loading next frame…</div> : null}
      </div>
    </div>
    <div className={styles.controls}>
      <Button type="button" variant="ghost" size="icon-sm" aria-label={playing && active ? "Pause combined preview" : "Play combined preview"} disabled={!active || !!playbackDisabledReason} onClick={toggle}>{playing && active ? <Pause className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}</Button>
      <input type="range" min={0} max={timeline.durationMs} step={50} value={timeMs} disabled={!active} aria-label="Combined preview position"
        aria-valuetext={`${stamp(timeMs)} of ${stamp(timeline.durationMs)}, ${timeline.entries[visible].label}`} className="min-w-0 flex-1 accent-primary" onChange={event => seek(Number(event.target.value))} />
      <span className="whitespace-nowrap text-xs tabular-nums text-muted">{stamp(timeMs)} / {stamp(timeline.durationMs)}</span>
      <Button type="button" variant="ghost" size="icon-sm" aria-label={muted ? "Unmute combined preview" : "Mute combined preview"} aria-pressed={muted} onClick={() => {
        mute.current = !mute.current; setMuted(mute.current); draw(true);
      }}>{muted ? <VolumeX className="size-4" aria-hidden="true" /> : <Volume2 className="size-4" aria-hidden="true" />}</Button>
      <Button type="button" variant="ghost" size="icon-sm" aria-label="View combined preview fullscreen" onClick={() => {
        const target = surface.current;
        if (target?.requestFullscreen) void target.requestFullscreen().catch(() => setError("Fullscreen is unavailable in this browser."));
      }}><Maximize className="size-4" aria-hidden="true" /></Button>
    </div>
    {showDescription ? <p className="text-center text-xs leading-5 text-muted">Preview · {timeline.entries.map(entry => entry.label).join(" → ")}. Your publishing file prepares separately.</p> : null}
    {playbackDisabledReason ? <p role="status" className="text-center text-xs leading-5 text-muted">{playbackDisabledReason}</p> : null}
    {error ? <div role="alert" className="text-sm leading-6 text-destructive">{error} <Button type="button" variant="ghost" size="sm" onClick={() => {
      for (const player of videos.current) player?.load(); for (const sound of addedAudio.current) sound?.load(); for (const sound of referenceAudio.current) sound?.load(); background.current?.load();
      setError(null); seek(0);
    }}>Retry preview</Button></div> : null}
    {backgroundAudio ? <audio ref={background} src={backgroundAudio.url} preload="auto" loop={backgroundAudio.playback === "repeat"} aria-label="Combined background audio"
      onLoadedMetadata={() => draw(true)} onError={() => fail("Your background audio preview is unavailable. Choose another track.")} /> : null}
    {timeline.entries.map((entry, index) => entry.addedAudio ? <audio key={entry.id} ref={node => { addedAudio.current[index] = node; }} src={entry.addedAudio.url}
      preload="auto" loop={entry.addedAudio.playback === "repeat"} aria-label={`${entry.label} added audio`} onLoadedMetadata={() => draw(true)}
      onError={() => fail(`The added audio for ${entry.label.toLowerCase()} could not load. Choose another track.`)} /> : null)}
    {timeline.entries.map((entry, index) => entry.referenceAudio ? <audio key={entry.id} ref={node => { referenceAudio.current[index] = node; }} src={entry.referenceAudio.url}
      preload="auto" loop={entry.referenceAudio.playback === "repeat"} aria-label={`${entry.label} reference audio`} onLoadedMetadata={() => draw(true)}
      onError={() => fail(`The reference audio for ${entry.label.toLowerCase()} could not load. Choose this clip again.`)} /> : null)}
  </section>;
}
