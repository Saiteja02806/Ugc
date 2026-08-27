import { NextResponse } from "next/server";

import {
  getBusinessProfileForUser,
  isBusinessProfileOnboardingComplete,
} from "@/lib/business-profiles/db";
import { getUserSubscription } from "@/lib/billing/subscription-db";
import {
  INTERNAL_FINALIZATION_SIGNATURE_HEADER,
  INTERNAL_FINALIZATION_TIMESTAMP_HEADER,
} from "@/lib/scheduling/finalization-signature";
import {
  getMissingInternalFinalizationEnvVars,
  verifyInternalFinalizationRequest,
} from "@/lib/scheduling/internal-finalization-auth";
import { areTrendingHookVideosEnabled } from "@/lib/trending/hook-video-feature";
import { ensureUnifiedTrendingDailyFeed } from "@/lib/trending/unified-daily-feed";
import { isWallTextEnabled } from "@/lib/trending/wall-text-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_LENGTH = 2_048;

type PreparePaidTrendingInput = {
  expectedPlanKey?: unknown;
  subscriptionId?: unknown;
  userId?: unknown;
};

export async function POST(request: Request) {
  if (getMissingInternalFinalizationEnvVars().length > 0) {
    return json({ ok: false, error: "Internal job auth is not configured." }, 503);
  }

  const rawBody = await request.text();

  if (!rawBody || Buffer.byteLength(rawBody, "utf8") > MAX_BODY_LENGTH) {
    return json({ ok: false, error: "Invalid request body." }, 400);
  }

  if (
    !verifyInternalFinalizationRequest({
      body: rawBody,
      signature: request.headers.get(INTERNAL_FINALIZATION_SIGNATURE_HEADER),
      timestamp: request.headers.get(INTERNAL_FINALIZATION_TIMESTAMP_HEADER),
    })
  ) {
    return json({ ok: false, error: "Unauthorized." }, 401);
  }

  const input = parseInput(rawBody);

  if (!input) {
    return json({ ok: false, error: "Invalid paid Trending prebuild input." }, 400);
  }

  try {
    // The job may start after a cancellation or another plan change. Re-read
    // the current entitlement instead of trusting the original webhook body.
    const subscription = await getUserSubscription(input.userId);

    if (
      !subscription.isActive ||
      subscription.planKey !== input.expectedPlanKey
    ) {
      return json({ ok: true, skipped: "subscription_is_no_longer_current" });
    }

    const profile = await getBusinessProfileForUser(input.userId);

    if (!profile || !isBusinessProfileOnboardingComplete(profile)) {
      return json({ ok: true, skipped: "business_profile_is_not_ready" });
    }

    const feed = await ensureUnifiedTrendingDailyFeed({
      includeHookVideos: areTrendingHookVideosEnabled(),
      includeWallText: isWallTextEnabled(),
      markItemsShown: false,
      profile,
      timezone: profile.trendingTimezone,
      userId: input.userId,
    });

    return json({
      dailyLimit: feed.entitlement.dailyTrendingLimit,
      feedId: feed.feed.id,
      ok: true,
      pendingSlotCount: feed.feed.pendingSlotCount,
    });
  } catch (error) {
    console.error("Paid Trending prebuild failed:", {
      error: error instanceof Error ? error.message : "Unknown error",
      subscriptionId: input.subscriptionId,
      userId: input.userId,
    });
    return json({ ok: false, error: "Paid Trending prebuild failed." }, 500);
  }
}

function parseInput(rawBody: string) {
  try {
    const input = JSON.parse(rawBody) as PreparePaidTrendingInput;
    const expectedPlanKey = getPlanKey(input.expectedPlanKey);
    const subscriptionId = getString(input.subscriptionId);
    const userId = getString(input.userId);

    return expectedPlanKey && subscriptionId && userId
      ? { expectedPlanKey, subscriptionId, userId }
      : null;
  } catch {
    return null;
  }
}

function getPlanKey(value: unknown): "starter" | "growth" | null {
  return value === "starter" || value === "growth" ? value : null;
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 240)
    : "";
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
}
