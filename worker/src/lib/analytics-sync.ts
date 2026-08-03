import {
  createWorkerScheduleFinalizationSignature,
  deriveWorkerScheduleFinalizationSecret,
} from "./schedule-finalization.js";

const SYNC_PATH = "/api/internal/jobs/sync-analytics";
const SIGNATURE_HEADER = "x-ugc-finalization-signature";
const TIMESTAMP_HEADER = "x-ugc-finalization-timestamp";

export async function syncAnalyticsInApp(jobId: string) {
  const config = getConfig();
  const body = JSON.stringify({ jobId });
  const timestamp = Date.now().toString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15 * 60_000);

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
    const result = (await response.json().catch(() => null)) as
      | ({ ok: true } & Record<string, unknown>)
      | { ok?: false }
      | null;

    if (!response.ok || result?.ok !== true) {
      throw new Error(
        `Analytics synchronization failed with HTTP ${response.status}.`,
      );
    }

    const { ok: _ok, ...output } = result;
    void _ok;
    return output;
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
    throw new Error("Missing UGC_INTERNAL_APP_URL for analytics.");
  }

  if (!secret || (dedicatedSecret && dedicatedSecret.length < 32)) {
    throw new Error("Internal analytics auth is not configured.");
  }

  const endpoint = new URL(
    SYNC_PATH,
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
