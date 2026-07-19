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
const terminalJobStatuses = new Set(["cancelled", "completed", "failed"]);
const aiGenerationJobTypes = [
  "generate_avatar",
  "generate_image",
  "generate_hook_video",
];

loadLocalEnv();

const options = parseArguments(process.argv.slice(2));
const baseUrl = (
  options.baseUrl ||
  process.env.PRODUCTION_APP_BASE_URL?.trim() ||
  "https://getugcpilot.com"
).replace(/\/$/, "");
const endpoint = `${baseUrl}/api/internal/gcp-cutover/audit`;
const generationId = options.generationId || randomUUID();
const canaryUserId =
  options.userId ||
  process.env.GCP_PRODUCTION_CUTOVER_AUDIT_USER_ID?.trim() ||
  "production-gcp-cutover-audit";
const canaryProjectId =
  options.canaryProjectId ||
  process.env.GCP_PRODUCTION_CUTOVER_AUDIT_PROJECT_ID?.trim() ||
  "production-gcp-cutover-audit";
const pollTimeoutMs = normalizeInteger(
  options.pollTimeoutMs,
  120_000,
  15_000,
  10 * 60_000,
);
const shouldExecute = options.mode === "execute";

const auditPlan = {
  endpoint,
  expectedProviders: {
    queueProvider: "gcp",
    socialSchedulerProvider: "gcp",
    storageProvider: "gcp",
  },
  expectedWorkerResult:
    "failed generate_image canary with missing prompt before any AI provider call",
  generationId,
};

if (!shouldExecute) {
  printDryRunPlan(auditPlan);
  process.exit(0);
}

if (!options.yes) {
  throw new Error(
    "Refusing to run the production cutover audit without --yes.",
  );
}

validateExecuteEnv();

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

await assertNoOpenRealAiGenerationJobs();

let canaryJobId = null;

try {
  const auditResponse = await requestProductionAudit();
  const runtime = auditResponse.runtime ?? {};
  const canary = auditResponse.canary ?? {};

  assertProvider("queueProvider", runtime.queueProvider);
  assertProvider("storageProvider", runtime.storageProvider);
  assertProvider("socialSchedulerProvider", runtime.socialSchedulerProvider);

  if (canary.messageProvider !== "gcp") {
    throw new Error(
      `Expected production app to enqueue via GCP, got ${canary.messageProvider ?? "unknown"}.`,
    );
  }

  if (canary.topicName !== "ugc-ai-generation") {
    throw new Error(
      `Expected ugc-ai-generation Pub/Sub topic, got ${canary.topicName ?? "unknown"}.`,
    );
  }

  canaryJobId = getRequiredString(canary.jobId, "canary.jobId");
  console.log(`Production app enqueued GCP canary job ${canaryJobId}`);
  console.log(`Pub/Sub message ${canary.messageId}`);

  const finalJob = await waitForJobCompletion(canaryJobId);

  assertExpectedCanaryFailure(finalJob);

  console.log(`Live Cloud Run worker consumed job ${canaryJobId}`);
  console.log(`Final status: ${finalJob.status}`);
  console.log(`Worker id: ${finalJob.worker_id}`);
  console.log(`Error: ${finalJob.error_message}`);
  console.log("Production GCP cutover audit passed");
} catch (error) {
  if (canaryJobId) {
    await cancelOpenCanaryJob(canaryJobId).catch((cancelError) => {
      console.error(
        `Could not cancel cutover canary job ${canaryJobId}: ${getErrorMessage(cancelError)}`,
      );
    });
  }

  throw error;
}

function parseArguments(args) {
  const parsed = {
    baseUrl: null,
    canaryProjectId: null,
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

    if (argument === "--base-url") {
      parsed.baseUrl = getRequiredArgumentValue(args, (index += 1), argument);
      continue;
    }

    if (argument === "--canary-project-id") {
      parsed.canaryProjectId = getRequiredArgumentValue(
        args,
        (index += 1),
        argument,
      );
      continue;
    }

    if (argument === "--generation-id") {
      parsed.generationId = getRequiredArgumentValue(
        args,
        (index += 1),
        argument,
      );
      continue;
    }

    if (argument === "--poll-timeout-ms") {
      parsed.pollTimeoutMs = Number(
        getRequiredArgumentValue(args, (index += 1), argument),
      );
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

function printDryRunPlan(plan) {
  console.log("Production GCP cutover audit dry run");
  console.log(JSON.stringify(plan, null, 2));
  console.log(
    "This checks the deployed app's provider selection, creates one invalid generate_image job through the production app, and waits for the live Cloud Run AI worker to fail it before paid AI APIs can be called.",
  );
  console.log("Run with --execute --yes after the route is deployed.");
}

function validateExecuteEnv() {
  getRequiredAuditSecret();
  getRequiredEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
  getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
}

async function requestProductionAudit() {
  const rawBody = JSON.stringify({
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

  if (!response.ok || !data.ok) {
    throw new Error(
      `Production audit endpoint failed: ${response.status} ${summarizeResponse(data, text)}`,
    );
  }

  return data;
}

async function assertNoOpenRealAiGenerationJobs() {
  const { data, error } = await supabase
    .from("background_jobs")
    .select("id,status,user_id,job_type,input_json,attempt_count,next_attempt_at")
    .in("job_type", aiGenerationJobTypes)
    .eq("queue_name", "ai-generation")
    .in("status", ["queued", "processing"])
    .limit(20);

  if (error) {
    throw new Error(`Could not inspect open AI-generation jobs: ${error.message}`);
  }

  const realOpenJobs = (data ?? []).filter((job) => !isSafeCanaryJob(job));

  if (realOpenJobs.length > 0) {
    throw new Error(
      `Refusing to run production cutover audit because ${realOpenJobs.length} real AI-generation job(s) are open.`,
    );
  }
}

async function waitForJobCompletion(jobId) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < pollTimeoutMs) {
    const job = await getJob(jobId);

    if (terminalJobStatuses.has(job.status)) {
      return job;
    }

    await sleep(2_000);
  }

  throw new Error(`Timed out waiting for background job ${jobId}.`);
}

async function getJob(jobId) {
  const { data, error } = await supabase
    .from("background_jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (error) {
    throw new Error(`Could not read background job: ${error.message}`);
  }

  return data;
}

function assertExpectedCanaryFailure(job) {
  if (job.status === "completed") {
    throw new Error(
      "The invalid-input production cutover canary completed. Stop and inspect before enabling paid AI generation.",
    );
  }

  if (job.status !== "failed") {
    throw new Error(`Expected canary job to fail safely, got ${job.status}.`);
  }

  if (
    typeof job.error_message !== "string" ||
    !job.error_message.includes("generate_image requires input.prompt")
  ) {
    throw new Error(
      `Expected missing-prompt failure, got: ${job.error_message ?? "none"}`,
    );
  }

  if (!job.aws_message_id || !job.started_at || !job.completed_at || !job.worker_id) {
    throw new Error(
      "The job reached a terminal state, but it does not show full queue and worker metadata.",
    );
  }
}

async function cancelOpenCanaryJob(jobId) {
  const latestJob = await getJob(jobId);

  if (terminalJobStatuses.has(latestJob.status)) {
    return latestJob;
  }

  const { data, error } = await supabase
    .from("background_jobs")
    .update({
      completed_at: new Date().toISOString(),
      error_message:
        "Cancelled after failed production GCP cutover audit.",
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`Could not cancel canary background job: ${error.message}`);
  }

  return data;
}

function isSafeCanaryJob(job) {
  const input = asObject(job.input_json);
  const canaryName = typeof input.canary === "string" ? input.canary : "";
  const userId = typeof job.user_id === "string" ? job.user_id : "";

  return (
    userId.startsWith("production-gcp-cutover-audit") ||
    userId.startsWith("gcp-ai-generation-worker-service-canary") ||
    canaryName.startsWith("production-gcp-cutover") ||
    canaryName.startsWith("gcp-ai-generation-worker-service")
  );
}

function assertProvider(name, value) {
  if (value !== "gcp") {
    throw new Error(`Expected ${name}=gcp, got ${value ?? "unknown"}.`);
  }
}

function getRequiredAuditSecret() {
  const dedicatedSecret =
    process.env.UGC_INTERNAL_CUTOVER_AUDIT_SECRET?.trim();

  if (dedicatedSecret !== undefined) {
    if (!isValidGcpCutoverAuditSecret(dedicatedSecret)) {
      throw new Error("UGC_INTERNAL_CUTOVER_AUDIT_SECRET is too short.");
    }

    return dedicatedSecret;
  }

  return deriveGcpCutoverAuditSecret(getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"));
}

function getRequiredArgumentValue(args, index, flag) {
  const value = args[index]?.trim();

  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }

  return value;
}

function normalizeInteger(value, fallback, min, max) {
  if (!Number.isInteger(value)) {
    return fallback;
  }

  return Math.min(Math.max(value, min), max);
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
    return JSON.stringify({
      message: data.message,
      missingRuntimeEnv: data.missingRuntimeEnv,
      providerChecks: data.providerChecks,
      runtime: data.runtime,
    });
  }

  return text.slice(0, 500);
}

function getRequiredString(value, name) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing ${name} in production audit response.`);
  }

  return value.trim();
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : "Unknown error";
}

function loadLocalEnv() {
  if (!existsSync(envFilePath)) {
    return;
  }

  const lines = readFileSync(envFilePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const match = trimmedLine.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);

    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;

    if (process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = cleanEnvValue(rawValue);
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
  for (const name of names) {
    const value = process.env[name]?.trim();

    if (value) {
      return value;
    }
  }

  throw new Error(`Missing ${names.join(" or ")}`);
}
