"use client";
import { useEffect, useRef } from "react";

/** Route prefetch has priority; decorative video loads only on sustained interest. */
export function useCoverPlayback(source: string | null, target: "a" | "button" = "a", playWhenVisible = false) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video || !source) return;
    const link = video.closest<HTMLElement>(target);
    if (!link) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    let interested = playWhenVisible;
    let startTimer: ReturnType<typeof setTimeout> | null = null;
    const stop = () => {
      if (startTimer !== null) { clearTimeout(startTimer); startTimer = null; }
      video.pause();
      if (video.hasAttribute("src")) { video.removeAttribute("src"); video.load(); }
    };
    const sync = () => {
      if (!interested || !visible || preference.matches || document.visibilityState === "hidden") { stop(); return; }
      if (video.hasAttribute("src") || startTimer !== null) return;
      startTimer = setTimeout(() => {
        startTimer = null;
        if (!interested || !visible || preference.matches || document.visibilityState === "hidden") return;
        video.src = source;
        void video.play().catch(() => {});
      }, 250);
    };
    const enter = (event: PointerEvent) => { if (event.pointerType === "touch") return; interested = true; sync(); };
    const focus = () => { interested = true; sync(); };
    const leave = () => { interested = playWhenVisible; if (!playWhenVisible) stop(); };
    const ready = () => { if (interested && visible && !preference.matches && document.visibilityState !== "hidden") void video.play().catch(() => {}); };
    const observer = new IntersectionObserver(entries => { visible = entries.some(entry => entry.isIntersecting); sync(); }, { rootMargin: playWhenVisible ? "0px" : "80px" });
    observer.observe(video);
    link.addEventListener("pointerenter", enter); link.addEventListener("pointerleave", leave);
    link.addEventListener("focus", focus); link.addEventListener("blur", leave);
    link.addEventListener("pointerdown", leave); link.addEventListener("click", leave);
    preference.addEventListener("change", sync); document.addEventListener("visibilitychange", sync);
    video.addEventListener("canplay", ready);
    return () => {
      observer.disconnect(); stop();
      link.removeEventListener("pointerenter", enter); link.removeEventListener("pointerleave", leave);
      link.removeEventListener("focus", focus); link.removeEventListener("blur", leave);
      link.removeEventListener("pointerdown", leave); link.removeEventListener("click", leave);
      preference.removeEventListener("change", sync); document.removeEventListener("visibilitychange", sync); video.removeEventListener("canplay", ready);
    };
  }, [source, target, playWhenVisible]);
  return ref;
}
