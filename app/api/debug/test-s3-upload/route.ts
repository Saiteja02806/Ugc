import { NextResponse } from "next/server";

import {
  buildDirectS3Url,
  getMissingStorageEnvVars,
  uploadBufferToS3,
} from "@/lib/storage/s3";

export async function POST() {
  const missingEnv = getMissingStorageEnvVars();

  if (missingEnv.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "S3 upload test is missing required server environment variables.",
        missingEnv,
      },
      { status: 500 },
    );
  }

  try {
    const timestamp = new Date().toISOString();
    const key = `health-check/test-${Date.now()}.txt`;

    const result = await uploadBufferToS3({
      key,
      buffer: Buffer.from(`S3 + CloudFront test successful at ${timestamp}`),
      contentType: "text/plain",
      cacheControl: "no-cache",
    });

    return NextResponse.json({
      ok: true,
      message: "S3 upload successful",
      key: result.key,
      cloudFrontUrl: result.url,
      directS3Url: buildDirectS3Url(result.key),
    });
  } catch (error) {
    console.error("S3 upload test failed:", error);
    const awsError =
      error && typeof error === "object"
        ? (error as {
            $metadata?: { httpStatusCode?: number; requestId?: string };
            Code?: string;
            code?: string;
            message?: string;
            name?: string;
          })
        : null;

    return NextResponse.json(
      {
        ok: false,
        error: "S3 upload test failed",
        diagnostic: {
          code: awsError?.Code ?? awsError?.code ?? awsError?.name ?? "Unknown",
          httpStatusCode: awsError?.$metadata?.httpStatusCode ?? null,
          message: awsError?.message ?? "No diagnostic message available",
          requestId: awsError?.$metadata?.requestId ?? null,
        },
      },
      { status: 500 },
    );
  }
}
