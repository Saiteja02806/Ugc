import {
  createWorkerScheduleFinalizationSignature,
  deriveWorkerScheduleFinalizationSecret,
} from "./schedule-finalization.js";

const RECONCILIATION_PATH = "/api/internal/trending/reconcile";
const SIGNATURE_HEADER = "x-ugc-finalization-signature";
const TIMESTAMP_HEADER = "x-ugc-finalization-timestamp";
const REQUEST_TIMEOUT_MS = 45_000;
const MAX_ATTEMPTS = 3;

export async function reconcileTrendingFeedInApp(params: {
  sourceJobId: string;
  userId: string;
}) {
  const config = getConfig();
  const body = JSON.stringify(params);
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
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
      const responseBody = await response.json().catch(() => null);

      if (
        response.ok &&
        responseBody &&
        typeof responseBody === "object" &&
        !Array.isArray(responseBody) &&
        (responseBody as Record<string, unknown>).ok === true
      ) {
        return;
      }

      const message = getErrorMessage(responseBody, response.status);
      const retryable =
        response.status === 408 ||
        response.status === 429 ||
        response.status >= 500;

      if (!retryable) {
        throw new TrendingFeedReconciliationRequestError(message, false);
      }

      lastError = new TrendingFeedReconciliationRequestError(message, true);
    } catch (error) {
      if (
        error instanceof TrendingFeedReconciliationRequestError &&
        !error.retryable
      ) {
        throw error;
      }
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }

    if (attempt < MAX_ATTEMPTS) {
      await sleep(attempt * 1_000);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Could not reconcile the completed Trending feed.");
}

class TrendingFeedReconciliationRequestError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "TrendingFeedReconciliationRequestError";
  }
}

function getConfig() {
  const rawAppUrl = process.env.UGC_INTERNAL_APP_URL?.trim();
  const dedicatedSecret = process.env.UGC_INTERNAL_SCHEDULING_SECRET?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const secret = dedicatedSecret
    ? dedicatedSecret
    : serviceRoleKey
      ? deriveWorkerScheduleFinalizationSecret(serviceRoleKey)
      : "";

  if (!rawAppUrl) {
    throw new Error("Missing UGC_INTERNAL_APP_URL for Trending reconciliation.");
  }

  if (!secret || (dedicatedSecret && dedicatedSecret.length < 32)) {
    throw new Error(
      "Set UGC_INTERNAL_SCHEDULING_SECRET to at least 32 characters or provide SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  let endpoint: URL;

  try {
    endpoint = new URL(RECONCILIATION_PATH, `${rawAppUrl.replace(/\/+$/, "")}/`);
  } catch {
    throw new Error("UGC_INTERNAL_APP_URL must be a valid URL.");
  }

  if (
    endpoint.protocol !== "https:" &&
    !["127.0.0.1", "localhost"].includes(endpoint.hostname)
  ) {
    throw new Error("UGC_INTERNAL_APP_URL must use HTTPS.");
  }

  return { endpoint, secret };
}

function getErrorMessage(value: unknown, status: number) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const message = (value as Record<string, unknown>).message;

    if (typeof message === "string" && message.trim()) {
      return message.trim().slice(0, 500);
    }
  }

  return `Trending reconciliation request failed with HTTP ${status}.`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
