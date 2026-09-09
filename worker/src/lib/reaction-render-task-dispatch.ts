import { GoogleAuth } from "google-auth-library";

import type { BackgroundJobRow } from "../types.js";

const CLOUD_PLATFORM_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const DEFAULT_LOCATION = "us-central1";
const TASK_NAME_PREFIX = "reaction-render-";

type DispatchConfig = {
  audience: string;
  dispatchUrl: string;
  location: string;
  projectId: string;
  queueName: string;
  serviceAccountEmail: string;
};

let cloudTasksAuth: GoogleAuth | null = null;

/**
 * The item and its child job are committed before this function runs. A task
 * name derived from the child job makes every retry safe: Cloud Tasks either
 * creates that exact task or reports that a previous call already did.
 */
export async function enqueueReactionRenderTask(job: BackgroundJobRow) {
  if (job.job_type !== "reaction_render") {
    throw new Error("Only reaction_render jobs can be delivered to the Reaction worker.");
  }

  const config = getReactionRenderDispatchConfig();
  const task = buildReactionRenderTaskRequest({
    ...config,
    attempt: job.attempt_count,
    jobId: job.id,
  });
  const response = await fetch(task.endpoint, {
    body: JSON.stringify(task.requestBody),
    headers: {
      Authorization: await getAuthorizationHeader(task.endpoint),
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (response.status === 409) {
    return { created: false, taskName: task.taskName };
  }

  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 500);
    throw new Error(`Could not enqueue Reaction render task: ${response.status} ${detail}`);
  }

  return { created: true, taskName: task.taskName };
}

export function buildReactionRenderTaskRequest(params: DispatchConfig & {
  attempt: number;
  jobId: string;
}) {
  if (!isUuid(params.jobId)) {
    throw new Error("Reaction render task requires a UUID background job ID.");
  }

  const taskName = `${TASK_NAME_PREFIX}${params.jobId}`;
  const queuePath = `projects/${params.projectId}/locations/${params.location}/queues/${params.queueName}`;
  const body = JSON.stringify({
    attempt: params.attempt,
    jobId: params.jobId,
    jobType: "reaction_render",
    schemaVersion: 1,
  });

  return {
    endpoint: `https://cloudtasks.googleapis.com/v2/projects/${encodeURIComponent(params.projectId)}/locations/${encodeURIComponent(params.location)}/queues/${encodeURIComponent(params.queueName)}/tasks`,
    requestBody: {
      task: {
        dispatchDeadline: "1800s",
        httpRequest: {
          body: Buffer.from(body, "utf8").toString("base64"),
          headers: { "Content-Type": "application/json" },
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

export function getReactionRenderDispatchConfig(
  env: Record<string, string | undefined> = process.env,
): DispatchConfig {
  const projectId = (env.GCP_PROJECT_ID || env.GOOGLE_CLOUD_PROJECT || "").trim();
  const location = (env.GCP_CLOUD_TASKS_LOCATION || env.GCP_REGION || DEFAULT_LOCATION).trim();
  const resourcePrefix = (env.GCP_RESOURCE_NAME_PREFIX || "ugc")
    .trim()
    .replace(/[^a-z0-9-]/gi, "-") || "ugc";
  const queueName = (env.GCP_REACTION_RENDER_TASKS_QUEUE || `${resourcePrefix}-reaction-render`).trim();
  const serviceAccountEmail = (
    env.GCP_CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL ||
    env.GCP_SCHEDULER_SERVICE_ACCOUNT_EMAIL ||
    (projectId ? `${resourcePrefix}-scheduler-sa@${projectId}.iam.gserviceaccount.com` : "")
  ).trim();
  const rawDispatchUrl = env.GCP_REACTION_RENDER_TASK_URL?.trim() || "";

  if (!projectId) throw new Error("Missing GCP_PROJECT_ID or GOOGLE_CLOUD_PROJECT for Reaction rendering.");
  if (!location) throw new Error("Missing Cloud Tasks location for Reaction rendering.");
  if (!queueName) throw new Error("Missing Cloud Tasks queue for Reaction rendering.");
  if (!serviceAccountEmail) throw new Error("Missing Cloud Tasks service account for Reaction rendering.");
  if (!rawDispatchUrl) throw new Error("Missing GCP_REACTION_RENDER_TASK_URL for Reaction rendering.");

  let dispatchUrl: URL;
  try {
    dispatchUrl = new URL(rawDispatchUrl);
  } catch {
    throw new Error("GCP_REACTION_RENDER_TASK_URL must be a valid URL.");
  }

  if (dispatchUrl.protocol !== "https:" || dispatchUrl.pathname !== "/tasks/jobs") {
    throw new Error("GCP_REACTION_RENDER_TASK_URL must be the HTTPS Reaction worker /tasks/jobs endpoint.");
  }

  return {
    audience: env.GCP_REACTION_RENDER_TASK_AUDIENCE?.trim() || dispatchUrl.origin,
    dispatchUrl: dispatchUrl.toString(),
    location,
    projectId,
    queueName,
    serviceAccountEmail,
  };
}

async function getAuthorizationHeader(endpoint: string) {
  if (!cloudTasksAuth) {
    cloudTasksAuth = new GoogleAuth({ scopes: [CLOUD_PLATFORM_SCOPE] });
  }

  const headers = await cloudTasksAuth.getRequestHeaders(endpoint);
  const authorization = headers.get("authorization");
  if (!authorization) throw new Error("Could not authorize Cloud Tasks Reaction task creation.");
  return authorization;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
