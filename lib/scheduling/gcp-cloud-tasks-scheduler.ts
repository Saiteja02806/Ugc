import "server-only";

import { GoogleAuth } from "google-auth-library";

import {
  getGoogleServiceAccountCredentials,
  getMissingVercelGcpCredentialEnvVars,
} from "@/lib/gcp/credentials";
import { getGcpProjectId } from "@/lib/queues/config";
import {
  buildGcpCloudTasksCreateTaskRequest,
  buildSocialPublishDispatchUrl,
  DEFAULT_GCP_CLOUD_TASKS_LOCATION,
  DEFAULT_GCP_SOCIAL_PUBLISH_TASKS_QUEUE,
  getDefaultGcpSchedulerServiceAccountEmail,
  getGcpCloudTasksTaskEndpoint,
  getGcpSocialPublishScheduleName,
  isGcpSocialPublishScheduleName,
} from "@/lib/scheduling/gcp-cloud-tasks-scheduler-logic";
import type {
  CreateSocialPublishScheduleInput,
  SocialPublishSchedule,
} from "@/lib/scheduling/social-scheduler-types";

const CLOUD_TASKS_SCOPE = "https://www.googleapis.com/auth/cloud-platform";

let cloudTasksAuth: GoogleAuth | null = null;

export function getMissingGcpSocialSchedulerEnvVars(
  env: Record<string, string | undefined> = process.env,
) {
  const missing = new Set<string>();

  if (!getGcpProjectId(env)) {
    missing.add("GCP_PROJECT_ID or GOOGLE_CLOUD_PROJECT");
  }

  if (!getSocialPublishDispatchUrl(env)) {
    missing.add(
      "GCP_SOCIAL_PUBLISH_DISPATCH_URL or APP_BASE_URL or UGC_INTERNAL_APP_URL",
    );
  }

  if (!getGcpSchedulerServiceAccountEmail(env)) {
    missing.add(
      "GCP_CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL or GCP_PROJECT_ID/GOOGLE_CLOUD_PROJECT",
    );
  }

  for (const envName of getMissingVercelGcpCredentialEnvVars(env)) {
    missing.add(envName);
  }

  return Array.from(missing);
}

export async function createGcpSocialPublishSchedule(
  input: CreateSocialPublishScheduleInput,
): Promise<SocialPublishSchedule> {
  const taskName = getGcpSocialPublishScheduleName(input.targetId);
  const dispatchUrl = getRequiredSocialPublishDispatchUrl();
  const { endpoint, requestBody, taskPath } =
    buildGcpCloudTasksCreateTaskRequest({
      audience: getGcpSocialPublishDispatchAudience(dispatchUrl),
      dispatchUrl,
      input,
      location: getGcpCloudTasksLocation(),
      projectId: getRequiredGcpProjectId(),
      queueName: getGcpSocialPublishTasksQueue(),
      serviceAccountEmail: getRequiredGcpSchedulerServiceAccountEmail(),
      taskName,
    });
  const response = await fetch(endpoint, {
    body: JSON.stringify(requestBody),
    cache: "no-store",
    headers: {
      Authorization: await getCloudTasksAuthorizationHeader(endpoint),
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (response.status === 409) {
    return {
      arn: taskPath,
      name: taskName,
    };
  }

  if (!response.ok) {
    throw new Error(
      `Could not create GCP Cloud Task: ${response.status} ${await getResponseSummary(
        response,
      )}`,
    );
  }

  return {
    arn: taskPath,
    name: taskName,
  };
}

export async function deleteGcpSocialPublishSchedule(
  scheduleName: string | null,
) {
  if (!isGcpSocialPublishScheduleName(scheduleName)) {
    return;
  }

  const endpoint = getGcpCloudTasksTaskEndpoint({
    location: getGcpCloudTasksLocation(),
    projectId: getRequiredGcpProjectId(),
    queueName: getGcpSocialPublishTasksQueue(),
    taskName: scheduleName,
  });
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
      `Could not delete GCP Cloud Task: ${response.status} ${await getResponseSummary(
        response,
      )}`,
    );
  }
}

function getCloudTasksAuth() {
  const projectId = getRequiredGcpProjectId();

  if (!cloudTasksAuth) {
    const credentials = getGoogleServiceAccountCredentials();

    cloudTasksAuth = new GoogleAuth({
      ...(credentials ? { credentials } : {}),
      projectId,
      scopes: [CLOUD_TASKS_SCOPE],
    });
  }

  return cloudTasksAuth;
}

async function getCloudTasksAuthorizationHeader(url: string) {
  const headers = await getCloudTasksAuth().getRequestHeaders(url);
  const authorization = headers.get("authorization");

  if (!authorization) {
    throw new Error("Could not authorize GCP Cloud Tasks request.");
  }

  return authorization;
}

function getRequiredGcpProjectId() {
  const projectId = getGcpProjectId();

  if (!projectId) {
    throw new Error("Missing GCP_PROJECT_ID or GOOGLE_CLOUD_PROJECT.");
  }

  return projectId;
}

function getGcpCloudTasksLocation(
  env: Record<string, string | undefined> = process.env,
) {
  return (
    env.GCP_CLOUD_TASKS_LOCATION?.trim() ||
    env.GCP_REGION?.trim() ||
    DEFAULT_GCP_CLOUD_TASKS_LOCATION
  );
}

function getGcpSocialPublishTasksQueue(
  env: Record<string, string | undefined> = process.env,
) {
  return (
    env.GCP_SOCIAL_PUBLISH_TASKS_QUEUE?.trim() ||
    DEFAULT_GCP_SOCIAL_PUBLISH_TASKS_QUEUE
  );
}

function getSocialPublishDispatchUrl(
  env: Record<string, string | undefined> = process.env,
) {
  const explicitUrl =
    env.GCP_SOCIAL_PUBLISH_DISPATCH_URL?.trim() ||
    env.UGC_SOCIAL_PUBLISH_DISPATCH_URL?.trim();

  if (explicitUrl) {
    return explicitUrl;
  }

  const baseUrl = env.UGC_INTERNAL_APP_URL?.trim() || env.APP_BASE_URL?.trim();

  return baseUrl ? buildSocialPublishDispatchUrl(baseUrl) : "";
}

function getRequiredSocialPublishDispatchUrl() {
  const dispatchUrl = getSocialPublishDispatchUrl();

  if (!dispatchUrl) {
    throw new Error(
      "Missing GCP_SOCIAL_PUBLISH_DISPATCH_URL or APP_BASE_URL.",
    );
  }

  return dispatchUrl;
}

function getGcpSocialPublishDispatchAudience(dispatchUrl: string) {
  return (
    process.env.GCP_SOCIAL_PUBLISH_DISPATCH_AUDIENCE?.trim() || dispatchUrl
  );
}

function getGcpSchedulerServiceAccountEmail(
  env: Record<string, string | undefined> = process.env,
) {
  const explicitEmail =
    env.GCP_CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL?.trim() ||
    env.GCP_SCHEDULER_SERVICE_ACCOUNT_EMAIL?.trim();

  if (explicitEmail) {
    return explicitEmail;
  }

  const projectId = getGcpProjectId(env);

  return projectId
    ? getDefaultGcpSchedulerServiceAccountEmail({
        namePrefix: env.GCP_RESOURCE_NAME_PREFIX,
        projectId,
      })
    : "";
}

function getRequiredGcpSchedulerServiceAccountEmail() {
  const serviceAccountEmail = getGcpSchedulerServiceAccountEmail();

  if (!serviceAccountEmail) {
    throw new Error("Missing GCP scheduler service account email.");
  }

  return serviceAccountEmail;
}

async function getResponseSummary(response: Response) {
  const body = await response.text().catch(() => "");

  return body.slice(0, 500);
}
