import { createHash } from "node:crypto";
import { GoogleAuth } from "google-auth-library";

const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });

export function buildTrendingReconciliationTask(params: {
  sourceJobId: string; userId: string; dispatchRevision: string;
}, env: Record<string, string | undefined> = process.env) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.sourceJobId) || !params.userId.trim() || !params.dispatchRevision) {
    throw new Error("Reconciliation delivery requires a durable source job.");
  }
  const projectId = (env.GCP_PROJECT_ID || env.GOOGLE_CLOUD_PROJECT || "").trim();
  if (!projectId || !env.UGC_INTERNAL_APP_URL) throw new Error("Missing Trending reconciliation delivery configuration.");
  const url = new URL("/api/internal/trending/reconcile", env.UGC_INTERNAL_APP_URL);
  if (url.protocol !== "https:") throw new Error("Reconciliation delivery requires HTTPS.");
  const location = env.GCP_CLOUD_TASKS_LOCATION || env.GCP_REGION || "us-central1";
  const prefix = env.GCP_RESOURCE_NAME_PREFIX || "ugc";
  const queue = env.GCP_TRENDING_RECONCILIATION_TASKS_QUEUE || `${prefix}-trending-reconciliation`;
  const revision = createHash("sha256").update(params.dispatchRevision).digest("hex").slice(0, 16);
  const path = `projects/${projectId}/locations/${location}/queues/${queue}`;
  const name = `${path}/tasks/trending-reconcile-${params.sourceJobId}-${revision}`;
  return {
    endpoint: `https://cloudtasks.googleapis.com/v2/${path}/tasks`,
    requestBody: { task: { name, dispatchDeadline: "90s", httpRequest: {
      httpMethod: "POST", url: url.toString(), headers: { "Content-Type": "application/json" },
      body: Buffer.from(JSON.stringify({ sourceJobId: params.sourceJobId, userId: params.userId })).toString("base64"),
      oidcToken: { audience: env.GCP_TRENDING_RECONCILIATION_AUDIENCE || url.toString(),
        serviceAccountEmail: env.GCP_CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL || env.GCP_SCHEDULER_SERVICE_ACCOUNT_EMAIL || `${prefix}-scheduler-sa@${projectId}.iam.gserviceaccount.com` },
    } } },
  };
}

export async function enqueueTrendingFeedReconciliationTask(params: {
  sourceJobId: string; userId: string; dispatchRevision: string;
}) {
  const task = buildTrendingReconciliationTask(params);
  const headers = await auth.getRequestHeaders(task.endpoint);
  const response = await fetch(task.endpoint, { method: "POST", headers: {
    Authorization: headers.get("authorization") || "", "Content-Type": "application/json",
  }, body: JSON.stringify(task.requestBody), signal: AbortSignal.timeout(5_000) });
  if (response.status !== 409 && !response.ok) throw new Error(`Could not dispatch Trending reconciliation: HTTP ${response.status}.`);
}
