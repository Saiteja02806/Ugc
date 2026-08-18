import { NextResponse } from "next/server";
import { z } from "zod";

import { FirebaseAuthRequestError } from "@/lib/firebase/server-auth";
import {
  normalizeHookEndSeconds,
  ViralHookTimingInputError,
} from "@/lib/viral/hook-review";
import {
  getMissingViralReviewEnvVars,
  saveViralHookTiming,
  ViralReviewStoreError,
} from "@/lib/viral/review-store";
import { requireViralReviewer } from "@/lib/viral/server-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RouteParamsSchema = z.object({ referenceId: z.string().uuid() });
const ReviewBodySchema = z
  .object({ hookEndSeconds: z.number().finite() })
  .strict();

export async function PATCH(
  request: Request,
  context: { params: Promise<{ referenceId: string }> },
) {
  let reviewerEmail: string;

  try {
    const reviewer = await requireViralReviewer(request);
    reviewerEmail = reviewer.email!;
  } catch (error) {
    return authErrorResponse(error);
  }

  const routeParams = RouteParamsSchema.safeParse(await context.params);
  if (!routeParams.success) {
    return json({ message: "This Explore reference ID is invalid.", ok: false }, 400);
  }

  const body = ReviewBodySchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!body.success) {
    return json(
      { message: "Enter a valid Hook ending time in seconds.", ok: false },
      400,
    );
  }

  let hookEndMs: number;
  try {
    hookEndMs = normalizeHookEndSeconds(body.data.hookEndSeconds);
  } catch (error) {
    return json(
      {
        message:
          error instanceof ViralHookTimingInputError
            ? error.message
            : "Enter a valid Hook ending time.",
        ok: false,
      },
      400,
    );
  }

  if (getMissingViralReviewEnvVars().length > 0) {
    return json(
      { message: "Explore is temporarily unavailable.", ok: false },
      501,
    );
  }

  try {
    const timing = await saveViralHookTiming({
      hookEndMs,
      referenceId: routeParams.data.referenceId,
      reviewedBy: reviewerEmail,
    });
    return json({ ok: true, timing });
  } catch (error) {
    console.error("Could not save the Viral Hook ending time:", error);

    if (error instanceof ViralReviewStoreError) {
      return json({ message: error.message, ok: false }, error.status);
    }

    return json(
      { message: "Could not save this Hook ending time. Try again.", ok: false },
      500,
    );
  }
}

function authErrorResponse(error: unknown) {
  if (error instanceof FirebaseAuthRequestError) {
    return json(
      {
        message:
          error.status === 401
            ? "Sign in before reviewing Explore Hooks."
            : error.status === 503
              ? "Explore reviewer access is temporarily unavailable."
              : "This account does not have Explore access.",
        ok: false,
      },
      error.status,
    );
  }

  console.error("Could not verify the Viral reviewer:", error);
  return json(
    { message: "Could not verify your Explore access.", ok: false },
    500,
  );
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
