import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { GoogleAuth } from "google-auth-library";

// Read-only production telemetry. Never print account, request, job or asset
// identifiers, input prompts, URLs, credentials, or internal error messages.
nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const url = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) throw new Error("Read-only finishing telemetry needs configured database access.");
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: jobs, error } = await db.from("background_jobs")
  .select("id,status,stage,progress,attempt_count,queued_at,started_at,completed_at,failed_at,last_heartbeat_at,created_at,error_code")
  .eq("project_id", "explore").eq("job_type", "render_demo_video")
  .order("created_at", { ascending: false }).limit(100);
if (error) throw new Error(`Finishing telemetry read failed (${error.code ?? "unavailable"}).`);
const ids = (jobs ?? []).map(job => job.id);
const eventResult = ids.length ? await db.from("background_job_events")
  .select("job_id,event_type,created_at,metadata").in("job_id", ids).order("created_at", { ascending: true })
  : { data: [], error: null };
if (eventResult.error) throw new Error(`Finishing stage read failed (${eventResult.error.code ?? "unavailable"}).`);
const elapsed = (start, end) => start && end && Date.parse(end) >= Date.parse(start) ? Date.parse(end) - Date.parse(start) : null;
const now = new Date().toISOString();
const rows = (jobs ?? []).map(job => ({
  createdAt: job.created_at, status: job.status, stage: job.stage, progress: job.progress,
  attempts: job.attempt_count, errorCode: job.error_code,
  queueMs: elapsed(job.queued_at ?? job.created_at, job.started_at),
  dispatchMs: elapsed(job.created_at, (eventResult.data ?? []).find(event => event.job_id === job.id && event.metadata?.stage === "render_job_launched")?.created_at),
  launcherToWorkerMs: elapsed((eventResult.data ?? []).find(event => event.job_id === job.id && event.metadata?.stage === "render_job_launched")?.created_at, job.started_at),
  runMs: elapsed(job.started_at, job.completed_at ?? job.failed_at),
  currentAgeMs: elapsed(job.created_at, now), heartbeatAgeMs: elapsed(job.last_heartbeat_at, now),
  stages: (eventResult.data ?? []).filter(event => event.job_id === job.id && typeof event.metadata?.stage === "string")
    .map(event => ({ stage: event.metadata.stage, atMs: elapsed(job.created_at, event.created_at) })),
}));
const summarize = name => {
  const values = rows.map(row => row[name]).filter(Number.isFinite).sort((a, b) => a - b);
  return values.length ? { count: values.length, min: values[0], median: values[Math.floor(values.length / 2)], p95: values[Math.ceil(values.length * .95) - 1], max: values.at(-1) } : null;
};
let cloudRun;
if (process.argv.includes("--cloud-run")) {
  const project = process.env.GCP_PROJECT_ID?.trim() || process.env.GOOGLE_CLOUD_PROJECT?.trim();
  if (!project) throw new Error("Cloud Run timing reads need a configured project.");
  const region = process.env.GCP_VIDEO_RENDER_JOB_LOCATION?.trim() || process.env.GCP_REGION?.trim() || "us-central1";
  const job = process.env.GCP_VIDEO_RENDER_JOB_NAME?.trim() || "ugc-video-render-job";
  const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  const client = await auth.getClient();
  const response = await client.request({ url: `https://run.googleapis.com/v2/projects/${encodeURIComponent(project)}/locations/${encodeURIComponent(region)}/jobs/${encodeURIComponent(job)}/executions?pageSize=10`, method: "GET" });
  cloudRun = (response.data.executions ?? []).map(execution => ({
    createdAt: execution.createTime, startAt: execution.startTime, completedAt: execution.completionTime,
    provisioningMs: elapsed(execution.createTime, execution.startTime), elapsedMs: elapsed(execution.createTime, execution.completionTime),
    succeeded: execution.succeededCount, failed: execution.failedCount, retried: execution.retriedCount,
    resources: execution.template?.containers?.[0]?.resources,
    conditions: (execution.conditions ?? []).map(condition => ({ type: condition.type, state: condition.state, at: condition.lastTransitionTime, reason: condition.reason })),
  }));
}
console.log(JSON.stringify({ generatedAt: now, readOnly: true, count: rows.length, queueMs: summarize("queueMs"), runMs: summarize("runMs"), jobs: rows, cloudRun }, null, 2));
