"use client";

import type { PublicBackgroundJob } from "@/lib/jobs/background-job-contract";

type StartJobResponse =
  | { job: PublicBackgroundJob; jobId: string; ok: true }
  | { message?: string; ok?: false };

type ReadJobResponse =
  | { job: PublicBackgroundJob; ok: true }
  | { error?: string; ok?: false };

export async function runAnalyticsBackgroundSync(params: {
  body?: Record<string, unknown>;
  idempotencyKey?: string;
  signal?: AbortSignal;
  token: string;
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

  let job = data.job;

  while (!["cancelled", "completed", "failed"].includes(job.status)) {
    await waitForNextPoll(params.signal);
    const pollResponse = await fetch(
      `/api/jobs/${encodeURIComponent(data.jobId)}`,
      {
        cache: "no-store",
        headers: { Authorization: `Bearer ${params.token}` },
        signal: params.signal,
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
}

function waitForNextPoll(signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("The request was aborted.", "AbortError"));
      return;
    }

    const onAbort = () => {
      window.clearTimeout(timeout);
      reject(new DOMException("The request was aborted.", "AbortError"));
    };
    const timeout = window.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, 3_000);

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
