import { NextResponse } from "next/server";

import { sendJobMessage } from "@/lib/aws/sqs";
import {
  attachAwsMessageToBackgroundJob,
  getBackgroundJobById,
  getMissingBackgroundJobStorageEnvVars,
} from "@/lib/jobs/background-jobs";
import { getMissingQueueEnvVars } from "@/lib/queues/config";
import {
  getMissingCloudTasksOidcEnvVars,
  getSocialPublishDispatchAudienceForRequest,
  verifyCloudTasksOidcRequest,
} from "@/lib/scheduling/cloud-tasks-oidc-auth";
import {
  dispatchScheduledSocialPublishJob,
  ScheduledSocialPublishDispatchError,
  type ScheduledSocialPublishDispatchInput,
} from "@/lib/scheduling/schedule-dispatch-logic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_LENGTH = 2_048;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: Request) {
  const missingRuntimeEnv = [
    ...new Set([
      ...getMissingCloudTasksOidcEnvVars(),
      ...getMissingBackgroundJobStorageEnvVars(),
      ...getMissingQueueEnvVars(["publish_social_post"]),
    ]),
  ];

  if (missingRuntimeEnv.length > 0) {
    console.error("Internal social schedule dispatch is not configured", {
      missingRuntimeEnv,
    });
    return json(
      {
        ok: false,
        message: "Internal social schedule dispatch is not configured.",
      },
      503,
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");

  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_LENGTH) {
    return json({ ok: false, message: "Request body is too large." }, 413);
  }

  const rawBody = await request.text();

  if (!rawBody || Buffer.byteLength(rawBody, "utf8") > MAX_BODY_LENGTH) {
    return json({ ok: false, message: "Request body is invalid." }, 400);
  }

  const audience = getSocialPublishDispatchAudienceForRequest(request.url);
  const authorized = await verifyCloudTasksOidcRequest({
    audience,
    authorization: request.headers.get("authorization"),
  });

  if (!authorized) {
    return json({ ok: false, message: "Unauthorized." }, 401);
  }

  let input: ScheduledSocialPublishDispatchInput;

  try {
    input = JSON.parse(rawBody) as ScheduledSocialPublishDispatchInput;
  } catch {
    return json({ ok: false, message: "Request body must be valid JSON." }, 400);
  }

  if (!isValidInput(input)) {
    return json(
      { ok: false, message: "Schedule dispatch details are invalid." },
      400,
    );
  }

  try {
    const result = await dispatchScheduledSocialPublishJob(input, {
      attachMessage: attachAwsMessageToBackgroundJob,
      getJob: getBackgroundJobById,
      reportError: (event, details) => {
        console.error(`Social schedule dispatch ${event}:`, details);
      },
      sendMessage: sendJobMessage,
    });

    return json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof ScheduledSocialPublishDispatchError) {
      return json(
        {
          code: error.code,
          ok: false,
          message: error.message,
        },
        error.status,
      );
    }

    console.error("Failed to dispatch scheduled social publish job:", error);
    return json(
      {
        ok: false,
        message: "Could not dispatch this social publish job right now.",
      },
      500,
    );
  }
}

function isValidInput(
  value: unknown,
): value is ScheduledSocialPublishDispatchInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const input = value as Record<string, unknown>;

  return (
    typeof input.jobId === "string" &&
    UUID_PATTERN.test(input.jobId) &&
    typeof input.targetId === "string" &&
    UUID_PATTERN.test(input.targetId)
  );
}
