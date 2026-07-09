import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { createClient } from "@supabase/supabase-js";
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const envFilePath = join(process.cwd(), ".env.local");
const workerEntryPath = join(process.cwd(), "worker", "dist", "index.js");
const testMessage =
  process.argv.slice(2).join(" ").trim() || "hello ecs worker";

loadLocalEnv();

const requiredEnvKeys = [
  "AWS_REGION",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_URL",
  "UGC_MEDIA_PROCESSING_QUEUE_URL",
];

for (const key of requiredEnvKeys) {
  getRequiredEnv(key);
}

if (!existsSync(workerEntryPath)) {
  throw new Error("Worker build is missing. Run `npm run worker:build` first.");
}

const enqueueCredentials = getSqsEnqueueCredentials();

if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  throw new Error(
    "Missing AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY for the local worker receive/delete smoke test.",
  );
}

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

const sqs = new SQSClient({
  credentials: enqueueCredentials,
  region: getRequiredEnv("AWS_REGION"),
});

const job = await createTestJob();
console.log(`Created background job ${job.id}`);

try {
  const sendResult = await enqueueTestJob(job.id);
  console.log(`Enqueued SQS message ${sendResult.MessageId ?? "unknown"}`);

  await attachAwsMessageId(job.id, sendResult.MessageId ?? null);
  await runWorkerOnce();

  const finalJob = await getJob(job.id);

  if (finalJob.status !== "completed") {
    throw new Error(
      `Expected job ${job.id} to complete, but status is ${finalJob.status}.`,
    );
  }

  const output = asObject(finalJob.output_json);

  if (
    output.receivedMessage !== testMessage ||
    output.worker !== "ecs-fargate"
  ) {
    throw new Error(
      `Job ${job.id} completed with unexpected output shape.`,
    );
  }

  console.log(`Job ${job.id} completed`);
  console.log(`Output worker: ${output.worker}`);
  console.log("test_worker_job E2E smoke test passed");
} catch (error) {
  console.error(`test_worker_job E2E smoke test failed for job ${job.id}`);
  await markJobFailed(job.id, getErrorMessage(error)).catch((markError) => {
    console.error(
      `Could not mark failed test job ${job.id}: ${getErrorMessage(markError)}`,
    );
  });
  throw error;
}

async function createTestJob() {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("background_jobs")
    .insert({
      created_at: now,
      input_json: {
        message: testMessage,
        source: "local-e2e-smoke-test",
      },
      job_type: "test_worker_job",
      queue_name: "media-processing",
      status: "queued",
      updated_at: now,
      user_id: process.env.TEST_WORKER_USER_ID?.trim() || "local-e2e-test",
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Could not create background job: ${error.message}`);
  }

  return data;
}

async function enqueueTestJob(jobId) {
  return sqs.send(
    new SendMessageCommand({
      MessageBody: JSON.stringify({
        jobId,
        jobType: "test_worker_job",
      }),
      QueueUrl: getRequiredEnv("UGC_MEDIA_PROCESSING_QUEUE_URL"),
    }),
  );
}

async function attachAwsMessageId(jobId, messageId) {
  if (!messageId) {
    return;
  }

  const { error } = await supabase
    .from("background_jobs")
    .update({
      aws_message_id: messageId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) {
    throw new Error(`Could not attach SQS message id: ${error.message}`);
  }
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

function getErrorMessage(error) {
  return error instanceof Error ? error.message : "Unknown error";
}

function runWorkerOnce() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [workerEntryPath], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        WORKER_ID: process.env.WORKER_ID || "local-e2e-worker",
        WORKER_JOB_TYPES: "test_worker_job",
        WORKER_POLL_MAX_MESSAGES: "1",
        WORKER_POLL_WAIT_SECONDS: "10",
        WORKER_QUEUE_NAME: "media-processing",
        WORKER_QUEUE_URL: getRequiredEnv("UGC_MEDIA_PROCESSING_QUEUE_URL"),
        WORKER_RUN_ONCE: "true",
        WORKER_VISIBILITY_TIMEOUT_SECONDS: "60",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("Worker run-once smoke test timed out."));
    }, 45_000);

    child.stdout.on("data", (chunk) => {
      process.stdout.write(`[worker] ${chunk.toString()}`);
    });

    child.stderr.on("data", (chunk) => {
      process.stderr.write(`[worker] ${chunk.toString()}`);
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on("exit", (code) => {
      clearTimeout(timeout);

      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Worker exited with code ${code ?? "unknown"}.`));
    });
  });
}

function getSqsEnqueueCredentials() {
  const accessKeyId =
    process.env.AWS_APP_ENQUEUE_ACCESS_KEY_ID?.trim() ||
    process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey =
    process.env.AWS_APP_ENQUEUE_SECRET_ACCESS_KEY?.trim() ||
    process.env.AWS_SECRET_ACCESS_KEY?.trim();

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      "Missing SQS enqueue credentials. Set AWS_APP_ENQUEUE_ACCESS_KEY_ID/AWS_APP_ENQUEUE_SECRET_ACCESS_KEY or AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY.",
    );
  }

  return {
    accessKeyId,
    secretAccessKey,
  };
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

function getRequiredEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
}
