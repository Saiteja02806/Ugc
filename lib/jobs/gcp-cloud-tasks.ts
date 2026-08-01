import "server-only";

import { GoogleAuth } from "google-auth-library";

import {
  getGoogleServiceAccountCredentials,
  getMissingVercelGcpCredentialEnvVars,
} from "@/lib/gcp/credentials";
import type { BackgroundJobRecord, BackgroundJobType } from "./background-jobs";
import {
  buildBackgroundJobCloudTaskRequest,
  DEFAULT_GCP_JOB_TASKS_LOCATION,
  resolveBackgroundJobDispatchUrl,
} from "./gcp-cloud-tasks-logic";
import { getGcpProjectId, getQueueNameForJobType } from "@/lib/queues/config";

const CLOUD_PLATFORM_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
let cloudTasksAuth: GoogleAuth | null = null;

const dispatchUrlEnvByQueueName = {
  "ai-generation": "GCP_AI_GENERATION_TASK_URL",
  carousel: "GCP_CAROUSEL_TASK_URL",
  "media-processing": "GCP_MEDIA_PROCESSING_TASK_URL",
  "social-publish": "GCP_SOCIAL_PUBLISH_TASK_URL",
  "video-render": "GCP_VIDEO_RENDER_TASK_URL",
} as const;

export function getMissingBackgroundJobCloudTasksEnvVars(
  jobTypes: BackgroundJobType[],
  env: Record<string, string | undefined> = process.env,
) {
  const missing = new Set<string>();

  if (!getGcpProjectId(env)) {
    missing.add("GCP_PROJECT_ID or GOOGLE_CLOUD_PROJECT");
  }

  if (!getCloudTasksServiceAccountEmail(env)) {
    missing.add(
      "GCP_CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL or GCP_PROJECT_ID/GOOGLE_CLOUD_PROJECT",
    );
  }

  for (const jobType of jobTypes) {
    const queueName = getQueueNameForJobType(jobType);
    const envName = getDispatchUrlEnvName(queueName);

    if (!getBackgroundJobDispatchUrl(queueName, env)) {
      missing.add(`${envName} or GCP_BACKGROUND_JOB_TASK_URL`);
    }
  }

  for (const envName of getMissingVercelGcpCredentialEnvVars(env)) {
    missing.add(envName);
  }

  return Array.from(missing);
}

export async function enqueueBackgroundJobCloudTask(job: BackgroundJobRecord) {
  const projectId = getRequiredProjectId();
  const location =
    process.env.GCP_CLOUD_TASKS_LOCATION?.trim() ||
    process.env.GCP_REGION?.trim() ||
    DEFAULT_GCP_JOB_TASKS_LOCATION;
  const queueName = getCloudTasksQueueName(job.jobType);
  const dispatchUrl = getRequiredDispatchUrl(job.jobType);
  const { endpoint, requestBody, taskName } =
    buildBackgroundJobCloudTaskRequest({
      attempt: job.attemptCount,
      audience:
        process.env.GCP_BACKGROUND_JOB_TASK_AUDIENCE?.trim() ||
        new URL(dispatchUrl).origin,
      dispatchUrl,
      jobId: job.id,
      jobType: job.jobType,
      location,
      projectId,
      queueName,
      serviceAccountEmail: getRequiredCloudTasksServiceAccountEmail(),
    });
  const response = await fetch(endpoint, {
    body: JSON.stringify(requestBody),
    cache: "no-store",
    headers: {
      Authorization: await getAuthorizationHeader(endpoint),
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (response.status !== 409 && !response.ok) {
    const summary = (await response.text().catch(() => "")).slice(0, 500);
    throw new Error(
      `Could not create background job Cloud Task: ${response.status} ${summary}`,
    );
  }

  return {
    messageId: taskName,
    provider: "gcp" as const,
    queueName,
  };
}

function getCloudTasksQueueName(jobType: BackgroundJobType) {
  const queueName = getQueueNameForJobType(jobType);
  const prefix = process.env.GCP_RESOURCE_NAME_PREFIX?.trim() || "ugc";
  const normalizedQueueName = queueName.replace(/[^a-z0-9-]/gi, "-");

  return process.env[`GCP_${queueName.replace(/-/g, "_").toUpperCase()}_TASKS_QUEUE`]?.trim() ||
    `${prefix}-${normalizedQueueName}`;
}

function getRequiredDispatchUrl(jobType: BackgroundJobType) {
  const queueName = getQueueNameForJobType(jobType);
  const dispatchUrl = getBackgroundJobDispatchUrl(queueName);

  if (!dispatchUrl) {
    throw new Error(
      `Missing ${getDispatchUrlEnvName(queueName)} or GCP_BACKGROUND_JOB_TASK_URL.`,
    );
  }

  return dispatchUrl;
}

export function getBackgroundJobDispatchUrl(
  queueName: string,
  env: Record<string, string | undefined> = process.env,
) {
  const explicitUrl = env[getDispatchUrlEnvName(queueName)]?.trim();
  const fallbackUrl = env.GCP_BACKGROUND_JOB_TASK_URL?.trim();
  const baseUrl = explicitUrl || fallbackUrl;

  if (!baseUrl) {
    return "";
  }

  return resolveBackgroundJobDispatchUrl(baseUrl);
}

function getDispatchUrlEnvName(queueName: string) {
  return (
    dispatchUrlEnvByQueueName[
      queueName as keyof typeof dispatchUrlEnvByQueueName
    ] || "GCP_BACKGROUND_JOB_TASK_URL"
  );
}

function getCloudTasksServiceAccountEmail(
  env: Record<string, string | undefined> = process.env,
) {
  const explicitEmail =
    env.GCP_CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL?.trim() ||
    env.GCP_SCHEDULER_SERVICE_ACCOUNT_EMAIL?.trim();

  if (explicitEmail) {
    return explicitEmail;
  }

  const projectId = getGcpProjectId(env);
  const prefix = env.GCP_RESOURCE_NAME_PREFIX?.trim() || "ugc";

  return projectId
    ? `${prefix}-scheduler-sa@${projectId}.iam.gserviceaccount.com`
    : "";
}

function getRequiredCloudTasksServiceAccountEmail() {
  const email = getCloudTasksServiceAccountEmail();

  if (!email) {
    throw new Error("Missing GCP Cloud Tasks service account email.");
  }

  return email;
}

function getRequiredProjectId() {
  const projectId = getGcpProjectId();

  if (!projectId) {
    throw new Error("Missing GCP_PROJECT_ID or GOOGLE_CLOUD_PROJECT.");
  }

  return projectId;
}

function getCloudTasksAuth() {
  if (!cloudTasksAuth) {
    const credentials = getGoogleServiceAccountCredentials();

    cloudTasksAuth = new GoogleAuth({
      ...(credentials ? { credentials } : {}),
      projectId: getRequiredProjectId(),
      scopes: [CLOUD_PLATFORM_SCOPE],
    });
  }

  return cloudTasksAuth;
}

async function getAuthorizationHeader(url: string) {
  const headers = await getCloudTasksAuth().getRequestHeaders(url);
  const authorization = headers.get("authorization");

  if (!authorization) {
    throw new Error("Could not authorize GCP Cloud Tasks request.");
  }

  return authorization;
}
