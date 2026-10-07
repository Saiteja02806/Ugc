"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { subtitlePreview, subtitleStyleDefinition, type SubtitleStyle } from "@/worker/src/subtitles/styles";

/** One player; selection is a draft and never starts playback or finishing. */
export function WorkflowSubtitlePreview({ style }: { style: SubtitleStyle }) {
  return <ExamplePlayer key={style} style={style} />;
}
function ExamplePlayer({ style }: { style: SubtitleStyle }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "playing" | "paused" | "error">("idle");
  const { video, poster } = subtitlePreview(style), definition = subtitleStyleDefinition(style);
  useEffect(() => {
    const player = ref.current;
    // React can replay this effect after cleanup during development. Restore
    // the source without loading or playing it until the user presses Play.
    if (player && player.getAttribute("src") !== video) player.setAttribute("src", video);
    const stop = () => { if (document.hidden) player?.pause(); };
    document.addEventListener("visibilitychange", stop);
    const observer = new IntersectionObserver(entries => { if (!entries[0]?.isIntersecting) player?.pause(); });
    if (player) observer.observe(player);
    return () => { document.removeEventListener("visibilitychange", stop); observer.disconnect(); player?.pause(); if (player) { player.removeAttribute("src"); player.load(); } };
  }, [video]);
  async function play() {
    const player = ref.current;
    if (!player) return;
    setStatus("loading");
    try {
      if (status === "error") player.load();
      if (player.ended) player.currentTime = 0;
      await player.play();
    } catch { setStatus("error"); }
  }
  return <section aria-label={`${definition.label} example`} className="mt-3 rounded-xl border border-border bg-card p-3">
    <div className="space-y-3">
      <video ref={ref} src={video} poster={poster} preload="none" playsInline controls={status === "playing" || status === "paused"} aria-label={`${definition.label} subtitle example video`}
        className="mx-auto aspect-[9/16] w-full max-w-60 rounded-lg bg-black object-contain" onPlaying={() => setStatus("playing")} onPause={() => setStatus(previous => previous === "error" || previous === "idle" ? previous : "paused")}
        onEnded={() => setStatus("paused")} onError={() => setStatus("error")} />
      <div className="min-w-0 space-y-2">
        <p className="text-sm font-medium">{definition.label} example</p>
        <p className="text-xs leading-5 text-muted">{definition.description} This shared example shows the rendered result. Your captions follow your video’s speech.</p>
        <Button type="button" variant="outline" disabled={status === "loading"} onClick={() => status === "playing" ? ref.current?.pause() : void play()}>
          {status === "loading" ? "Loading…" : status === "error" ? "Retry example" : status === "playing" ? "Pause example" : "Play example"}
        </Button>
        <p role={status === "error" ? "alert" : "status"} className="text-xs text-muted">{status === "error" ? "The example could not load. Try again." : status === "loading" ? "Loading the selected example…" : "Examples play only when you press Play."}</p>
      </div>
    </div>
  </section>;
}
