import { NextResponse } from "next/server";

import {
  getCanonicalBackgroundJobType,
  getPublicBackgroundJob,
  type CanonicalBackgroundJobType,
} from "@/lib/jobs/background-job-contract";
import {
  createAndDispatchBackgroundJob,
  isPubliclyCreatableJobType,
} from "@/lib/jobs/background-job-service";
import {
  getMissingBackgroundJobStorageEnvVars,
  listBackgroundJobsForUser,
} from "@/lib/jobs/background-jobs";
import { getMissingBackgroundJobCloudTasksEnvVars } from "@/lib/jobs/gcp-cloud-tasks";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";

export const runtime = "nodejs";

type CreateJobBody = {
  idempotencyKey?: unknown;
  input?: { message?: unknown };
  jobType?: unknown;
  projectId?: unknown;
};

export async function GET(request: Request) {
  const auth = await authenticate(request, "list jobs");

  if (auth.response) {
    return auth.response;
  }

  const missing = getMissingBackgroundJobStorageEnvVars();

  if (missing.length > 0) {
    return json({ ok: false, error: `Job storage is not configured. Add ${missing.join(", ")}.` }, 501);
  }

  const url = new URL(request.url);
  const activeOnly = url.searchParams.get("status") === "active";
  const requestedType = url.searchParams.get("type")?.trim() || null;
  const limit = Number.parseInt(url.searchParams.get("limit") || "50", 10);

  try {
    const jobs = await listBackgroundJobsForUser({
      activeOnly,
      limit: Number.isFinite(limit) ? limit : 50,
      userId: auth.userId,
    });
    const publicJobs = jobs
      .filter(
        (job) =>
          !requestedType ||
          getCanonicalBackgroundJobType(job.jobType) ===
            (requestedType as CanonicalBackgroundJobType),
      )
      .map(getPublicBackgroundJob);

    return json({ ok: true, jobs: publicJobs });
  } catch (error) {
    console.error("Failed to list background jobs:", error);
    return json({ ok: false, error: "Could not list background jobs." }, 500);
  }
}

export async function POST(request: Request) {
  const auth = await authenticate(request, "create a job");

  if (auth.response) {
    return auth.response;
  }

  const body = await readBody(request);
  const jobType = getString(body?.jobType, 80);

  if (!body || !isPubliclyCreatableJobType(jobType)) {
    return json(
      { ok: false, error: "This endpoint currently accepts test_worker_job only." },
      400,
    );
  }

  const missing = Array.from(
    new Set([
      ...getMissingBackgroundJobStorageEnvVars(),
      ...getMissingBackgroundJobCloudTasksEnvVars([jobType]),
    ]),
  );

  if (missing.length > 0) {
    return json({ ok: false, error: `Job dispatch is not configured. Add ${missing.join(", ")}.` }, 501);
  }

  const headerIdempotencyKey = request.headers.get("Idempotency-Key")?.trim();
  const bodyIdempotencyKey = getString(body.idempotencyKey, 200);
  const message = getString(body.input?.message, 500) || "hello from app";

  try {
    const job = await createAndDispatchBackgroundJob({
      idempotencyKey: headerIdempotencyKey || bodyIdempotencyKey || null,
      input: { message },
      jobType,
      projectId: getString(body.projectId, 120) || null,
      userId: auth.userId,
    });

    return json({ ok: true, job: getPublicBackgroundJob(job) }, 202);
  } catch (error) {
    console.error("Failed to create background job:", error);
    return json({ ok: false, error: "Could not start the background job." }, 502);
  }
}

async function authenticate(request: Request, action: string) {
  try {
    return {
      response: null,
      userId: (await requireFirebaseUser(request)).uid,
    };
  } catch (error) {
    if (error instanceof FirebaseAuthRequestError) {
      return {
        response: json(
          {
            ok: false,
            error: error.status === 401 ? `Sign in to ${action}.` : error.message,
          },
          error.status,
        ),
        userId: "",
      };
    }

    console.error(`Failed to authenticate request to ${action}:`, error);
    return {
      response: json({ ok: false, error: "Could not verify your sign-in session." }, 500),
      userId: "",
    };
  }
}

async function readBody(request: Request) {
  try {
    return (await request.json()) as CreateJobBody;
  } catch {
    return null;
  }
}

function getString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
}
