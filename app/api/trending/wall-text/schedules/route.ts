import { after, NextResponse } from "next/server";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import {
  createUserSchedule,
  SchedulingRequestError,
} from "@/lib/scheduling/service";
import {
  startWallTextScheduleRender,
} from "@/lib/scheduling/wall-text-render-start";
import { getSelectedWallTextDraft } from "@/lib/trending/wall-text-db";
import { WallTextScheduleRequestSchema } from "@/lib/trending/wall-text-scheduling-contract";
import { getWallTextPreviewTitle } from "@/lib/trending/wall-text-text-logic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let userId: string;

  try {
    userId = (await requireFirebaseUser(request)).uid;
  } catch (error) {
    return authErrorResponse(error);
  }

  const parsed = WallTextScheduleRequestSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return json(
      { message: "Choose an account and a valid Wall-of-text video.", ok: false },
      400,
    );
  }

  try {
    const draft = await getSelectedWallTextDraft({
      assignmentId: parsed.data.assignmentId,
      userId,
    });

    if (!draft) {
      return json(
        { message: "This Wall-of-text video is no longer available.", ok: false },
        404,
      );
    }

    const pending = await createUserSchedule({
      input: {
        caption: "",
        metadata: {
          mediaMode: "single_video",
          wallTextAssignmentId: draft.assignmentId,
          wallTextCreativeId: draft.id,
          wallTextRenderError: null,
          wallTextRenderStatus: "not_requested",
        },
        plannedTargets: parsed.data.targets,
        scheduledDate: parsed.data.scheduledDate,
        scheduledTime: parsed.data.scheduledTime,
        source: {
          id: draft.assignmentId,
          kind: "wall_text_pending",
        },
        targets: [],
        timezone: parsed.data.timezone,
        title: getWallTextPreviewTitle(draft.text.fullText),
        useDefaultScheduleTime: parsed.data.useDefaultScheduleTime,
      },
      userId,
    });

    // Acknowledge the user's saved account/time now. `after` keeps this
    // server-side continuation alive after the response; it creates the
    // durable render job and delivers it without relying on this browser
    // remaining open. Any error is persisted on the saved schedule for Retry.
    after(() =>
      startWallTextScheduleRender({
        schedule: pending.schedule,
        userId,
      }).catch((error) => {
        console.error("Could not start the saved Wall-of-text render:", {
          error: error instanceof Error ? error.message : "Unknown error",
          scheduleId: pending.schedule.id,
          userId,
        });
      }),
    );

    return json({
      ok: true,
      renderStatus: "queued",
      schedule: pending.schedule,
    });
  } catch (error) {
    if (error instanceof SchedulingRequestError) {
      return json({ code: error.code, message: error.message, ok: false }, error.status);
    }

    console.error("Could not create pending Wall-of-text schedule:", error);
    return json(
      { message: "Could not save this Wall-of-text schedule.", ok: false },
      500,
    );
  }
}

function authErrorResponse(error: unknown) {
  if (error instanceof FirebaseAuthRequestError) {
    return json(
      {
        message:
          error.status === 401
            ? "Sign in before scheduling Wall-of-text videos."
            : error.message,
        ok: false,
      },
      error.status,
    );
  }

  console.error("Failed to verify Wall-of-text schedule requester:", error);
  return json({ message: "Could not verify your sign-in session.", ok: false }, 500);
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
