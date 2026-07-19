import { createClient } from "@supabase/supabase-js";
import { GoogleAuth } from "google-auth-library";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { getGoogleServiceAccountCredentials } from "../lib/gcp/credentials.ts";
import {
  buildGcpCloudTasksCreateTaskRequest,
  buildSocialPublishDispatchUrl,
  DEFAULT_GCP_CLOUD_TASKS_LOCATION,
  DEFAULT_GCP_SOCIAL_PUBLISH_TASKS_QUEUE,
  getDefaultGcpSchedulerServiceAccountEmail,
  getGcpSocialPublishScheduleName,
} from "../lib/scheduling/gcp-cloud-tasks-scheduler-logic.ts";

loadEnvFile(resolve(".env.local"));

const options = parseArguments(process.argv.slice(2));
const localApplicationDefaultCredentialsPath = resolve(
  ".tools",
  "gcloud-config",
  "application_default_credentials.json",
);
const projectId =
  options.projectId ||
  process.env.GCP_PROJECT_ID?.trim() ||
  process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
  "ugcsaas";
const location =
  options.location ||
  process.env.GCP_CLOUD_TASKS_LOCATION?.trim() ||
  process.env.GCP_REGION?.trim() ||
  DEFAULT_GCP_CLOUD_TASKS_LOCATION;
const cloudTasksQueue =
  options.cloudTasksQueue ||
  process.env.GCP_SOCIAL_PUBLISH_TASKS_QUEUE?.trim() ||
  DEFAULT_GCP_SOCIAL_PUBLISH_TASKS_QUEUE;
const appBaseUrl =
  options.baseUrl ||
  process.env.APP_BASE_URL?.trim() ||
  process.env.UGC_INTERNAL_APP_URL?.trim() ||
  "https://getugcpilot.com";
const dispatchUrl =
  options.dispatchUrl ||
  process.env.GCP_SOCIAL_PUBLISH_DISPATCH_URL?.trim() ||
  buildSocialPublishDispatchUrl(appBaseUrl);
const schedulerServiceAccountEmail =
  options.serviceAccountEmail ||
  process.env.GCP_CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL?.trim() ||
  getDefaultGcpSchedulerServiceAccountEmail({ projectId });
const dispatchDelaySeconds = normalizeInteger(
  options.delaySeconds,
  10,
  0,
  300,
);
const pollTimeoutMs = normalizeInteger(
  options.pollTimeoutMs,
  90_000,
  15_000,
  10 * 60_000,
);
const workerGraceMs = normalizeInteger(
  options.workerGraceMs,
  30_000,
  0,
  5 * 60_000,
);
const targetId = options.targetId || randomUUID();
const taskName = options.taskName || getGcpSocialPublishScheduleName(targetId);
const canaryUserId =
  options.userId ||
  process.env.GCP_SOCIAL_DISPATCH_CANARY_USER_ID?.trim() ||
  "gcp-social-dispatch-canary";
const scheduledFor = new Date(
  Date.now() + dispatchDelaySeconds * 1_000,
).toISOString();
const shouldExecute = options.mode === "execute";
let cloudTasksAuth = null;

const canaryPlan = {
  appBaseUrl,
  cloudTasksQueue,
  dispatchUrl,
  jobType: "publish_social_post",
  location,
  projectId,
  schedulerServiceAccountEmail,
  scheduledFor,
  targetId,
  taskName,
  userId: canaryUserId,
  workerGraceMs,
};

if (!shouldExecute) {
  printDryRunPlan(canaryPlan);
  process.exit(0);
}

if (!options.yes) {
  throw new Error(
    "Refusing to create the Cloud Tasks dispatch canary without --yes.",
  );
}

validateExecuteEnv();
validateDispatchUrl(dispatchUrl);

const supabase = createClient(
  getRequiredEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
  getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);
const backgroundJob = await createCanaryBackgroundJob();
let createdTaskPath = null;

console.log(`Created canary background job ${backgroundJob.id}`);
console.log(`Using fake scheduled target ${targetId}`);

try {
  const request = buildGcpCloudTasksCreateTaskRequest({
    audience: dispatchUrl,
    dispatchUrl,
    input: {
      jobId: backgroundJob.id,
      scheduledFor,
      targetId,
    },
    location,
    projectId,
    queueName: cloudTasksQueue,
    serviceAccountEmail: schedulerServiceAccountEmail,
    taskName,
  });

  const task = await createCloudTask(request.endpoint, request.requestBody);
  createdTaskPath = request.taskPath;
  console.log(`Created Cloud Task ${task.name ?? request.taskPath}`);
  console.log(`Scheduled dispatch at ${scheduledFor}`);

  const dispatchedJob = await waitForDispatchOutcome(backgroundJob.id);

  if (!dispatchedJob.aws_message_id) {
    throw new Error(
      `Cloud Tasks did not attach a queue message id. Final status: ${dispatchedJob.status}.`,
    );
  }

  if (isExpectedSafeWorkerFailure(dispatchedJob)) {
    console.log(`Attached Pub/Sub message ${dispatchedJob.aws_message_id}`);
    console.log(
      `Always-on social worker consumed dummy job ${backgroundJob.id} safely`,
    );
    console.log(`Final status: ${dispatchedJob.status}`);
    console.log(`Error: ${dispatchedJob.error_message}`);
    console.log("GCP Cloud Tasks social dispatch canary passed");
    process.exit(0);
  }

  if (dispatchedJob.status !== "queued") {
    throw new Error(
      `The canary job ended as ${dispatchedJob.status}; expected queued or safe fake-target failure.`,
    );
  }

  const cancelledJob = await cancelQueuedCanaryJob(backgroundJob.id);

  if (!cancelledJob) {
    throw new Error(
      "The canary dispatch succeeded, but the queued dummy job could not be cancelled.",
    );
  }

  console.log(`Attached Pub/Sub message ${dispatchedJob.aws_message_id}`);
  console.log(`Cancelled dummy background job ${backgroundJob.id}`);
  console.log("GCP Cloud Tasks social dispatch canary passed");
} catch (error) {
  console.error(
    `GCP Cloud Tasks social dispatch canary failed for job ${backgroundJob.id}`,
  );

  if (createdTaskPath) {
    await deleteCloudTask(createdTaskPath).catch((deleteError) => {
      console.error(
        `Could not delete Cloud Task ${createdTaskPath}: ${getErrorMessage(deleteError)}`,
      );
    });
  }

  await cancelQueuedCanaryJob(backgroundJob.id).catch((cancelError) => {
    console.error(
      `Could not cancel canary background job ${backgroundJob.id}: ${getErrorMessage(cancelError)}`,
    );
  });

  throw error;
}

function parseArguments(args) {
  const parsed = {
    baseUrl: null,
    cloudTasksQueue: null,
    delaySeconds: null,
    dispatchUrl: null,
    location: null,
    mode: "dry-run",
    pollTimeoutMs: null,
    projectId: null,
    serviceAccountEmail: null,
    targetId: null,
    taskName: null,
    userId: null,
    workerGraceMs: null,
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

    if (argument === "--base-url") {
      parsed.baseUrl = getRequiredArgumentValue(args, (index += 1), argument);
      continue;
    }

    if (argument === "--cloud-tasks-queue") {
      parsed.cloudTasksQueue = getRequiredArgumentValue(
        args,
        (index += 1),
        argument,
      );
      continue;
    }

    if (argument === "--delay-seconds") {
      parsed.delaySeconds = Number(
        getRequiredArgumentValue(args, (index += 1), argument),
      );
      continue;
    }

    if (argument === "--dispatch-url") {
      parsed.dispatchUrl = getRequiredArgumentValue(
        args,
        (index += 1),
        argument,
      );
      continue;
    }

    if (argument === "--location") {
      parsed.location = getRequiredArgumentValue(args, (index += 1), argument);
      continue;
    }

    if (argument === "--poll-timeout-ms") {
      parsed.pollTimeoutMs = Number(
        getRequiredArgumentValue(args, (index += 1), argument),
      );
      continue;
    }

    if (argument === "--worker-grace-ms") {
      parsed.workerGraceMs = Number(
        getRequiredArgumentValue(args, (index += 1), argument),
      );
      continue;
    }

    if (argument === "--project-id") {
      parsed.projectId = getRequiredArgumentValue(args, (index += 1), argument);
      continue;
    }

    if (argument === "--service-account-email") {
      parsed.serviceAccountEmail = getRequiredArgumentValue(
        args,
        (index += 1),
        argument,
      );
      continue;
    }

    if (argument === "--target-id") {
      parsed.targetId = getRequiredArgumentValue(args, (index += 1), argument);
      continue;
    }

    if (argument === "--task-name") {
      parsed.taskName = getRequiredArgumentValue(args, (index += 1), argument);
      continue;
    }

    if (argument === "--user-id") {
      parsed.userId = getRequiredArgumentValue(args, (index += 1), argument);
      continue;
    }

    throw new Error(`Unknown option ${argument}.`);
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
  const missingEnv = getMissingExecuteEnvVars();

  console.log("GCP Cloud Tasks social dispatch canary dry run");
  console.log(
    "This would create one fake publish_social_post job, one Cloud Task, verify the deployed dispatch route attaches a Pub/Sub message id, then either cancel the dummy job or accept the live worker's safe fake-target failure.",
  );
  console.log(JSON.stringify(plan, null, 2));

  if (missingEnv.length > 0) {
    console.log(`Missing for --execute: ${missingEnv.join(", ")}`);
  }
}

function validateExecuteEnv() {
  const missingEnv = getMissingExecuteEnvVars();

  if (missingEnv.length > 0) {
    throw new Error(`Missing required env for canary: ${missingEnv.join(", ")}`);
  }
}

function getMissingExecuteEnvVars() {
  const missing = [];

  if (!getEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL")) {
    missing.push("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!getEnv("SUPABASE_SERVICE_ROLE_KEY")) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  if (!getEnv("GCP_PROJECT_ID", "GOOGLE_CLOUD_PROJECT")) {
    missing.push("GCP_PROJECT_ID or GOOGLE_CLOUD_PROJECT");
  }

  if (
    !getGoogleServiceAccountCredentials() &&
    !getEnv("GOOGLE_APPLICATION_CREDENTIALS") &&
    !getLocalApplicationDefaultCredentialsPath() &&
    !getEnv("CLOUDSDK_CONFIG")
  ) {
    missing.push(
      "GOOGLE_CLOUD_CREDENTIALS_JSON or GOOGLE_APPLICATION_CREDENTIALS or local ADC",
    );
  }

  return missing;
}

function validateDispatchUrl(value) {
  const url = new URL(value);

  if (url.protocol !== "https:") {
    throw new Error("Cloud Tasks dispatch URL must use https.");
  }
}

async function createCanaryBackgroundJob() {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("background_jobs")
    .insert({
      input_json: {
        canary: "gcp-cloud-tasks-social-dispatch",
        targetId,
      },
      job_type: "publish_social_post",
      project_id: "gcp-social-dispatch-canary",
      queue_name: "social-publish",
      status: "queued",
      updated_at: now,
      user_id: canaryUserId,
    })
    .select("id,status,aws_message_id")
    .single();

  if (error) {
    throw new Error(`Could not create canary background job: ${error.message}`);
  }

  return data;
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
      `Could not create Cloud Task: ${response.status} ${await getResponseSummary(
        response,
      )}`,
    );
  }

  return response.json().catch(() => ({}));
}

async function deleteCloudTask(taskPath) {
  const endpoint = `https://cloudtasks.googleapis.com/v2/${taskPath}`;
  const response = await fetch(endpoint, {
    cache: "no-store",
    headers: {
      Authorization: await getCloudTasksAuthorizationHeader(endpoint),
    },
    method: "DELETE",
  });

  if (response.status === 404) {
    return;
  }

  if (!response.ok) {
    throw new Error(
      `Could not delete Cloud Task: ${response.status} ${await getResponseSummary(
        response,
      )}`,
    );
  }
}

function getCloudTasksAuth() {
  if (cloudTasksAuth) {
    return cloudTasksAuth;
  }

  const credentials = getGoogleServiceAccountCredentials();
  const keyFile =
    getEnv("GOOGLE_APPLICATION_CREDENTIALS") ||
    getLocalApplicationDefaultCredentialsPath();
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
    throw new Error("Could not authorize GCP Cloud Tasks request.");
  }

  return authorization;
}

async function waitForDispatchOutcome(jobId) {
  const deadline = Date.now() + pollTimeoutMs;
  let firstMessageAttachedAt = 0;

  while (Date.now() < deadline) {
    const job = await getCanaryJob(jobId);

    console.log(
      `poll dispatch job=${job.id} status=${job.status} message=${job.aws_message_id ? "attached" : "pending"}`,
    );

    if (isTerminalJobStatus(job.status)) {
      return job;
    }

    if (job.aws_message_id) {
      firstMessageAttachedAt ||= Date.now();

      if (Date.now() - firstMessageAttachedAt >= workerGraceMs) {
        return job;
      }
    }

    await sleep(3_000);
  }

  return getCanaryJob(jobId);
}

async function getCanaryJob(jobId) {
  const { data, error } = await supabase
    .from("background_jobs")
    .select("id,status,aws_message_id,error_message,worker_id")
    .eq("id", jobId)
    .single();

  if (error) {
    throw new Error(`Could not read canary background job: ${error.message}`);
  }

  return data;
}

function isExpectedSafeWorkerFailure(job) {
  return (
    job.status === "failed" &&
    typeof job.error_message === "string" &&
    job.error_message.includes("Publish target was not found.")
  );
}

function isTerminalJobStatus(status) {
  return status === "cancelled" || status === "completed" || status === "failed";
}

async function cancelQueuedCanaryJob(jobId) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("background_jobs")
    .update({
      completed_at: now,
      status: "cancelled",
      updated_at: now,
    })
    .eq("id", jobId)
    .eq("status", "queued")
    .select("id,status")
    .maybeSingle();

  if (error) {
    throw new Error(`Could not cancel canary background job: ${error.message}`);
  }

  return data;
}

function sleep(milliseconds) {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, milliseconds);
  });
}

function normalizeInteger(value, fallback, min, max) {
  return Number.isInteger(value) && value >= min && value <= max
    ? value
    : fallback;
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
    throw new Error(`Missing ${names.join(" or ")}`);
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

function getLocalApplicationDefaultCredentialsPath() {
  return existsSync(localApplicationDefaultCredentialsPath)
    ? localApplicationDefaultCredentialsPath
    : "";
}

async function getResponseSummary(response) {
  const body = await response.text().catch(() => "");

  return body.slice(0, 500);
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : "Unknown error";
}
