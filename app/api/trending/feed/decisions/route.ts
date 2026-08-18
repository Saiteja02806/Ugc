import { NextResponse } from "next/server";
import { z } from "zod";

import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import {
  getMissingTrendingDecisionEnvVars,
  recordTrendingCreativeDecision,
} from "@/lib/trending/creative-decisions";
import { replenishTrendingFormatAfterDecision } from "@/lib/trending/feed-replenishment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TrendingCreativeDecisionSchema = z
  .object({
    assignmentId: z.string().uuid(),
    creativeId: z.string().uuid(),
    decision: z.enum(["accepted", "rejected"]),
    format: z.enum(["carousel", "hook_video", "wall_text"]),
  })
  .strict();

export async function POST(request: Request) {
  let userId: string;

  try {
    userId = (await requireFirebaseUser(request)).uid;
  } catch (error) {
    if (error instanceof FirebaseAuthRequestError) {
      return json(
        {
          error:
            error.status === 401
              ? "Sign in before choosing a Trending idea."
              : error.message,
          ok: false,
        },
        error.status,
      );
    }

    console.error("Failed to verify Trending decision requester:", error);
    return json(
      { error: "Could not verify your sign-in session.", ok: false },
      500,
    );
  }

  const parsed = TrendingCreativeDecisionSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return json(
      { error: "Choose a valid Trending creative decision.", ok: false },
      400,
    );
  }

  if (getMissingTrendingDecisionEnvVars().length > 0) {
    return json(
      { error: "Creative decisions are temporarily unavailable.", ok: false },
      501,
    );
  }

  try {
    const decision = await recordTrendingCreativeDecision({
      ...parsed.data,
      userId,
    });
    let replenishment: Awaited<
      ReturnType<typeof replenishTrendingFormatAfterDecision>
    > | null = null;

    try {
      replenishment = await replenishTrendingFormatAfterDecision({
        format: parsed.data.format,
        userId,
      });
    } catch (error) {
      // The user's decision is already durable. A temporary queue or inventory
      // failure must not make the client retry and accidentally double-submit it.
      console.error(
        "Could not schedule Trending feed replenishment after a saved decision:",
        error,
      );
    }

    return json({ decision, ok: true, replenishment });
  } catch (error) {
    console.error("Could not save Trending creative decision:", error);
    return json(
      { error: "Could not save this decision. Try again.", ok: false },
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
