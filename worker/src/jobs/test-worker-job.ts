import type { BackgroundJobRow, Json } from "../types.js";

export async function runTestWorkerJob(job: BackgroundJobRow) {
  const input = getJsonRecord(job.input_json);
  const message = getString(input.message) || "hello from worker";

  return {
    receivedMessage: message,
    processedAt: new Date().toISOString(),
    worker: process.env.WORKER_RUNTIME_NAME?.trim() || "gcp-cloud-run",
  } satisfies Record<string, Json>;
}

function getJsonRecord(value: Json): Record<string, Json | undefined> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value;
}

function getString(value: Json | undefined) {
  return typeof value === "string" ? value.trim() : "";
}
