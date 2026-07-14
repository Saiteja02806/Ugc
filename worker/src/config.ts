import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { hostname } from "node:os";

import type { BackgroundJobType } from "./types.js";

export type WorkerConfig = {
  allowedJobTypes: BackgroundJobType[];
  awsRegion: string;
  pollMaxMessages: number;
  pollWaitTimeSeconds: number;
  queueName: string;
  queueUrl: string;
  supabaseServiceRoleKey: string;
  supabaseUrl: string;
  visibilityTimeoutSeconds: number;
  workerGitCommit: string;
  workerId: string;
  workerRunOnce: boolean;
  workerVersion: string;
};

export function loadWorkerConfig(): WorkerConfig {
  loadLocalEnvForDevelopment();

  return {
    allowedJobTypes: getWorkerJobTypes(),
    awsRegion: getRequiredEnv("AWS_REGION"),
    pollMaxMessages: getIntegerEnv("WORKER_POLL_MAX_MESSAGES", 1, {
      max: 10,
      min: 1,
    }),
    pollWaitTimeSeconds: getIntegerEnv("WORKER_POLL_WAIT_SECONDS", 10, {
      max: 20,
      min: 0,
    }),
    queueName: getOptionalEnv("WORKER_QUEUE_NAME", "media-processing"),
    queueUrl: getWorkerQueueUrl(),
    supabaseServiceRoleKey: getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    supabaseUrl: getRequiredEnv("SUPABASE_URL"),
    visibilityTimeoutSeconds: getIntegerEnv(
      "WORKER_VISIBILITY_TIMEOUT_SECONDS",
      60,
      {
        max: 43_200,
        min: 1,
      },
    ),
    workerGitCommit: getOptionalEnv("WORKER_GIT_COMMIT", "unknown"),
    workerId:
      process.env.WORKER_ID?.trim() ||
      `${hostname() || "local"}-${process.pid.toString()}`,
    workerRunOnce: process.env.WORKER_RUN_ONCE?.trim() === "true",
    workerVersion: getOptionalEnv("WORKER_VERSION", "local-dev"),
  };
}

const validWorkerJobTypes = new Set<BackgroundJobType>([
  "extract_video_metadata",
  "generate_avatar",
  "generate_carousel",
  "generate_hook_video",
  "generate_image",
  "generate_thumbnail",
  "publish_social_post",
  "render_demo_video",
  "render_edit_video",
  "render_schedule_combination",
  "test_worker_job",
]);

function getWorkerQueueUrl() {
  const queueUrl =
    process.env.WORKER_QUEUE_URL?.trim() ||
    process.env.UGC_MEDIA_PROCESSING_QUEUE_URL?.trim() ||
    "";

  if (!queueUrl) {
    throw new Error(
      "Missing WORKER_QUEUE_URL. Set it to the SQS queue this worker service should poll.",
    );
  }

  return queueUrl;
}

function getWorkerJobTypes() {
  const rawValue = process.env.WORKER_JOB_TYPES?.trim();

  if (!rawValue) {
    return ["test_worker_job"] satisfies BackgroundJobType[];
  }

  const jobTypes = rawValue
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (jobTypes.length === 0) {
    throw new Error("WORKER_JOB_TYPES must include at least one job type.");
  }

  for (const jobType of jobTypes) {
    if (!validWorkerJobTypes.has(jobType as BackgroundJobType)) {
      throw new Error(`Invalid WORKER_JOB_TYPES entry: ${jobType}`);
    }
  }

  return Array.from(new Set(jobTypes)) as BackgroundJobType[];
}

function loadLocalEnvForDevelopment() {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  const candidatePaths = [
    join(process.cwd(), ".env.local"),
    join(process.cwd(), "..", ".env.local"),
  ];

  for (const candidatePath of candidatePaths) {
    const envPath = resolve(candidatePath);

    if (existsSync(envPath)) {
      loadEnvFile(envPath);
      return;
    }
  }
}

function loadEnvFile(envPath: string) {
  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);

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

function cleanEnvValue(rawValue: string) {
  const value = rawValue.trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
}

function getOptionalEnv(name: string, fallback: string) {
  return process.env[name]?.trim() || fallback;
}

function getIntegerEnv(
  name: string,
  fallback: number,
  bounds: {
    max: number;
    min: number;
  },
) {
  const rawValue = process.env[name]?.trim();

  if (!rawValue) {
    return fallback;
  }

  const parsedValue = Number(rawValue);

  if (!Number.isInteger(parsedValue)) {
    return fallback;
  }

  return Math.min(Math.max(parsedValue, bounds.min), bounds.max);
}
