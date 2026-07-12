import { NextResponse } from "next/server";

import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import {
  completeTrendingFeedAssignment,
  getMissingTrendingFeedEnvVars,
  type TrendingFeedCompletionAction,
} from "@/lib/trending/daily-feed";

export const runtime = "nodejs";

type CompleteTrendingActionBody = {
  action?: unknown;
  assignmentId?: unknown;
};

const COMPLETION_ACTIONS = new Set<TrendingFeedCompletionAction>([
  "saved",
  "scheduled",
  "skipped",
]);

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: Request) {
  let userId: string;

  try {
    userId = (await requireFirebaseUser(request)).uid;
  } catch (error) {
    if (error instanceof FirebaseAuthRequestError) {
      return jsonResponse(
        {
          ok: false,
          message:
            error.status === 401
              ? "Sign in before updating Trending carousels."
              : error.message,
        },
        error.status,
      );
    }

    console.error("Failed to verify Trending action requester:", error);
    return jsonResponse(
      {
        ok: false,
        message: "Could not verify your sign-in session.",
      },
      500,
    );
  }

  const missingRuntimeEnv = getMissingTrendingFeedEnvVars();

  if (missingRuntimeEnv.length > 0) {
    return jsonResponse(
      {
        ok: false,
        message: `Trending actions are not configured. Add ${missingRuntimeEnv.join(
          ", ",
        )} in server environment variables.`,
      },
      501,
    );
  }

  let body: CompleteTrendingActionBody;

  try {
    body = (await request.json()) as CompleteTrendingActionBody;
  } catch {
    return jsonResponse(
      {
        ok: false,
        message: "Send a Trending carousel and action.",
      },
      400,
    );
  }

  const assignmentId =
    typeof body.assignmentId === "string" ? body.assignmentId.trim() : "";
  const action =
    typeof body.action === "string" &&
    COMPLETION_ACTIONS.has(body.action as TrendingFeedCompletionAction)
      ? (body.action as TrendingFeedCompletionAction)
      : null;

  if (!assignmentId || !action) {
    return jsonResponse(
      {
        ok: false,
        message: "Send a valid Trending carousel action.",
      },
      400,
    );
  }

  try {
    const assignment = await completeTrendingFeedAssignment({
      action,
      assignmentId,
      userId,
    });

    if (!assignment) {
      return jsonResponse(
        {
          ok: false,
          message: "This Trending carousel is not available for your account.",
        },
        404,
      );
    }

    return jsonResponse({
      assignment: {
        completedAt: assignment.completedAt,
        id: assignment.id,
        state: assignment.state,
      },
      ok: true,
    });
  } catch (error) {
    console.error("Failed to complete Trending carousel action:", error);
    return jsonResponse(
      {
        ok: false,
        message: "Could not update this Trending carousel right now.",
      },
      500,
    );
  }
}
