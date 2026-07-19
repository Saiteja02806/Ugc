import { PubSub } from "@google-cloud/pubsub";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const envFilePath = join(process.cwd(), ".env.local");
const terminalJobStatuses = new Set(["cancelled", "completed", "failed"]);

loadLocalEnv();

const options = parseArguments(process.argv.slice(2));
const projectId =
  options.projectId ||
  process.env.GCP_PROJECT_ID?.trim() ||
  process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
  "ugcsaas";
const serviceName =
  options.serviceName ||
  process.env.GCP_SOCIAL_PUBLISH_WORKER_SERVICE_NAME?.trim() ||
  "ugc-social-publish-worker";
const pubsubTopic =
  options.topic ||
  process.env.UGC_SOCIAL_PUBLISH_PUBSUB_TOPIC?.trim() ||
  "ugc-social-publish";
const queueName = options.queueName || "social-publish";
const canaryUserId =
  options.userId ||
  process.env.GCP_SOCIAL_PUBLISH_WORKER_SERVICE_CANARY_USER_ID?.trim() ||
  "gcp-social-publish-worker-service-canary";
const targetId = options.targetId || randomUUID();
const pollTimeoutMs = normalizeInteger(
  options.pollTimeoutMs,
  120_000,
  15_000,
  10 * 60_000,
);
const shouldExecute = options.mode === "execute";

const serviceCanaryPlan = {
  expectedResult: "failed background job with missing fake publish target",
  jobType: "publish_social_post",
  projectId,
  pubsubTopic,
  queueName,
  serviceName,
  targetId,
  userId: canaryUserId,
};

if (!shouldExecute) {
  printDryRunPlan(serviceCanaryPlan);
  process.exit(0);
}

if (!options.yes) {
  throw new Error(
    "Refusing to run the social-publish worker service canary without --yes.",
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
const pubsub = new PubSub({ projectId });

await assertNoOpenRealSocialPublishJobs();

const backgroundJob = await createCanaryBackgroundJob();

console.log(`Created fake-target social publish job ${backgroundJob.id}`);
console.log(`Using fake scheduled target ${targetId}`);

try {
  const messageId = await enqueueCanaryJob(backgroundJob.id);
  console.log(`Published Pub/Sub message ${messageId}`);
  await attachQueueMessageId(backgroundJob.id, messageId);

  const finalJob = await waitForJobCompletion(backgroundJob.id);

  assertExpectedCanaryFailure(finalJob);

  console.log(`Always-on service consumed fake-target job ${backgroundJob.id}`);
  console.log(`Final status: ${finalJob.status}`);
  console.log(`Error: ${finalJob.error_message}`);
  console.log("GCP social-publish worker service fake-target canary passed");
} catch (error) {
  console.error(
    `GCP social-publish worker service canary failed for job ${backgroundJob.id}`,
  );

  await cancelOpenCanaryJob(backgroundJob.id).catch((cancelError) => {
    console.error(
      `Could not cancel canary background job ${backgroundJob.id}: ${getErrorMessage(cancelError)}`,
    );
  });

  throw error;
}

function parseArguments(args) {
  const parsed = {
    mode: "dry-run",
    pollTimeoutMs: null,
    projectId: null,
    queueName: null,
    serviceName: null,
    targetId: null,
    topic: null,
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

    if (argument === "--poll-timeout-ms") {
      parsed.pollTimeoutMs = Number(
        getRequiredArgumentValue(args, (index += 1), argument),
      );
      continue;
    }

    if (argument === "--project-id") {
      parsed.projectId = getRequiredArgumentValue(args, (index += 1), argument);
      continue;
    }

    if (argument === "--queue-name") {
      parsed.queueName = getRequiredArgumentValue(args, (index += 1), argument);
      continue;
    }

    if (argument === "--service-name") {
      parsed.serviceName = getRequiredArgumentValue(
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

    if (argument === "--topic") {
      parsed.topic = getRequiredArgumentValue(args, (index += 1), argument);
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
  console.log("GCP social-publish worker service canary dry run");
  console.log(JSON.stringify(plan, null, 2));
  console.log(
    "This would create one fake publish_social_post job, publish it to Pub/Sub, and wait for the always-on Cloud Run Service to fail the job before any provider publish call because the fake target does not exist.",
  );
  console.log(
    "Run with --execute --yes only after the ugc-social-publish-worker Cloud Run Service is Ready and social reconciliation remains disabled.",
  );
}

function validateExecuteEnv() {
  getRequiredEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
  getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
}

async function assertNoOpenRealSocialPublishJobs() {
  const { data, error } = await supabase
    .from("background_jobs")
    .select("id,status,user_id,input_json,attempt_count,next_attempt_at")
    .eq("job_type", "publish_social_post")
    .eq("queue_name", queueName)
    .in("status", ["queued", "processing"])
    .limit(20);

  if (error) {
    throw new Error(`Could not inspect open social publish jobs: ${error.message}`);
  }

  const realOpenJobs = (data ?? []).filter((job) => !isSafeCanaryJob(job));

  if (realOpenJobs.length > 0) {
    throw new Error(
      `Refusing to run service canary because ${realOpenJobs.length} real social publish job(s) are open.`,
    );
  }
}

async function createCanaryBackgroundJob() {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("background_jobs")
    .insert({
      created_at: now,
      input_json: {
        canary: "gcp-social-publish-worker-service-fake-target",
        targetId,
      },
      job_type: "publish_social_post",
      queue_name: queueName,
      status: "queued",
      updated_at: now,
      user_id: canaryUserId,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Could not create canary background job: ${error.message}`);
  }

  return data;
}

async function enqueueCanaryJob(jobId) {
  return pubsub.topic(pubsubTopic).publishMessage({
    attributes: {
      jobType: "publish_social_post",
      queueName,
      schema: "ugc-background-job-v1",
      source: "gcp-social-publish-worker-service-fake-target-canary",
    },
    data: Buffer.from(
      JSON.stringify({
        jobId,
        jobType: "publish_social_post",
      }),
      "utf8",
    ),
  });
}

async function attachQueueMessageId(jobId, messageId) {
  const { error } = await supabase
    .from("background_jobs")
    .update({
      aws_message_id: messageId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) {
    throw new Error(`Could not attach queue message id: ${error.message}`);
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
      "The fake-target service canary completed. Stop and inspect before enabling social publishing.",
    );
  }

  if (job.status !== "failed") {
    throw new Error(`Expected canary job to fail safely, got ${job.status}.`);
  }

  if (
    typeof job.error_message !== "string" ||
    !job.error_message.includes("Publish target was not found")
  ) {
    throw new Error(
      `Expected missing-target failure, got: ${job.error_message ?? "none"}`,
    );
  }

  if (!job.started_at || !job.completed_at || !job.worker_id) {
    throw new Error(
      "The job failed, but it does not show worker start/completion metadata.",
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
        "Cancelled after failed GCP social-publish worker service canary.",
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
    (userId.startsWith("gcp-social-") ||
      canaryName.startsWith("gcp-social-publish-worker")) &&
    terminalJobStatuses.has(job.status)
  );
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

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : "Unknown error";
}

function asObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value;
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
