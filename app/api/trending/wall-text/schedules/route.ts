import { NextResponse } from "next/server";
import { z } from "zod";

import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import {
  createUserSchedule,
  SchedulingRequestError,
} from "@/lib/scheduling/service";
import { getSavedWallTextDraft } from "@/lib/trending/wall-text-db";
import { getWallTextPreviewTitle } from "@/lib/trending/wall-text-text-logic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WallTextScheduleRequestSchema = z
  .object({
    assignmentId: z.string().uuid(),
    scheduledDate: z.string().trim().max(32).optional(),
    scheduledTime: z.string().trim().max(32).optional(),
    targets: z
      .array(
        z
          .object({
            connectionId: z.string().uuid(),
            platform: z.enum(["instagram", "tiktok", "youtube"]).optional(),
            settings: z.record(z.string(), z.unknown()).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(10),
    timezone: z.string().trim().min(1).max(100),
    useDefaultScheduleTime: z.boolean(),
  })
  .strict();

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
    const draft = await getSavedWallTextDraft({
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

    // This acknowledgement is intentionally independent of queue delivery.
    // The selected account/time is already durable if render delivery is slow
    // or temporarily unavailable.
    return json({
      ok: true,
      renderStatus: getRenderStatus(pending.schedule.metadata.wallTextRenderStatus),
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

function getRenderStatus(value: unknown) {
  return value === "not_requested" ||
    value === "failed" ||
    value === "ready" ||
    value === "rendering" ||
    value === "queued"
    ? value
    : "queued";
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
