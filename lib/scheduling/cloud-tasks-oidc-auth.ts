import "server-only";

import { OAuth2Client } from "google-auth-library";

import { getGcpProjectId } from "@/lib/queues/config";
import {
  getDefaultGcpSchedulerServiceAccountEmail,
  SOCIAL_PUBLISH_DISPATCH_PATH,
} from "@/lib/scheduling/gcp-cloud-tasks-scheduler-logic";

let oauthClient: OAuth2Client | null = null;

export function getMissingCloudTasksOidcEnvVars(
  env: Record<string, string | undefined> = process.env,
) {
  return getExpectedCloudTasksSchedulerEmail(env)
    ? []
    : [
        "GCP_CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL or GCP_PROJECT_ID/GOOGLE_CLOUD_PROJECT",
      ];
}

export function getSocialPublishDispatchAudienceForRequest(
  requestUrl: string,
  env: Record<string, string | undefined> = process.env,
) {
  const explicitAudience = env.GCP_SOCIAL_PUBLISH_DISPATCH_AUDIENCE?.trim();

  if (explicitAudience) {
    return explicitAudience;
  }

  const url = new URL(requestUrl);
  url.pathname = SOCIAL_PUBLISH_DISPATCH_PATH;
  url.search = "";
  url.hash = "";

  return url.toString();
}

export async function verifyCloudTasksOidcRequest(params: {
  audience: string;
  authorization: string | null;
  env?: Record<string, string | undefined>;
}) {
  const idToken = extractBearerToken(params.authorization);
  const expectedEmail = getExpectedCloudTasksSchedulerEmail(params.env);

  if (!idToken || !expectedEmail) {
    return false;
  }

  try {
    const ticket = await getOauthClient().verifyIdToken({
      audience: params.audience,
      idToken,
    });
    const payload = ticket.getPayload();

    return payload?.email === expectedEmail;
  } catch {
    return false;
  }
}

function getExpectedCloudTasksSchedulerEmail(
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

function extractBearerToken(authorization: string | null) {
  const match = authorization?.match(/^Bearer\s+(.+)$/i);

  return match?.[1]?.trim() || "";
}

function getOauthClient() {
  if (!oauthClient) {
    oauthClient = new OAuth2Client();
  }

  return oauthClient;
}
