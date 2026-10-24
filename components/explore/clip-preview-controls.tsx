"use client";

import { useEffect, useState, type RefObject } from "react";
import { Maximize, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import styles from "./clip-preview-controls.module.css";

/** The playhead describes the selected clip, rather than the full source file. */
export function ClipPreviewControls({ player, timeMs, startMs, endMs, onSeek, onMute }: {
  player: RefObject<HTMLVideoElement | null>;
  timeMs: number; startMs: number; endMs: number; onSeek: (timeMs: number) => void;
  onMute: (muted: boolean) => void;
}) {
  const [playing, setPlaying] = useState(false), [muted, setMuted] = useState(false), [error, setError] = useState<string | null>(null);
  const length = Math.max(0, endMs - startMs);
  useEffect(() => {
    const video = player.current;
    if (!video) return;
    const play = () => setPlaying(true), pause = () => setPlaying(false);
    video.addEventListener("play", play); video.addEventListener("pause", pause);
    return () => { video.removeEventListener("play", play); video.removeEventListener("pause", pause); };
  }, [player]);
  function toggle() {
    const video = player.current;
    if (!video) return;
    setError(null);
    if (!video.paused) { video.pause(); return; }
    if (video.currentTime * 1000 < startMs || video.currentTime * 1000 >= endMs - 50) onSeek(0);
    void video.play().catch(() => setError("This preview could not play. Try again."));
  }
  function mute() {
    const next = !muted;
    onMute(next);
    setMuted(next);
  }
  function fullscreen() {
    const surface = player.current?.closest?.("section") ?? player.current?.parentElement;
    if (!surface?.requestFullscreen) { setError("Fullscreen is unavailable in this browser."); return; }
    void surface.requestFullscreen().catch(() => setError("Fullscreen is unavailable in this browser."));
  }
  return <>
    <div className={styles.controls} role="group" aria-label="Clip preview playback">
      <Button type="button" variant="ghost" size="icon-sm" aria-label={playing ? "Pause preview" : "Play preview"} onClick={toggle}>{playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}</Button>
      <input type="range" aria-label="Preview playback position" min={0} max={length} step={10} value={Math.max(0, Math.min(timeMs, length))} onChange={event => onSeek(Math.min(Number(event.target.value), Math.max(0, length - 50)))} />
      <span>{(Math.max(0, Math.min(timeMs, length)) / 1000).toFixed(1)} / {(length / 1000).toFixed(1)}s</span>
      <Button type="button" variant="ghost" size="icon-sm" aria-label={muted ? "Unmute preview" : "Mute preview"} onClick={mute}>{muted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}</Button>
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Fullscreen preview" onClick={fullscreen}><Maximize aria-hidden="true" /></Button>
    </div>
    {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
  </>;
}
