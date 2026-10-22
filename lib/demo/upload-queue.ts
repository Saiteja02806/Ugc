/** Share two transfer slots across selections and retries for one mounted Demo screen. */
export function createDemoUploadQueue<T extends { id: string }>(
  upload: (item: T, signal: AbortSignal) => Promise<void>,
  onIdle: () => void,
) {
  const items = new Map<string, { item: T; controller: AbortController; started: boolean }>();
  let active = false, running = 0;
  function drain() {
    if (!active) return;
    for (const entry of items.values()) {
      if (running >= 2) break;
      if (entry.started || entry.controller.signal.aborted) continue;
      entry.started = true; running++;
      void Promise.resolve().then(() => {
        entry.controller.signal.throwIfAborted();
        return upload(entry.item, entry.controller.signal);
      }).catch(() => {
        // The screen owns per-file errors. Cancellation also settles the slot.
      }).finally(() => {
        running--; items.delete(entry.item.id);
        drain();
        if (active && running === 0 && items.size === 0) onIdle();
      });
    }
  }
  return {
    activate() { active = true; drain(); },
    enqueue(item: T) {
      if (!active || items.has(item.id)) return;
      items.set(item.id, { item, controller: new AbortController(), started: false });
      drain();
    },
    cancel(id: string) {
      const entry = items.get(id);
      if (!entry) return;
      entry.controller.abort();
      if (!entry.started) items.delete(id);
    },
    dispose() {
      active = false;
      for (const entry of items.values()) entry.controller.abort();
      for (const [id, entry] of items) if (!entry.started) items.delete(id);
    },
  };
}
