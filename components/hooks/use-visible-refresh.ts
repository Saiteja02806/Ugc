"use client";

import { useEffect, useEffectEvent } from "react";

/** Hidden/offline tabs do no status reads. Resume checks once, then waits for each read. */
export function useVisibleRefresh({ refresh, intervalMs = false, enabled = true, maxPolls = Infinity, resetKey }: {
  refresh: () => Promise<unknown>;
  intervalMs?: number | false;
  enabled?: boolean;
  maxPolls?: number;
  /** Reset a finite polling budget when the active jobs change. */
  resetKey?: string;
}) {
  const read = useEffectEvent(refresh);
  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let checking = false;
    let polls = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const available = () => !disposed && document.visibilityState === "visible" && navigator.onLine !== false;
    function schedule() {
      clearTimeout(timer);
      if (available() && intervalMs && polls < maxPolls) {
        timer = setTimeout(() => { polls++; void refreshVisible(); }, intervalMs);
      }
    }
    async function refreshVisible() {
      if (!available() || checking) return;
      clearTimeout(timer);
      checking = true;
      try { await read(); }
      // Loaders own the user-facing error. A failed read must not strand the timer.
      catch { /* Retry under the resource queue's bounded backoff. */ }
      finally { checking = false; schedule(); }
    }
    function resume() {
      if (available()) void refreshVisible();
      else clearTimeout(timer);
    }
    schedule();
    window.addEventListener("focus", resume);
    window.addEventListener("online", resume);
    window.addEventListener("offline", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      disposed = true;
      clearTimeout(timer);
      window.removeEventListener("focus", resume);
      window.removeEventListener("online", resume);
      window.removeEventListener("offline", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [enabled, intervalMs, maxPolls, resetKey]);
}
