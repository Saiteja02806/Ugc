/** Bound token acquisition and GET response parsing, without retrying mutations. */
export async function withReadDeadline<T>(read: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal, timeoutMs = 20_000): Promise<T> {
  const deadline = AbortSignal.timeout(timeoutMs);
  const bounded = signal ? AbortSignal.any([signal, deadline]) : deadline;
  bounded.throwIfAborted();
  let onAbort: () => void = () => {};
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(deadline.aborted ? new Error("Loading took too long. Try again.") : bounded.reason);
    bounded.addEventListener("abort", onAbort, { once: true });
  });
  try { return await Promise.race([read(bounded), aborted]); }
  finally { bounded.removeEventListener("abort", onAbort); }
}
