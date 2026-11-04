import type { HookStartingFrame } from "./hook-starting-frame-client";

export type StartingFrameRequest = {
  ownerId: string; referenceId: string; sourceSha256: string; signal?: AbortSignal;
  retainedFrame?: HookStartingFrame["frame"];
};
type Pending = { controller: AbortController; promise: Promise<HookStartingFrame>; users: number };
const copy = (frame: HookStartingFrame) => ({ ...frame, frame: { ...frame.frame } });
const keyOf = (input: StartingFrameRequest) => JSON.stringify([input.ownerId, input.referenceId, input.sourceSha256,
  input.retainedFrame ? [input.retainedFrame.sha256, input.retainedFrame.index, input.retainedFrame.timeSeconds, input.retainedFrame.width, input.retainedFrame.height] : null]);

/** Auth is checked by the caller on every read, including ready-cache hits. Never caches failures. */
export function createStartingFrameCache(options: { now?: () => number; maxEntries?: number; maxBytes?: number; ttlMs?: number } = {}) {
  const ready = new Map<string, { value: HookStartingFrame; expires: number }>();
  const pending = new Map<string, Pending>();
  const now = options.now ?? Date.now;
  const maxBytes = options.maxBytes ?? 24 * 1024 ** 2, maxEntries = options.maxEntries ?? 8;
  let bytes = 0;
  const remove = (key: string) => { const entry = ready.get(key); if (entry) { bytes -= entry.value.blob.size; ready.delete(key); } };
  const prune = () => { for (const [key, entry] of ready) if (entry.expires <= now()) remove(key); };
  return {
    canPrefetch(input: StartingFrameRequest) { prune(); return ready.has(keyOf(input)) || pending.has(keyOf(input)) || pending.size < 2; },
    read(input: StartingFrameRequest, load: (signal: AbortSignal) => Promise<HookStartingFrame>): Promise<HookStartingFrame> {
      try { input.signal?.throwIfAborted(); } catch (error) { return Promise.reject(error); }
      prune(); const key = keyOf(input), hit = ready.get(key);
      if (hit) { ready.delete(key); ready.set(key, hit); return Promise.resolve(copy(hit.value)); }
      let entry = pending.get(key);
      if (!entry) {
        const controller = new AbortController();
        entry = { controller, users: 0, promise: Promise.resolve().then(() => load(controller.signal)) };
        const current = entry;
        pending.set(key, current);
        current.promise = current.promise.then(value => {
          if (!controller.signal.aborted && value.blob.size <= maxBytes && maxEntries > 0) {
            while (ready.size >= maxEntries || bytes + value.blob.size > maxBytes) remove(ready.keys().next().value!);
            ready.set(key, { value: copy(value), expires: now() + (options.ttlMs ?? 5 * 60_000) }); bytes += value.blob.size;
          }
          return value;
        }).finally(() => { if (pending.get(key) === current) pending.delete(key); });
      }
      const current = entry;
      current.users++;
      return new Promise((resolve, reject) => {
        let finished = false;
        const finish = () => {
          if (finished) return false; finished = true;
          input.signal?.removeEventListener("abort", abort);
          if (--current.users === 0 && pending.get(key) === current) { pending.delete(key); current.controller.abort(); }
          return true;
        };
        const abort = () => { if (finish()) reject(input.signal?.reason ?? new DOMException("Aborted", "AbortError")); };
        input.signal?.addEventListener("abort", abort, { once: true });
        current.promise.then(value => { if (finish()) resolve(copy(value)); }, error => { if (finish()) reject(error); });
      });
    },
  };
}
