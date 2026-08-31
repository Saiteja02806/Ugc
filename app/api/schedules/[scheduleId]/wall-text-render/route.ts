import { NextResponse } from "next/server";

import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import { updateScheduledPostRenderState } from "@/lib/scheduling/db";
import {
  finalizeWallTextSchedulesFromWorker,
  getUserSchedule,
  SchedulingRequestError,
} from "@/lib/scheduling/service";
import {
  requestWallTextRender,
  WallTextRenderRequestError,
} from "@/lib/trending/wall-text-render-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ scheduleId: string }> },
) {
  let userId: string;

  try {
    userId = (await requireFirebaseUser(request)).uid;
  } catch (error) {
    return authErrorResponse(error);
  }

  const { scheduleId } = await params;

  if (!UUID_PATTERN.test(scheduleId)) {
    return json({ message: "Schedule ID is invalid.", ok: false }, 400);
  }

  try {
    const schedule = await getUserSchedule({ postId: scheduleId, userId });

    if (!schedule) {
      return json({ message: "This schedule was not found.", ok: false }, 404);
    }

    if (schedule.sourceKind !== "wall_text_pending" || schedule.status !== "draft") {
      return json({
        ok: true,
        schedule,
        status: getRenderStatus(schedule.metadata.wallTextRenderStatus),
      });
    }

    const assignmentId = getString(schedule.metadata.wallTextAssignmentId);

    if (!assignmentId || !UUID_PATTERN.test(assignmentId)) {
      return json(
        { message: "This Wall-of-text schedule is missing its video selection.", ok: false },
        409,
      );
    }

    try {
      const render = await requestWallTextRender({ assignmentId, userId });
      const linked = await updateScheduledPostRenderState({
        expectedSourceKind: "wall_text_pending",
        expectedStatus: "draft",
        expectedUpdatedAt: schedule.updatedAt,
        metadata: {
          finalScheduleError: null,
          finalScheduleErrorCode: null,
          finalScheduleFailedAt: null,
          finalScheduleStatus: null,
          wallTextRenderError: render.draft.renderError,
          wallTextRenderId: render.renderId,
          wallTextRenderJobId: render.jobId,
          wallTextRenderQueuedAt: new Date().toISOString(),
          wallTextRenderStatus: render.draft.renderStatus,
        },
        postId: schedule.id,
        userId,
      });

      if (!linked) {
        return json(
          {
            message: "This schedule changed while video preparation was starting.",
            ok: false,
          },
          409,
        );
      }

      if (
        render.draft.renderStatus === "ready" &&
        render.draft.renderedMediaAssetId &&
        render.renderId
      ) {
        try {
          await finalizeWallTextSchedulesFromWorker({
            assignmentId,
            mediaAssetId: render.draft.renderedMediaAssetId,
            renderId: render.renderId,
            userId,
          });
        } catch (error) {
          const finalizationFailed = await updateScheduledPostRenderState({
            expectedSourceKind: "wall_text_pending",
            expectedStatus: "draft",
            metadata: {
              finalScheduleError: getErrorMessage(
                error,
                "The video is ready, but publishing could not be scheduled.",
              ),
              finalScheduleErrorCode: "wall_text_finalization_failed",
              finalScheduleFailedAt: new Date().toISOString(),
              finalScheduleStatus: "failed",
              wallTextRenderStatus: "ready",
            },
            postId: schedule.id,
            userId,
          });

          return json({
            ok: true,
            schedule:
              finalizationFailed ??
              (await getUserSchedule({ postId: schedule.id, userId })) ??
              linked,
            status: "ready",
          });
        }
      }

      return json({
        ok: true,
        schedule:
          (await getUserSchedule({ postId: schedule.id, userId })) ?? linked,
        status: render.draft.renderStatus,
      });
    } catch (error) {
      const message = getErrorMessage(error, "Could not restart video preparation.");
      const failed = await updateScheduledPostRenderState({
        expectedSourceKind: "wall_text_pending",
        expectedStatus: "draft",
        metadata: {
          wallTextRenderError: message,
          wallTextRenderFailedAt: new Date().toISOString(),
          wallTextRenderStatus: "failed",
        },
        postId: schedule.id,
        userId,
      });

      return json({
        ok: true,
        schedule: failed ?? schedule,
        status: "failed",
      });
    }
  } catch (error) {
    if (error instanceof SchedulingRequestError) {
      return json({ code: error.code, message: error.message, ok: false }, error.status);
    }

    console.error("Could not retry Wall-of-text preparation:", error);
    return json(
      { message: "Could not retry Wall-of-text preparation.", ok: false },
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
            ? "Sign in before preparing this video."
            : error.message,
        ok: false,
      },
      error.status,
    );
  }

  console.error("Failed to verify Wall-of-text preparation requester:", error);
  return json({ message: "Could not verify your sign-in session.", ok: false }, 500);
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof WallTextRenderRequestError) {
    return error.message;
  }

  return error instanceof Error && error.message ? error.message : fallback;
}

function getRenderStatus(value: unknown) {
  return value === "failed" ||
    value === "ready" ||
    value === "rendering" ||
    value === "queued"
    ? value
    : "queued";
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
