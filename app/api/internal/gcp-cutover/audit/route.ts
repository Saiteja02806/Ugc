import { NextResponse } from "next/server";

import {
  getMissingSqsEnvVars,
  getQueueNameForJobType,
  getQueueProviderName,
  sendJobMessage,
} from "@/lib/aws/sqs";
import {
  GCP_CUTOVER_AUDIT_SIGNATURE_HEADER,
  GCP_CUTOVER_AUDIT_TIMESTAMP_HEADER,
} from "@/lib/internal/gcp-cutover-audit-signature";
import {
  getMissingGcpCutoverAuditAuthEnvVars,
  verifyGcpCutoverAuditRequest,
} from "@/lib/internal/gcp-cutover-audit-auth";
import {
  attachAwsMessageToBackgroundJob,
  createBackgroundJob,
  getMissingBackgroundJobStorageEnvVars,
  markBackgroundJobFailed,
} from "@/lib/jobs/background-jobs";
import {
  getGcpProjectId,
  getGcpPubSubTopicNameForJobType,
} from "@/lib/queues/config";
import { getMissingSocialSchedulerEnvVars } from "@/lib/scheduling/social-scheduler";
import { getSocialSchedulerProviderName } from "@/lib/scheduling/social-scheduler-config";
import {
  getMissingStorageEnvVars,
  getStorageProviderName,
} from "@/lib/storage/s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CANARY_JOB_TYPE = "generate_image";
const MAX_BODY_LENGTH = 2_048;

type AuditRequestBody = {
  generationId?: unknown;
  projectId?: unknown;
  userId?: unknown;
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");

  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_LENGTH) {
    return json({ ok: false, message: "Request body is too large." }, 413);
  }

  const body = await request.text();

  if (!body || Buffer.byteLength(body, "utf8") > MAX_BODY_LENGTH) {
    return json({ ok: false, message: "Request body is invalid." }, 400);
  }

  const missingAuthEnv = getMissingGcpCutoverAuditAuthEnvVars();

  if (missingAuthEnv.length > 0) {
    console.error("GCP cutover audit auth is not configured", {
      missingAuthEnv,
    });
    return json({ ok: false, message: "Cutover audit is not configured." }, 503);
  }

  const authorized = verifyGcpCutoverAuditRequest({
    body,
    signature: request.headers.get(GCP_CUTOVER_AUDIT_SIGNATURE_HEADER),
    timestamp: request.headers.get(GCP_CUTOVER_AUDIT_TIMESTAMP_HEADER),
  });

  if (!authorized) {
    return json({ ok: false, message: "Unauthorized." }, 401);
  }

  let input: AuditRequestBody;

  try {
    input = JSON.parse(body) as AuditRequestBody;
  } catch {
    return json({ ok: false, message: "Request body must be valid JSON." }, 400);
  }

  let runtimeSnapshot: ReturnType<typeof getRuntimeSnapshot>;

  try {
    runtimeSnapshot = getRuntimeSnapshot();
  } catch (error) {
    console.error("GCP cutover audit could not resolve providers", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return json(
      { ok: false, message: "Cutover providers are not configured correctly." },
      503,
    );
  }

  const providerChecks = {
    queueProvider: runtimeSnapshot.queueProvider === "gcp",
    socialSchedulerProvider:
      runtimeSnapshot.socialSchedulerProvider === "gcp",
    storageProvider: runtimeSnapshot.storageProvider === "gcp",
  };

  if (!Object.values(providerChecks).every(Boolean)) {
    return json(
      {
        ok: false,
        message: "Production is not fully cut over to GCP providers.",
        providerChecks,
        runtime: runtimeSnapshot,
      },
      409,
    );
  }

  const missingRuntimeEnv = getMissingRuntimeEnv();

  if (missingRuntimeEnv.length > 0) {
    console.error("GCP cutover audit runtime is missing env vars", {
      missingRuntimeEnv,
    });
    return json(
      {
        ok: false,
        message: "Production GCP cutover runtime is not fully configured.",
        missingRuntimeEnv,
        runtime: runtimeSnapshot,
      },
      503,
    );
  }

  const generationId = getString(input.generationId) || crypto.randomUUID();
  const canaryProjectId =
    cleanPathSegment(input.projectId, "production-gcp-cutover-audit");
  const canaryUserId =
    cleanPathSegment(input.userId, "production-gcp-cutover-audit");
  const backgroundJob = await createBackgroundJob({
    input: {
      canary: "production-gcp-cutover-invalid-ai-generation",
      generationId,
    },
    jobType: CANARY_JOB_TYPE,
    projectId: canaryProjectId,
    queueName: getQueueNameForJobType(CANARY_JOB_TYPE),
    userId: canaryUserId,
  });

  try {
    const message = await sendJobMessage({
      jobId: backgroundJob.id,
      jobType: CANARY_JOB_TYPE,
    });

    if (message.provider !== "gcp") {
      throw new Error(
        `Expected GCP Pub/Sub provider, got ${message.provider}.`,
      );
    }

    const updatedJob = await attachAwsMessageToBackgroundJob({
      awsMessageId: message.messageId,
      jobId: backgroundJob.id,
    });

    return json({
      canary: {
        generationId,
        jobId: updatedJob.id,
        jobType: updatedJob.jobType,
        messageId: message.messageId,
        messageProvider: message.provider,
        queueName: updatedJob.queueName,
        status: updatedJob.status,
        topicName: message.topicName,
      },
      ok: true,
      runtime: runtimeSnapshot,
    });
  } catch (error) {
    console.error("Failed to enqueue production GCP cutover audit job", {
      error: error instanceof Error ? error.message : "Unknown error",
      jobId: backgroundJob.id,
    });

    await markBackgroundJobFailed({
      errorMessage:
        error instanceof Error
          ? error.message
          : "Could not send GCP cutover audit job.",
      jobId: backgroundJob.id,
    }).catch((persistenceError) => {
      console.error("Failed to persist GCP cutover audit failure", {
        error:
          persistenceError instanceof Error
            ? persistenceError.message
            : "Unknown error",
        jobId: backgroundJob.id,
      });
    });

    return json(
      {
        jobId: backgroundJob.id,
        ok: false,
        message: "Could not enqueue the GCP cutover audit job.",
        runtime: runtimeSnapshot,
      },
      502,
    );
  }
}

function getRuntimeSnapshot() {
  return {
    cloudTasksQueue:
      process.env.GCP_SOCIAL_PUBLISH_TASKS_QUEUE?.trim() ||
      "ugc-social-publish-scheduler",
    gcpProjectId: getGcpProjectId() || null,
    queueProvider: getQueueProviderName(),
    socialSchedulerProvider: getSocialSchedulerProviderName(),
    storageBucket: process.env.GCP_STORAGE_BUCKET?.trim() || null,
    storageProvider: getStorageProviderName(),
    storagePublicBaseUrlHost: getUrlHost(
      process.env.GCP_STORAGE_PUBLIC_BASE_URL?.trim(),
    ),
    topicName: getGcpPubSubTopicNameForJobType(CANARY_JOB_TYPE),
  };
}

function getMissingRuntimeEnv() {
  return Array.from(
    new Set([
      ...getMissingBackgroundJobStorageEnvVars(),
      ...getMissingSqsEnvVars([CANARY_JOB_TYPE]),
      ...getMissingStorageEnvVars(),
      ...getMissingSocialSchedulerEnvVars(),
    ]),
  );
}

function getString(value: unknown, maxLength = 120) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanPathSegment(value: unknown, fallback: string) {
  const cleanValue = getString(value, 120)
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return cleanValue || fallback;
}

function getUrlHost(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}
