"use client";

import type { PublicBackgroundJob } from "@/lib/jobs/background-job-contract";

type StartJobResponse =
  | {
      data?: unknown;
      job?: PublicBackgroundJob;
      jobId?: string;
      ok: true;
      refreshing?: boolean;
    }
  | { message?: string; ok?: false };

type ReadJobResponse =
  | { job: PublicBackgroundJob; ok: true }
  | { error?: string; ok?: false };

const ANALYTICS_SYNC_TIMEOUT_MS = 15 * 60_000;
const ANALYTICS_SYNC_POLL_INTERVAL_MS = 10_000;
const ANALYTICS_SYNC_TIMEOUT_MESSAGE =
  "Analytics is taking longer than expected. Saved data will remain available while refresh continues.";

export async function runAnalyticsBackgroundSync(params: {
  body?: Record<string, unknown>;
  idempotencyKey?: string;
  onBackgroundError?: (error: Error) => void;
  onBackgroundOutput?: (output: unknown) => void;
  signal?: AbortSignal;
  token: string;
  timeoutMs?: number;
  url: string;
}) {
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
    signal: params.signal,
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

  if (data.data !== undefined) {
    if (
      data.job &&
      data.jobId &&
      !["cancelled", "completed", "failed"].includes(data.job.status)
    ) {
      void waitForAnalyticsJob({
        initialJob: data.job,
        jobId: data.jobId,
        signal: params.signal,
        timeoutMs: params.timeoutMs,
        token: params.token,
      })
        .then((output) => params.onBackgroundOutput?.(output))
        .catch((error: unknown) => {
          if (isAbortError(error)) {
            return;
          }

          params.onBackgroundError?.(
            error instanceof Error
              ? error
              : new Error("Analytics background refresh failed."),
          );
        });
    } else if (
      data.job?.status === "completed" &&
      data.job.output !== null
    ) {
      return data.job.output;
    }

    // Saved data is deliberately returned before the provider refresh
    // completes. Polling is no longer on the render path.
    return data.data;
  }

  if (!data.job || !data.jobId) {
    throw new Error("Analytics synchronization did not return saved data or a job.");
  }

  return waitForAnalyticsJob({
    initialJob: data.job,
    jobId: data.jobId,
    signal: params.signal,
    timeoutMs: params.timeoutMs,
    token: params.token,
  });
}

async function waitForAnalyticsJob(params: {
  initialJob: PublicBackgroundJob;
  jobId: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  token: string;
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
    let job = params.initialJob;

    while (!["cancelled", "completed", "failed"].includes(job.status)) {
      await waitForNextPoll(requestController.signal);
      const pollResponse = await fetch(
        `/api/jobs/${encodeURIComponent(params.jobId)}`,
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

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}
