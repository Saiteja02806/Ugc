import { NextResponse } from "next/server";

import { requireFirebaseUser } from "@/lib/firebase/server-auth";
import { getPublicBackgroundJob } from "@/lib/jobs/background-job-contract";
import { cancelBackgroundJobForUser } from "@/lib/jobs/background-job-service";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  try {
    const [user, params] = await Promise.all([
      requireFirebaseUser(request),
      context.params,
    ]);
    const job = await cancelBackgroundJobForUser({
      jobId: params.jobId,
      userId: user.uid,
    });

    if (!job) {
      return json({ ok: false, error: "Job was not found." }, 404);
    }

    return json({ ok: true, job: getPublicBackgroundJob(job) }, 202);
  } catch (error) {
    const status = getAuthStatus(error);

    if (status) {
      return json({ ok: false, error: "Sign in to cancel this job." }, status);
    }

    console.error("Failed to request background job cancellation:", error);
    return json({ ok: false, error: "Could not cancel the job." }, 500);
  }
}

function getAuthStatus(error: unknown) {
  return typeof error === "object" && error && "status" in error
    ? Number((error as { status: unknown }).status) || null
    : null;
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
}
