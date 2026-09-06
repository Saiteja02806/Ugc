import { prepareWallTextInApp } from "../lib/wall-text-preparation.js";
import type { BackgroundJobRow, Json } from "../types.js";
import type { WorkerJobContext } from "./index.js";

export async function runGenerateWallTextJob(
  job: BackgroundJobRow,
  context: WorkerJobContext,
) {
  const input = parseInput(job);

  await context.checkpoint({
    progress: null,
    stage: "generating_wall_text",
    status: "waiting_external_service",
  });
  const result = await prepareWallTextInApp({
    ...input,
    recoveryIteration: job.attempt_count,
  });
  await context.checkpoint({
    progress: null,
    stage: "wall_text_persisted",
    status: "processing",
  });

  return result;
}

function parseInput(job: BackgroundJobRow) {
  const input = getRecord(job.input_json);
  const userId = getString(input?.userId);
  const businessProfileId = getString(input?.businessProfileId);
  const businessProfileVersion = input?.businessProfileVersion;
  const recoveryKey = getOptionalString(input?.recoveryKey);
  const refillKey = getOptionalString(input?.refillKey);
  const requestedCount = input?.requestedCount ?? 6;

  if (
    !job.user_id ||
    job.user_id !== userId ||
    !businessProfileId ||
    typeof businessProfileVersion !== "number" ||
    !Number.isInteger(businessProfileVersion) ||
    businessProfileVersion <= 0 ||
    typeof requestedCount !== "number" ||
    !Number.isInteger(requestedCount) ||
    requestedCount < 1 ||
    requestedCount > 50
  ) {
    throw new Error("wall_text_generation input is invalid.");
  }
  const requestKey =
    getString(input?.requestKey) ||
    [
      "legacy-wall-job",
      businessProfileId,
      `v${businessProfileVersion}`,
      ...(refillKey ? [`refill-${refillKey}`] : []),
    ].join(":");

  return {
    businessProfileId,
    businessProfileVersion,
    recoveryKey,
    refillKey,
    requestedCount,
    requestKey,
    userId,
  };
}

function getRecord(value: Json | undefined) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : null;
}

function getString(value: Json | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function getOptionalString(value: Json | undefined) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 200)
    : null;
}
