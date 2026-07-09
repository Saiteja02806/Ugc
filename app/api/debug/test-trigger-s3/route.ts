import { tasks } from "@trigger.dev/sdk";
import { NextResponse } from "next/server";

import type { testS3UploadTask } from "@/trigger/test-s3-upload";

export async function POST() {
  try {
    const handle = await tasks.trigger<typeof testS3UploadTask>(
      "test-s3-upload",
      undefined,
    );

    return NextResponse.json({
      ok: true,
      message: "Trigger.dev S3 task started",
      runId: handle.id,
    });
  } catch (error) {
    console.error("Failed to trigger test-s3-upload:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to trigger Trigger.dev S3 task",
      },
      { status: 500 },
    );
  }
}
