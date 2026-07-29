import { NextResponse } from "next/server";

import { getBusinessProfileForUser } from "@/lib/business-profiles/db";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import {
  prepareTrendingWallTextIdeas,
  TrendingWallTextPreparationError,
} from "@/lib/trending/trending-wall-text-feed";
import { isWallTextLocalDevelopmentEnabled } from "@/lib/trending/wall-text-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isWallTextLocalDevelopmentEnabled()) {
    return json({ error: "Not found.", ok: false }, 404);
  }

  let userId: string;

  try {
    userId = (await requireFirebaseUser(request)).uid;
  } catch (error) {
    if (error instanceof FirebaseAuthRequestError) {
      return json(
        {
          error:
            error.status === 401
              ? "Sign in before preparing Wall-of-text ideas."
              : error.message,
          ok: false,
        },
        error.status,
      );
    }

    console.error("Failed to verify Wall-of-text requester:", error);
    return json(
      { error: "Could not verify your sign-in session.", ok: false },
      500,
    );
  }

  try {
    const profile = await getBusinessProfileForUser(userId);

    if (!profile) {
      return json(
        {
          code: "business_profile_required",
          error:
            "Complete your business profile before preparing Wall-of-text ideas.",
          ok: false,
        },
        409,
      );
    }

    const ideas = await prepareTrendingWallTextIdeas(profile);

    return json({
      ideaCount: ideas.length,
      ideas: ideas.map((idea) => ({
        backgroundAssetId: idea.backgroundAssetId,
        durationSeconds: idea.durationSeconds,
        id: idea.id,
        layout: idea.layout,
        previewUrl: idea.previewUrl,
        text: idea.text,
        thumbnailUrl: idea.thumbnailUrl,
      })),
      ok: true,
    });
  } catch (error) {
    if (error instanceof TrendingWallTextPreparationError) {
      return json({ error: error.message, ok: false }, error.status);
    }

    if (
      error instanceof Error &&
      error.message === "OpenAI is not configured."
    ) {
      return json(
        {
          error: "Wall-of-text idea generation is not configured.",
          ok: false,
        },
        501,
      );
    }

    console.error("Could not prepare Trending Wall-of-text ideas:", error);
    return json(
      { error: "Could not prepare Trending Wall-of-text ideas.", ok: false },
      500,
    );
  }
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
