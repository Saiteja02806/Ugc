import { NextResponse } from "next/server";

import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import {
  getMissingSchedulingRuntimeEnvVars,
  retryUserScheduleTargetPublishing,
  SchedulingRequestError,
} from "@/lib/scheduling/service";
import { hasTikTokBetaAccess } from "@/lib/social/tiktok-beta-access";
import { hasYouTubeBetaAccess } from "@/lib/social/youtube-beta-access";

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
  {
    params,
  }: {
    params: Promise<{ scheduleId: string; targetId: string }>;
  },
) {
  let userId: string;
  let user: Awaited<ReturnType<typeof requireFirebaseUser>>;

  try {
    user = await requireFirebaseUser(request);
    userId = user.uid;
  } catch (error) {
    return authErrorResponse(error);
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

  const { scheduleId, targetId } = await params;

  try {
    const result = await retryUserScheduleTargetPublishing({
      allowTikTokTargets: hasTikTokBetaAccess(user),
      allowYouTubeTargets: hasYouTubeBetaAccess(user),
      postId: scheduleId,
      targetId,
      userId,
    });

    return jsonResponse({
      created: result.created,
      ok: true,
      retryStatus: result.retryStatus,
      schedule: result.schedule,
    });
  } catch (error) {
    if (error instanceof SchedulingRequestError) {
      return jsonResponse(
        {
          code: error.code,
          message: error.message,
          ok: false,
        },
        error.status,
      );
    }

    console.error("Failed to retry social publishing:", error);
    return jsonResponse(
      {
        ok: false,
        message: "Could not retry publishing right now.",
      },
      500,
    );
  }
}

function authErrorResponse(error: unknown) {
  if (error instanceof FirebaseAuthRequestError) {
    return jsonResponse(
      {
        ok: false,
        message:
          error.status === 401
            ? "Sign in before retrying publishing."
            : error.message,
      },
      error.status,
    );
  }

  console.error("Failed to verify publishing retry requester:", error);
  return jsonResponse(
    {
      ok: false,
      message: "Could not verify your sign-in session.",
    },
    500,
  );
}
