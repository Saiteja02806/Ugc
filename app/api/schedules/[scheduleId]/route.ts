import { after, NextResponse } from "next/server";

import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import {
  cancelUserSchedule,
  getMissingSchedulingRuntimeEnvVars,
  SchedulingRequestError,
  updateUserSchedule,
} from "@/lib/scheduling/service";
import { getScheduledPostForUser } from "@/lib/scheduling/db";
import { startWallTextScheduleRender } from "@/lib/scheduling/wall-text-render-start";
import type { ScheduleUpdateInput } from "@/lib/scheduling/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ scheduleId: string }> },
) {
  let userId: string;

  try {
    userId = (await requireFirebaseUser(request)).uid;
  } catch (error) {
    return authErrorResponse(error, "Sign in before viewing this schedule.");
  }

  const missingRuntimeEnv = getMissingSchedulingRuntimeEnvVars();

  if (missingRuntimeEnv.length > 0) {
    return jsonResponse(
      {
        ok: false,
        message: `Scheduling is not configured. Add ${missingRuntimeEnv.join(
          ", ",
        )}.`,
      },
      501,
    );
  }

  const { scheduleId } = await params;

  try {
    const schedule = await getScheduledPostForUser({
      postId: scheduleId,
      userId,
    });

    if (!schedule) {
      return jsonResponse(
        {
          ok: false,
          message: "This schedule was not found.",
        },
        404,
      );
    }

    // A schedule is durable before Wall rendering starts. Resume only the
    // narrow hand-off state when its owner opens it, so a transient post-save
    // failure cannot leave a saved account/time waiting forever. The render
    // starter is idempotent, so this remains safe if the original `after`
    // continuation is running at the same time.
    if (
      schedule.sourceKind === "wall_text_pending" &&
      schedule.status === "draft" &&
      schedule.metadata.wallTextRenderStatus === "not_requested"
    ) {
      after(() =>
        startWallTextScheduleRender({ schedule, userId }).catch((error) => {
          console.error("Could not resume the saved Wall-of-text render:", {
            error: error instanceof Error ? error.message : "Unknown error",
            scheduleId: schedule.id,
          });
        }),
      );
    }

    return jsonResponse({
      ok: true,
      schedule,
    });
  } catch (error) {
    console.error("Failed to load schedule:", error);
    return jsonResponse(
      {
        ok: false,
        message: "Could not load this schedule right now.",
      },
      500,
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ scheduleId: string }> },
) {
  let userId: string;

  try {
    userId = (await requireFirebaseUser(request)).uid;
  } catch (error) {
    return authErrorResponse(error, "Sign in before cancelling this schedule.");
  }

  const missingRuntimeEnv = getMissingSchedulingRuntimeEnvVars();

  if (missingRuntimeEnv.length > 0) {
    return jsonResponse(
      {
        ok: false,
        message: `Scheduling is not configured. Add ${missingRuntimeEnv.join(
          ", ",
        )}.`,
      },
      501,
    );
  }

  const { scheduleId } = await params;

  try {
    const schedule = await cancelUserSchedule({
      postId: scheduleId,
      userId,
    });

    return jsonResponse({
      ok: true,
      schedule,
    });
  } catch (error) {
    if (error instanceof SchedulingRequestError) {
      return jsonResponse(
        {
          code: error.code,
          ok: false,
          message: error.message,
        },
        error.status,
      );
    }

    console.error("Failed to cancel schedule:", error);
    return jsonResponse(
      {
        ok: false,
        message: "Could not cancel this schedule right now.",
      },
      500,
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ scheduleId: string }> },
) {
  let userId: string;

  try {
    userId = (await requireFirebaseUser(request)).uid;
  } catch (error) {
    return authErrorResponse(error, "Sign in before editing this schedule.");
  }

  const missingRuntimeEnv = getMissingSchedulingRuntimeEnvVars();

  if (missingRuntimeEnv.length > 0) {
    return jsonResponse(
      {
        ok: false,
        message: `Scheduling is not configured. Add ${missingRuntimeEnv.join(
          ", ",
        )}.`,
      },
      501,
    );
  }

  let body: ScheduleUpdateInput;

  try {
    body = (await request.json()) as ScheduleUpdateInput;
  } catch {
    return jsonResponse(
      {
        ok: false,
        message: "Send schedule details as JSON.",
      },
      400,
    );
  }

  const { scheduleId } = await params;

  try {
    const schedule = await updateUserSchedule({
      input: body,
      postId: scheduleId,
      userId,
    });

    return jsonResponse({
      ok: true,
      schedule,
    });
  } catch (error) {
    if (error instanceof SchedulingRequestError) {
      return jsonResponse(
        {
          code: error.code,
          ok: false,
          message: error.message,
        },
        error.status,
      );
    }

    console.error("Failed to edit schedule:", error);
    return jsonResponse(
      {
        ok: false,
        message: "Could not edit this schedule right now.",
      },
      500,
    );
  }
}

function authErrorResponse(error: unknown, unauthorizedMessage: string) {
  if (error instanceof FirebaseAuthRequestError) {
    return jsonResponse(
      {
        ok: false,
        message: error.status === 401 ? unauthorizedMessage : error.message,
      },
      error.status,
    );
  }

  console.error("Failed to verify scheduling requester:", error);
  return jsonResponse(
    {
      ok: false,
      message: "Could not verify your sign-in session.",
    },
    500,
  );
}
