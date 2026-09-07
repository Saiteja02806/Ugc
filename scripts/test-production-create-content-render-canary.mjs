import { createClient } from "@supabase/supabase-js";
import { GoogleAuth } from "google-auth-library";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { getGoogleServiceAccountCredentials } from "../lib/gcp/credentials.ts";
import { buildBackgroundJobCloudTaskRequest } from "../lib/jobs/gcp-cloud-tasks-logic.ts";

const terminalStatuses = new Set(["cancelled", "completed", "failed"]);
const localApplicationDefaultCredentialsPath = resolve(
  ".tools",
  "gcloud-config",
  "application_default_credentials.json",
);

loadEnvFile(resolve(".env.local"));

const options = parseArguments(process.argv.slice(2));
const projectId =
  options.projectId ||
  getEnv("GCP_PROJECT_ID", "GOOGLE_CLOUD_PROJECT") ||
  "ugcsaas";
const location =
  options.location || getEnv("GCP_CLOUD_TASKS_LOCATION", "GCP_REGION") || "us-central1";
const cloudTasksQueue =
  options.cloudTasksQueue ||
  getEnv("GCP_VIDEO_RENDER_TASKS_QUEUE") ||
  "ugc-video-render";
const baseUrl = normalizeBaseUrl(
  options.baseUrl ||
    getEnv("PRODUCTION_APP_BASE_URL", "APP_BASE_URL", "UGC_INTERNAL_APP_URL") ||
    "https://www.getugcpilot.com",
);
const dispatchUrl =
  options.dispatchUrl ||
  getEnv("GCP_VIDEO_RENDER_TASK_URL") ||
  `${baseUrl}/api/internal/jobs/launch-render`;
const audience =
  options.audience ||
  getEnv("GCP_BACKGROUND_JOB_TASK_AUDIENCE") ||
  new URL(dispatchUrl).origin;
const schedulerServiceAccountEmail =
  options.serviceAccountEmail ||
  getEnv("GCP_CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL", "GCP_SCHEDULER_SERVICE_ACCOUNT_EMAIL") ||
  `ugc-scheduler-sa@${projectId}.iam.gserviceaccount.com`;
const canaryUserId =
  options.userId ||
  getEnv("GCP_CREATE_CONTENT_RENDER_CANARY_USER_ID") ||
  "production-create-content-render-canary";
const canaryProjectId =
  options.canaryProjectId ||
  getEnv("GCP_CREATE_CONTENT_RENDER_CANARY_PROJECT_ID") ||
  "production-create-content-render-canary";
const dispatchDelaySeconds = normalizeInteger(options.delaySeconds, 10, 5, 300);
const pollTimeoutMs = normalizeInteger(options.pollTimeoutMs, 180_000, 30_000, 10 * 60_000);
const expectedReleaseSha = getOptionalReleaseSha(options.expectedReleaseSha);
const shouldExecute = options.mode === "execute";
let cloudTasksAuth = null;

const canaryPlan = {
  audience,
  cloudTasksQueue,
  dispatchUrl,
  expectedFailure: "overlay must be an object.",
  expectedReleaseSha,
  jobType: "render_create_content_video",
  location,
  projectId,
  schedulerServiceAccountEmail,
  touchesUserMedia: false,
};

if (!shouldExecute) {
  printDryRunPlan(canaryPlan);
  process.exit(0);
}

if (!options.yes) {
  throw new Error("Refusing to run the production canary without --yes.");
}

if (!expectedReleaseSha) {
  throw new Error("--expected-release-sha is required when executing the production canary.");
}

validateExecuteEnvironment();
validateDispatchUrl(dispatchUrl);

const supabase = createClient(
  getRequiredEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
  getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  {
    auth: { autoRefreshToken: false, persistSession: false },
  },
);

await assertVideoRenderCapacity();

let backgroundJobId = null;
let createdTaskPath = null;

try {
  const job = await createCanaryBackgroundJob();
  backgroundJobId = job.id;
  await claimCanaryDelivery(job.id);

  const request = buildBackgroundJobCloudTaskRequest({
    attempt: 0,
    audience,
    dispatchUrl,
    jobId: job.id,
    jobType: "render_create_content_video",
    location,
    projectId,
    queueName: cloudTasksQueue,
    serviceAccountEmail: schedulerServiceAccountEmail,
  });
  request.requestBody.task.scheduleTime = new Date(
    Date.now() + dispatchDelaySeconds * 1_000,
  ).toISOString();

  const task = await createCloudTask(request.endpoint, request.requestBody);
  createdTaskPath =
    typeof task.name === "string" && task.name.trim()
      ? task.name.trim()
      : request.requestBody.task.name;
  await attachCanaryTask(job.id, request.taskName);

  console.log(`Created Create Content render canary job ${job.id}`);
  console.log(`Scheduled Cloud Task ${createdTaskPath}`);

  const completedJob = await waitForTerminalJob(job.id);
  assertExpectedSafeFailure(completedJob, request.taskName);
  await assertReleasedRenderSlot(job.id);

  console.log(`Worker execution: ${completedJob.worker_execution_id}`);
  console.log(`Worker identity: ${completedJob.worker_id}`);
  console.log("Create Content production render canary passed");
} catch (error) {
  console.error(
    `Create Content production render canary failed${backgroundJobId ? ` for job ${backgroundJobId}` : ""}.`,
  );

  if (createdTaskPath) {
    await deleteCloudTask(createdTaskPath).catch((deleteError) => {
      console.error(
        `Could not delete the unfinished canary task: ${getErrorMessage(deleteError)}`,
      );
    });
  }

  if (backgroundJobId) {
    await cancelUnfinishedCanary(backgroundJobId).catch((cancelError) => {
      console.error(
        `Could not cancel the unfinished canary job: ${getErrorMessage(cancelError)}`,
      );
    });
  }

  throw error;
}

function parseArguments(args) {
  const parsed = {
    audience: null,
    baseUrl: null,
    canaryProjectId: null,
    cloudTasksQueue: null,
    delaySeconds: null,
    dispatchUrl: null,
    expectedReleaseSha: null,
    location: null,
    mode: "dry-run",
    pollTimeoutMs: null,
    projectId: null,
    serviceAccountEmail: null,
    userId: null,
    yes: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--dry-run") {
      parsed.mode = "dry-run";
      continue;
    }

    if (argument === "--execute") {
      parsed.mode = "execute";
      continue;
    }

    if (argument === "--yes") {
      parsed.yes = true;
      continue;
    }

    const optionName = {
      "--audience": "audience",
      "--base-url": "baseUrl",
      "--canary-project-id": "canaryProjectId",
      "--cloud-tasks-queue": "cloudTasksQueue",
      "--delay-seconds": "delaySeconds",
      "--dispatch-url": "dispatchUrl",
      "--expected-release-sha": "expectedReleaseSha",
      "--location": "location",
      "--poll-timeout-ms": "pollTimeoutMs",
      "--project-id": "projectId",
      "--service-account-email": "serviceAccountEmail",
      "--user-id": "userId",
    }[argument];

    if (!optionName) {
      throw new Error(`Unknown option ${argument}.`);
    }

    const value = getRequiredArgumentValue(args, (index += 1), argument);

    parsed[optionName] =
      optionName === "delaySeconds" || optionName === "pollTimeoutMs"
        ? Number(value)
        : value;
  }

  return parsed;
}

function getRequiredArgumentValue(args, index, flag) {
  const value = args[index]?.trim();

  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }

  return value;
}

function printDryRunPlan(plan) {
  console.log("Create Content production render canary dry run");
  console.log(JSON.stringify(plan, null, 2));
  console.log(
    "This creates one intentionally malformed render_create_content_video job, sends it through the production Cloud Task and launcher, and expects the deployed worker to reject it before it can read media, write storage, run ffmpeg, or call an AI provider.",
  );
  console.log("Run with --execute --yes --expected-release-sha <commit> after deployment.");
}

function validateExecuteEnvironment() {
  const missing = [];

  if (!getEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL")) {
    missing.push("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!getEnv("SUPABASE_SERVICE_ROLE_KEY")) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  if (
    !getGoogleServiceAccountCredentials() &&
    !getEnv("GOOGLE_APPLICATION_CREDENTIALS") &&
    !existsSync(localApplicationDefaultCredentialsPath) &&
    !getEnv("CLOUDSDK_CONFIG")
  ) {
    missing.push(
      "GOOGLE_CLOUD_CREDENTIALS_JSON, GOOGLE_APPLICATION_CREDENTIALS, or local ADC",
    );
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment for canary: ${missing.join(", ")}.`);
  }
}

function validateDispatchUrl(value) {
  const url = new URL(value);

  if (url.protocol !== "https:") {
    throw new Error("The production dispatch URL must use HTTPS.");
  }

  if (url.pathname !== "/api/internal/jobs/launch-render") {
    throw new Error("The production dispatch URL must target /api/internal/jobs/launch-render.");
  }
}

async function assertVideoRenderCapacity() {
  const { data, error } = await supabase
    .from("video_render_execution_slots")
    .select("slot_number")
    .is("background_job_id", null)
    .limit(1);

  if (error) {
    throw new Error(`Could not inspect video render capacity: ${error.message}`);
  }

  if (!data?.length) {
    throw new Error("Refusing to run the canary while every video render slot is occupied.");
  }
}

async function createCanaryBackgroundJob() {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("background_jobs")
    .insert({
      input_json: {
        canary: "production-create-content-render-invalid-payload",
        expectedReleaseSha,
      },
      job_type: "render_create_content_video",
      max_attempts: 1,
      project_id: canaryProjectId,
      queue_name: "video-render",
      queue_provider: "gcp",
      queued_at: now,
      stage: "queued",
      status: "queued",
      updated_at: now,
      user_id: canaryUserId,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Could not create the canary job: ${error.message}`);
  }

  return data;
}

async function claimCanaryDelivery(jobId) {
  const { error } = await supabase
    .from("background_jobs")
    .update({ last_delivery_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("status", "queued");

  if (error) {
    throw new Error(`Could not claim canary task delivery: ${error.message}`);
  }
}

async function createCloudTask(endpoint, requestBody) {
  const response = await fetch(endpoint, {
    body: JSON.stringify(requestBody),
    cache: "no-store",
    headers: {
      Authorization: await getCloudTasksAuthorizationHeader(endpoint),
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(
      `Could not create Cloud Task: ${response.status} ${await getResponseSummary(response)}`,
    );
  }

  return response.json().catch(() => ({}));
}

async function attachCanaryTask(jobId, taskName) {
  const { error } = await supabase
    .from("background_jobs")
    .update({ queue_message_id: taskName })
    .eq("id", jobId)
    .eq("status", "queued");

  if (error) {
    throw new Error(`Could not attach the canary task to its job: ${error.message}`);
  }
}

function getCloudTasksAuth() {
  if (cloudTasksAuth) {
    return cloudTasksAuth;
  }

  const credentials = getGoogleServiceAccountCredentials();
  const keyFile =
    getEnv("GOOGLE_APPLICATION_CREDENTIALS") ||
    (existsSync(localApplicationDefaultCredentialsPath)
      ? localApplicationDefaultCredentialsPath
      : undefined);

  cloudTasksAuth = new GoogleAuth({
    ...(credentials ? { credentials } : {}),
    ...(!credentials && keyFile ? { keyFile } : {}),
    projectId,
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });

  return cloudTasksAuth;
}

async function getCloudTasksAuthorizationHeader(url) {
  const headers = await getCloudTasksAuth().getRequestHeaders(url);
  const authorization =
    typeof headers.get === "function"
      ? headers.get("authorization")
      : headers.authorization || headers.Authorization;

  if (!authorization) {
    throw new Error("Could not authorize the Cloud Tasks request.");
  }

  return authorization;
}

async function waitForTerminalJob(jobId) {
  const deadline = Date.now() + pollTimeoutMs;

  while (Date.now() < deadline) {
    const job = await getCanaryJob(jobId);
    console.log(
      `poll status=${job.status} queue=${job.queue_message_id ? "attached" : "pending"} execution=${job.worker_execution_id ? "attached" : "pending"}`,
    );

    if (terminalStatuses.has(job.status)) {
      return job;
    }

    await sleep(3_000);
  }

  const job = await getCanaryJob(jobId);
  throw new Error(`Timed out waiting for terminal canary status; last status was ${job.status}.`);
}

async function getCanaryJob(jobId) {
  const { data, error } = await supabase
    .from("background_jobs")
    .select(
      "id,status,queue_message_id,worker_execution_id,worker_id,started_at,failed_at,completed_at,error_message,output_json,output_reference",
    )
    .eq("id", jobId)
    .single();

  if (error) {
    throw new Error(`Could not read the canary job: ${error.message}`);
  }

  return data;
}

function assertExpectedSafeFailure(job, taskName) {
  if (job.status !== "failed") {
    throw new Error(`Expected the malformed canary to fail, got ${job.status}.`);
  }

  if (job.queue_message_id !== taskName) {
    throw new Error("The Cloud Task was not durably attached to the canary job.");
  }

  if (!job.worker_execution_id || !job.worker_id || !job.started_at || !job.failed_at) {
    throw new Error("The canary failed without complete launcher and worker metadata.");
  }

  if (typeof job.error_message !== "string" || !job.error_message.includes("overlay must be an object.")) {
    throw new Error(`Expected the safe overlay validation failure, got ${job.error_message ?? "none"}.`);
  }

  if (job.output_json || job.output_reference) {
    throw new Error("The malformed canary unexpectedly produced output.");
  }

  if (!job.worker_id.endsWith(`:${expectedReleaseSha}`)) {
    throw new Error(
      `Expected worker Git commit ${expectedReleaseSha}, got ${job.worker_id}.`,
    );
  }
}

async function assertReleasedRenderSlot(jobId) {
  const { data, error } = await supabase
    .from("video_render_execution_slots")
    .select("slot_number")
    .eq("background_job_id", jobId);

  if (error) {
    throw new Error(`Could not verify video render slot release: ${error.message}`);
  }

  if (data?.length) {
    throw new Error("The failed canary still owns a video render execution slot.");
  }
}

async function deleteCloudTask(taskPath) {
  const endpoint = `https://cloudtasks.googleapis.com/v2/${taskPath}`;
  const response = await fetch(endpoint, {
    cache: "no-store",
    headers: { Authorization: await getCloudTasksAuthorizationHeader(endpoint) },
    method: "DELETE",
  });

  if (response.status === 404) {
    return;
  }

  if (!response.ok) {
    throw new Error(
      `Could not delete Cloud Task: ${response.status} ${await getResponseSummary(response)}`,
    );
  }
}

async function cancelUnfinishedCanary(jobId) {
  const job = await getCanaryJob(jobId);

  if (terminalStatuses.has(job.status)) {
    return;
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("background_jobs")
    .update({
      completed_at: now,
      error_message: "Cancelled after an incomplete Create Content render production canary.",
      status: "cancelled",
      updated_at: now,
    })
    .eq("id", jobId)
    .in("status", [
      "created",
      "queued",
      "processing",
      "rendering",
      "stalled",
      "uploading_output",
      "waiting_external_service",
    ]);

  if (error) {
    throw new Error(`Could not cancel the unfinished canary: ${error.message}`);
  }
}

function getOptionalReleaseSha(value) {
  if (!value || !value.trim()) {
    return null;
  }

  const sha = value.trim().toLowerCase();

  if (!/^[0-9a-f]{7,64}$/.test(sha)) {
    throw new Error("Expected release SHA must be a 7-64 character hexadecimal Git commit.");
  }

  return sha;
}

function normalizeBaseUrl(value) {
  return value.trim().replace(/\/$/, "");
}

function normalizeInteger(value, fallback, min, max) {
  if (!Number.isInteger(value)) {
    return fallback;
  }

  return Math.min(Math.max(value, min), max);
}

function sleep(milliseconds) {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, milliseconds);
  });
}

function loadEnvFile(envPath) {
  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const match = trimmedLine.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);

    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;

    if (process.env[key] === undefined) {
      process.env[key] = cleanEnvValue(rawValue);
    }
  }
}

function cleanEnvValue(rawValue) {
  const value = rawValue.trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function getRequiredEnv(...names) {
  const value = getEnv(...names);

  if (!value) {
    throw new Error(`Missing ${names.join(" or ")}.`);
  }

  return value;
}

function getEnv(...names) {
  for (const name of names) {
    const value = process.env[name]?.trim();

    if (value) {
      return value;
    }
  }

  return "";
}

async function getResponseSummary(response) {
  const body = await response.text().catch(() => "");
  return body.slice(0, 500);
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : "Unknown error";
}
