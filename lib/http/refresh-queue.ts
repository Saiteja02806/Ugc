export type RefreshRead = (signal: AbortSignal) => Promise<void>;

/** One mounted resource: coalesce resume/poll reads, but let mutations demand fresh data. */
export function createRefreshQueue(now: () => number = Date.now) {
  let active = false;
  let current: { controller: AbortController; promise: Promise<void> } | null = null;
  let backgroundAfter = 0;
  let failures = 0;

  return {
    activate() { active = true; },
    dispose() {
      active = false;
      current?.controller.abort();
      current = null;
    },
    run(read: RefreshRead, { background = false }: { background?: boolean } = {}): Promise<void> {
      if (!active) return Promise.resolve();
      if (background && current) return current.promise;
      if (background && now() < backgroundAfter) return Promise.resolve();
      // A completed mutation must not reuse a read started before that mutation.
      current?.controller.abort();
      const controller = new AbortController();
      const request = { controller, promise: Promise.resolve() };
      current = request;
      request.promise = Promise.resolve().then(() => {
        controller.signal.throwIfAborted();
        return read(controller.signal);
      }).then(() => {
        if (current !== request) return;
        failures = 0;
        backgroundAfter = now() + 1_000;
      }, error => {
        if (current === request && !controller.signal.aborted) {
          failures++;
          backgroundAfter = now() + Math.min(60_000, 5_000 * 2 ** Math.min(failures - 1, 4));
        }
        throw error;
      }).finally(() => {
        if (current === request) current = null;
      });
      return request.promise;
    },
  };
}
