"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Music2, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import styles from "./music-choice-preview.module.css";

/** Interactive design review only. Nothing here is saved or sent to generation. */
export function MusicChoicePreview({ referenceTitle }: { referenceTitle: string }) {
  const [choice, setChoice] = useState<"reference" | "sample" | "none">("reference");
  const [open, setOpen] = useState(false), [library, setLibrary] = useState(false), [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const label = choice === "none" ? "No background music" : choice === "sample" ? "Sample alternative track" : `Reference audio · ${referenceTitle}`;
  function stop() { audio.current?.pause(); setPlaying(false); }
  function select(next: typeof choice) { stop(); setChoice(next); setOpen(false); setLibrary(false); setError(null); }
  useEffect(() => () => { audio.current?.pause(); }, []);
  async function play() {
    if (playing) { stop(); return; }
    setError(null);
    try { await audio.current?.play(); setPlaying(true); }
    catch { setError("Audio preview could not load."); }
  }
  return <section className={styles.music} aria-label="Background music">
    <p className={styles.label}>Background music</p>
    <div className={styles.row}>
      <Button type="button" variant="ghost" size="icon-sm" className={styles.play} disabled={choice === "none"} aria-label={playing ? "Pause background music" : "Preview background music"} onClick={() => void play()}>
        {playing ? <Pause className="size-3.5" aria-hidden="true" /> : <Play className="size-3.5" aria-hidden="true" />}
      </Button>
      <span className={styles.track} title={label}>{label}</span>
      <Popover open={open} onOpenChange={value => { stop(); setOpen(value); if (!value) setLibrary(false); }}>
        <PopoverTrigger render={<Button type="button" variant="ghost" size="sm" className={styles.change} aria-label="Change background music" />}>Change</PopoverTrigger>
        <PopoverContent align="start" className={styles.panel}>
          <PopoverTitle>{library ? "Choose another track" : "Background music"}</PopoverTitle>
          {library ? <>
            <Button type="button" variant="ghost" size="sm" className={styles.back} onClick={() => setLibrary(false)}><ArrowLeft className="size-3.5" aria-hidden="true" />Back</Button>
            <p className={styles.hint}>Layout preview · example track</p>
            <button type="button" className={styles.option} onClick={() => select("sample")}><Music2 className="size-4" aria-hidden="true" /><span>Sample alternative track<small>Choose from the audio library</small></span></button>
            <Button type="button" variant="outline" disabled>Upload audio</Button>
          </> : <div role="group" aria-label="Music choices">
            <button type="button" className={styles.option} aria-pressed={choice === "reference"} onClick={() => select("reference")}><span>Reference audio<small>Same music as {referenceTitle}</small></span>{choice === "reference" ? <Check className="size-4" aria-hidden="true" /> : null}</button>
            <button type="button" className={styles.option} onClick={() => setLibrary(true)}><span>Choose another track<small>Audio library or upload</small></span></button>
            <button type="button" className={styles.option} aria-pressed={choice === "none"} onClick={() => select("none")}><span>No background music<small>Keep speech and demo audio</small></span>{choice === "none" ? <Check className="size-4" aria-hidden="true" /> : null}</button>
          </div>}
        </PopoverContent>
      </Popover>
    </div>
    {error ? <p role="alert" className={styles.hint}>{error}</p> : null}
    <audio ref={audio} src="/e2e/explore-format-preview/music-audio" preload="none" onEnded={() => setPlaying(false)} />
  </section>;
}
