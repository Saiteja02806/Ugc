import { prepareWallTextInApp } from "../lib/wall-text-preparation.js";
import { scheduleWallTextTerminalReplacement } from "../lib/wall-text-terminal-replacement.js";
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
  let result: Awaited<ReturnType<typeof prepareWallTextInApp>>;
  try {
    result = await prepareWallTextInApp({
      ...input,
      recoveryIteration: job.attempt_count,
    });
  } catch (error) {
    const errorCode = getErrorCode(error);
    if (
      isCandidateReplacementFailure(errorCode) &&
      !hasTerminalReplacementAlreadyBeenScheduled(input.refillKey)
    ) {
      const replacement = await scheduleWallTextTerminalReplacement({
        businessProfileId: input.businessProfileId,
        businessProfileVersion: input.businessProfileVersion,
        dailyFeedId: input.dailyFeedId,
        errorCode,
        failedJobId: job.id,
        recoveryKey: input.recoveryKey,
        requestedCount: input.requestedCount,
        userId: input.userId,
      });
      return {
        ideaCount: 0,
        replacementJobId: replacement.jobId,
        replacementScheduled: replacement.replacementScheduled,
      } satisfies Record<string, Json>;
    }
    throw error;
  }
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
  const earlyPlanId = getOptionalString(input?.earlyPlanId);
  const dailyFeedId = getOptionalString(input?.dailyFeedId);
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
    dailyFeedId,
    earlyPlanId,
    recoveryKey,
    refillKey,
    requestedCount,
    requestKey,
    userId,
  };
}

function getErrorCode(error: unknown) {
  if (!error || typeof error !== "object") return "";
  const value = (error as { code?: unknown }).code;
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isCandidateReplacementFailure(errorCode: string) {
  return errorCode === "wall_text_render_fit_rejected" ||
    errorCode === "content_retry_exhausted" ||
    errorCode === "model_output_refusal";
}

function hasTerminalReplacementAlreadyBeenScheduled(refillKey: string | null) {
  return Boolean(refillKey && refillKey.startsWith("terminal:"));
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
