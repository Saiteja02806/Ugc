import { RetryableJobError } from "../retryable-job-error.js";
import { isRetryableContentPlanProviderError } from "./content-plan-provider-retry.js";

export const CONTENT_COPY_TIMEOUT_MS = 60_000;
export const CONTENT_COPY_MAX_RETRIES = 0;

/** One provider attempt. The durable job owns retries and their timing. */
export async function requestContentModel<T>(
  format: "hook" | "reaction",
  request: () => Promise<T>,
): Promise<T> {
  try {
    return await request();
  } catch (error) {
    if (!isRetryableContentPlanProviderError(error)) throw error;
    throw new RetryableJobError(
      `The ${format} model request was interrupted; saved work will be reused.`,
      { code: `${format}_provider_transient`, retryAfterSeconds: 30 },
    );
  }
}
