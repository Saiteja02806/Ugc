import type { PublicBackgroundJob } from "../jobs/background-job-contract.ts";

export type VideoGenerationState = "empty" | "generating" | "completed" | "failed";

export function getVideoGenerationState({
  submitting,
  loading,
  jobs,
  fallback,
  missingOutput = false,
}: {
  submitting: boolean;
  loading: boolean;
  jobs: readonly Pick<PublicBackgroundJob, "status">[];
  fallback: VideoGenerationState;
  missingOutput?: boolean;
}): VideoGenerationState {
  if (submitting || loading || jobs.some((job) => !["cancelled", "completed", "failed"].includes(job.status))) {
    return "generating";
  }
  if (missingOutput || jobs.some((job) => job.status === "failed" || job.status === "cancelled")) {
    return "failed";
  }
  if (jobs.length > 0) return "completed";
  // A stale local "generating" flag must never lock an empty job list.
  return fallback === "generating" ? "empty" : fallback;
}
