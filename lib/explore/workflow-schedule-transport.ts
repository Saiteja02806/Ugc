import { withReadDeadline } from "../http/read-deadline.ts";
import { ScheduleRequestError } from "./workflow-schedule-client.ts";

export const WORKFLOW_SCHEDULE_TIMEOUT_MS = 20_000;

/** One bounded attempt. A timeout never retries or proves a mutation was rejected. */
export async function requestWorkflowSchedule(deps: {
  token: () => Promise<string | null>;
  fetch: typeof fetch;
  assertActive?: () => void;
  timeoutMs?: number;
}, url: string, init?: RequestInit) {
  // Native browser fetch must be invoked without the transport object as `this`.
  const { fetch: send } = deps;
  return withReadDeadline(async signal => {
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
}
