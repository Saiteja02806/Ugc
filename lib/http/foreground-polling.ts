/** One read at a time. Hidden/offline tabs do no polling and resume with one read. */
export function pollInForeground({ poll, intervalMs, maxErrorIntervalMs, immediate = false, onError, page = document, events = window, isOnline = () => navigator.onLine }: {
  poll: () => Promise<unknown>;
  intervalMs: number | (() => number);
  maxErrorIntervalMs?: number;
  immediate?: boolean;
  onError?: (error: unknown) => void;
  page?: Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">;
  events?: Pick<Window, "addEventListener" | "removeEventListener">;
  isOnline?: () => boolean;
}) {
  let stopped = false, running = false;
  const interval = () => typeof intervalMs === "function" ? intervalMs() : intervalMs;
  let nextInterval = interval();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const available = () => !stopped && page.visibilityState !== "hidden" && isOnline();
  const clear = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined; };
  async function tick() {
    clear();
    if (!available() || running) return;
    running = true;
    try { await poll(); nextInterval = interval(); }
    catch (error) {
      const base = interval();
      nextInterval = Math.min(Math.max(base, maxErrorIntervalMs ?? base), nextInterval * 2);
      if (!stopped) onError?.(error);
    }
    finally {
      running = false;
      if (available()) timer = setTimeout(() => void tick(), nextInterval);
    }
  }
  const resume = () => { clear(); if (available()) void tick(); };
  page.addEventListener("visibilitychange", resume);
  events.addEventListener("online", resume);
  events.addEventListener("offline", resume);
  if (immediate) void tick();
  else if (available()) timer = setTimeout(() => void tick(), interval());
  return () => {
    stopped = true; clear();
    page.removeEventListener("visibilitychange", resume);
    events.removeEventListener("online", resume);
    events.removeEventListener("offline", resume);
  };
}
