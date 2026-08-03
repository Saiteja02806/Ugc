import type { BackgroundJobType } from "./background-jobs.ts";

export const DEFAULT_GCP_JOB_TASKS_LOCATION = "us-central1";
export const GCP_JOB_TASK_SCHEMA_VERSION = 1;

const TASK_ID_PATTERN = /^[A-Za-z0-9_-]{1,500}$/;

export type BackgroundJobTaskPayload = {
  attempt: number;
  jobId: string;
  jobType: BackgroundJobType;
  schemaVersion: typeof GCP_JOB_TASK_SCHEMA_VERSION;
};

export function getBackgroundJobTaskName(params: {
  attempt: number;
  jobId: string;
}) {
  return `job-${params.jobId}-attempt-${Math.max(0, params.attempt)}`;
}

export function getCloudTasksQueuePath(params: {
  location: string;
  projectId: string;
  queueName: string;
}) {
  return `projects/${params.projectId}/locations/${params.location}/queues/${params.queueName}`;
}

export function getCloudTasksCreateEndpoint(params: {
  location: string;
  projectId: string;
  queueName: string;
}) {
  return `https://cloudtasks.googleapis.com/v2/${getCloudTasksQueuePath({
    location: encodeURIComponent(params.location),
    projectId: encodeURIComponent(params.projectId),
    queueName: encodeURIComponent(params.queueName),
  })}/tasks`;
}

export function resolveBackgroundJobDispatchUrl(baseUrl: string) {
  const url = new URL(baseUrl);

  if (url.pathname !== "/" && url.pathname !== "") {
    url.search = "";
    url.hash = "";
    return url.toString();
  }

  return new URL(
    "/tasks/jobs",
    baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`,
  ).toString();
}

export function buildBackgroundJobCloudTaskRequest(params: {
  attempt: number;
  audience: string;
  dispatchUrl: string;
  jobId: string;
  jobType: BackgroundJobType;
  location: string;
  projectId: string;
  queueName: string;
  serviceAccountEmail: string;
}) {
  const taskName = getBackgroundJobTaskName(params);

  if (!TASK_ID_PATTERN.test(taskName)) {
    throw new Error("Invalid background job Cloud Tasks task name.");
  }

  const queuePath = getCloudTasksQueuePath(params);
  const payload = {
    attempt: Math.max(0, params.attempt),
    jobId: params.jobId,
    jobType: params.jobType,
    schemaVersion: GCP_JOB_TASK_SCHEMA_VERSION,
  } satisfies BackgroundJobTaskPayload;

  return {
    endpoint: getCloudTasksCreateEndpoint(params),
    payload,
    requestBody: {
      task: {
        dispatchDeadline: "1800s",
        httpRequest: {
          body: Buffer.from(JSON.stringify(payload), "utf8").toString("base64"),
          headers: {
            "Content-Type": "application/json",
          },
          httpMethod: "POST",
          oidcToken: {
            audience: params.audience,
            serviceAccountEmail: params.serviceAccountEmail,
          },
          url: params.dispatchUrl,
        },
        name: `${queuePath}/tasks/${taskName}`,
      },
    },
    taskName,
  };
}
