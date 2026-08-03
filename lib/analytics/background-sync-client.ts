"use client";

import type { PublicBackgroundJob } from "@/lib/jobs/background-job-contract";

type StartJobResponse =
  | { job: PublicBackgroundJob; jobId: string; ok: true }
  | { message?: string; ok?: false };

type ReadJobResponse =
  | { job: PublicBackgroundJob; ok: true }
  | { error?: string; ok?: false };

const ANALYTICS_SYNC_TIMEOUT_MS = 90_000;
const ANALYTICS_SYNC_POLL_INTERVAL_MS = 3_000;
const ANALYTICS_SYNC_TIMEOUT_MESSAGE =
  "Analytics is taking longer than expected. Refresh and try again.";

export async function runAnalyticsBackgroundSync(params: {
  body?: Record<string, unknown>;
  idempotencyKey?: string;
  signal?: AbortSignal;
  token: string;
  timeoutMs?: number;
  url: string;
}) {
  const requestController = new AbortController();
  const timeoutMs = Math.max(1, params.timeoutMs ?? ANALYTICS_SYNC_TIMEOUT_MS);
  let timedOut = false;
  const abortFromCaller = () => requestController.abort(params.signal?.reason);

  if (params.signal?.aborted) {
    abortFromCaller();
  } else {
    params.signal?.addEventListener("abort", abortFromCaller, { once: true });
  }

  const deadline = globalThis.setTimeout(() => {
    timedOut = true;
    requestController.abort();
  }, timeoutMs);

  try {
    const headers = new Headers({
      Authorization: `Bearer ${params.token}`,
      "Content-Type": "application/json",
    });

    if (params.idempotencyKey) {
      headers.set("Idempotency-Key", params.idempotencyKey);
    }

    const response = await fetch(params.url, {
      body: JSON.stringify(params.body ?? {}),
      cache: "no-store",
      headers,
      method: "POST",
      signal: requestController.signal,
    });
    const data = (await response.json().catch(() => null)) as
      | StartJobResponse
      | null;

    if (!response.ok || data?.ok !== true) {
      throw new Error(
        data && "message" in data && data.message
          ? data.message
          : "Could not start analytics synchronization.",
      );
    }

    let job = data.job;

    while (!["cancelled", "completed", "failed"].includes(job.status)) {
      await waitForNextPoll(requestController.signal);
      const pollResponse = await fetch(
        `/api/jobs/${encodeURIComponent(data.jobId)}`,
        {
          cache: "no-store",
          headers: { Authorization: `Bearer ${params.token}` },
          signal: requestController.signal,
        },
      );
      const pollData = (await pollResponse.json().catch(() => null)) as
        | ReadJobResponse
        | null;

      if (!pollResponse.ok || pollData?.ok !== true) {
        throw new Error("Could not read analytics synchronization state.");
      }

      job = pollData.job;
    }

    if (job.status !== "completed") {
      throw new Error(
        job.error?.message ?? "Analytics synchronization did not complete.",
      );
    }

    return job.output;
  } catch (error) {
    if (timedOut) {
      throw new Error(ANALYTICS_SYNC_TIMEOUT_MESSAGE);
    }

    throw error;
  } finally {
    globalThis.clearTimeout(deadline);
    params.signal?.removeEventListener("abort", abortFromCaller);
  }
}

function waitForNextPoll(signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("The request was aborted.", "AbortError"));
      return;
    }

    const onAbort = () => {
      globalThis.clearTimeout(timeout);
      reject(new DOMException("The request was aborted.", "AbortError"));
    };
    const timeout = globalThis.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ANALYTICS_SYNC_POLL_INTERVAL_MS);

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
