import { NextResponse } from "next/server";

import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import {
  getUserSchedule,
  SchedulingRequestError,
} from "@/lib/scheduling/service";
import {
  startWallTextScheduleRender,
  WallTextScheduleRenderStartError,
} from "@/lib/scheduling/wall-text-render-start";

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

    const render = await startWallTextScheduleRender({ schedule, userId });

    return json({
      ok: true,
      schedule: render.schedule,
      status: render.status,
    });
  } catch (error) {
    if (error instanceof SchedulingRequestError) {
      return json({ code: error.code, message: error.message, ok: false }, error.status);
    }

    if (error instanceof WallTextScheduleRenderStartError) {
      return json({ message: error.message, ok: false }, error.status);
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

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
