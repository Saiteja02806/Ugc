import { createHmac } from "node:crypto";

const FINALIZATION_PATH = "/api/internal/schedules/finalize";
const WALL_TEXT_FINALIZATION_PATH = "/api/internal/schedules/wall-text-finalize";
const FINALIZATION_SIGNATURE_HEADER = "x-ugc-finalization-signature";
const FINALIZATION_TIMESTAMP_HEADER = "x-ugc-finalization-timestamp";
const MAX_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 30_000;
const RETRY_DELAYS_MS = [500, 1_500];
const DERIVATION_CONTEXT = "ugc-schedule-finalization-v1";
const SCHEDULE_STATUSES = new Set([
  "cancelled",
  "draft",
  "failed",
  "partially_failed",
  "published",
  "publishing",
  "scheduled",
  "scheduling",
]);

export type ScheduleFinalizationResult = {
  created: boolean;
  scheduleId: string;
  skipped: boolean;
  status: string;
};

export type WallTextScheduleFinalizationResult = {
  finalizedCount: number;
  scheduleCount: number;
};

export function createWorkerScheduleFinalizationSignature(params: {
  body: string;
  secret: string;
  timestamp: string;
}) {
  const digest = createHmac("sha256", params.secret)
    .update(`${params.timestamp}.${params.body}`, "utf8")
    .digest("hex");

  return `v1=${digest}`;
}

export function deriveWorkerScheduleFinalizationSecret(sourceSecret: string) {
  return createHmac("sha256", sourceSecret)
    .update(DERIVATION_CONTEXT, "utf8")
    .digest("hex");
}

export async function finalizeRenderedSchedule(params: {
  renderId: string;
  scheduleId: string;
  userId: string;
}): Promise<ScheduleFinalizationResult> {
  const config = getFinalizationConfig(FINALIZATION_PATH);
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
          [FINALIZATION_SIGNATURE_HEADER]:
            createWorkerScheduleFinalizationSignature({
              body,
              secret: config.secret,
              timestamp,
            }),
          [FINALIZATION_TIMESTAMP_HEADER]: timestamp,
        },
        method: "POST",
        signal: controller.signal,
      });
      const responseBody = await readResponseBody(response);

      if (response.ok && isSuccessfulResponse(responseBody)) {
        return {
          created: responseBody.created,
          scheduleId: responseBody.scheduleId,
          skipped: responseBody.skipped,
          status: responseBody.status,
        };
      }

      const message = getResponseErrorMessage(responseBody, response.status);
      const retryable =
        response.status === 408 ||
        response.status === 429 ||
        response.status >= 500;

      throw new FinalizationRequestError(message, retryable);
    } catch (error) {
      lastError = error;
      const retryable =
        !(error instanceof FinalizationRequestError) || error.retryable;

      if (!retryable || attempt === MAX_ATTEMPTS) {
        throw error;
      }
    } finally {
      clearTimeout(timeout);
    }

    await sleep(RETRY_DELAYS_MS[attempt - 1] ?? 1_500);
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Could not finalize the rendered schedule.");
}

export async function finalizeRenderedWallTextSchedules(params: {
  assignmentId: string;
  mediaAssetId: string;
  renderId: string;
  userId: string;
}): Promise<WallTextScheduleFinalizationResult> {
  const config = getFinalizationConfig(WALL_TEXT_FINALIZATION_PATH);
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
          [FINALIZATION_SIGNATURE_HEADER]:
            createWorkerScheduleFinalizationSignature({
              body,
              secret: config.secret,
              timestamp,
            }),
          [FINALIZATION_TIMESTAMP_HEADER]: timestamp,
        },
        method: "POST",
        signal: controller.signal,
      });
      const responseBody = await readResponseBody(response);

      if (response.ok && isSuccessfulWallTextResponse(responseBody)) {
        return responseBody;
      }

      const message = getResponseErrorMessage(responseBody, response.status);
      const retryable =
        response.status === 408 ||
        response.status === 429 ||
        response.status >= 500;

      throw new FinalizationRequestError(message, retryable);
    } catch (error) {
      lastError = error;
      const retryable =
        !(error instanceof FinalizationRequestError) || error.retryable;

      if (!retryable || attempt === MAX_ATTEMPTS) {
        throw error;
      }
    } finally {
      clearTimeout(timeout);
    }

    await sleep(RETRY_DELAYS_MS[attempt - 1] ?? 1_500);
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Could not finalize the rendered Wall-of-text schedule.");
}

class FinalizationRequestError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.retryable = retryable;
  }
}

function getFinalizationConfig(path: string) {
  const rawAppUrl = process.env.UGC_INTERNAL_APP_URL?.trim();
  const dedicatedSecret =
    process.env.UGC_INTERNAL_SCHEDULING_SECRET?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const secret = dedicatedSecret
    ? dedicatedSecret
    : serviceRoleKey
      ? deriveWorkerScheduleFinalizationSecret(serviceRoleKey)
      : "";

  if (!rawAppUrl) {
    throw new Error("Missing UGC_INTERNAL_APP_URL for schedule finalization.");
  }

  if (!secret || (dedicatedSecret && dedicatedSecret.length < 32)) {
    throw new Error(
      "Set UGC_INTERNAL_SCHEDULING_SECRET to at least 32 characters or provide SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  let endpoint: URL;

  try {
    endpoint = new URL(path, `${rawAppUrl.replace(/\/+$/, "")}/`);
  } catch {
    throw new Error("UGC_INTERNAL_APP_URL must be a valid URL.");
  }

  if (
    endpoint.protocol !== "https:" &&
    !["127.0.0.1", "localhost"].includes(endpoint.hostname)
  ) {
    throw new Error("UGC_INTERNAL_APP_URL must use HTTPS.");
  }

  return {
    endpoint,
    secret,
  };
}

async function readResponseBody(response: Response) {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

function isSuccessfulResponse(
  value: unknown,
): value is ScheduleFinalizationResult & { ok: true } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const response = value as Record<string, unknown>;

  return (
    response.ok === true &&
    typeof response.created === "boolean" &&
    typeof response.scheduleId === "string" &&
    response.scheduleId.length > 0 &&
    typeof response.skipped === "boolean" &&
    typeof response.status === "string" &&
    SCHEDULE_STATUSES.has(response.status)
  );
}

function isSuccessfulWallTextResponse(
  value: unknown,
): value is WallTextScheduleFinalizationResult & { ok: true } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const response = value as Record<string, unknown>;

  return (
    response.ok === true &&
    typeof response.finalizedCount === "number" &&
    Number.isInteger(response.finalizedCount) &&
    response.finalizedCount >= 0 &&
    typeof response.scheduleCount === "number" &&
    Number.isInteger(response.scheduleCount) &&
    response.scheduleCount >= 0
  );
}

function getResponseErrorMessage(value: unknown, status: number) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const message = (value as Record<string, unknown>).message;

    if (typeof message === "string" && message.trim()) {
      return message.trim().slice(0, 500);
    }
  }

  return `Schedule finalization request failed with HTTP ${status}.`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
