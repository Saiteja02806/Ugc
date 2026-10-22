/** One read at a time. Hidden/offline tabs do no polling and resume with one read. */
export function pollInForeground({ poll, intervalMs, immediate = false, onError, page = document, events = window, isOnline = () => navigator.onLine }: {
  poll: () => Promise<unknown>;
  intervalMs: number;
  immediate?: boolean;
  onError?: (error: unknown) => void;
  page?: Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">;
  events?: Pick<Window, "addEventListener" | "removeEventListener">;
  isOnline?: () => boolean;
}) {
  let stopped = false, running = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const available = () => !stopped && page.visibilityState !== "hidden" && isOnline();
  const clear = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined; };
  async function tick() {
    clear();
    if (!available() || running) return;
    running = true;
    try { await poll(); }
    catch (error) { if (!stopped) onError?.(error); }
    finally {
      running = false;
      if (available()) timer = setTimeout(() => void tick(), intervalMs);
    }
  }
  const resume = () => { clear(); if (available()) void tick(); };
  page.addEventListener("visibilitychange", resume);
  events.addEventListener("online", resume);
  events.addEventListener("offline", resume);
  if (immediate) void tick();
  else if (available()) timer = setTimeout(() => void tick(), intervalMs);
  return () => {
    stopped = true; clear();
    page.removeEventListener("visibilitychange", resume);
    events.removeEventListener("online", resume);
    events.removeEventListener("offline", resume);
  };
}
