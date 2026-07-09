import { NextResponse } from "next/server";

import { getBackgroundJobById } from "@/lib/jobs/background-jobs";

type HookVideoJobOutput = {
  key?: unknown;
  ok?: unknown;
  provider?: unknown;
  url?: unknown;
  videoId?: unknown;
};

const terminalStatuses = new Set(["cancelled", "completed", "failed"]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const runtime = "nodejs";

function getSafeOutput(output: unknown) {
  if (!output || typeof output !== "object") {
    return null;
  }

  const videoOutput = output as HookVideoJobOutput;

  return {
    ok: videoOutput.ok === true,
    videoId:
      typeof videoOutput.videoId === "string" ? videoOutput.videoId : null,
    provider:
      typeof videoOutput.provider === "string" ? videoOutput.provider : null,
    key: typeof videoOutput.key === "string" ? videoOutput.key : null,
    url: typeof videoOutput.url === "string" ? videoOutput.url : null,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId")?.trim() ?? "";

  if (!UUID_PATTERN.test(jobId)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing or invalid job id.",
      },
      { status: 400 },
    );
  }

  try {
    const job = await getBackgroundJobById(jobId);

    if (!job) {
      return NextResponse.json(
        {
          ok: false,
          error: "Hook video generation job was not found.",
        },
        { status: 404 },
      );
    }

    if (job.jobType !== "generate_hook_video") {
      return NextResponse.json(
        {
          ok: false,
          error: "The requested job is not a hook video generation job.",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      job: {
        id: job.id,
        status: job.status,
        isTerminal: terminalStatuses.has(job.status),
        output: getSafeOutput(job.output),
        error: job.errorMessage,
      },
    });
  } catch (error) {
    console.error("Failed to retrieve hook video job status:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Could not retrieve hook video generation status.",
      },
      { status: 500 },
    );
  }
}
