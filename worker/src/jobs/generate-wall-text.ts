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
  const result = await prepareWallTextInApp(input);
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

  if (
    !job.user_id ||
    job.user_id !== userId ||
    !businessProfileId ||
    typeof businessProfileVersion !== "number" ||
    !Number.isInteger(businessProfileVersion) ||
    businessProfileVersion <= 0
  ) {
    throw new Error("wall_text_generation input is invalid.");
  }

  return { businessProfileId, businessProfileVersion, userId };
}

function getRecord(value: Json | undefined) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : null;
}

function getString(value: Json | undefined) {
  return typeof value === "string" ? value.trim() : "";
}
