"use client";
import { useEffect, useRef } from "react";

/** How often a continuously playing cover is checked for frozen playback. */
export const COVER_WATCHDOG_MS = 4_000;
/** A source still not playable this long after assignment counts as stalled. */
export const COVER_STALL_GRACE_MS = 4_000;
/** Source reloads allowed before waiting for the next return/focus/hover. */
export const COVER_MAX_RELOADS = 3;
const HAVE_FUTURE_DATA = 3;

/** Visible landing covers buffer once; galleries load only on sustained interest.
 * Continuous covers play while they are on screen and do not pause when the pointer leaves.
 * Playback that errors, stalls or silently freezes (for example after the tab sits idle)
 * recovers in place with a bounded number of source reloads. It never refreshes the page. */
export function useCoverPlayback(source: string | null, target: "a" | "button" = "a", warmCover = false, continuous = false) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video || !source) return;
    const link = video.closest<HTMLElement>(target);
    if (!link) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    // An authenticated private source can resolve after pointerenter. Preserve
    // the current hover/focus when its blob URL becomes available.
    let interested = link.matches(":hover") || document.activeElement === link;
    let startTimer: ReturnType<typeof setTimeout> | null = null;
    let watchdog: ReturnType<typeof setInterval> | null = null;
    let assignedAt = 0, lastTime = -1, frozenChecks = 0, reloads = 0;
    const play = () => { void video.play().catch(() => {}); };
    const assign = () => { assignedAt = Date.now(); video.src = source; };
    const allowed = () => visible && !preference.matches && document.visibilityState !== "hidden";
    const wanted = () => (continuous || interested) && allowed() && video.hasAttribute("src");
    const stopWatchdog = () => {
      if (watchdog !== null) { clearInterval(watchdog); watchdog = null; }
      lastTime = -1; frozenChecks = 0;
    };
    const stop = (release = true) => {
      if (startTimer !== null) { clearTimeout(startTimer); startTimer = null; }
      stopWatchdog();
      video.pause();
      if (release && video.hasAttribute("src")) { video.removeAttribute("src"); video.load(); reloads = 0; }
    };
    // Re-request the same URL (HTTP cache still applies) on a fresh media pipeline.
    const reload = () => {
      if (reloads >= COVER_MAX_RELOADS) return;
      reloads++; lastTime = -1; frozenChecks = 0;
      video.removeAttribute("src"); video.load(); assign(); play();
    };
    const stalled = () => Boolean(video.error) || (video.readyState < HAVE_FUTURE_DATA && Date.now() - assignedAt > COVER_STALL_GRACE_MS);
    // Continuous covers only: detect a cover that claims to play but whose time stopped moving.
    const check = () => {
      if (!wanted()) return;
      if (video.error) { reload(); return; }
      if (video.paused) {
        lastTime = -1;
        frozenChecks = 0;
        if (stalled()) reload();
        else play();
        return;
      }
      if (video.currentTime !== lastTime) { lastTime = video.currentTime; frozenChecks = 0; return; }
      if (++frozenChecks >= 2) reload();
    };
    const startWatchdog = () => { if (continuous && watchdog === null) watchdog = setInterval(check, COVER_WATCHDOG_MS); };
    const sync = () => {
      if (!allowed()) { stop(); return; }
      if (continuous || warmCover) {
        if (!video.hasAttribute("src")) {
          const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
          video.preload = connection?.saveData ? "metadata" : "auto"; assign();
        }
        if (continuous || interested) { play(); startWatchdog(); }
        return;
      }
      if (!interested) { stop(); return; }
      if (video.hasAttribute("src") || startTimer !== null) return;
      startTimer = setTimeout(() => {
        startTimer = null;
        if (!interested || !allowed()) return;
        assign();
        play();
      }, 250);
    };
    // Return to the page, regained focus, reconnect or hover: restart a stalled cover now.
    const recover = () => {
      if (!allowed()) return;
      if (!video.hasAttribute("src")) { sync(); return; }
      if (!(continuous || interested)) return;
      if (stalled()) { reload(); return; }
      lastTime = -1; frozenChecks = 0;
      if (video.paused) play();
    };
    const resume = () => { reloads = 0; recover(); };
    const enter = (event: PointerEvent) => { if (event.pointerType === "touch") return; interested = true; sync(); if (continuous) resume(); };
    const focus = () => { interested = true; sync(); };
    const leave = () => { if (continuous) return; interested = false; stop(!warmCover); };
    const ready = () => { if ((continuous || interested) && allowed()) play(); };
    const playing = () => { reloads = 0; frozenChecks = 0; };
    const failed = () => { if (wanted()) reload(); };
    const observer = new IntersectionObserver(entries => { visible = entries.some(entry => entry.isIntersecting); sync(); }, { rootMargin: "0px" });
    observer.observe(video);
    link.addEventListener("pointerenter", enter); link.addEventListener("pointerleave", leave);
    link.addEventListener("focus", focus); link.addEventListener("blur", leave);
    link.addEventListener("pointerdown", leave); link.addEventListener("click", leave);
    preference.addEventListener("change", sync); document.addEventListener("visibilitychange", sync);
    document.addEventListener("resume", resume);
    window.addEventListener("focus", resume); window.addEventListener("pageshow", resume); window.addEventListener("online", resume);
    video.addEventListener("canplay", ready); video.addEventListener("playing", playing); video.addEventListener("error", failed);
    return () => {
      observer.disconnect(); stop();
      link.removeEventListener("pointerenter", enter); link.removeEventListener("pointerleave", leave);
      link.removeEventListener("focus", focus); link.removeEventListener("blur", leave);
      link.removeEventListener("pointerdown", leave); link.removeEventListener("click", leave);
      preference.removeEventListener("change", sync); document.removeEventListener("visibilitychange", sync);
      document.removeEventListener("resume", resume);
      window.removeEventListener("focus", resume); window.removeEventListener("pageshow", resume); window.removeEventListener("online", resume);
      video.removeEventListener("canplay", ready); video.removeEventListener("playing", playing); video.removeEventListener("error", failed);
    };
  }, [source, target, warmCover, continuous]);
  return ref;
}
