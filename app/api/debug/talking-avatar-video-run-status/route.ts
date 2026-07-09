import { runs } from "@trigger.dev/sdk";
import { NextResponse } from "next/server";

type VideoRunOutput = {
  ok?: unknown;
  videoId?: unknown;
  provider?: unknown;
  key?: unknown;
  url?: unknown;
};

const terminalStatuses = new Set([
  "COMPLETED",
  "FAILED",
  "CANCELED",
  "CRASHED",
  "INTERRUPTED",
  "SYSTEM_FAILURE",
  "TIMED_OUT",
]);

function getSafeOutput(output: unknown) {
  if (!output || typeof output !== "object") {
    return null;
  }

  const videoOutput = output as VideoRunOutput;

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
  const runId = url.searchParams.get("runId")?.trim();

  if (!runId) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing run id.",
      },
      { status: 400 },
    );
  }

  try {
    const run = await runs.retrieve(runId);
    const status = run.status;

    return NextResponse.json({
      ok: true,
      run: {
        id: run.id,
        status,
        taskIdentifier: run.taskIdentifier,
        isTerminal: terminalStatuses.has(status),
        output: getSafeOutput(run.output),
        error: run.error
          ? "Talking avatar video generation failed. Check the Trigger.dev worker logs."
          : null,
      },
    });
  } catch (error) {
    console.error("Failed to retrieve talking avatar video run status:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Could not retrieve talking avatar video generation status.",
      },
      { status: 500 },
    );
  }
}
