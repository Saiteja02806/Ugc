import { NextResponse } from "next/server";

import { getBackgroundJobById } from "@/lib/jobs/background-jobs";
import { FirebaseAuthRequestError, requireFirebaseUser } from "@/lib/firebase/server-auth";

type AvatarRunOutput = {
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

  const avatarOutput = output as AvatarRunOutput;

  return {
    ok: avatarOutput.ok === true,
    generationId:
      typeof avatarOutput.generationId === "string"
        ? avatarOutput.generationId
        : null,
    key: typeof avatarOutput.key === "string" ? avatarOutput.key : null,
    url: typeof avatarOutput.url === "string" ? avatarOutput.url : null,
  };
}

export async function GET(request: Request) {
  let user;

  try {
    user = await requireFirebaseUser(request);
  } catch (error) {
    const status = error instanceof FirebaseAuthRequestError ? error.status : 500;
    return NextResponse.json({ ok: false, error: error instanceof FirebaseAuthRequestError ? error.message : "Could not verify your session." }, { status });
  }

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
          error: "Avatar generation job was not found.",
        },
        { status: 404 },
      );
    }

    if (job.userId !== user.uid) {
      return NextResponse.json(
        { ok: false, error: "Avatar generation job was not found." },
        { status: 404 },
      );
    }

    if (job.jobType !== "generate_avatar") {
      return NextResponse.json(
        {
          ok: false,
          error: "The requested job is not an avatar generation job.",
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
    console.error("Failed to retrieve avatar job status:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Could not retrieve avatar generation status.",
      },
      { status: 500 },
    );
  }
}
