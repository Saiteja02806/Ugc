import { PubSub, v1 } from "@google-cloud/pubsub";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const envFilePath = join(process.cwd(), ".env.local");

loadLocalEnv();

const options = parseArguments(process.argv.slice(2));
const projectId =
  options.projectId ||
  process.env.GCP_PROJECT_ID?.trim() ||
  process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
  "ugcsaas";
const region = options.region || process.env.GCP_REGION?.trim() || "us-central1";
const canaryJobName =
  options.jobName ||
  process.env.GCP_SOCIAL_PUBLISH_WORKER_CANARY_JOB_NAME?.trim() ||
  "ugc-social-publish-worker-canary";
const pubsubTopic =
  options.topic ||
  process.env.UGC_SOCIAL_PUBLISH_PUBSUB_TOPIC?.trim() ||
  "ugc-social-publish";
const pubsubSubscription =
  options.subscription ||
  process.env.UGC_SOCIAL_PUBLISH_PUBSUB_SUBSCRIPTION?.trim() ||
  "ugc-social-publish-sub";
const queueName = options.queueName || "social-publish";
const canaryUserId =
  options.userId ||
  process.env.GCP_SOCIAL_PUBLISH_WORKER_CANARY_USER_ID?.trim() ||
  "gcp-social-publish-worker-canary";
const targetId = options.targetId || randomUUID();
const pollTimeoutMs = normalizeInteger(
  options.pollTimeoutMs,
  120_000,
  15_000,
  10 * 60_000,
);
const shouldExecute = options.mode === "execute";

const canaryPlan = {
  canaryJobName,
  expectedResult: "failed background job with missing fake publish target",
  jobType: "publish_social_post",
  projectId,
  pubsubSubscription,
  pubsubTopic,
  queueName,
  region,
  targetId,
  userId: canaryUserId,
};

if (!shouldExecute) {
  printDryRunPlan(canaryPlan);
  process.exit(0);
}

if (!options.yes) {
  throw new Error(
    "Refusing to run the social-publish worker canary without --yes.",
  );
}

validateExecuteEnv();

const gcloudCommand = getGcloudCommand();
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
const subscriber = new v1.SubscriberClient({ projectId });
const drainedMessages = await drainTerminalCanaryMessages();

if (drainedMessages > 0) {
  console.log(`Drained ${drainedMessages} terminal canary Pub/Sub message(s)`);
}

const backgroundJob = await createCanaryBackgroundJob();

console.log(`Created fake-target social publish job ${backgroundJob.id}`);
console.log(`Using fake scheduled target ${targetId}`);

try {
  const messageId = await enqueueCanaryJob(backgroundJob.id);
  console.log(`Published Pub/Sub message ${messageId}`);
  await attachQueueMessageId(backgroundJob.id, messageId);

  executeCloudRunJob();

  const finalJob = await waitForJobCompletion(backgroundJob.id);

  assertExpectedCanaryFailure(finalJob);

  console.log(`Worker consumed fake-target job ${backgroundJob.id}`);
  console.log(`Final status: ${finalJob.status}`);
  console.log(`Error: ${finalJob.error_message}`);
  console.log("GCP social-publish worker fake-target canary passed");
} catch (error) {
  console.error(
    `GCP social-publish worker canary failed for job ${backgroundJob.id}`,
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
    jobName: null,
    mode: "dry-run",
    pollTimeoutMs: null,
    projectId: null,
    queueName: null,
    region: null,
    subscription: null,
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

    if (argument === "--job-name") {
      parsed.jobName = getRequiredArgumentValue(args, (index += 1), argument);
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

    if (argument === "--region") {
      parsed.region = getRequiredArgumentValue(args, (index += 1), argument);
      continue;
    }

    if (argument === "--target-id") {
      parsed.targetId = getRequiredArgumentValue(args, (index += 1), argument);
      continue;
    }

    if (argument === "--subscription") {
      parsed.subscription = getRequiredArgumentValue(
        args,
        (index += 1),
        argument,
      );
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
  console.log("GCP social-publish worker canary dry run");
  console.log(JSON.stringify(plan, null, 2));
  console.log(
    "This would create one fake publish_social_post job, publish it to Pub/Sub, execute the one-off Cloud Run Job, and expect the worker to fail before any provider publish call because the fake target does not exist.",
  );
  console.log(
    "Before publishing, execution mode drains only terminal canary messages from the social-publish subscription and aborts on non-terminal work.",
  );
  console.log(
    "Run with --execute --yes only after the ugc-social-publish-worker-canary Cloud Run Job has been applied.",
  );
}

function validateExecuteEnv() {
  getRequiredEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
  getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
}

async function createCanaryBackgroundJob() {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("background_jobs")
    .insert({
      created_at: now,
      input_json: {
        canary: "gcp-social-publish-worker-fake-target",
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

async function drainTerminalCanaryMessages() {
  const subscriptionPath = subscriber.subscriptionPath(
    projectId,
    pubsubSubscription,
  );
  let drainedCount = 0;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const [response] = await subscriber.pull({
      maxMessages: 10,
      returnImmediately: true,
      subscription: subscriptionPath,
    });
    const receivedMessages = response.receivedMessages ?? [];

    if (receivedMessages.length === 0) {
      break;
    }

    const ackIds = [];
    const releaseIds = [];

    for (const receivedMessage of receivedMessages) {
      const ackId = receivedMessage.ackId;

      if (!ackId) {
        continue;
      }

      const parsedMessage = parsePulledWorkerMessage(receivedMessage);

      if (!parsedMessage?.jobId) {
        releaseIds.push(ackId);
        continue;
      }

      const job = await getJobByIdOrNull(parsedMessage.jobId);

      if (!job) {
        ackIds.push(ackId);
        drainedCount += 1;
        continue;
      }

      if (isTerminalJob(job) && isSafeCanaryJob(job)) {
        ackIds.push(ackId);
        drainedCount += 1;
        continue;
      }

      releaseIds.push(ackId);
    }

    if (ackIds.length > 0) {
      await subscriber.acknowledge({
        ackIds,
        subscription: subscriptionPath,
      });
    }

    if (releaseIds.length > 0) {
      await subscriber.modifyAckDeadline({
        ackDeadlineSeconds: 0,
        ackIds: releaseIds,
        subscription: subscriptionPath,
      });
      throw new Error(
        `Found ${releaseIds.length} non-terminal or non-canary message(s) in ${pubsubSubscription}. Refusing to run the fake-target canary until the subscription is clear.`,
      );
    }
  }

  return drainedCount;
}

function parsePulledWorkerMessage(receivedMessage) {
  const rawBody = decodePubSubData(receivedMessage.message?.data ?? null);

  if (!rawBody) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawBody);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function decodePubSubData(data) {
  if (!data) {
    return null;
  }

  if (typeof data !== "string") {
    return Buffer.from(data).toString("utf8");
  }

  const decodedValue = Buffer.from(data, "base64").toString("utf8");

  return decodedValue.trim().startsWith("{") ? decodedValue : data;
}

async function enqueueCanaryJob(jobId) {
  return pubsub.topic(pubsubTopic).publishMessage({
    attributes: {
      jobType: "publish_social_post",
      queueName,
      schema: "ugc-background-job-v1",
      source: "gcp-social-publish-worker-fake-target-canary",
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

function executeCloudRunJob() {
  console.log(`Executing Cloud Run Job ${canaryJobName}`);
  run(gcloudCommand, [
    "run",
    "jobs",
    "execute",
    canaryJobName,
    "--region",
    region,
    "--project",
    projectId,
    "--wait",
  ]);
}

async function waitForJobCompletion(jobId) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < pollTimeoutMs) {
    const job = await getJob(jobId);

    if (["cancelled", "completed", "failed"].includes(job.status)) {
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

async function getJobByIdOrNull(jobId) {
  const { data, error } = await supabase
    .from("background_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not read background job: ${error.message}`);
  }

  return data;
}

function assertExpectedCanaryFailure(job) {
  if (job.status === "completed") {
    throw new Error(
      "The fake-target canary completed. Stop and inspect before enabling social publishing.",
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

function isTerminalJob(job) {
  return ["cancelled", "completed", "failed"].includes(job.status);
}

function isSafeCanaryJob(job) {
  const input = asObject(job.input_json);
  const canaryName = typeof input.canary === "string" ? input.canary : "";
  const userId = typeof job.user_id === "string" ? job.user_id : "";

  return (
    job.job_type === "publish_social_post" &&
    job.queue_name === queueName &&
    (userId.startsWith("gcp-social-") ||
      canaryName.startsWith("gcp-social-publish-worker"))
  );
}

async function cancelOpenCanaryJob(jobId) {
  const latestJob = await getJob(jobId);

  if (["cancelled", "completed", "failed"].includes(latestJob.status)) {
    return latestJob;
  }

  const { data, error } = await supabase
    .from("background_jobs")
    .update({
      completed_at: new Date().toISOString(),
      error_message: "Cancelled after failed GCP social-publish worker canary.",
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

function getGcloudCommand() {
  const configuredCommand =
    process.env.GCLOUD_BIN?.trim() || process.env.GCLOUD_PATH?.trim();

  if (configuredCommand) {
    return configuredCommand;
  }

  const localGcloud = resolve(".tools", "google-cloud-sdk", "bin", "gcloud.cmd");

  if (existsSync(localGcloud)) {
    return localGcloud;
  }

  return "gcloud";
}

function run(command, args) {
  const spawnOptions = {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      CLOUDSDK_CORE_PROJECT: projectId,
    },
    stdio: "inherit",
  };
  const isWindowsCommandScript =
    process.platform === "win32" && /\.cmd$/i.test(command);
  const result = isWindowsCommandScript
    ? spawnSync(
        process.env.ComSpec || "cmd.exe",
        ["/d", "/c", command, ...args],
        spawnOptions,
      )
    : spawnSync(command, args, spawnOptions);

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} exited with code ${result.status}`,
    );
  }
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
