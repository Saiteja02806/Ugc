import { NextResponse } from "next/server";

import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import {
  createUserSchedule,
  SchedulingRequestError,
} from "@/lib/scheduling/service";
import { recordTrendingCreativeDecision } from "@/lib/trending/creative-decisions";
import { getSelectedReadyReactionCreative } from "@/lib/trending/reaction-feed";
import { ReactionScheduleRequestSchema } from "@/lib/trending/reaction-scheduling-contract";
import { markDailyTrendingSlotDecided } from "@/lib/trending/unified-daily-feed-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let userId: string;

  try {
    userId = (await requireFirebaseUser(request)).uid;
  } catch (error) {
    return authError(error);
  }

  const parsed = ReactionScheduleRequestSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return json(
      { message: "Choose an account and a ready Reaction Reel.", ok: false },
      400,
    );
  }

  try {
    const creative = await getSelectedReadyReactionCreative({
      assignmentId: parsed.data.assignmentId,
      userId,
    });

    if (!creative) {
      return json(
        { message: "This Reaction Reel is no longer ready to schedule.", ok: false },
        409,
      );
    }

    // The browser outbox makes the physical swipe durable even when the
    // network is briefly unavailable. The scheduler repeats that idempotent
    // accepted decision before using the media so a fast right-swipe can
    // never schedule an undecided or rejected card.
    await recordTrendingCreativeDecision({
      assignmentId: creative.assignmentId,
      creativeId: creative.creativeId,
      decision: "accepted",
      format: "reaction",
      userId,
    });
    await markDailyTrendingSlotDecided({
      assignmentId: creative.assignmentId,
      format: "reaction",
      userId,
    });

    const result = await createUserSchedule({
      input: {
        caption: parsed.data.caption ?? "",
        idempotencyKey: `reaction-trending-schedule:${creative.assignmentId}`,
        metadata: {
          mediaMode: "single_video",
          reactionAssignmentId: creative.assignmentId,
          reactionCreativeId: creative.creativeId,
        },
        plannedTargets: parsed.data.targets,
        scheduledDate: parsed.data.scheduledDate,
        scheduledTime: parsed.data.scheduledTime,
        source: { id: creative.mediaAssetId, kind: "media_asset" },
        targets: [],
        timezone: parsed.data.timezone,
        title: creative.title,
        useDefaultScheduleTime: parsed.data.useDefaultScheduleTime,
      },
      userId,
    });

    return json({ created: result.created, ok: true, schedule: result.schedule });
  } catch (error) {
    if (error instanceof SchedulingRequestError) {
      return json({ code: error.code, message: error.message, ok: false }, error.status);
    }

    console.error("Could not schedule Reaction Reel:", error);
    return json({ message: "Could not schedule this Reaction Reel.", ok: false }, 500);
  }
}

function authError(error: unknown) {
  if (error instanceof FirebaseAuthRequestError) {
    return json(
      {
        message:
          error.status === 401
            ? "Sign in before scheduling Reaction Reels."
            : error.message,
        ok: false,
      },
      error.status,
    );
  }

  console.error("Failed to verify Reaction schedule requester:", error);
  return json({ message: "Could not verify your sign-in session.", ok: false }, 500);
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
}
