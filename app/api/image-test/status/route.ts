import { NextResponse } from "next/server";

import { getBackgroundJobById } from "@/lib/jobs/background-jobs";
import { FirebaseAuthRequestError, requireFirebaseUser } from "@/lib/firebase/server-auth";

type ImageTestRunOutput = {
  ok?: unknown;
  generationId?: unknown;
  key?: unknown;
  url?: unknown;
};

const terminalStatuses = new Set(["cancelled", "completed", "failed"]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const runtime = "nodejs";

function getSafeOutput(output: unknown) {
  if (!output || typeof output !== "object") {
    return null;
  }

  const imageOutput = output as ImageTestRunOutput;

  return {
    ok: imageOutput.ok === true,
    generationId:
      typeof imageOutput.generationId === "string"
        ? imageOutput.generationId
        : null,
    key: typeof imageOutput.key === "string" ? imageOutput.key : null,
    url: typeof imageOutput.url === "string" ? imageOutput.url : null,
  };
}

export async function GET(request: Request) {
  let user;

  try {
    user = await requireFirebaseUser(request);
  } catch (error) {
    const status = error instanceof FirebaseAuthRequestError ? error.status : 500;
    return NextResponse.json(
      { ok: false, message: error instanceof FirebaseAuthRequestError ? error.message : "Could not verify your session." },
      { status },
    );
  }

  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId")?.trim() ?? "";

  if (!UUID_PATTERN.test(jobId)) {
    return NextResponse.json(
      {
        ok: false,
        message: "Missing or invalid job id.",
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
          message: "Image generation job was not found.",
        },
        { status: 404 },
      );
    }

    if (job.userId !== user.uid) {
      return NextResponse.json(
        { ok: false, message: "Image generation job was not found." },
        { status: 404 },
      );
    }

    if (job.jobType !== "generate_image") {
      return NextResponse.json(
        {
          ok: false,
          message: "The requested job is not an image generation job.",
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
    console.error("Failed to retrieve image test job status:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Could not retrieve AWS image generation status.",
      },
      { status: 500 },
    );
  }
}
