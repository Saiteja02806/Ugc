import { NextResponse } from "next/server";

import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import {
  getMissingSchedulingRuntimeEnvVars,
  scheduleRenderedPost,
  SchedulingRequestError,
  type ScheduleRenderedPostInput,
} from "@/lib/scheduling/service";

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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ scheduleId: string }> },
) {
  let userId: string;

  try {
    userId = (await requireFirebaseUser(request)).uid;
  } catch (error) {
    return authErrorResponse(error, "Sign in before scheduling this post.");
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

  let body: ScheduleRenderedPostInput;

  try {
    body = (await request.json()) as ScheduleRenderedPostInput;
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
    const result = await scheduleRenderedPost({
      input: body,
      postId: scheduleId,
      userId,
    });

    return jsonResponse({
      created: result.created,
      ok: true,
      schedule: result.schedule,
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

    console.error("Failed to schedule rendered post:", error);
    return jsonResponse(
      {
        ok: false,
        message: "Could not schedule this rendered post right now.",
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

  console.error("Failed to verify rendered schedule requester:", error);
  return jsonResponse(
    {
      ok: false,
      message: "Could not verify your sign-in session.",
    },
    500,
  );
}
