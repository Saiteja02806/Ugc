import { after, NextResponse } from "next/server";

import {
  getBusinessProfileForUser,
  getMissingBusinessProfileEnvVars,
} from "@/lib/business-profiles/db";
import { FreeTrialAccessError } from "@/lib/billing/free-trial";
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
import {
  prepareUnifiedTrendingDailyFeed,
  readUnifiedTrendingDailyFeed,
} from "@/lib/trending/unified-daily-feed";
import {
  getMissingUnifiedTrendingFeedEnvVars,
  restartFailedDailyTrendingFeedSlots,
} from "@/lib/trending/unified-daily-feed-db";

export const runtime = "nodejs";
export const maxDuration = 60;

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

    const requestUrl = new URL(request.url);
    const preparationParams = {
      includeHookVideos: hookVideosEnabled,
      includeWallText: isWallTextEnabled(),
      profile,
      timezone: requestUrl.searchParams.get("timezone"),
      userId,
    };
    let dailyFeed = await readUnifiedTrendingDailyFeed(preparationParams);

    const failedFeed = dailyFeed.feed;
    if (
      requestUrl.searchParams.get("retryFailed") === "1" &&
      failedFeed?.state === "failed" &&
      failedFeed.id
    ) {
      const retryKey = await restartFailedDailyTrendingFeedSlots({
        feedId: failedFeed.id,
        userId,
      });

      if (retryKey) {
        dailyFeed = await readUnifiedTrendingDailyFeed(preparationParams);
      }
    }
    const { requiresPreparation, ...publicDailyFeed } = dailyFeed;

    if (requiresPreparation) {
      after(() =>
        prepareUnifiedTrendingDailyFeed(preparationParams).catch((error) => {
          console.error("Could not prepare the Trending daily pack:", error);
        }),
      );
    }

    const profileState =
      publicDailyFeed.items.length > 0
        ? "ready"
        : profile.preparationStatus === "failed"
          ? "failed"
          : publicDailyFeed.feed.state === "preparing"
            ? "preparing"
            : "ready";
    return jsonResponse({
      ...publicDailyFeed,
      ok: true,
      profile: {
        error: profile.preparationError,
        id: profile.id,
        profileVersion: profile.profileVersion,
        state: profileState,
      },
    });
  } catch (error) {
    if (error instanceof FreeTrialAccessError) {
      return jsonResponse(
        {
          code: error.code,
          message: error.message,
          ok: false,
          upgradeRequired: true,
        },
        error.status,
      );
    }

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
