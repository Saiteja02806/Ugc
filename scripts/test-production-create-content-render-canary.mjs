import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  GCP_CUTOVER_AUDIT_SIGNATURE_HEADER,
  GCP_CUTOVER_AUDIT_TIMESTAMP_HEADER,
  createGcpCutoverAuditSignature,
  deriveGcpCutoverAuditSecret,
  isValidGcpCutoverAuditSecret,
} from "../lib/internal/gcp-cutover-audit-signature.ts";

const envFilePath = join(process.cwd(), ".env.local");
const terminalStatuses = new Set(["cancelled", "completed", "failed"]);

loadEnvFile(envFilePath);

const options = parseArguments(process.argv.slice(2));
const baseUrl = normalizeBaseUrl(
  options.baseUrl ||
    getEnv("PRODUCTION_APP_BASE_URL", "APP_BASE_URL", "UGC_INTERNAL_APP_URL") ||
    "https://getugcpilot.com",
);
const endpoint = `${baseUrl}/api/internal/gcp-cutover/audit`;
const generationId = options.generationId || randomUUID();
const canaryUserId =
  options.userId ||
  getEnv("GCP_CREATE_CONTENT_RENDER_CANARY_USER_ID") ||
  "production-create-content-render-canary";
const canaryProjectId =
  options.canaryProjectId ||
  getEnv("GCP_CREATE_CONTENT_RENDER_CANARY_PROJECT_ID") ||
  "production-create-content-render-canary";
const pollTimeoutMs = normalizeInteger(
  options.pollTimeoutMs,
  180_000,
  30_000,
  10 * 60_000,
);
const expectedAppReleaseSha = getOptionalReleaseSha(
  options.expectedAppReleaseSha || process.env.UGC_EXPECTED_APP_RELEASE_SHA,
);
const expectedWorkerReleaseSha = getOptionalReleaseSha(
  options.expectedReleaseSha || process.env.UGC_EXPECTED_WORKER_RELEASE_SHA,
);
const shouldExecute = options.mode === "execute";

const canaryPlan = {
  endpoint,
  expectedFailure: "overlay must be an object.",
  expectedAppReleaseSha,
  expectedWorkerReleaseSha,
  jobType: "render_create_content_video",
  maxAttempts: 1,
  queueName: "video-render",
  taskQueueName: "ugc-video-render",
  touchesUserMedia: false,
};

if (!shouldExecute) {
  printDryRunPlan(canaryPlan);
  process.exit(0);
}

if (!options.yes) {
  throw new Error("Refusing to run the production canary without --yes.");
}

if (!expectedAppReleaseSha) {
  throw new Error(
    "--expected-app-release-sha is required when executing the production canary.",
  );
}

if (!expectedWorkerReleaseSha) {
  throw new Error(
    "--expected-release-sha is required when executing the production canary.",
  );
}

validateExecuteEnvironment();

const supabase = createClient(
  getRequiredEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
  getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  {
    auth: { autoRefreshToken: false, persistSession: false },
  },
);

await assertVideoRenderCapacity();

let backgroundJobId = null;

try {
  const auditResponse = await requestProductionAudit();
  const runtime = asRecord(auditResponse.runtime);
  const canary = asRecord(auditResponse.canary);
  backgroundJobId = getRequiredString(canary.jobId, "canary.jobId");
  const taskName = getRequiredString(canary.messageId, "canary.messageId");

  assertAppReleaseIdentity(runtime);
  assertCanaryLaunch(canary, runtime);

  console.log(
    `Production app enqueued Create Content render canary job ${backgroundJobId}`,
  );
  console.log(`Cloud Task ${taskName}`);

  const completedJob = await waitForTerminalJob(backgroundJobId);
  assertExpectedSafeFailure(completedJob, taskName);
  await assertReleasedRenderSlot(backgroundJobId);

  console.log(`Cloud Run operation: ${completedJob.cloud_run_operation_id}`);
  console.log(`Worker identity: ${completedJob.worker_id}`);
  console.log("Create Content production render canary passed");
} catch (error) {
  console.error(
    `Create Content production render canary failed${backgroundJobId ? ` for job ${backgroundJobId}` : ""}.`,
  );

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
    baseUrl: null,
    canaryProjectId: null,
    expectedAppReleaseSha: null,
    expectedReleaseSha: null,
    generationId: null,
    mode: "dry-run",
    pollTimeoutMs: null,
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
      "--base-url": "baseUrl",
      "--canary-project-id": "canaryProjectId",
      "--expected-app-release-sha": "expectedAppReleaseSha",
      "--expected-release-sha": "expectedReleaseSha",
      "--generation-id": "generationId",
      "--poll-timeout-ms": "pollTimeoutMs",
      "--user-id": "userId",
    }[argument];

    if (!optionName) {
      throw new Error(`Unknown option ${argument}.`);
    }

    const value = getRequiredArgumentValue(args, (index += 1), argument);
    parsed[optionName] = optionName === "pollTimeoutMs" ? Number(value) : value;
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
    "This asks the signed production audit route to create one malformed render_create_content_video job. The deployed app schedules its Cloud Task and the deployed worker must reject the payload before it can read media, write storage, run FFmpeg, or call an AI provider.",
  );
  console.log(
    "Run with --execute --yes --expected-app-release-sha <app-commit> --expected-release-sha <worker-commit> after deployment.",
  );
}

function validateExecuteEnvironment() {
  getRequiredAuditSecret();
  getRequiredEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
  getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
}

async function requestProductionAudit() {
  const rawBody = JSON.stringify({
    canaryKind: "create-content-render",
    generationId,
    projectId: canaryProjectId,
    userId: canaryUserId,
  });
  const timestamp = Date.now().toString();
  const signature = createGcpCutoverAuditSignature({
    body: rawBody,
    secret: getRequiredAuditSecret(),
    timestamp,
  });
  const response = await fetch(endpoint, {
    body: rawBody,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      [GCP_CUTOVER_AUDIT_SIGNATURE_HEADER]: signature,
      [GCP_CUTOVER_AUDIT_TIMESTAMP_HEADER]: timestamp,
    },
    method: "POST",
  });
  const text = await response.text();
  const data = parseJsonResponse(text);

  if (!response.ok || data.ok !== true) {
    throw new Error(
      `Production audit endpoint failed: ${response.status} ${summarizeResponse(data, text)}`,
    );
  }

  return data;
}

function assertAppReleaseIdentity(runtime) {
  if (runtime.appGitCommit !== expectedAppReleaseSha) {
    throw new Error(
      `Expected deployed app Git commit ${expectedAppReleaseSha}, got ${runtime.appGitCommit ?? "unreported"}.`,
    );
  }
}

function assertCanaryLaunch(canary, runtime) {
  const required = {
    canaryKind: "create-content-render",
    expectedFailure: "overlay must be an object.",
    jobType: "render_create_content_video",
    maxAttempts: 1,
    messageProvider: "gcp",
    queueName: "video-render",
    taskQueueName: "ugc-video-render",
  };

  for (const [field, expected] of Object.entries(required)) {
    if (canary[field] !== expected) {
      throw new Error(
        `Expected canary.${field}=${expected}, got ${canary[field] ?? "unreported"}.`,
      );
    }
  }

  if (runtime.workerQueue !== "video-render") {
    throw new Error(
      `Expected production audit worker queue video-render, got ${runtime.workerQueue ?? "unreported"}.`,
    );
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
    throw new Error(
      "Refusing to run the canary while every video render slot is occupied.",
    );
  }
}

async function waitForTerminalJob(jobId) {
  const deadline = Date.now() + pollTimeoutMs;

  while (Date.now() < deadline) {
    const job = await getCanaryJob(jobId);
    console.log(
      `poll status=${job.status} queue=${job.queue_message_id ? "attached" : "pending"} cloudRunOperation=${job.cloud_run_operation_id ? "attached" : "pending"}`,
    );

    if (terminalStatuses.has(job.status)) {
      return job;
    }

    await sleep(3_000);
  }

  const job = await getCanaryJob(jobId);
  throw new Error(
    `Timed out waiting for terminal canary status; last status was ${job.status}.`,
  );
}

async function getCanaryJob(jobId) {
  const { data, error } = await supabase
    .from("background_jobs")
    .select(
      "id,status,queue_message_id,cloud_run_operation_id,worker_id,started_at,failed_at,completed_at,error_message,output_json,output_reference",
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

  if (
    !job.cloud_run_operation_id ||
    !job.worker_id ||
    !job.started_at ||
    !job.failed_at
  ) {
    throw new Error("The canary failed without complete launcher and worker metadata.");
  }

  if (
    typeof job.error_message !== "string" ||
    !job.error_message.includes("overlay must be an object.")
  ) {
    throw new Error(
      `Expected the safe overlay validation failure, got ${job.error_message ?? "none"}.`,
    );
  }

  if (job.output_json || job.output_reference) {
    throw new Error("The malformed canary unexpectedly produced output.");
  }

  if (!job.worker_id.endsWith(`:${expectedWorkerReleaseSha}`)) {
    throw new Error(
      `Expected worker Git commit ${expectedWorkerReleaseSha}, got ${job.worker_id}.`,
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
      error_message:
        "Cancelled after an incomplete Create Content render production canary.",
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

function getRequiredAuditSecret() {
  const dedicatedSecret = process.env.UGC_INTERNAL_CUTOVER_AUDIT_SECRET?.trim();

  if (dedicatedSecret !== undefined) {
    if (!isValidGcpCutoverAuditSecret(dedicatedSecret)) {
      throw new Error("UGC_INTERNAL_CUTOVER_AUDIT_SECRET is too short.");
    }

    return dedicatedSecret;
  }

  return deriveGcpCutoverAuditSecret(getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"));
}

function getOptionalReleaseSha(value) {
  if (!value || !value.trim()) {
    return null;
  }

  const sha = value.trim().toLowerCase();

  if (!/^[0-9a-f]{7,64}$/.test(sha)) {
    throw new Error(
      "Expected release SHA must be a 7-64 character hexadecimal Git commit.",
    );
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

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function getRequiredString(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${fieldName} must be a non-empty string.`);
  }

  return value.trim();
}

function parseJsonResponse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function summarizeResponse(data, text) {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const message = data.message || data.error;

    if (typeof message === "string" && message.trim()) {
      return message.slice(0, 500);
    }
  }

  return text.slice(0, 500);
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

function getErrorMessage(error) {
  return error instanceof Error ? error.message : "Unknown error";
}
