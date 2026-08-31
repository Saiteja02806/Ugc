import "server-only";

import { updateScheduledPostRenderState } from "@/lib/scheduling/db";
import {
  finalizeWallTextSchedulesFromWorker,
  getUserSchedule,
} from "@/lib/scheduling/service";
import type { ScheduledPost } from "@/lib/scheduling/types";
import {
  requestWallTextRender,
  WallTextRenderRequestError,
} from "@/lib/trending/wall-text-render-request";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type WallTextRenderStartStatus =
  | "failed"
  | "not_requested"
  | "queued"
  | "ready"
  | "rendering";

export type WallTextRenderStartResult = {
  schedule: ScheduledPost;
  status: WallTextRenderStartStatus;
};

/**
 * Starts Wall rendering only after its selected account/time has been stored.
 * The durable background-job row is created by requestWallTextRender before a
 * queue message is delivered, so rendering no longer depends on the browser.
 */
export async function startWallTextScheduleRender(params: {
  schedule: ScheduledPost;
  userId: string;
}): Promise<WallTextRenderStartResult> {
  const { schedule, userId } = params;

  if (schedule.sourceKind !== "wall_text_pending" || schedule.status !== "draft") {
    return { schedule, status: getWallTextRenderStatus(schedule) };
  }

  const assignmentId = getString(schedule.metadata.wallTextAssignmentId);

  if (!assignmentId || !UUID_PATTERN.test(assignmentId)) {
    throw new WallTextScheduleRenderStartError(
      "This Wall-of-text schedule is missing its video selection.",
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
      return getLatestScheduleOrThrow({
        fallback: schedule,
        postId: schedule.id,
        userId,
      });
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

        return {
          schedule:
            finalizationFailed ??
            (await getUserSchedule({ postId: schedule.id, userId })) ??
            linked,
          status: "ready",
        };
      }
    }

    return getLatestScheduleOrThrow({
      fallback: linked,
      postId: schedule.id,
      userId,
    });
  } catch (error) {
    if (error instanceof WallTextScheduleRenderStartError) {
      throw error;
    }

    const failed = await markWallTextRenderStartFailed({
      error,
      schedule,
      userId,
    });

    return { schedule: failed ?? schedule, status: "failed" };
  }
}

export class WallTextScheduleRenderStartError extends Error {
  readonly status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "WallTextScheduleRenderStartError";
    this.status = status;
  }
}

async function getLatestScheduleOrThrow(params: {
  fallback: ScheduledPost;
  postId: string;
  userId: string;
}): Promise<WallTextRenderStartResult> {
  const current = await getUserSchedule({
    postId: params.postId,
    userId: params.userId,
  });
  const schedule = current ?? params.fallback;

  return { schedule, status: getWallTextRenderStatus(schedule) };
}

async function markWallTextRenderStartFailed(params: {
  error: unknown;
  schedule: ScheduledPost;
  userId: string;
}) {
  const message = getErrorMessage(
    params.error,
    "Could not start Wall-of-text video preparation.",
  );

  try {
    return await updateScheduledPostRenderState({
      expectedSourceKind: "wall_text_pending",
      expectedStatus: "draft",
      expectedUpdatedAt: params.schedule.updatedAt,
      metadata: {
        wallTextRenderError: message,
        wallTextRenderFailedAt: new Date().toISOString(),
        wallTextRenderStatus: "failed",
      },
      postId: params.schedule.id,
      userId: params.userId,
    });
  } catch (persistenceError) {
    console.error("Could not record a saved Wall-of-text render start failure:", {
      error: getErrorMessage(persistenceError, "Unknown persistence error."),
      scheduleId: params.schedule.id,
    });
    return null;
  }
}

function getWallTextRenderStatus(schedule: ScheduledPost): WallTextRenderStartStatus {
  const value = schedule.metadata.wallTextRenderStatus;

  return value === "not_requested" ||
    value === "failed" ||
    value === "ready" ||
    value === "rendering" ||
    value === "queued"
    ? value
    : "queued";
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof WallTextRenderRequestError) {
    return error.message;
  }

  return error instanceof Error && error.message ? error.message : fallback;
}
