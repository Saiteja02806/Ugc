import { NextResponse } from "next/server";

import {
  getBusinessProfileForUser,
  getMissingBusinessProfileEnvVars,
} from "@/lib/business-profiles/db";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import {
  ensureTrendingDailyFeed,
  getMissingTrendingFeedEnvVars,
} from "@/lib/trending/daily-feed";

export const runtime = "nodejs";

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: Request) {
  let userId: string;

  try {
    userId = (await requireFirebaseUser(request)).uid;
  } catch (error) {
    if (error instanceof FirebaseAuthRequestError) {
      return jsonResponse(
        {
          ok: false,
          message:
            error.status === 401
              ? "Sign in before viewing Trending carousels."
              : error.message,
        },
        error.status,
      );
    }

    console.error("Failed to verify Trending feed requester:", error);
    return jsonResponse(
      {
        ok: false,
        message: "Could not verify your sign-in session.",
      },
      500,
    );
  }

  const missingRuntimeEnv = [
    ...new Set([
      ...getMissingBusinessProfileEnvVars(),
      ...getMissingTrendingFeedEnvVars(),
    ]),
  ];

  if (missingRuntimeEnv.length > 0) {
    return jsonResponse(
      {
        ok: false,
        message: `Trending feed is not configured. Add ${missingRuntimeEnv.join(
          ", ",
        )} in server environment variables.`,
      },
      501,
    );
  }

  try {
    const profile = await getBusinessProfileForUser(userId);

    if (!profile) {
      return jsonResponse({
        carousels: [],
        entitlement: null,
        feed: null,
        ok: true,
        profile: { state: "missing" },
      });
    }

    const dailyFeed = await ensureTrendingDailyFeed({
      profile,
      timezone: new URL(request.url).searchParams.get("timezone"),
      userId,
    });
    const profileState =
      dailyFeed.carousels.length > 0
        ? "ready"
        : profile.preparationStatus === "failed"
          ? "failed"
          : "preparing";

    return jsonResponse({
      carousels: dailyFeed.carousels,
      entitlement: dailyFeed.entitlement,
      feed: dailyFeed.feed,
      ok: true,
      profile: {
        error: profile.preparationError,
        id: profile.id,
        state: profileState,
      },
    });
  } catch (error) {
    console.error("Failed to load Trending feed:", error);
    return jsonResponse(
      {
        ok: false,
        message: "Could not load Trending carousels right now.",
      },
      500,
    );
  }
}
