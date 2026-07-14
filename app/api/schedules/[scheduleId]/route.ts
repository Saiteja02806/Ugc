import { NextResponse } from "next/server";

import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import {
  cancelUserSchedule,
  getMissingSchedulingRuntimeEnvVars,
  SchedulingRequestError,
} from "@/lib/scheduling/service";
import { getScheduledPostForUser } from "@/lib/scheduling/db";

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
