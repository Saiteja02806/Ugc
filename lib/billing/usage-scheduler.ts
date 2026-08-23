export const BILLING_USAGE_FLUSH_PATH = "/api/internal/billing/usage/flush";
export const DEFAULT_BILLING_USAGE_FLUSH_LIMIT = 50;
export const DEFAULT_BILLING_USAGE_SCHEDULE = "*/5 * * * *";
export const DEFAULT_BILLING_USAGE_SCHEDULER_JOB = "ugc-billing-usage-flush";

type BuildBillingUsageSchedulerRequestParams = {
  audience: string;
  jobName: string;
  location: string;
  projectId: string;
  schedule?: string;
  serviceAccountEmail: string;
  targetUrl: string;
};

export function buildBillingUsageFlushAudience(baseUrl: string) {
  return buildBillingUsageUrl(baseUrl, false);
}

export function buildBillingUsageFlushTargetUrl(
  baseUrl: string,
  limit = DEFAULT_BILLING_USAGE_FLUSH_LIMIT,
) {
  const targetUrl = new URL(buildBillingUsageUrl(baseUrl, false));
  const normalizedLimit = Number.isFinite(limit)
    ? Math.max(1, Math.min(Math.trunc(limit), 100))
    : DEFAULT_BILLING_USAGE_FLUSH_LIMIT;
  targetUrl.searchParams.set(
    "limit",
    String(normalizedLimit),
  );
  return targetUrl.toString();
}

export function buildBillingUsageSchedulerRequest(
  params: BuildBillingUsageSchedulerRequestParams,
) {
  assertHttpsUrl(params.audience, "billing usage scheduler audience");
  assertHttpsUrl(params.targetUrl, "billing usage scheduler target");

  const jobPath = `projects/${params.projectId}/locations/${params.location}/jobs/${params.jobName}`;
  const collectionEndpoint = `https://cloudscheduler.googleapis.com/v1/projects/${encodeURIComponent(
    params.projectId,
  )}/locations/${encodeURIComponent(params.location)}/jobs`;
  const jobEndpoint = `https://cloudscheduler.googleapis.com/v1/${jobPath}`;
  const updateMask = [
    "attemptDeadline",
    "description",
    "httpTarget",
    "retryConfig",
    "schedule",
    "timeZone",
  ].join(",");

  return {
    collectionEndpoint,
    jobEndpoint,
    jobPath,
    requestBody: {
      attemptDeadline: "60s",
      description: "Retries pending Dodo usage events for completed AI generations.",
      httpTarget: {
        body: Buffer.from("{}", "utf8").toString("base64"),
        headers: { "Content-Type": "application/json" },
        httpMethod: "POST",
        oidcToken: {
          audience: params.audience,
          serviceAccountEmail: params.serviceAccountEmail,
        },
        uri: params.targetUrl,
      },
      name: jobPath,
      retryConfig: {
        maxBackoffDuration: "300s",
        maxDoublings: 3,
        maxRetryDuration: "900s",
        minBackoffDuration: "10s",
        retryCount: 3,
      },
      schedule: params.schedule ?? DEFAULT_BILLING_USAGE_SCHEDULE,
      timeZone: "Etc/UTC",
    },
    updateEndpoint: `${jobEndpoint}?updateMask=${encodeURIComponent(updateMask)}`,
  };
}

function buildBillingUsageUrl(baseUrl: string, includeQuery: boolean) {
  const url = new URL(BILLING_USAGE_FLUSH_PATH, ensureUrlSlash(baseUrl.trim()));
  assertHttpsUrl(url.toString(), "billing usage URL");

  if (!includeQuery) {
    url.search = "";
    url.hash = "";
  }

  return url.toString();
}

function assertHttpsUrl(rawUrl: string, label: string) {
  const url = new URL(rawUrl);

  if (url.protocol !== "https:") {
    throw new Error(`${label} must use HTTPS.`);
  }
}

function ensureUrlSlash(value: string) {
  if (!value) throw new Error("Missing billing application base URL.");
  return value.endsWith("/") ? value : `${value}/`;
}
