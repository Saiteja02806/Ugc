import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import {
  completeBusinessProfileOnboarding,
  getBusinessProfileForUser,
  getMissingBusinessProfileEnvVars,
  isBusinessProfileOnboardingComplete,
  saveBusinessProfileOnboardingGoalDraft,
  saveBusinessProfileOnboardingIdentity,
} from "@/lib/business-profiles/db";
import { inspectBusinessLogo } from "@/lib/business-profiles/logo";
import { enqueueBusinessProfileSetupJob } from "@/lib/business-profiles/jobs";
import {
  BUSINESS_PROFILE_ONBOARDING_VERSION,
  BusinessProfileOnboardingContextSchema,
  PrimaryGoalsDraftSchema,
  PrimaryGoalsSchema,
  getMissingBusinessProfileOnboardingFields,
} from "@/lib/business-profiles/schema";
import { BusinessProfileSetupInputSchema } from "@/lib/business-profiles/setup";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import { getPublicBackgroundJob } from "@/lib/jobs/background-job-contract";
import { getMissingBackgroundJobStorageEnvVars } from "@/lib/jobs/background-jobs";
import { getMissingBackgroundJobCloudTasksEnvVars } from "@/lib/jobs/gcp-cloud-tasks";
import { deleteStorageObject } from "@/lib/storage/storage";

export const runtime = "nodejs";

const onboardingPatchSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("save_identity"),
      businessName: BusinessProfileOnboardingContextSchema.shape.businessName,
      logoStorageKey: z.string().trim().min(1).max(1_000).nullable().optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("save_goal_draft"),
      primaryGoals: PrimaryGoalsDraftSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("complete"),
      primaryGoals: PrimaryGoalsSchema,
    })
    .strict(),
]);

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

export async function PATCH(request: Request) {
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
      { message: "Send onboarding details as JSON.", ok: false },
      400,
    );
  }

  const parsed = onboardingPatchSchema.safeParse(body);

  if (!parsed.success) {
    return json(
      {
        message: "Complete the current onboarding step before continuing.",
        ok: false,
      },
      400,
    );
  }

  try {
    const existing = await getBusinessProfileForUser(userId);

    if (!existing) {
      return json(
        {
          message: "Add your business information before continuing.",
          ok: false,
        },
        404,
      );
    }

    if (parsed.data.action === "save_identity") {
      const previousLogoKey = existing.logoStorageKey;
      let logo: Awaited<ReturnType<typeof inspectBusinessLogo>> | null | undefined;

      if (parsed.data.logoStorageKey === null) {
        logo = null;
      } else if (parsed.data.logoStorageKey) {
        try {
          logo = await inspectBusinessLogo({
            key: parsed.data.logoStorageKey,
            userId,
          });
        } catch (error) {
          return json(
            {
              message:
                error instanceof Error
                  ? error.message
                  : "Could not validate the uploaded logo.",
              ok: false,
            },
            400,
          );
        }
      }

      const profile = await saveBusinessProfileOnboardingIdentity({
        logo,
        onboardingContext: { businessName: parsed.data.businessName },
        profile: existing,
      });

      if (
        previousLogoKey &&
        previousLogoKey !== profile.logoStorageKey
      ) {
        void deleteStorageObject({ key: previousLogoKey }).catch((deleteError) => {
          console.error("Could not delete replaced business logo:", deleteError);
        });
      }

      return json({ ok: true, profile: toClientProfile(profile) });
    }

    if (parsed.data.action === "save_goal_draft") {
      const profile = await saveBusinessProfileOnboardingGoalDraft({
        primaryGoals: parsed.data.primaryGoals,
        profile: existing,
      });

      return json({ ok: true, profile: toClientProfile(profile) });
    }

    if (!existing.context.businessName?.trim()) {
      return json(
        { message: "Add the business name before choosing your goals.", ok: false },
        409,
      );
    }

    const profile = await completeBusinessProfileOnboarding({
      primaryGoals: parsed.data.primaryGoals,
      profile: existing,
    });

    return json({ ok: true, profile: toClientProfile(profile) });
  } catch (error) {
    console.error("Could not update business profile onboarding:", error);
    return json(
      { message: "Could not save this onboarding step.", ok: false },
      500,
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
  const onboardingComplete = isBusinessProfileOnboardingComplete(profile);

  return {
    analysisConfidence: profile.context.confidence,
    analysisSummary: profile.context.productSummary,
    businessName: profile.context.businessName,
    id: profile.id,
    intakeType: profile.intakeType,
    logoStorageKey: profile.logoStorageKey,
    logoUrl: profile.logoUrl,
    onboardingComplete,
    onboardingCompletedAt: profile.onboardingCompletedAt,
    onboardingMissingFields: [
      ...getMissingBusinessProfileOnboardingFields(profile.context),
      ...(profile.primaryGoals.length > 0 ? [] : ["primaryGoals"]),
    ],
    onboardingRequiredVersion: BUSINESS_PROFILE_ONBOARDING_VERSION,
    onboardingStatus: onboardingComplete ? "completed" : "incomplete",
    onboardingVersion: profile.onboardingVersion,
    preparationError: profile.preparationError,
    preparationStatus: profile.preparationStatus,
    primaryGoal: profile.primaryGoal,
    primaryGoals: profile.primaryGoals,
    profileVersion: profile.profileVersion,
  };
}
