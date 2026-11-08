"use client";

import { useEffect, useRef } from "react";
import { ANALYTICS_SNAPSHOT_READ_STALE_MS } from "./freshness-policy";

type WakeResource = {
  dataUpdatedAt: number;
  errorUpdatedAt: number;
  refetch: (options: { cancelRefetch: boolean }) => Promise<unknown>;
};

const MIN_CHECK_DELAY_MS = 1_000;
const OFFLINE = () => document.visibilityState === "hidden" || !navigator.onLine;

/** Browsers may resume a laptop in the same visible tab. React Query's normal
 * visibility handling does not cover every window-focus/pageshow sequence.
 * Saved-data readers can also check while the screen stays open. Refresh POSTs
 * keep event-only behavior; provider admission retains its own server policy.
 *
 * The open-screen check is scheduled from the moment the saved data actually
 * became stale. A fixed interval aligned to mount can skip its own tick (data
 * updated half a second after mount) and delay the next read by a whole extra
 * interval; that made a visible Analytics screen look frozen. */
export function useAnalyticsWake(resource: WakeResource, enabled: boolean, staleTime = ANALYTICS_SNAPSHOT_READ_STALE_MS, checkWhileOpen = false) {
  const lastAttempt = useRef(0);
  const { dataUpdatedAt, errorUpdatedAt, refetch } = resource;
  useEffect(() => {
    if (!enabled) return;
    const dueAt = () => Math.max(
      dataUpdatedAt + staleTime,
      Math.max(lastAttempt.current, errorUpdatedAt) + ANALYTICS_SNAPSHOT_READ_STALE_MS,
    );
    const wake = () => {
      if (OFFLINE()) return;
      const now = Date.now();
      if (now < dueAt()) return;
      lastAttempt.current = now;
      // A simultaneous visibility/reconnect refetch joins the current request.
      void refetch({ cancelRefetch: false }).catch(() => undefined);
    };
    let timer: number | undefined;
    const schedule = () => {
      if (!checkWhileOpen) return;
      if (timer !== undefined) window.clearTimeout(timer);
      timer = undefined;
      if (OFFLINE()) return;
      timer = window.setTimeout(() => {
        wake();
        schedule();
      }, Math.max(MIN_CHECK_DELAY_MS, dueAt() - Date.now() + 100));
    };
    const resume = () => {
      if (OFFLINE()) return;
      wake();
      schedule();
    };
    window.addEventListener("focus", resume);
    window.addEventListener("pageshow", resume);
    window.addEventListener("online", resume);
    document.addEventListener("visibilitychange", resume);
    schedule();
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      window.removeEventListener("focus", resume);
      window.removeEventListener("pageshow", resume);
      window.removeEventListener("online", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [enabled, staleTime, dataUpdatedAt, errorUpdatedAt, refetch, checkWhileOpen]);
}
