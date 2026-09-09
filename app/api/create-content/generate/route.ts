import { NextResponse } from "next/server";
import { z } from "zod";

import { getBusinessProfileForUser } from "@/lib/business-profiles/db";
import { getBusinessProfileOnboardingGate } from "@/lib/business-profiles/onboarding-access";
import {
  generateCreateContentCopy,
  CREATE_CONTENT_MAX_OPTION_COUNT,
} from "@/lib/create-content/generation";
import { CreateContentGeneratedCopyValidationError } from "@/lib/create-content/generation-validation";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REQUEST_SCHEMA = z
  .object({
    format: z.enum(["wall_text", "hook_text"]),
    request: z.string().trim().min(1).max(1_200),
    requestedCount: z.number().int().min(1).max(CREATE_CONTENT_MAX_OPTION_COUNT).optional(),
  })
  .strip();

export async function POST(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const body = REQUEST_SCHEMA.safeParse(
      await request.json().catch(() => null),
    );

    if (!body.success) {
      return json(
        { error: "Tell the AI what you would like to create.", ok: false },
        400,
      );
    }

    const profile = await getBusinessProfileForUser(user.uid);
    const onboardingGate = getBusinessProfileOnboardingGate(profile);
    if (onboardingGate || !profile) {
      return json(
        {
          code: onboardingGate?.code ?? "onboarding_required",
          error:
            onboardingGate?.message ??
            "Complete your business profile before creating personalized copy.",
          ok: false,
        },
        onboardingGate?.status ?? 409,
      );
    }

    const options = await generateCreateContentCopy({
      businessContext: profile.context,
      format: body.data.format,
      request: body.data.request,
      requestedCount: body.data.requestedCount,
    });

    return json({ ok: true, options });
  } catch (error) {
    if (error instanceof FirebaseAuthRequestError) {
      return json(
        {
          error:
            error.status === 401
              ? "Sign in before creating personalized copy."
              : error.message,
          ok: false,
        },
        error.status,
      );
    }

    if (error instanceof CreateContentGeneratedCopyValidationError) {
      return json(
        {
          error:
            "The generated copy did not fit this video format. Please try again.",
          ok: false,
        },
        422,
      );
    }

    console.error("Could not generate Create Content copy:", error);
    return json(
      { error: "Could not generate copy right now. Please try again.", ok: false },
      502,
    );
  }
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
}
