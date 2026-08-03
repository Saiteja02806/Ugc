import "server-only";

import { createAndDispatchBackgroundJob } from "@/lib/jobs/background-job-service";

export type AnalyticsSyncOperation =
  | "instagram_content"
  | "instagram_insights"
  | "tiktok_videos";

export async function enqueueAnalyticsSyncJob(params: {
  days?: 7 | 30 | 90;
  idempotencyKey?: string | null;
  operation: AnalyticsSyncOperation;
  userId: string;
}) {
  const timeBucket = Math.floor(Date.now() / (5 * 60_000));
  const scope = [
    params.operation,
    params.days ? `${params.days}d` : "current",
  ].join(":");

  return createAndDispatchBackgroundJob({
    idempotencyKey: `analytics-sync:${scope}:${params.idempotencyKey || timeBucket}`,
    input: {
      ...(params.days ? { days: params.days } : {}),
      operation: params.operation,
      userId: params.userId,
    },
    inputReference: `analytics:${scope}`,
    jobType: "analytics_sync",
    projectId: scope,
    userId: params.userId,
  });
}
