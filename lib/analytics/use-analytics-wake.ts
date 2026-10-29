"use client";

import { useEffect, useRef } from "react";
import { ANALYTICS_SNAPSHOT_READ_STALE_MS } from "./freshness-policy";

type WakeResource = {
  dataUpdatedAt: number;
  errorUpdatedAt: number;
  refetch: (options: { cancelRefetch: boolean }) => Promise<unknown>;
};

/** Browsers may resume a laptop in the same visible tab. React Query's normal
 * visibility handling does not cover every window-focus/pageshow sequence.
 * Saved-data readers can also check while the screen stays open. Refresh POSTs
 * keep event-only behavior; provider admission retains its own server policy. */
export function useAnalyticsWake(resource: WakeResource, enabled: boolean, staleTime = ANALYTICS_SNAPSHOT_READ_STALE_MS, checkWhileOpen = false) {
  const lastAttempt = useRef(0);
  const { dataUpdatedAt, errorUpdatedAt, refetch } = resource;
  useEffect(() => {
    if (!enabled) return;
    const wake = () => {
      if (document.visibilityState === "hidden" || !navigator.onLine) return;
      const now = Date.now();
      if (now - dataUpdatedAt < staleTime ||
          now - Math.max(lastAttempt.current, errorUpdatedAt) < ANALYTICS_SNAPSHOT_READ_STALE_MS) return;
      lastAttempt.current = now;
      // A simultaneous visibility/reconnect refetch joins the current request.
      void refetch({ cancelRefetch: false }).catch(() => undefined);
    };
    window.addEventListener("focus", wake);
    window.addEventListener("pageshow", wake);
    window.addEventListener("online", wake);
    const interval = checkWhileOpen
      ? window.setInterval(wake, Math.max(staleTime, ANALYTICS_SNAPSHOT_READ_STALE_MS))
      : undefined;
    return () => {
      if (interval !== undefined) window.clearInterval(interval);
      window.removeEventListener("focus", wake);
      window.removeEventListener("pageshow", wake);
      window.removeEventListener("online", wake);
    };
  }, [enabled, staleTime, dataUpdatedAt, errorUpdatedAt, refetch, checkWhileOpen]);
}
