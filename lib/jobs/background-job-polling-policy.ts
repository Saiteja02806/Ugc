import type { QueryClient } from "@tanstack/react-query";

import type { PublicBackgroundJob } from "./background-job-contract";

// The list polls every five seconds. Allow a small scheduling skew, but never
// let an abandoned or failed list replace independent receipt recovery.
export const ACTIVE_JOB_COVERAGE_MAX_AGE_MS = 7_500;
export const COMPLETED_MEDIA_JOB_FRESHNESS_MS = 30_000;

/** Briefly coalesce lifecycle reads for completed durable media receipts only. */
export function backgroundJobStaleTime(query: {
  state: { data?: PublicBackgroundJob; status: string; fetchFailureCount?: number };
}): number {
  const job = query.state.data;
  const output = job?.output;
  if (query.state.status !== "success" || (query.state.fetchFailureCount ?? 0) > 0 ||
      job?.status !== "completed" || job.error !== null ||
      !job.completedAt || !Number.isFinite(Date.parse(job.completedAt)) ||
      !output || typeof output !== "object" || Array.isArray(output) ||
      typeof output.mediaAssetId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(output.mediaAssetId)) return 0;
  // This is a finite freshness window, not a timer or an immutable-job claim.
  // Explicit refetch and invalidation still reach the server immediately.
  return COMPLETED_MEDIA_JOB_FRESHNESS_MS;
}

/** Reuse a recent account-owned list receipt; absence always needs a detail read. */
export function readCoveredBackgroundJob(
  client: QueryClient,
  {
    ownerId,
    jobId,
    currentJob,
    invalidated = false,
    now = Date.now(),
  }: {
    ownerId: string | undefined;
    jobId: string;
    currentJob?: PublicBackgroundJob;
    invalidated?: boolean;
    now?: number;
  },
): PublicBackgroundJob | undefined {
  // Callers must invalidate details before explicit refresh/retry (or otherwise
  // bypass coverage). Raw QueryObserver.refetch() does not set this flag.
  if (!ownerId || !jobId || invalidated) return undefined;

  let newest: PublicBackgroundJob | undefined;
  for (const query of client.getQueryCache().findAll({
    queryKey: ["background-jobs", ownerId, "active"],
  })) {
    const { state } = query;
    const age = now - state.dataUpdatedAt;
    if (!query.isActive() || state.status !== "success" || state.isInvalidated || state.fetchFailureCount > 0 ||
        age < 0 || age > ACTIVE_JOB_COVERAGE_MAX_AGE_MS || !Array.isArray(state.data)) continue;

    const candidate = (state.data as PublicBackgroundJob[]).find(job => job.id === jobId);
    if (!candidate) continue;
    const candidateTime = Date.parse(candidate.updatedAt);
    const currentTime = currentJob ? Date.parse(currentJob.updatedAt) : -Infinity;
    // Never overwrite a newer mutation/detail result with an older list entry.
    // Unknown ordering is deliberately resolved by a server read.
    if (!Number.isFinite(candidateTime) || (currentJob && !Number.isFinite(currentTime)) ||
        candidateTime < currentTime) continue;
    // Date.parse truncates sub-millisecond server timestamps. Differing receipts
    // at the same parsed time need an authoritative read in either direction:
    // keeping the old receipt could freeze progress; replacing it could regress
    // a mutation or collected output. Exact JSON equality is conservative (a
    // harmless key-order difference causes an extra GET, never stale reuse).
    if (currentJob && candidateTime === currentTime &&
        JSON.stringify(candidate) !== JSON.stringify(currentJob)) return undefined;
    if (!newest || candidateTime > Date.parse(newest.updatedAt)) newest = candidate;
  }
  return newest;
}
