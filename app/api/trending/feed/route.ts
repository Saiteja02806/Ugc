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
  ensureTrendingDailyFeed,
  getMissingTrendingFeedEnvVars,
} from "@/lib/trending/daily-feed";
import {
  buildUnifiedTrendingFeed,
  createCurrentTrendingFeedProviders,
  getTrendingFeedProviderAvailability,
} from "@/lib/trending/feed-items";
import { areTrendingHookVideosEnabled } from "@/lib/trending/hook-video-feature";
import { getTrendingHookFeedProvider } from "@/lib/trending/trending-hook-feed";
import { getTrendingWallTextFeedProvider } from "@/lib/trending/trending-wall-text-feed";
import {
  filterWallTextProvidersForRuntime,
  isWallTextEnabled,
} from "@/lib/trending/wall-text-access";

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

    const [dailyFeed, hookProvider, wallTextProvider] = await Promise.all([
      ensureTrendingDailyFeed({
        profile,
        timezone: new URL(request.url).searchParams.get("timezone"),
        userId,
      }),
      hookVideosEnabled
        ? getTrendingHookFeedProvider(profile)
        : Promise.resolve(undefined),
      isWallTextEnabled()
        ? getTrendingWallTextFeedProvider(profile)
        : Promise.resolve(undefined),
    ]);
    const profileState =
      dailyFeed.carousels.length > 0
        ? "ready"
        : profile.preparationStatus === "failed"
          ? "failed"
          : dailyFeed.feed.state === "preparing"
            ? "preparing"
            : "ready";
    const providers = filterWallTextProvidersForRuntime(
      createCurrentTrendingFeedProviders(
        dailyFeed.carousels,
        hookProvider,
        wallTextProvider,
        { includeHookVideos: hookVideosEnabled },
      ),
    );

    return jsonResponse({
      carousels: dailyFeed.carousels,
      entitlement: dailyFeed.entitlement,
      feed: dailyFeed.feed,
      formatAvailability: getTrendingFeedProviderAvailability(providers),
      items: buildUnifiedTrendingFeed(providers),
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
