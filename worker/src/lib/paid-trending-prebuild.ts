import {
  createWorkerScheduleFinalizationSignature,
  deriveWorkerScheduleFinalizationSecret,
} from "./schedule-finalization.js";

const PREPARATION_PATH = "/api/internal/jobs/prepare-paid-trending";
const SIGNATURE_HEADER = "x-ugc-finalization-signature";
const TIMESTAMP_HEADER = "x-ugc-finalization-timestamp";

export class PaidTrendingPrebuildRequestError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = "PaidTrendingPrebuildRequestError";
    this.retryable = retryable;
  }
}

export async function preparePaidTrendingInApp(params: {
  expectedPlanKey: "starter" | "growth";
  subscriptionId: string;
  userId: string;
}) {
  const config = getConfig();
  const body = JSON.stringify(params);
  const timestamp = Date.now().toString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2 * 60_000);

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
      dailyLimit?: unknown;
      error?: unknown;
      feedId?: unknown;
      ok?: unknown;
      pendingSlotCount?: unknown;
      skipped?: unknown;
    } | null;

    if (!response.ok || result?.ok !== true) {
      const detail =
        typeof result?.error === "string" && result.error.trim()
          ? ` ${result.error.trim().slice(0, 240)}`
          : "";
      throw new PaidTrendingPrebuildRequestError(
        `Paid Trending prebuild request failed with HTTP ${response.status}.${detail}`,
        response.status === 408 || response.status === 429 || response.status >= 500,
      );
    }

    return {
      dailyLimit:
        typeof result.dailyLimit === "number" ? result.dailyLimit : null,
      feedId: typeof result.feedId === "string" ? result.feedId : null,
      pendingSlotCount:
        typeof result.pendingSlotCount === "number"
          ? result.pendingSlotCount
          : null,
      skipped: typeof result.skipped === "string" ? result.skipped : null,
    };
  } catch (error) {
    if (error instanceof PaidTrendingPrebuildRequestError) {
      throw error;
    }

    throw new PaidTrendingPrebuildRequestError(
      error instanceof Error
        ? `Paid Trending prebuild request failed: ${error.message}`
        : "Paid Trending prebuild request failed.",
      true,
    );
  } finally {
    clearTimeout(timeout);
  }
}

function getConfig() {
  const appUrl = process.env.UGC_INTERNAL_APP_URL?.trim();
  const dedicatedSecret = process.env.UGC_INTERNAL_SCHEDULING_SECRET?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const secret = dedicatedSecret
    ? dedicatedSecret
    : serviceRoleKey
      ? deriveWorkerScheduleFinalizationSecret(serviceRoleKey)
      : "";

  if (!appUrl) {
    throw new Error("Missing UGC_INTERNAL_APP_URL for paid Trending prebuild.");
  }

  if (!secret || (dedicatedSecret && dedicatedSecret.length < 32)) {
    throw new Error("Internal paid Trending prebuild auth is not configured.");
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
