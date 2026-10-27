"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type NetworkInformation = EventTarget & { saveData?: boolean };

export function LandingPreviewVideo({ src, poster, title, desktopOnly = false, autoPlay = true, playbackAllowed = true }: {
  src: string;
  poster: string;
  title: string;
  desktopOnly?: boolean;
  autoPlay?: boolean;
  playbackAllowed?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [environment, setEnvironment] = useState({ visible: false, foreground: false,
    online: false, desktop: false, automatic: false });
  const [playRequest, setPlayRequest] = useState(0);
  const [paused, setPaused] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const desktop = window.matchMedia("(min-width: 1024px)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
    let visible = false;
    const update = () => setEnvironment({ visible, foreground: document.visibilityState !== "hidden",
      online: navigator.onLine, desktop: desktop.matches,
      automatic: !reducedMotion.matches && !connection?.saveData });
    const measure = () => {
      const rect = element.getBoundingClientRect();
      visible = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
      update();
    };
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= 0.1);
      update();
    }, { threshold: [0, 0.1] });
    observer?.observe(element);
    if (!observer) { measure(); window.addEventListener("scroll", measure, { passive: true }); }
    document.addEventListener("visibilitychange", update);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    desktop.addEventListener("change", update);
    reducedMotion.addEventListener("change", update);
    connection?.addEventListener("change", update);
    window.addEventListener("resize", measure);
    update();
    const delay = window.setTimeout(() => setReady(true), 750);
    return () => {
      clearTimeout(delay); observer?.disconnect();
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      desktop.removeEventListener("change", update);
      reducedMotion.removeEventListener("change", update);
      connection?.removeEventListener("change", update);
    };
  }, []);

  const shouldLoad = playbackAllowed && ready && environment.visible && environment.foreground && environment.online
    && (!desktopOnly || environment.desktop) && !paused
    && ((autoPlay && environment.automatic) || playRequest > 0);
  // Removing a source can cancel the browser's queued pause event. The control
  // must still immediately offer Play when this preview has been released.
  const isPlaying = shouldLoad && playing;

  useEffect(() => {
    const element = video.current;
    if (!element || !shouldLoad) return;
    let cancelled = false;
    // Own the source lifecycle so hidden/offscreen previews release downloads
    // and decoders. Content-hashed URLs let repeat playback reuse the cache.
    element.src = src;
    element.load();
    void element.play().catch(() => { if (!cancelled) setPlaying(false); });
    return () => {
      cancelled = true;
      element.pause();
      element.removeAttribute("src");
      element.load();
    };
  }, [shouldLoad, src, playRequest]);

  return (
    <div ref={container} className="relative size-full" data-landing-preview>
      <video ref={video} muted loop playsInline poster={poster} preload="none"
        aria-label={title} className="size-full object-cover"
        onPlaying={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onError={() => setPlaying(false)} />
      <button type="button" disabled={!playbackAllowed} aria-label={`${isPlaying ? "Pause" : "Play"} ${title}`}
        onClick={() => {
          if (isPlaying) setPaused(true);
          else { setPaused(false); setPlayRequest(value => value + 1); }
        }}
        className="absolute bottom-3 right-3 z-20 flex size-9 items-center justify-center rounded-full border border-white/25 bg-black/65 text-white opacity-0 backdrop-blur-md transition-[background-color,opacity] hover:bg-black/85 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white group-hover:opacity-100 group-focus-within:opacity-100 disabled:hidden">
        {isPlaying ? <Pause className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
      </button>
    </div>
  );
}
