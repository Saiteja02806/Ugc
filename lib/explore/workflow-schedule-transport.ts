import { ReadDeadlineError, withReadDeadline } from "../http/read-deadline.ts";
import { ScheduleRequestError } from "./workflow-schedule-client.ts";

export const WORKFLOW_SCHEDULE_TIMEOUT_MS = 20_000;

export function isScheduleTimeout(error: unknown): boolean {
  return error instanceof ReadDeadlineError || error instanceof Error &&
    (error.name === "TimeoutError" || /^(signal timed out|the operation was aborted due to timeout)\.?$/i.test(error.message));
}

/** Retry a timed-out read once; never automatically retry a scheduling mutation. */
export async function requestWorkflowSchedule(deps: {
  token: () => Promise<string | null>;
  fetch: typeof fetch;
  assertActive?: () => void;
  timeoutMs?: number;
}, url: string, init?: RequestInit) {
  // Native browser fetch must be invoked without the transport object as `this`.
  const { fetch: send } = deps;
  const readOnly = !init?.method || init.method.toUpperCase() === "GET";
  const attempt = () => withReadDeadline(async signal => {
    const token = await deps.token();
    // A late auth reply must never send a POST after the caller has timed out.
    signal.throwIfAborted();
    deps.assertActive?.();
    if (!token) throw new Error("Sign in to schedule your post.");
    const response = await send(url, { ...init, cache: "no-store", signal,
      headers: { ...init?.headers, Authorization: `Bearer ${token}` } });
    signal.throwIfAborted();
    const value = await response.json().catch(() => null);
    signal.throwIfAborted();
    deps.assertActive?.();
    if (!response.ok || !value?.ok) throw new ScheduleRequestError(
      value?.message ?? value?.error ?? "Could not confirm scheduling. Check the same saved request before trying again.", response.status, value?.code);
    return value;
  }, init?.signal ?? undefined, deps.timeoutMs ?? WORKFLOW_SCHEDULE_TIMEOUT_MS);
  for (let count = 0; ; count++) {
    try { return await attempt(); }
    catch (error) {
      if (!isScheduleTimeout(error) || init?.signal?.aborted) throw error;
      if (readOnly && count === 0) continue;
      throw new ScheduleRequestError(readOnly
        ? "The scheduling check took too long. Your choices are kept. Try again."
        : "The scheduling reply took too long. Check the saved request before trying again.", 408, "schedule_request_timeout");
    }
  }
}
