import type { CreateSocialPublishScheduleInput } from "@/lib/scheduling/social-scheduler-types";

export const DEFAULT_GCP_CLOUD_TASKS_LOCATION = "us-central1";
export const DEFAULT_GCP_SOCIAL_PUBLISH_TASKS_QUEUE =
  "ugc-social-publish-scheduler";
export const GCP_SOCIAL_PUBLISH_SCHEDULE_PREFIX = "ugc-social-gcp-";
export const SOCIAL_PUBLISH_DISPATCH_PATH =
  "/api/internal/schedules/dispatch";

const GCP_TASK_ID_PATTERN = /^[A-Za-z0-9_-]{1,500}$/;

export type BuildGcpCloudTasksCreateTaskRequestParams = {
  audience: string;
  dispatchDeadline?: string;
  dispatchUrl: string;
  input: CreateSocialPublishScheduleInput;
  location: string;
  projectId: string;
  queueName: string;
  serviceAccountEmail: string;
  taskName: string;
};

export function getGcpSocialPublishScheduleName(targetId: string) {
  const safeTargetId = targetId.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 44);

  return `${GCP_SOCIAL_PUBLISH_SCHEDULE_PREFIX}${safeTargetId}`.slice(0, 64);
}

export function isGcpSocialPublishScheduleName(
  scheduleName: string | null,
): scheduleName is string {
  return Boolean(
    scheduleName &&
      scheduleName.startsWith(GCP_SOCIAL_PUBLISH_SCHEDULE_PREFIX) &&
      GCP_TASK_ID_PATTERN.test(scheduleName),
  );
}

export function getGcpCloudTasksTaskPath(params: {
  location: string;
  projectId: string;
  queueName: string;
  taskName: string;
}) {
  return `projects/${params.projectId}/locations/${params.location}/queues/${params.queueName}/tasks/${params.taskName}`;
}

export function getGcpCloudTasksCreateEndpoint(params: {
  location: string;
  projectId: string;
  queueName: string;
}) {
  return `https://cloudtasks.googleapis.com/v2/projects/${encodeURIComponent(
    params.projectId,
  )}/locations/${encodeURIComponent(params.location)}/queues/${encodeURIComponent(
    params.queueName,
  )}/tasks`;
}

export function getGcpCloudTasksTaskEndpoint(params: {
  location: string;
  projectId: string;
  queueName: string;
  taskName: string;
}) {
  return `https://cloudtasks.googleapis.com/v2/${getGcpCloudTasksTaskPath({
    location: encodeURIComponent(params.location),
    projectId: encodeURIComponent(params.projectId),
    queueName: encodeURIComponent(params.queueName),
    taskName: encodeURIComponent(params.taskName),
  })}`;
}

export function buildSocialPublishDispatchUrl(baseUrl: string) {
  const trimmedBaseUrl = baseUrl.trim();

  if (!trimmedBaseUrl) {
    throw new Error("Missing social publish dispatch base URL.");
  }

  return new URL(SOCIAL_PUBLISH_DISPATCH_PATH, ensureUrlSlash(trimmedBaseUrl))
    .toString();
}

export function buildScheduledSocialPublishDispatchBody(
  input: CreateSocialPublishScheduleInput,
) {
  return JSON.stringify({
    jobId: input.jobId,
    jobType: "publish_social_post",
    targetId: input.targetId,
  });
}

export function getDefaultGcpSchedulerServiceAccountEmail(params: {
  namePrefix?: string;
  projectId: string;
}) {
  const namePrefix = params.namePrefix?.trim() || "ugc";

  return `${namePrefix}-scheduler-sa@${params.projectId}.iam.gserviceaccount.com`;
}

export function buildGcpCloudTasksCreateTaskRequest(
  params: BuildGcpCloudTasksCreateTaskRequestParams,
) {
  if (!GCP_TASK_ID_PATTERN.test(params.taskName)) {
    throw new Error("Invalid Cloud Tasks task name.");
  }

  const scheduledAt = new Date(params.input.scheduledFor);

  if (Number.isNaN(scheduledAt.getTime())) {
    throw new Error("Invalid schedule time.");
  }

  const body = buildScheduledSocialPublishDispatchBody(params.input);
  const taskPath = getGcpCloudTasksTaskPath({
    location: params.location,
    projectId: params.projectId,
    queueName: params.queueName,
    taskName: params.taskName,
  });

  return {
    endpoint: getGcpCloudTasksCreateEndpoint({
      location: params.location,
      projectId: params.projectId,
      queueName: params.queueName,
    }),
    requestBody: {
      task: {
        dispatchDeadline: params.dispatchDeadline ?? "30s",
        httpRequest: {
          body: Buffer.from(body, "utf8").toString("base64"),
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
        name: taskPath,
        scheduleTime: scheduledAt.toISOString(),
      },
    },
    taskPath,
  };
}

function ensureUrlSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}
