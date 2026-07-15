import { NextResponse } from "next/server";

import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import {
  createUserSchedule,
  getMinimumRenderLeadMinutes,
  getMissingSchedulingRuntimeEnvVars,
  listUserSchedules,
  SchedulingRequestError,
} from "@/lib/scheduling/service";
import {
  scheduledPostStatuses,
  type ScheduleCreateInput,
  type ScheduledPostStatus,
} from "@/lib/scheduling/types";

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

export async function GET(request: Request) {
  let userId: string;

  try {
    userId = (await requireFirebaseUser(request)).uid;
  } catch (error) {
    return authErrorResponse(error, "Sign in before viewing schedules.");
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

  const url = new URL(request.url);
  const status = getScheduleStatus(url.searchParams.get("status"));

  if (url.searchParams.get("status") && !status) {
    return jsonResponse(
      {
        ok: false,
        message: "Unknown schedule status.",
      },
      400,
    );
  }

  try {
    const schedules = await listUserSchedules({
      from: normalizeDateParam(url.searchParams.get("from")),
      status,
      to: normalizeDateParam(url.searchParams.get("to")),
      userId,
    });

    return jsonResponse({
      minimumRenderLeadMinutes: getMinimumRenderLeadMinutes(),
      ok: true,
      schedules,
    });
  } catch (error) {
    console.error("Failed to list schedules:", error);
    return jsonResponse(
      {
        ok: false,
        message: "Could not load schedules right now.",
      },
      500,
    );
  }
}

export async function POST(request: Request) {
  let userId: string;

  try {
    userId = (await requireFirebaseUser(request)).uid;
  } catch (error) {
    return authErrorResponse(error, "Sign in before scheduling posts.");
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

  let body: ScheduleCreateInput;

  try {
    body = (await request.json()) as ScheduleCreateInput;
  } catch {
    return jsonResponse(
      {
        ok: false,
        message: "Send schedule details as JSON.",
      },
      400,
    );
  }

  try {
    const result = await createUserSchedule({
      input: body,
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

    console.error("Failed to create schedule:", error);
    return jsonResponse(
      {
        ok: false,
        message: "Could not create this schedule right now.",
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

function getScheduleStatus(value: string | null): ScheduledPostStatus | null {
  if (!value) {
    return null;
  }

  return scheduledPostStatuses.includes(value as ScheduledPostStatus)
    ? (value as ScheduledPostStatus)
    : null;
}

function normalizeDateParam(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
