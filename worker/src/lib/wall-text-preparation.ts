import {
  createWorkerScheduleFinalizationSignature,
  deriveWorkerScheduleFinalizationSecret,
} from "./schedule-finalization.js";
import { RetryableJobError } from "../retryable-job-error.js";
import { isRetryableContentPlanProviderError } from "./content-plan-provider-retry.js";

const PREPARATION_PATH = "/api/internal/jobs/prepare-wall-text";
const SIGNATURE_HEADER = "x-ugc-finalization-signature";
const TIMESTAMP_HEADER = "x-ugc-finalization-timestamp";

export async function prepareWallTextInApp(params: {
  businessProfileId: string;
  businessProfileVersion: number;
  recoveryIteration?: number;
  recoveryKey?: string | null;
  refillKey?: string | null;
  requestedCount: number;
  requestKey: string;
  userId: string;
}) {
  const config = getConfig();
  const body = JSON.stringify(params);
  const timestamp = Date.now().toString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10 * 60_000);

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
      error?: unknown;
      errorCode?: unknown;
      ideaCount?: unknown;
      ok?: unknown;
    } | null;

    if (
      !response.ok ||
      result?.ok !== true ||
      typeof result.ideaCount !== "number"
    ) {
      const detail =
        typeof result?.error === "string" && result.error.trim()
          ? ` ${result.error.trim().slice(0, 240)}`
          : "";
      const errorCode =
        typeof result?.errorCode === "string" && result.errorCode.trim()
          ? result.errorCode.trim().slice(0, 120)
          : "wall_text_preparation_failed";

      if (errorCode === "infrastructure_error" ||
          (errorCode === "wall_text_preparation_failed" &&
            (response.status === 408 || response.status === 429 || response.status >= 500))) {
        throw new RetryableJobError(
          `Wall-of-text preparation request failed with HTTP ${response.status}.${detail}`,
          { code: errorCode, retryAfterSeconds: 30 },
        );
      }

      throw Object.assign(
        new Error(
          `Wall-of-text preparation request failed with HTTP ${response.status}.${detail}`,
        ),
        { code: errorCode },
      );
    }

    return { ideaCount: result.ideaCount };
  } catch (error) {
    if (error instanceof RetryableJobError) throw error;
    if (isRetryableContentPlanProviderError(error) ||
        (error instanceof Error && (error.name === "AbortError" ||
          (error instanceof TypeError && /fetch failed|network/i.test(error.message))))) {
      throw new RetryableJobError("The Wall preparation connection was interrupted; saved work will be reused.", {
        code: "wall_text_preparation_transient", retryAfterSeconds: 30,
      });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function getConfig() {
  const appUrl = process.env.UGC_INTERNAL_APP_URL?.trim();
  const dedicatedSecret =
    process.env.UGC_INTERNAL_SCHEDULING_SECRET?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const secret = dedicatedSecret
    ? dedicatedSecret
    : serviceRoleKey
      ? deriveWorkerScheduleFinalizationSecret(serviceRoleKey)
      : "";

  if (!appUrl) {
    throw new Error("Missing UGC_INTERNAL_APP_URL for Wall-of-text preparation.");
  }

  if (!secret || (dedicatedSecret && dedicatedSecret.length < 32)) {
    throw new Error("Internal Wall-of-text preparation auth is not configured.");
  }

  const endpoint = new URL(
    PREPARATION_PATH,
    `${appUrl.replace(/\/+$/, "")}/`,
  );

  if (
    endpoint.protocol !== "https:" &&
    !["127.0.0.1", "localhost"].includes(endpoint.hostname)
  ) {
    throw new Error("UGC_INTERNAL_APP_URL must use HTTPS.");
  }

  return { endpoint, secret };
}
