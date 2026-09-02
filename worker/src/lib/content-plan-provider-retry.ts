import { RetryableJobError } from "../retryable-job-error.js";

// A full five-brief planning chunk has substantially more structured output
// than ordinary copy. Give one request enough time to finish, then let the
// durable background-job contract own the retry. SDK-level retries would
// otherwise repeat the same request invisibly and delay checkpoints/failure
// persistence for several minutes.
export const CONTENT_PLAN_OPENAI_TIMEOUT_MS = 120_000;
export const CONTENT_PLAN_OPENAI_MAX_RETRIES = 0;

export function toContentPlanProviderRetry(error: unknown) {
  if (error instanceof RetryableJobError) return error;
  if (!isRetryableContentPlanProviderError(error)) return error;

  return new RetryableJobError(
    "The content-plan model request was interrupted and will resume from its last saved chunk.",
    {
      code: "content_plan_provider_transient",
      retryAfterSeconds: 45,
    },
  );
}

export function isRetryableContentPlanProviderError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const record = error as Record<string, unknown>;
  const status = getNumber(record.status) ?? getNumber(record.statusCode);
  if (status === 408 || status === 429 || (status !== null && status >= 500)) {
    return true;
  }

  const name = getString(record.name);
  if (
    name === "APIConnectionTimeoutError" ||
    name === "APIConnectionError" ||
    name === "InternalServerError" ||
    name === "RateLimitError"
  ) {
    return true;
  }

  const code = getString(record.code)?.toUpperCase();
  if (
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    code === "ECONNREFUSED" ||
    code === "EAI_AGAIN" ||
    code === "ENOTFOUND" ||
    code === "ABORT_ERR"
  ) {
    return true;
  }

  return /request timed out|network error|connection reset/i.test(
    getString(record.message) ?? "",
  );
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
