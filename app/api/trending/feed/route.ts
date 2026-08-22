import { NextResponse } from "next/server";

import {
  getBusinessProfileForUser,
  getMissingBusinessProfileEnvVars,
} from "@/lib/business-profiles/db";
import { getBusinessProfileOnboardingGate } from "@/lib/business-profiles/onboarding-access";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import {
  getMissingTrendingFeedEnvVars,
} from "@/lib/trending/daily-feed";
import { areTrendingHookVideosEnabled } from "@/lib/trending/hook-video-feature";
import {
  isWallTextEnabled,
} from "@/lib/trending/wall-text-access";
import { ensureUnifiedTrendingDailyFeed } from "@/lib/trending/unified-daily-feed";
import { getMissingUnifiedTrendingFeedEnvVars } from "@/lib/trending/unified-daily-feed-db";

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
  const hookVideosEnabled = areTrendingHookVideosEnabled(request);

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
      ...getMissingUnifiedTrendingFeedEnvVars(),
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
    const onboardingGate = getBusinessProfileOnboardingGate(profile);

    if (onboardingGate || !profile) {
      return jsonResponse(
        {
          code: onboardingGate?.code ?? "onboarding_required",
          message:
            onboardingGate?.message ??
            "Complete the required business onboarding before using Trending.",
          ok: false,
        },
        onboardingGate?.status ?? 409,
      );
    }

    const dailyFeed = await ensureUnifiedTrendingDailyFeed({
      includeHookVideos: hookVideosEnabled,
      includeWallText: isWallTextEnabled(),
      profile,
      timezone: new URL(request.url).searchParams.get("timezone"),
      userId,
    });
    const profileState =
      dailyFeed.carousels.length > 0
        ? "ready"
        : profile.preparationStatus === "failed"
          ? "failed"
          : dailyFeed.feed.state === "preparing"
            ? "preparing"
            : "ready";
    return jsonResponse({
      carousels: dailyFeed.carousels,
      contentMix: dailyFeed.contentMix,
      entitlement: dailyFeed.entitlement,
      feed: dailyFeed.feed,
      formatAvailability: dailyFeed.formatAvailability,
      items: dailyFeed.items,
      ok: true,
      profile: {
        error: profile.preparationError,
        id: profile.id,
        profileVersion: profile.profileVersion,
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
