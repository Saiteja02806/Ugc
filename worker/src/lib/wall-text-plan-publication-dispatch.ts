import { GoogleAuth } from "google-auth-library";

const CLOUD_PLATFORM_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const DEFAULT_LOCATION = "us-central1";
const WALL_PLAN_PUBLICATION_PATH = "/api/internal/trending/wall-plan-ready";
const TASK_NAME_PREFIX = "wall-plan-publication-";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
 * The publication row is the durable outbox. Cloud Tasks receives a task for
 * that exact row, so duplicate enqueue attempts are harmless and retries keep
 * targeting the same admission work.
 */
export async function enqueueWallTextPlanPublicationTask(params: {
  planId: string;
  publicationId: string;
}) {
  const config = getWallTextPlanPublicationDispatchConfig();
  const task = buildWallTextPlanPublicationTaskRequest({
    ...config,
    planId: params.planId,
    publicationId: params.publicationId,
  });
  const response = await fetch(task.endpoint, {
    body: JSON.stringify(task.requestBody),
    headers: {
      Authorization: await getAuthorizationHeader(task.endpoint),
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  // A previous attempt may have created the deterministic task just before a
  // worker crash or network error. Cloud Tasks keeps the original task alive.
  if (response.status === 409) {
    return { created: false, taskName: task.taskName };
  }

  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 500);
    throw new Error(
      `Could not enqueue Wall-of-Text publication task: ${response.status} ${detail}`,
    );
  }

  return { created: true, taskName: task.taskName };
}

export function buildWallTextPlanPublicationTaskRequest(params: DispatchConfig & {
  planId: string;
  publicationId: string;
}) {
  if (!UUID_PATTERN.test(params.planId) || !UUID_PATTERN.test(params.publicationId)) {
    throw new Error("Wall-of-Text publication task requires UUID identifiers.");
  }

  const taskName = `${TASK_NAME_PREFIX}${params.publicationId}`;
  const queuePath = `projects/${params.projectId}/locations/${params.location}/queues/${params.queueName}`;
  const body = JSON.stringify({
    planId: params.planId,
    publicationId: params.publicationId,
  });

  return {
    endpoint: `https://cloudtasks.googleapis.com/v2/projects/${encodeURIComponent(params.projectId)}/locations/${encodeURIComponent(params.location)}/queues/${encodeURIComponent(params.queueName)}/tasks`,
    requestBody: {
      task: {
        dispatchDeadline: "60s",
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

export function getWallTextPlanPublicationDispatchConfig(
  env: Record<string, string | undefined> = process.env,
): DispatchConfig {
  const projectId = (env.GCP_PROJECT_ID || env.GOOGLE_CLOUD_PROJECT || "").trim();
  const location = (env.GCP_CLOUD_TASKS_LOCATION || env.GCP_REGION || DEFAULT_LOCATION).trim();
  const resourcePrefix = (env.GCP_RESOURCE_NAME_PREFIX || "ugc")
    .trim()
    .replace(/[^a-z0-9-]/gi, "-") || "ugc";
  const queueName = (env.GCP_WALL_TEXT_PUBLICATION_TASKS_QUEUE || `${resourcePrefix}-wall-text-publication`).trim();
  const serviceAccountEmail = (
    env.GCP_CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL ||
    env.GCP_SCHEDULER_SERVICE_ACCOUNT_EMAIL ||
    (projectId ? `${resourcePrefix}-scheduler-sa@${projectId}.iam.gserviceaccount.com` : "")
  ).trim();
  const rawAppUrl = env.UGC_INTERNAL_APP_URL?.trim() || "";

  if (!projectId) throw new Error("Missing GCP_PROJECT_ID or GOOGLE_CLOUD_PROJECT for Wall publication delivery.");
  if (!location) throw new Error("Missing Cloud Tasks location for Wall publication delivery.");
  if (!queueName) throw new Error("Missing Cloud Tasks queue for Wall publication delivery.");
  if (!serviceAccountEmail) throw new Error("Missing Cloud Tasks service account for Wall publication delivery.");
  if (!rawAppUrl) throw new Error("Missing UGC_INTERNAL_APP_URL for Wall publication delivery.");

  let dispatchUrl: URL;
  try {
    dispatchUrl = new URL(
      WALL_PLAN_PUBLICATION_PATH,
      rawAppUrl.endsWith("/") ? rawAppUrl : `${rawAppUrl}/`,
    );
  } catch {
    throw new Error("UGC_INTERNAL_APP_URL must be a valid URL.");
  }

  if (dispatchUrl.protocol !== "https:") {
    throw new Error("UGC_INTERNAL_APP_URL must use HTTPS for Wall publication delivery.");
  }

  return {
    audience: env.GCP_WALL_TEXT_PUBLICATION_AUDIENCE?.trim() || dispatchUrl.toString(),
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

  if (!authorization) {
    throw new Error("Could not authorize Cloud Tasks publication request.");
  }

  return authorization;
}
