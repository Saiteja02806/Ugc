import { NextResponse } from "next/server";

import {
  getLatestEditableVideoRenderForOwner,
  type RenderJobStatus,
} from "@/lib/edit/render-storage";
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
export const dynamic = "force-dynamic";

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

function getRenderStatusResponse(job: BackgroundJobRecord) {
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
          ? job.errorMessage ?? "Video save failed."
          : null,
    },
  });
}

function mapPersistedRenderStatus(status: RenderJobStatus) {
  if (status === "queued") {
    return "QUEUED";
  }

  if (status === "rendering") {
    return "EXECUTING";
  }

  if (status === "completed") {
    return "COMPLETED";
  }

  return "FAILED";
}

async function getLatestRenderStatus(sourceVideoId: string, userId: string) {
  const render = await getLatestEditableVideoRenderForOwner({
    sourceVideoId,
    userId,
  });

  if (!render) {
    return NextResponse.json(
      { ok: false, error: "No save exists for this Edit project." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    run: {
      error:
        render.status === "failed"
          ? render.error_message ?? "Video save failed."
          : null,
      id: render.render_id,
      isTerminal: render.status === "completed" || render.status === "failed",
      output:
        render.status === "completed"
          ? {
              key: render.output_s3_key ?? null,
              ok: true,
              renderId: render.render_id,
              sourceVideoId: render.source_video_id,
              url: render.output_url ?? null,
            }
          : null,
      status: mapPersistedRenderStatus(render.status),
      taskIdentifier: "render_edit_video",
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
        error: `Video save status is not configured. Add ${missingRuntimeEnv.join(
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
        error: "Video save job was not found.",
      },
      { status: 404 },
    );
  }

  if (job.jobType !== "render_edit_video") {
    return NextResponse.json(
      {
        ok: false,
        error: "This worker job is not a video save.",
      },
      { status: 400 },
    );
  }

  if (job.userId && job.userId !== userId) {
    return NextResponse.json(
      {
        ok: false,
        error: "You do not have access to this save.",
      },
      { status: 403 },
    );
  }

  return getRenderStatusResponse(job);
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
  const sourceVideoId = url.searchParams.get("sourceVideoId")?.trim();

  if (jobId) {
    try {
      return await getAwsRenderStatus(jobId, user.uid);
    } catch (error) {
      console.error("Failed to retrieve edited video render status:", error);

      return NextResponse.json(
        {
          ok: false,
          error: "Could not retrieve video save status.",
        },
        { status: 500 },
      );
    }
  }

  if (sourceVideoId) {
    try {
      return await getLatestRenderStatus(sourceVideoId, user.uid);
    } catch (error) {
      console.error("Failed to retrieve latest Edit project render status:", error);

      return NextResponse.json(
        {
          ok: false,
          error: "Could not retrieve the latest Edit project save status.",
        },
        { status: 500 },
      );
    }
  }

  return NextResponse.json(
    {
      ok: false,
      error: "Missing save job id or Edit project source video id.",
    },
    { status: 400 },
  );
}
