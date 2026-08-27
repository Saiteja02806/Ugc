import { NextResponse } from "next/server";

import {
  completeTrendingWalkthroughForUser,
  getBusinessProfileForUser,
} from "@/lib/business-profiles/db";
import { getBusinessProfileOnboardingGate } from "@/lib/business-profiles/onboarding-access";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await getAuthenticatedUserId(request);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const profile = await getBusinessProfileForUser(auth.userId);
    const onboardingGate = getBusinessProfileOnboardingGate(profile);

    if (onboardingGate || !profile) {
      return json(
        {
          message:
            onboardingGate?.message ??
            "Complete the required business onboarding before using Trending.",
          ok: false,
        },
        onboardingGate?.status ?? 409,
      );
    }

    return json({
      completed: Boolean(profile.trendingWalkthroughCompletedAt),
      ok: true,
    });
  } catch (error) {
    console.error("Could not load the Trending walkthrough state:", error);
    return json(
      { message: "Could not load the Trending walkthrough.", ok: false },
      500,
    );
  }
}

export async function POST(request: Request) {
  const auth = await getAuthenticatedUserId(request);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const profile = await getBusinessProfileForUser(auth.userId);
    const onboardingGate = getBusinessProfileOnboardingGate(profile);

    if (onboardingGate || !profile) {
      return json(
        {
          message:
            onboardingGate?.message ??
            "Complete the required business onboarding before using Trending.",
          ok: false,
        },
        onboardingGate?.status ?? 409,
      );
    }

    await completeTrendingWalkthroughForUser(auth.userId);

    return json({ completed: true, ok: true });
  } catch (error) {
    console.error("Could not complete the Trending walkthrough:", error);
    return json(
      { message: "Could not complete the Trending walkthrough.", ok: false },
      500,
    );
  }
}

async function getAuthenticatedUserId(request: Request): Promise<
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }
> {
  try {
    return { ok: true, userId: (await requireFirebaseUser(request)).uid };
  } catch (error) {
    if (error instanceof FirebaseAuthRequestError) {
      return {
        ok: false,
        response: json(
          {
            message:
              error.status === 401
                ? "Sign in before viewing Trending."
                : error.message,
            ok: false,
          },
          error.status,
        ),
      };
    }

    console.error("Failed to verify the Trending walkthrough requester:", error);
    return {
      ok: false,
      response: json(
        { message: "Could not verify your sign-in session.", ok: false },
        500,
      ),
    };
  }
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
}
