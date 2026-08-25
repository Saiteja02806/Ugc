import { NextResponse } from "next/server";
import { z } from "zod";

import { getBusinessProfileForUser } from "@/lib/business-profiles/db";
import { getBusinessProfileOnboardingGate } from "@/lib/business-profiles/onboarding-access";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import {
  getPublicBackgroundJob,
} from "@/lib/jobs/background-job-contract";
import { enqueueTrendingWallTextJob } from "@/lib/trending/wall-text-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const PrepareWallTextSchema = z
  .object({ requestedCount: z.number().int().min(1).max(50).optional() })
  .strict();

export async function POST(request: Request) {
  let userId: string;

  try {
    userId = (await requireFirebaseUser(request)).uid;
  } catch (error) {
    if (error instanceof FirebaseAuthRequestError) {
      return json(
        {
          error:
            error.status === 401
              ? "Sign in before preparing Wall-of-text ideas."
              : error.message,
          ok: false,
        },
        error.status,
      );
    }

    console.error("Failed to verify Wall-of-text requester:", error);
    return json(
      { error: "Could not verify your sign-in session.", ok: false },
      500,
    );
  }

  try {
    const body = PrepareWallTextSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!body.success) {
      return json({ error: "Choose between 1 and 50 Wall videos.", ok: false }, 400);
    }
    const profile = await getBusinessProfileForUser(userId);
    const onboardingGate = getBusinessProfileOnboardingGate(profile);

    if (onboardingGate || !profile) {
      return json(
        {
          code: onboardingGate?.code ?? "onboarding_required",
          error:
            onboardingGate?.message ??
            "Complete the required business onboarding before using Trending.",
          ok: false,
        },
        onboardingGate?.status ?? 409,
      );
    }

    const job = await enqueueTrendingWallTextJob({
      businessProfileId: profile.id,
      businessProfileVersion: profile.profileVersion,
      profile,
      requestedCount: body.data.requestedCount,
      userId,
    });

    return json(
      {
        job: getPublicBackgroundJob(job),
        jobId: job.id,
        ok: true,
        status: job.status,
      },
      job.status === "completed" ? 200 : 202,
    );
  } catch (error) {
    console.error("Could not queue Trending Wall-of-text ideas:", error);
    return json(
      { error: "Could not queue Trending Wall-of-text ideas.", ok: false },
      502,
    );
  }
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
