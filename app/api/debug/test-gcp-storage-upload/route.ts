import { NextResponse } from "next/server";

import {
  buildDirectStorageUrl,
  getMissingStorageEnvVars,
  uploadBufferToStorage,
} from "@/lib/storage/storage";

export const runtime = "nodejs";

export async function POST() {
  const missing = getMissingStorageEnvVars();

  if (missing.length > 0) {
    return NextResponse.json(
      {
        error: "Cloud Storage upload test is missing required environment variables.",
        missing,
        ok: false,
      },
      { status: 501 },
    );
  }

  try {
    const timestamp = new Date().toISOString();
    const key = `health-check/test-${Date.now()}.txt`;
    const result = await uploadBufferToStorage({
      buffer: Buffer.from(`GCP Cloud Storage test successful at ${timestamp}`),
      contentType: "text/plain; charset=utf-8",
      key,
    });

    return NextResponse.json({
      directUrl: buildDirectStorageUrl(result.key),
      key: result.key,
      message: "Cloud Storage upload successful",
      ok: true,
      publicUrl: result.url,
    });
  } catch (error) {
    console.error("Cloud Storage upload test failed:", error);

    return NextResponse.json(
      {
        error: "Cloud Storage upload test failed",
        ok: false,
      },
      { status: 500 },
    );
  }
}
