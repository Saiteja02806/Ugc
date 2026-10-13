"use client";
import { useEffect, useRef } from "react";

/** Attach cover bytes only when visible and pause background/offscreen motion. */
export function useCoverPlayback(source: string | null) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video || !source) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    const sync = () => {
      if (!visible || preference.matches || document.visibilityState === "hidden") { video.pause(); return; }
      if (video.getAttribute("src") !== source) video.src = source;
      void video.play().catch(() => {});
    };
    const observer = new IntersectionObserver(entries => { visible = entries.some(entry => entry.isIntersecting); sync(); }, { rootMargin: "80px" });
    observer.observe(video);
    preference.addEventListener("change", sync); document.addEventListener("visibilitychange", sync);
    video.addEventListener("canplay", sync);
    return () => { observer.disconnect(); preference.removeEventListener("change", sync); document.removeEventListener("visibilitychange", sync); video.removeEventListener("canplay", sync); video.pause(); };
  }, [source]);
  return ref;
}
