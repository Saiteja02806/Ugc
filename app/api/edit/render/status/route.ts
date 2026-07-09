import { NextResponse } from "next/server";

import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";
import {
  getBackgroundJobById,
  getMissingBackgroundJobStorageEnvVars,
  type BackgroundJobRecord,
  type BackgroundJobStatus,
} from "@/lib/jobs/background-jobs";

export const runtime = "nodejs";

type RenderRunOutput = {
  key?: unknown;
  ok?: unknown;
  renderId?: unknown;
  sourceVideoId?: unknown;
  url?: unknown;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const backgroundJobTerminalStatuses = new Set<BackgroundJobStatus>([
  "cancelled",
  "completed",
  "failed",
]);

function getSafeOutput(output: unknown) {
  if (!output || typeof output !== "object") {
    return null;
  }

  const renderOutput = output as RenderRunOutput;

  return {
    ok: renderOutput.ok === true,
    renderId:
      typeof renderOutput.renderId === "string" ? renderOutput.renderId : null,
    sourceVideoId:
      typeof renderOutput.sourceVideoId === "string"
        ? renderOutput.sourceVideoId
        : null,
    key: typeof renderOutput.key === "string" ? renderOutput.key : null,
    url: typeof renderOutput.url === "string" ? renderOutput.url : null,
  };
}

function mapBackgroundJobStatus(status: BackgroundJobStatus) {
  if (status === "queued") {
    return "QUEUED";
  }

  if (status === "processing") {
    return "EXECUTING";
  }

  if (status === "completed") {
    return "COMPLETED";
  }

  if (status === "cancelled") {
    return "CANCELED";
  }

  return "FAILED";
}

function getAwsRenderStatusResponse(job: BackgroundJobRecord) {
  return NextResponse.json({
    ok: true,
    run: {
      id: job.id,
      status: mapBackgroundJobStatus(job.status),
      taskIdentifier: job.jobType,
      isTerminal: backgroundJobTerminalStatuses.has(job.status),
      output: getSafeOutput(job.output),
      error:
        job.status === "failed"
          ? job.errorMessage ?? "Edited video render failed in AWS."
          : null,
    },
  });
}

async function getAwsRenderStatus(jobId: string, userId: string) {
  if (!UUID_PATTERN.test(jobId)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing or invalid job id.",
      },
      { status: 400 },
    );
  }

  const missingRuntimeEnv = getMissingBackgroundJobStorageEnvVars();

  if (missingRuntimeEnv.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        error: `AWS render status is not configured. Add ${missingRuntimeEnv.join(
          ", ",
        )}.`,
      },
      { status: 501 },
    );
  }

  const job = await getBackgroundJobById(jobId);

  if (!job) {
    return NextResponse.json(
      {
        ok: false,
        error: "AWS render job was not found.",
      },
      { status: 404 },
    );
  }

  if (job.jobType !== "render_edit_video") {
    return NextResponse.json(
      {
        ok: false,
        error: "This worker job is not an edited video render.",
      },
      { status: 400 },
    );
  }

  if (job.userId && job.userId !== userId) {
    return NextResponse.json(
      {
        ok: false,
        error: "You do not have access to this render.",
      },
      { status: 403 },
    );
  }

  return getAwsRenderStatusResponse(job);
}

export async function GET(request: Request) {
  let user;

  try {
    user = await requireFirebaseUser(request);
  } catch (error) {
    if (error instanceof FirebaseAuthRequestError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
        },
        { status: error.status },
      );
    }

    console.error("Failed to verify render status requester:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Could not verify your sign-in session.",
      },
      { status: 500 },
    );
  }

  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId")?.trim();

  if (jobId) {
    try {
      return await getAwsRenderStatus(jobId, user.uid);
    } catch (error) {
      console.error("Failed to retrieve AWS edited video render status:", error);

      return NextResponse.json(
        {
          ok: false,
          error: "Could not retrieve AWS edited video render status.",
        },
        { status: 500 },
      );
    }
  }

  return NextResponse.json(
    {
      ok: false,
      error: "Missing AWS render job id.",
    },
    { status: 400 },
  );
}
