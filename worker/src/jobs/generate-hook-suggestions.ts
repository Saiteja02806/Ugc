import { generateHookSuggestionsInApp } from "../lib/hook-suggestions.js";
import type { BackgroundJobRow, Json } from "../types.js";
import type { WorkerJobContext } from "./index.js";

export async function runGenerateHookSuggestionsJob(
  job: BackgroundJobRow,
  context: WorkerJobContext,
) {
  assertValidInput(job);

  await context.checkpoint({
    progress: null,
    stage: "generating_hook_suggestions",
    status: "waiting_external_service",
  });
  const result = await generateHookSuggestionsInApp(job.id);
  await context.checkpoint({
    progress: null,
    stage: "hook_suggestions_persisted",
    status: "processing",
  });

  return result as Record<string, Json | undefined>;
}

function assertValidInput(job: BackgroundJobRow) {
  const input = getRecord(job.input_json);

  if (
    !job.user_id ||
    input?.operation !== "composition_suggestions" ||
    input.userId !== job.user_id
  ) {
    throw new Error("hook_text_generation input is invalid.");
  }
}

function getRecord(value: Json | undefined) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : null;
}
