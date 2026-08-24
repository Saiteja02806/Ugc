import { syncAnalyticsInApp } from "../lib/analytics-sync.js";
import type { BackgroundJobRow, Json } from "../types.js";
import type { WorkerJobContext } from "./index.js";

export async function runAnalyticsSyncJob(
  job: BackgroundJobRow,
  context: WorkerJobContext,
) {
  assertValidInput(job);

  await context.checkpoint({
    progress: null,
    stage: "syncing_provider_analytics",
    status: "waiting_external_service",
  });
  const result = await syncAnalyticsInApp(job.id);
  await context.checkpoint({
    progress: null,
    stage: "analytics_snapshot_persisted",
    status: "processing",
  });

  return result as Record<string, Json | undefined>;
}

function assertValidInput(job: BackgroundJobRow) {
  const input = getRecord(job.input_json);

  if (
    !job.user_id ||
    input?.userId !== job.user_id ||
    ![
      "instagram_attribution",
      "instagram_content",
      "instagram_insights",
      "tiktok_videos",
    ].includes(
      typeof input.operation === "string" ? input.operation : "",
    )
  ) {
    throw new Error("analytics_sync input is invalid.");
  }
}

function getRecord(value: Json | undefined) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : null;
}
