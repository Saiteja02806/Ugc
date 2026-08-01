import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import { getPublicBackgroundJob } from "@/lib/jobs/background-job-contract";
import { getMissingBackgroundJobStorageEnvVars } from "@/lib/jobs/background-jobs";
import { getMissingBackgroundJobCloudTasksEnvVars } from "@/lib/jobs/gcp-cloud-tasks";
import { enqueueWebsiteAnalysisJob } from "@/lib/website-analysis/jobs";

export const runtime = "nodejs";

const DEFAULT_PROJECT_ID = "test-project-001";

type AnalyzeWebsiteBody = {
  idempotencyKey?: unknown;
  projectId?: unknown;
  websiteUrl?: unknown;
};

export async function POST(request: Request) {
  let userId: string;

  try {
    userId = (await requireFirebaseUser(request)).uid;
  } catch (error) {
    if (error instanceof FirebaseAuthRequestError) {
      return errorResponse(
        error.status === 401
          ? "Sign in before analyzing a website."
          : error.message,
        error.status,
      );
    }

    console.error("Failed to verify website analysis requester:", error);
    return errorResponse("Could not verify your sign-in session.", 500);
  }

  const body = await readBody(request);

  if (!body) {
    return errorResponse("Send website analysis details as JSON.", 400);
  }

  const websiteUrl = getString(body.websiteUrl, 2_048);

  if (!websiteUrl) {
    return errorResponse("Website URL is required.", 400);
  }

  const missing = Array.from(
    new Set([
      ...getMissingBackgroundJobStorageEnvVars(),
      ...getMissingBackgroundJobCloudTasksEnvVars(["media_analysis"]),
    ]),
  );

  if (missing.length > 0) {
    return errorResponse(
      `Website analysis jobs are not configured. Add ${missing.join(", ")}.`,
      501,
    );
  }

  const idempotencyKey =
    getString(request.headers.get("Idempotency-Key"), 200) ||
    getString(body.idempotencyKey, 200) ||
    randomUUID();
  const projectId =
    getString(body.projectId, 120) || DEFAULT_PROJECT_ID;

  try {
    const job = await enqueueWebsiteAnalysisJob({
      idempotencyKey,
      projectId,
      userId,
      websiteUrl,
    });

    return NextResponse.json(
      {
        job: getPublicBackgroundJob(job),
        jobId: job.id,
        ok: true,
      },
      {
        headers: { "Cache-Control": "no-store" },
        status: job.status === "completed" ? 200 : 202,
      },
    );
  } catch (error) {
    console.error("Could not queue website analysis:", error);
    return errorResponse("Could not start the website analysis.", 502);
  }
}

async function readBody(request: Request) {
  try {
    return (await request.json()) as AnalyzeWebsiteBody;
  } catch {
    return null;
  }
}

function getString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { message, ok: false },
    { headers: { "Cache-Control": "no-store" }, status },
  );
}
