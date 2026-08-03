import "server-only";

import { GoogleAuth } from "google-auth-library";

import {
  getGoogleServiceAccountCredentials,
  getMissingVercelGcpCredentialEnvVars,
} from "@/lib/gcp/credentials";
import { getGcpProjectId } from "@/lib/queues/config";
import type { BackgroundJobRecord } from "./background-jobs";
import { buildCloudRunJobExecutionRequest } from "./gcp-cloud-run-job-logic";

const CLOUD_PLATFORM_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
let cloudRunAuth: GoogleAuth | null = null;

export function getMissingCloudRunRenderJobEnvVars(
  env: Record<string, string | undefined> = process.env,
) {
  const missing = new Set<string>();

  if (!getGcpProjectId(env)) {
    missing.add("GCP_PROJECT_ID or GOOGLE_CLOUD_PROJECT");
  }

  if (!env.GCP_VIDEO_RENDER_JOB_NAME?.trim()) {
    missing.add("GCP_VIDEO_RENDER_JOB_NAME");
  }

  for (const envName of getMissingVercelGcpCredentialEnvVars(env)) {
    missing.add(envName);
  }

  return Array.from(missing);
}

export async function launchBackgroundRenderJob(job: BackgroundJobRecord) {
  const request = buildCloudRunJobExecutionRequest({
    jobId: job.id,
    jobName: getRequiredEnv("GCP_VIDEO_RENDER_JOB_NAME"),
    jobType: job.jobType,
    location:
      process.env.GCP_VIDEO_RENDER_JOB_LOCATION?.trim() ||
      process.env.GCP_REGION?.trim() ||
      "us-central1",
    projectId: getRequiredProjectId(),
    timeoutSeconds: getRenderTimeoutSeconds(),
  });
  const response = await fetch(request.endpoint, {
    body: JSON.stringify(request.requestBody),
    cache: "no-store",
    headers: {
      Authorization: await getAuthorizationHeader(request.endpoint),
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    const summary = (await response.text().catch(() => "")).slice(0, 500);
    throw new Error(
      `Could not launch GCP Cloud Run Job: ${response.status} ${summary}`,
    );
  }

  const result = (await response.json()) as { name?: unknown };
  const executionName =
    typeof result.name === "string" && result.name.trim()
      ? result.name.trim()
      : request.jobPath;

  return { executionName };
}

function getCloudRunAuth() {
  if (!cloudRunAuth) {
    const credentials = getGoogleServiceAccountCredentials();

    cloudRunAuth = new GoogleAuth({
      ...(credentials ? { credentials } : {}),
      projectId: getRequiredProjectId(),
      scopes: [CLOUD_PLATFORM_SCOPE],
    });
  }

  return cloudRunAuth;
}

async function getAuthorizationHeader(url: string) {
  const headers = await getCloudRunAuth().getRequestHeaders(url);
  const authorization = headers.get("authorization");

  if (!authorization) {
    throw new Error("Could not authorize GCP Cloud Run Jobs request.");
  }

  return authorization;
}

function getRequiredProjectId() {
  const projectId = getGcpProjectId();

  if (!projectId) {
    throw new Error("Missing GCP_PROJECT_ID or GOOGLE_CLOUD_PROJECT.");
  }

  return projectId;
}

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing ${name}.`);
  }

  return value;
}

function getRenderTimeoutSeconds() {
  const value = Number(process.env.GCP_VIDEO_RENDER_JOB_TIMEOUT_SECONDS || 3600);

  return Number.isFinite(value) ? value : 3600;
}
