import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { hostname } from "node:os";

import {
  EXECUTABLE_BACKGROUND_JOB_TYPES,
  type BackgroundJobType,
} from "./types.js";

export type WorkerConfig = {
  allowedJobTypes: BackgroundJobType[];
  queueName: string;
  socialReconciliationBatchSize: number;
  socialReconciliationEnabled: boolean;
  socialReconciliationIntervalSeconds: number;
  supabaseServiceRoleKey: string;
  supabaseUrl: string;
  visibilityTimeoutSeconds: number;
  workerBuildGitCommit: string | null;
  workerGitCommit: string;
  workerId: string;
  workerReleaseVerified: boolean;
  workerRunOnce: boolean;
  workerVersion: string;
};

export function loadWorkerConfig(): WorkerConfig {
  loadLocalEnvForDevelopment();

  const workerGitCommit = getOptionalEnv("WORKER_GIT_COMMIT", "unknown");
  const workerBuildGitCommit = getOptionalGitCommit(
    process.env.WORKER_BUILD_GIT_COMMIT,
  );
  const workerReleaseVerified = validateWorkerReleaseIdentity({
    workerBuildGitCommit,
    workerBuildGitCommitWasDeclared:
      process.env.WORKER_BUILD_GIT_COMMIT !== undefined,
    workerGitCommit,
  });

  return {
    allowedJobTypes: getWorkerJobTypes(),
    queueName: getOptionalEnv("WORKER_QUEUE_NAME", "media-processing"),
    socialReconciliationBatchSize: getIntegerEnv(
      "SOCIAL_RECONCILIATION_BATCH_SIZE",
      10,
      {
        max: 100,
        min: 1,
      },
    ),
    socialReconciliationEnabled: getBooleanEnv(
      "SOCIAL_RECONCILIATION_ENABLED",
      true,
    ),
    socialReconciliationIntervalSeconds: getIntegerEnv(
      "SOCIAL_RECONCILIATION_INTERVAL_SECONDS",
      15,
      {
        max: 300,
        min: 5,
      },
    ),
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
    workerBuildGitCommit,
    workerGitCommit,
    workerId:
      process.env.WORKER_ID?.trim() ||
      `${hostname() || "local"}-${process.pid.toString()}`,
    workerReleaseVerified,
    workerRunOnce: process.env.WORKER_RUN_ONCE?.trim() === "true",
    workerVersion: getOptionalEnv("WORKER_VERSION", "local-dev"),
  };
}

/**
 * New images bake their source SHA into WORKER_BUILD_GIT_COMMIT. Terraform
 * separately supplies WORKER_GIT_COMMIT for the durable worker_id, so reject a
 * production revision when those two independently configured values disagree.
 * Older images lack the build variable and remain runnable during the one-time
 * rollout of this guard.
 */
function validateWorkerReleaseIdentity(params: {
  workerBuildGitCommit: string | null;
  workerBuildGitCommitWasDeclared: boolean;
  workerGitCommit: string;
}) {
  if (process.env.NODE_ENV !== "production") {
    return Boolean(
      params.workerBuildGitCommit &&
        params.workerBuildGitCommit ===
          getOptionalGitCommit(params.workerGitCommit),
    );
  }

  if (!params.workerBuildGitCommitWasDeclared) {
    // Compatibility for images built before the release-identity guard.
    return false;
  }

  if (!params.workerBuildGitCommit) {
    throw new Error(
      "WORKER_BUILD_GIT_COMMIT must contain a Git SHA in production. Rebuild the worker image through the release image builder.",
    );
  }

  const configuredCommit = getOptionalGitCommit(params.workerGitCommit);

  if (!configuredCommit) {
    throw new Error(
      "WORKER_GIT_COMMIT must contain the worker image Git SHA in production.",
    );
  }

  if (configuredCommit !== params.workerBuildGitCommit) {
    throw new Error(
      "WORKER_GIT_COMMIT does not match the Git SHA baked into this worker image.",
    );
  }

  return true;
}

const validWorkerJobTypes = new Set<BackgroundJobType>(
  EXECUTABLE_BACKGROUND_JOB_TYPES,
);

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

function getOptionalEnv(name: string, fallback: string): string;
function getOptionalEnv(name: string, fallback: null): string | null;
function getOptionalEnv(name: string, fallback: string | null) {
  return process.env[name]?.trim() || fallback;
}

function getOptionalGitCommit(value: string | undefined) {
  const normalized = value?.trim().toLowerCase() || "";

  return /^[0-9a-f]{7,64}$/i.test(normalized) ? normalized : null;
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

function getBooleanEnv(name: string, fallback: boolean) {
  const rawValue = process.env[name]?.trim().toLowerCase();

  if (!rawValue) {
    return fallback;
  }

  if (["1", "true", "yes"].includes(rawValue)) {
    return true;
  }

  if (["0", "false", "no"].includes(rawValue)) {
    return false;
  }

  return fallback;
}
