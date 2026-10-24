import "server-only";

import { createAndDispatchBackgroundJob } from "@/lib/jobs/background-job-service";

export type AnalyticsSyncOperation =
  | "connection_profiles"
  | "instagram_attribution"
  | "instagram_content"
  | "instagram_insights"
  | "tiktok_videos"
  | "youtube_channel";

export async function enqueueAnalyticsSyncJob(params: {
  days?: 7 | 30 | 90;
  force?: boolean;
  idempotencyKey?: string | null;
  connectionRevisions?: Record<string, string>;
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
      ...(params.force ? { force: true } : {}),
      operation: params.operation,
      ...(params.connectionRevisions ? { connectionRevisions: params.connectionRevisions } : {}),
      userId: params.userId,
    },
    inputReference: `analytics:${scope}`,
    jobType: "analytics_sync",
    projectId: scope,
    userId: params.userId,
  });
}
