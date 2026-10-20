"use client";

import { useEffect, useEffectEvent } from "react";

/** Hidden tabs do no status reads. Resume does one check, then polling waits for it to settle. */
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
    function schedule() {
      clearTimeout(timer);
      if (!disposed && intervalMs && polls < maxPolls && document.visibilityState === "visible") {
        timer = setTimeout(() => { polls++; void refreshVisible(); }, intervalMs);
      }
    }
    async function refreshVisible() {
      if (disposed || checking || document.visibilityState !== "visible") return;
      clearTimeout(timer);
      checking = true;
      try { await read(); }
      // Loaders own the user-facing error. A failed read must not strand the timer.
      catch { /* Retry under the resource queue's bounded backoff. */ }
      finally { checking = false; schedule(); }
    }
    function resume() {
      if (document.visibilityState === "visible") void refreshVisible();
      else clearTimeout(timer);
    }
    schedule();
    window.addEventListener("focus", resume);
    window.addEventListener("online", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      disposed = true;
      clearTimeout(timer);
      window.removeEventListener("focus", resume);
      window.removeEventListener("online", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [enabled, intervalMs, maxPolls, resetKey]);
}
