import { NextResponse } from "next/server";

import {
  auditAwsMediaForGcpBackfill,
  getMissingAwsMediaBackfillAuditEnvVars,
} from "@/lib/internal/legacy-cloud-media-audit";
import {
  getMissingGcpCutoverAuditAuthEnvVars,
  verifyGcpCutoverAuditRequest,
} from "@/lib/internal/gcp-cutover-audit-auth";
import {
  GCP_CUTOVER_AUDIT_SIGNATURE_HEADER,
  GCP_CUTOVER_AUDIT_TIMESTAMP_HEADER,
} from "@/lib/internal/gcp-cutover-audit-signature";
import { getStorageProviderName } from "@/lib/storage/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_LENGTH = 2_048;

type AuditRequestBody = {
  pageSize?: unknown;
  sampleLimit?: unknown;
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
    console.error("GCP media backfill audit auth is not configured", {
      missingAuthEnv,
    });
    return json(
      { ok: false, message: "Media backfill audit is not configured." },
      503,
    );
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

  const missingRuntimeEnv = getMissingAwsMediaBackfillAuditEnvVars();

  if (missingRuntimeEnv.length > 0) {
    console.error("GCP media backfill audit runtime is missing env vars", {
      missingRuntimeEnv,
    });
    return json(
      {
        missingRuntimeEnv,
        ok: false,
        message: "Production media backfill audit runtime is not configured.",
      },
      503,
    );
  }

  try {
    const audit = await auditAwsMediaForGcpBackfill({
      pageSize: normalizeInteger(input.pageSize, 500, 1, 1000),
      sampleLimit: normalizeInteger(input.sampleLimit, 10, 0, 25),
    });

    return json({
      audit,
      ok: true,
      runtime: getRuntimeSnapshot(audit.supabaseProjectRef),
    });
  } catch (error) {
    console.error("Production GCP media backfill audit failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Production GCP media backfill audit failed.",
      },
      502,
    );
  }
}

function getRuntimeSnapshot(supabaseProjectRef: string) {
  return {
    storageBucket:
      process.env.GCP_STORAGE_BUCKET?.trim() ||
      process.env.GOOGLE_CLOUD_STORAGE_BUCKET?.trim() ||
      null,
    storageProvider: getStorageProviderName(),
    storagePublicBaseUrlHost: getUrlHost(
      process.env.GCP_STORAGE_PUBLIC_BASE_URL?.trim() ||
        process.env.GCS_PUBLIC_BASE_URL?.trim(),
    ),
    supabaseProjectRef,
  };
}

function normalizeInteger(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
) {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return fallback;
  }

  return Math.min(Math.max(value, min), max);
}

function getUrlHost(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}
