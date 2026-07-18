import { PubSub } from "@google-cloud/pubsub";
import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const envFilePath = join(process.cwd(), ".env.local");
const options = parseArguments(process.argv.slice(2));
loadLocalEnv();

const projectId =
  options.projectId ||
  process.env.GCP_PROJECT_ID?.trim() ||
  process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
  "ugcsaas";
const region = options.region || process.env.GCP_REGION?.trim() || "us-central1";
const canaryJobName =
  options.jobName ||
  process.env.GCP_WORKER_CANARY_JOB_NAME?.trim() ||
  "ugc-worker-canary-test";
const pubsubTopic =
  options.topic ||
  process.env.UGC_MEDIA_PROCESSING_PUBSUB_TOPIC?.trim() ||
  "ugc-media-processing";
const queueName = options.queueName || "media-processing";
const testMessage =
  options.message || `hello gcp worker ${new Date().toISOString()}`;
const gcloudCommand = getGcloudCommand();

const supabase = createClient(
  getRequiredEnv("SUPABASE_URL"),
  getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);
const pubsub = new PubSub({ projectId });
const job = await createTestJob();

console.log(`Created background job ${job.id}`);

try {
  const messageId = await enqueueTestJob(job.id);
  console.log(`Published Pub/Sub message ${messageId}`);
  await attachQueueMessageId(job.id, messageId);
  executeCloudRunJob();

  const finalJob = await waitForJobCompletion(job.id);
  const output = asObject(finalJob.output_json);

  if (
    finalJob.status !== "completed" ||
    output.receivedMessage !== testMessage ||
    output.worker !== "gcp-cloud-run-job"
  ) {
    throw new Error(
      `Job ${job.id} completed with unexpected status or output shape.`,
    );
  }

  console.log(`Job ${job.id} completed`);
  console.log(`Output worker: ${output.worker}`);
  console.log("GCP test_worker_job canary passed");
} catch (error) {
  console.error(`GCP test_worker_job canary failed for job ${job.id}`);
  await markJobFailed(job.id, getErrorMessage(error)).catch((markError) => {
    console.error(
      `Could not mark failed test job ${job.id}: ${getErrorMessage(markError)}`,
    );
  });
  throw error;
}

function parseArguments(args) {
  const options = {
    jobName: null,
    message: null,
    projectId: null,
    queueName: null,
    region: null,
    topic: null,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--job-name") {
      options.jobName = getRequiredArgumentValue(args, (index += 1), argument);
      continue;
    }

    if (argument === "--message") {
      options.message = getRequiredArgumentValue(args, (index += 1), argument);
      continue;
    }

    if (argument === "--project-id") {
      options.projectId = getRequiredArgumentValue(args, (index += 1), argument);
      continue;
    }

    if (argument === "--queue-name") {
      options.queueName = getRequiredArgumentValue(args, (index += 1), argument);
      continue;
    }

    if (argument === "--region") {
      options.region = getRequiredArgumentValue(args, (index += 1), argument);
      continue;
    }

    if (argument === "--topic") {
      options.topic = getRequiredArgumentValue(args, (index += 1), argument);
      continue;
    }

    throw new Error(`Unknown option ${argument}.`);
  }

  return options;
}

function getRequiredArgumentValue(args, index, flag) {
  const value = args[index]?.trim();

  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }

  return value;
}

async function createTestJob() {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("background_jobs")
    .insert({
      created_at: now,
      input_json: {
        message: testMessage,
        source: "gcp-cloud-run-job-smoke-test",
      },
      job_type: "test_worker_job",
      queue_name: queueName,
      status: "queued",
      updated_at: now,
      user_id: process.env.TEST_WORKER_USER_ID?.trim() || "gcp-canary-test",
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Could not create background job: ${error.message}`);
  }

  return data;
}

async function enqueueTestJob(jobId) {
  return pubsub.topic(pubsubTopic).publishMessage({
    attributes: {
      jobType: "test_worker_job",
      queueName,
      schema: "ugc-background-job-v1",
      source: "gcp-cloud-run-job-smoke-test",
    },
    data: Buffer.from(
      JSON.stringify({
        jobId,
        jobType: "test_worker_job",
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
  const timeoutMs = 120_000;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
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

async function markJobFailed(jobId, errorMessage) {
  const { error } = await supabase
    .from("background_jobs")
    .update({
      completed_at: new Date().toISOString(),
      error_message: errorMessage,
      status: "failed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) {
    throw new Error(`Could not mark failed background job: ${error.message}`);
  }
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

function asObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value;
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

function getRequiredEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
}
