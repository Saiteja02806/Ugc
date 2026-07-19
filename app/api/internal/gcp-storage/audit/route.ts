import { NextResponse } from "next/server";

import {
  getMissingGcpCutoverAuditAuthEnvVars,
  verifyGcpCutoverAuditRequest,
} from "@/lib/internal/gcp-cutover-audit-auth";
import {
  GCP_CUTOVER_AUDIT_SIGNATURE_HEADER,
  GCP_CUTOVER_AUDIT_TIMESTAMP_HEADER,
} from "@/lib/internal/gcp-cutover-audit-signature";
import {
  createUploadingMediaAsset,
  getMissingMediaStorageEnvVars,
  markMediaAssetReady,
  softDeleteMediaAsset,
} from "@/lib/media/media-storage";
import { createMediaUploadTarget } from "@/lib/media/media-upload";
import {
  createPresignedPutUrl,
  deleteS3Object,
  getMissingStorageEnvVars,
  getStorageProviderName,
  headS3Object,
} from "@/lib/storage/s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AUDIT_CONTENT_TYPE = "image/png";
const AUDIT_FILE_NAME = "production-gcp-storage-audit.png";
const AUDIT_IMAGE = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);
const MAX_BODY_LENGTH = 2_048;

type AuditRequestBody = {
  projectId?: unknown;
  userId?: unknown;
};

type CleanupResult = {
  errors: string[];
  mediaAssetSoftDeleted: boolean;
  objectDeleted: boolean;
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");

  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_LENGTH) {
    return json({ ok: false, message: "Request body is too large." }, 413);
  }

  const body = await request.text();

  if (!body || Buffer.byteLength(body, "utf8") > MAX_BODY_LENGTH) {
    return json({ ok: false, message: "Request body is invalid." }, 400);
  }

  const missingAuthEnv = getMissingGcpCutoverAuditAuthEnvVars();

  if (missingAuthEnv.length > 0) {
    console.error("GCP storage audit auth is not configured", {
      missingAuthEnv,
    });
    return json({ ok: false, message: "Storage audit is not configured." }, 503);
  }

  const authorized = verifyGcpCutoverAuditRequest({
    body,
    signature: request.headers.get(GCP_CUTOVER_AUDIT_SIGNATURE_HEADER),
    timestamp: request.headers.get(GCP_CUTOVER_AUDIT_TIMESTAMP_HEADER),
  });

  if (!authorized) {
    return json({ ok: false, message: "Unauthorized." }, 401);
  }

  let input: AuditRequestBody;

  try {
    input = JSON.parse(body) as AuditRequestBody;
  } catch {
    return json({ ok: false, message: "Request body must be valid JSON." }, 400);
  }

  let storageProvider: ReturnType<typeof getStorageProviderName>;

  try {
    storageProvider = getStorageProviderName();
  } catch (error) {
    console.error("GCP storage audit could not resolve storage provider", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return json(
      { ok: false, message: "Storage provider is not configured correctly." },
      503,
    );
  }

  const runtimeSnapshot = getRuntimeSnapshot(storageProvider);

  if (storageProvider !== "gcp") {
    return json(
      {
        ok: false,
        message: "Production storage provider is not cut over to GCP.",
        runtime: runtimeSnapshot,
      },
      409,
    );
  }

  const missingRuntimeEnv = getMissingRuntimeEnv();

  if (missingRuntimeEnv.length > 0) {
    console.error("GCP storage audit runtime is missing env vars", {
      missingRuntimeEnv,
    });
    return json(
      {
        ok: false,
        message: "Production GCP storage runtime is not fully configured.",
        missingRuntimeEnv,
        runtime: runtimeSnapshot,
      },
      503,
    );
  }

  const userId = cleanPathSegment(input.userId, "production-gcp-storage-audit");
  const projectId = cleanPathSegment(
    input.projectId,
    "production-gcp-storage-audit",
  );
  const uploadTarget = createMediaUploadTarget({
    collection: "image",
    contentType: AUDIT_CONTENT_TYPE,
    fileName: AUDIT_FILE_NAME,
    fileSize: AUDIT_IMAGE.byteLength,
    title: "Production GCP storage audit",
    userId,
  });

  if (!uploadTarget.ok) {
    console.error("GCP storage audit could not create upload target", {
      error: uploadTarget.error,
    });
    return json(
      { ok: false, message: "Could not create storage audit upload target." },
      500,
    );
  }

  const { target } = uploadTarget;
  let mediaAssetCreated = false;
  let objectCreated = false;

  try {
    const signedPutUrl = await createPresignedPutUrl({
      contentType: target.contentType,
      expiresInSeconds: 5 * 60,
      key: target.key,
    });

    const uploadHost = getUrlHost(signedPutUrl);

    await createUploadingMediaAsset({
      assetId: target.assetId,
      collection: target.collection,
      fileName: target.fileName,
      fileSizeBytes: target.fileSize,
      mimeType: target.contentType,
      projectId,
      sourceType: "upload",
      storageKey: target.key,
      title: target.title,
      url: target.cloudFrontUrl,
      userId,
    });
    mediaAssetCreated = true;

    const uploadResponse = await fetch(signedPutUrl, {
      body: AUDIT_IMAGE,
      cache: "no-store",
      headers: {
        "Content-Type": target.contentType,
      },
      method: "PUT",
    });

    if (!uploadResponse.ok) {
      const responseText = await uploadResponse.text().catch(() => "");

      throw new Error(
        `Signed upload failed with ${uploadResponse.status}: ${responseText.slice(
          0,
          300,
        )}`,
      );
    }

    objectCreated = true;

    const objectHead = await headS3Object({ key: target.key });

    assertExpectedContentType(objectHead.ContentType, target.contentType);
    assertExpectedContentLength(objectHead.ContentLength, target.fileSize);

    const readyAsset = await markMediaAssetReady({
      assetId: target.assetId,
      height: 1,
      ratio: "1:1",
      userId,
      width: 1,
    });

    const publicRead = await fetch(target.cloudFrontUrl, {
      cache: "no-store",
      method: "GET",
    });

    if (!publicRead.ok) {
      throw new Error(
        `Public GCP storage URL returned ${publicRead.status}.`,
      );
    }

    const publicBody = Buffer.from(await publicRead.arrayBuffer());
    const publicContentType = publicRead.headers.get("content-type");

    assertExpectedContentType(publicContentType, target.contentType);
    assertExpectedContentLength(publicBody.byteLength, target.fileSize);

    const cleanup = await cleanupAuditResources({
      assetId: target.assetId,
      mediaAssetCreated,
      objectCreated,
      key: target.key,
      userId,
    });

    return json({
      asset: {
        id: readyAsset.id,
        sourceType: readyAsset.source_type,
        status: readyAsset.status,
        storageKey: readyAsset.storage_key,
        urlHost: getUrlHost(readyAsset.url),
      },
      cleanup,
      object: {
        contentLength: objectHead.ContentLength ?? null,
        contentType: objectHead.ContentType ?? null,
      },
      ok: true,
      publicRead: {
        contentLength: publicBody.byteLength,
        contentType: publicContentType,
        ok: true,
        status: publicRead.status,
        urlHost: getUrlHost(target.cloudFrontUrl),
      },
      runtime: runtimeSnapshot,
      upload: {
        contentLength: target.fileSize,
        contentType: target.contentType,
        signedUrlHost: uploadHost,
        status: uploadResponse.status,
      },
    });
  } catch (error) {
    console.error("Production GCP storage audit failed", {
      assetId: target.assetId,
      error: error instanceof Error ? error.message : "Unknown error",
      key: target.key,
    });

    const cleanup = await cleanupAuditResources({
      assetId: target.assetId,
      mediaAssetCreated,
      objectCreated,
      key: target.key,
      userId,
    });

    return json(
      {
        cleanup,
        message:
          error instanceof Error
            ? error.message
            : "Production GCP storage audit failed.",
        ok: false,
        runtime: runtimeSnapshot,
        target: {
          assetId: target.assetId,
          key: target.key,
          publicUrlHost: getUrlHost(target.cloudFrontUrl),
        },
      },
      502,
    );
  }
}

async function cleanupAuditResources(params: {
  assetId: string;
  mediaAssetCreated: boolean;
  objectCreated: boolean;
  key: string;
  userId: string;
}): Promise<CleanupResult> {
  const result: CleanupResult = {
    errors: [],
    mediaAssetSoftDeleted: false,
    objectDeleted: false,
  };

  if (params.objectCreated) {
    try {
      await deleteS3Object({ key: params.key });
      result.objectDeleted = true;
    } catch (error) {
      result.errors.push(
        `Could not delete audit object: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }

  if (params.mediaAssetCreated) {
    try {
      const deletedAsset = await softDeleteMediaAsset({
        assetId: params.assetId,
        userId: params.userId,
      });

      result.mediaAssetSoftDeleted = Boolean(deletedAsset);
    } catch (error) {
      result.errors.push(
        `Could not soft-delete audit media asset: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }

  return result;
}

function getRuntimeSnapshot(storageProvider: ReturnType<typeof getStorageProviderName>) {
  return {
    storageBucket:
      process.env.GCP_STORAGE_BUCKET?.trim() ||
      process.env.GOOGLE_CLOUD_STORAGE_BUCKET?.trim() ||
      null,
    storageProvider,
    storagePublicBaseUrlHost: getUrlHost(
      process.env.GCP_STORAGE_PUBLIC_BASE_URL?.trim() ||
        process.env.GCS_PUBLIC_BASE_URL?.trim(),
    ),
  };
}

function getMissingRuntimeEnv() {
  return Array.from(
    new Set([...getMissingStorageEnvVars(), ...getMissingMediaStorageEnvVars()]),
  );
}

function assertExpectedContentType(actual: string | null | undefined, expected: string) {
  const normalizedActual = actual?.split(";")[0]?.trim().toLowerCase();

  if (normalizedActual !== expected) {
    throw new Error(`Expected ${expected} object, got ${actual ?? "unknown"}.`);
  }
}

function assertExpectedContentLength(
  actual: number | null | undefined,
  expected: number,
) {
  if (actual !== expected) {
    throw new Error(
      `Expected ${expected} uploaded bytes, got ${actual ?? "unknown"}.`,
    );
  }
}

function cleanPathSegment(value: unknown, fallback: string) {
  const cleanValue = getString(value, 120)
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return cleanValue || fallback;
}

function getString(value: unknown, maxLength = 120) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function getUrlHost(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}
