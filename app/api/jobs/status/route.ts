import { NextResponse } from "next/server";

import {
  getBackgroundJobById,
  getMissingBackgroundJobStorageEnvVars,
} from "@/lib/jobs/background-jobs";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";

export const runtime = "nodejs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function getAuthErrorResponse(error: FirebaseAuthRequestError) {
  return jsonResponse(
    {
      ok: false,
      error:
        error.status === 401
          ? "Sign in before checking worker job status."
          : error.message,
    },
    error.status,
  );
}

export async function GET(request: Request) {
  let user;

  try {
    user = await requireFirebaseUser(request);
  } catch (error) {
    if (error instanceof FirebaseAuthRequestError) {
      return getAuthErrorResponse(error);
    }

    console.error("Failed to verify job status requester:", error);

    return jsonResponse(
      {
        ok: false,
        error: "Could not verify your sign-in session.",
      },
      500,
    );
  }

  const missingRuntimeEnv = getMissingBackgroundJobStorageEnvVars();

  if (missingRuntimeEnv.length > 0) {
    return jsonResponse(
      {
        ok: false,
        error: `Background job status is not configured. Add ${missingRuntimeEnv.join(
          ", ",
        )}.`,
      },
      501,
    );
  }

  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId")?.trim() ?? "";

  if (!jobId || !UUID_PATTERN.test(jobId)) {
    return jsonResponse(
      {
        ok: false,
        error: "Missing or invalid jobId.",
      },
      400,
    );
  }

  try {
    const job = await getBackgroundJobById(jobId);

    if (!job) {
      return jsonResponse(
        {
          ok: false,
          error: "Worker job was not found.",
        },
        404,
      );
    }

    if (job.userId && job.userId !== user.uid) {
      return jsonResponse(
        {
          ok: false,
          error: "You do not have access to this worker job.",
        },
        403,
      );
    }

    return jsonResponse({
      ok: true,
      job: {
        completedAt: job.completedAt,
        createdAt: job.createdAt,
        error: job.errorMessage,
        id: job.id,
        jobType: job.jobType,
        output: job.output,
        queueName: job.queueName,
        startedAt: job.startedAt,
        status: job.status,
        updatedAt: job.updatedAt,
      },
    });
  } catch (error) {
    console.error("Failed to read worker job status:", error);

    return jsonResponse(
      {
        ok: false,
        error: "Could not read worker job status.",
      },
      500,
    );
  }
}
