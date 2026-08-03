import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import {
  getBusinessProfileForUser,
  getMissingBusinessProfileEnvVars,
} from "@/lib/business-profiles/db";
import { enqueueBusinessProfileSetupJob } from "@/lib/business-profiles/jobs";
import { BusinessProfileSetupInputSchema } from "@/lib/business-profiles/setup";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import { getPublicBackgroundJob } from "@/lib/jobs/background-job-contract";
import { getMissingBackgroundJobStorageEnvVars } from "@/lib/jobs/background-jobs";
import { getMissingBackgroundJobCloudTasksEnvVars } from "@/lib/jobs/gcp-cloud-tasks";

export const runtime = "nodejs";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
}

async function getUserId(request: Request) {
  try {
    return (await requireFirebaseUser(request)).uid;
  } catch (error) {
    if (error instanceof FirebaseAuthRequestError) {
      throw error;
    }

    throw new FirebaseAuthRequestError(
      "Could not verify your sign-in session.",
      500,
    );
  }
}

export async function GET(request: Request) {
  try {
    const profile = await getBusinessProfileForUser(await getUserId(request));

    return json({
      ok: true,
      profile: profile ? toClientProfile(profile) : null,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not load your business profile.";
    const status =
      error instanceof FirebaseAuthRequestError ? error.status : 500;

    return json({ message, ok: false }, status);
  }
}

export async function POST(request: Request) {
  let userId: string;

  try {
    userId = await getUserId(request);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not verify your sign-in session.";
    const status =
      error instanceof FirebaseAuthRequestError ? error.status : 500;

    return json({ message, ok: false }, status);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return json(
      { message: "Send business profile details as JSON.", ok: false },
      400,
    );
  }

  const parsed = BusinessProfileSetupInputSchema.safeParse(body);

  if (!parsed.success) {
    return json(
      {
        message:
          "Complete the selected business profile source before continuing.",
        ok: false,
      },
      400,
    );
  }

  const missing = Array.from(
    new Set([
      ...getMissingBusinessProfileEnvVars(),
      ...getMissingBackgroundJobStorageEnvVars(),
      ...getMissingBackgroundJobCloudTasksEnvVars(["media_analysis"]),
    ]),
  );

  if (missing.length > 0) {
    return json(
      {
        message: `Business profile jobs are not configured. Add ${missing.join(", ")}.`,
        ok: false,
      },
      501,
    );
  }

  const idempotencyKey =
    getString(request.headers.get("Idempotency-Key"), 200) ||
    getString(
      isRecord(body) ? body.idempotencyKey : undefined,
      200,
    ) ||
    randomUUID();

  try {
    const job = await enqueueBusinessProfileSetupJob({
      idempotencyKey,
      input: parsed.data,
      userId,
    });

    return json(
      {
        job: getPublicBackgroundJob(job),
        jobId: job.id,
        ok: true,
      },
      job.status === "completed" ? 200 : 202,
    );
  } catch (error) {
    console.error("Could not queue business profile setup:", error);
    return json(
      { message: "Could not start business profile setup.", ok: false },
      502,
    );
  }
}

function getString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function toClientProfile(
  profile: NonNullable<Awaited<ReturnType<typeof getBusinessProfileForUser>>>,
) {
  return {
    id: profile.id,
    intakeType: profile.intakeType,
    preparationError: profile.preparationError,
    preparationStatus: profile.preparationStatus,
    profileVersion: profile.profileVersion,
  };
}
