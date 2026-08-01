import { processMediaAnalysisInApp } from "../lib/media-analysis.js";
import type { BackgroundJobRow, Json } from "../types.js";
import type { WorkerJobContext } from "./index.js";

export async function runMediaAnalysisJob(
  job: BackgroundJobRow,
  context: WorkerJobContext,
) {
  assertValidInput(job);

  await context.checkpoint({
    progress: null,
    stage: "analyzing_source",
    status: "waiting_external_service",
  });
  const result = await processMediaAnalysisInApp(job.id);
  await context.checkpoint({
    progress: null,
    stage: "analysis_persisted",
    status: "processing",
  });

  return result as Record<string, Json | undefined>;
}

function assertValidInput(job: BackgroundJobRow) {
  const input = getRecord(job.input_json);
  const operation = getString(input?.operation);
  const userId = getString(input?.userId);

  if (
    !job.user_id ||
    job.user_id !== userId ||
    !["business_profile_setup", "website_analysis"].includes(operation)
  ) {
    throw new Error("media_analysis input is invalid.");
  }
}

function getRecord(value: Json | undefined) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : null;
}

function getString(value: Json | undefined) {
  return typeof value === "string" ? value.trim() : "";
}
