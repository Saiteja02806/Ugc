import { NextResponse } from "next/server";
import { z } from "zod";

import { getBusinessProfileForUser } from "@/lib/business-profiles/db";
import { getBusinessProfileOnboardingGate } from "@/lib/business-profiles/onboarding-access";
import { FreeTrialAccessError } from "@/lib/billing/free-trial";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import {
  resolveTrendingContentMixPreference,
  TRENDING_CONTENT_MIX_LIMITS,
  type TrendingContentMix,
} from "@/lib/trending/content-mix";
import { areTrendingHookVideosEnabled } from "@/lib/trending/hook-video-feature";
import { ensureUnifiedTrendingDailyFeed } from "@/lib/trending/unified-daily-feed";
import {
  getDailyTrendingFeedForDate,
  getTrendingContentMixPreference,
  getTrendingLocalDate,
  getTrendingPlanEntitlement,
  normalizeTrendingTimezone,
  saveTrendingContentMixPreference,
} from "@/lib/trending/unified-daily-feed-db";
import { isWallTextEnabled } from "@/lib/trending/wall-text-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ContentMixSchema = z
  .object({
    carousel: z.number().int().min(0).max(100),
    hook_video: z.number().int().min(0).max(100),
    reaction: z.number().int().min(0).max(100),
    timezone: z.string().trim().min(1).max(100).optional(),
    wall_text: z.number().int().min(0).max(100),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.carousel +
        value.wall_text +
        value.hook_video +
        value.reaction !==
      100
    ) {
      context.addIssue({
        code: "custom",
        message: "The four content percentages must total 100%.",
      });
    }
  });

export async function GET(request: Request) {
  const auth = await getAuthenticatedUserId(request);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const [preference, entitlement] = await Promise.all([
      getTrendingContentMixPreference(auth.userId),
      getTrendingPlanEntitlement(auth.userId),
    ]);
    const effectivePreference = resolveTrendingContentMixPreference({
      planKey: entitlement.planKey,
      preference,
    });

    return json({
      editable: true,
      entitlement,
      limits: { ...TRENDING_CONTENT_MIX_LIMITS },
      ok: true,
      preference: effectivePreference,
    });
  } catch (error) {
    if (error instanceof FreeTrialAccessError) {
      return json(
        {
          code: error.code,
          message: error.message,
          ok: false,
          upgradeRequired: true,
        },
        error.status,
      );
    }

    console.error("Could not load the Trending content mix:", error);
    return json(
      { message: "Could not load your content mix right now.", ok: false },
      500,
    );
  }
}

export async function PUT(request: Request) {
  const auth = await getAuthenticatedUserId(request);

  if (!auth.ok) {
    return auth.response;
  }

  const parsed = ContentMixSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return json(
      {
        message:
          parsed.error.issues[0]?.message ??
          "Choose a valid content mix that totals 100%.",
        ok: false,
      },
      400,
    );
  }

  try {
    const [profile, entitlement] = await Promise.all([
      getBusinessProfileForUser(auth.userId),
      getTrendingPlanEntitlement(auth.userId),
    ]);
    const onboardingGate = getBusinessProfileOnboardingGate(profile);

    if (onboardingGate || !profile) {
      return json(
        {
          message:
            onboardingGate?.message ??
            "Complete the required business onboarding before adjusting Trending.",
          ok: false,
        },
        onboardingGate?.status ?? 409,
      );
    }

    const mix: TrendingContentMix = {
      carousel: parsed.data.carousel,
      hook_video: parsed.data.hook_video,
      reaction: parsed.data.reaction,
      wall_text: parsed.data.wall_text,
    };
    const timezone = normalizeTrendingTimezone(
      parsed.data.timezone ?? profile.trendingTimezone,
    );
    const localDate = getTrendingLocalDate(timezone);
    const [savedPreference, currentFeed] = await Promise.all([
      saveTrendingContentMixPreference({ mix, userId: auth.userId }),
      getDailyTrendingFeedForDate({ localDate, userId: auth.userId }),
    ]);
    const dailyFeed = await ensureUnifiedTrendingDailyFeed({
      includeHookVideos: areTrendingHookVideosEnabled(request),
      includeWallText: isWallTextEnabled(),
      markItemsShown: false,
      profile,
      timezone,
      userId: auth.userId,
    });

    return json({
      applied: currentFeed ? "next_day" : "today",
      changedToday: 0,
      contentMix: dailyFeed.contentMix,
      entitlement: {
        ...entitlement,
        dailyTrendingLimit: entitlement.dailyLimit,
      },
      feed: dailyFeed.feed,
      message:
        currentFeed
          ? "Mix saved. Today's complete pack stays unchanged; the new mix starts tomorrow."
          : "Mix saved. Today's complete pack is being prepared in the background.",
      ok: true,
      preference: savedPreference,
    });
  } catch (error) {
    if (error instanceof FreeTrialAccessError) {
      return json(
        {
          code: error.code,
          message: error.message,
          ok: false,
          upgradeRequired: true,
        },
        error.status,
      );
    }

    console.error("Could not save the Trending content mix:", error);
    return json(
      { message: "Could not save your content mix right now.", ok: false },
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
                ? "Sign in before adjusting Trending."
                : error.message,
            ok: false,
          },
          error.status,
        ),
      };
    }

    console.error("Failed to verify the Trending content-mix requester:", error);
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
