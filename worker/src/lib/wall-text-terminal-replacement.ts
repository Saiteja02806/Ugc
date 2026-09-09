import {
  createWorkerScheduleFinalizationSignature,
  deriveWorkerScheduleFinalizationSecret,
} from "./schedule-finalization.js";
import { RetryableJobError } from "../retryable-job-error.js";

const REPLACEMENT_PATH = "/api/internal/jobs/recover-wall-text-terminal";
const SIGNATURE_HEADER = "x-ugc-finalization-signature";
const TIMESTAMP_HEADER = "x-ugc-finalization-timestamp";
const REQUEST_TIMEOUT_MS = 45_000;

export async function scheduleWallTextTerminalReplacement(params: {
  businessProfileId: string;
  businessProfileVersion: number;
  dailyFeedId: string;
  errorCode: string;
  failedJobId: string;
  recoveryKey?: string | null;
  requestedCount: number;
  userId: string;
}) {
  const config = getConfig();
  const body = JSON.stringify(params);
  const timestamp = Date.now().toString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(config.endpoint, {
      body,
      headers: {
        "Content-Type": "application/json",
        [SIGNATURE_HEADER]: createWorkerScheduleFinalizationSignature({
          body,
          secret: config.secret,
          timestamp,
        }),
        [TIMESTAMP_HEADER]: timestamp,
      },
      method: "POST",
      signal: controller.signal,
    });
    const result = (await response.json().catch(() => null)) as {
      jobId?: unknown;
      ok?: unknown;
      replacementScheduled?: unknown;
    } | null;

    if (response.ok && result?.ok === true) {
      return {
        jobId: typeof result.jobId === "string" ? result.jobId : null,
        replacementScheduled: result.replacementScheduled === true,
      };
    }

    if (response.status === 408 || response.status === 429 || response.status >= 500) {
      throw new RetryableJobError(
        `Could not schedule a Wall-of-text replacement: HTTP ${response.status}.`,
        { code: "wall_text_terminal_replacement_retry", retryAfterSeconds: 30 },
      );
    }

    // A changed profile or removed feed no longer owns this candidate. The
    // current feed will generate its own work, so the original terminal job
    // may complete without creating a duplicate replacement.
    return { jobId: null, replacementScheduled: false };
  } catch (error) {
    if (error instanceof RetryableJobError) throw error;
    if (error instanceof Error && (error.name === "AbortError" || /fetch failed|network/i.test(error.message))) {
      throw new RetryableJobError(
        "The Wall replacement request was interrupted.",
        { code: "wall_text_terminal_replacement_retry", retryAfterSeconds: 30 },
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function getConfig() {
  const rawAppUrl = process.env.UGC_INTERNAL_APP_URL?.trim();
  const dedicatedSecret = process.env.UGC_INTERNAL_SCHEDULING_SECRET?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const secret = dedicatedSecret || (serviceRoleKey ? deriveWorkerScheduleFinalizationSecret(serviceRoleKey) : "");

  if (!rawAppUrl) throw new Error("Missing UGC_INTERNAL_APP_URL for Wall-of-text replacement.");
  if (!secret || (dedicatedSecret && dedicatedSecret.length < 32)) {
    throw new Error("Internal Wall-of-text replacement auth is not configured.");
  }

  const endpoint = new URL(REPLACEMENT_PATH, `${rawAppUrl.replace(/\/+$/, "")}/`);
  if (endpoint.protocol !== "https:" && !["127.0.0.1", "localhost"].includes(endpoint.hostname)) {
    throw new Error("UGC_INTERNAL_APP_URL must use HTTPS.");
  }
  return { endpoint, secret };
}
