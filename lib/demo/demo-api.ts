import "server-only";

import { NextResponse } from "next/server";

import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
  type VerifiedFirebaseUser,
} from "@/lib/firebase/server-auth";
import { getMissingStorageEnvVars } from "@/lib/storage/s3";

import { getMissingDemoVideoStorageEnvVars } from "./demo-storage";

export const DEFAULT_DEMO_PROJECT_ID = "test-project-001";

const SAFE_PATH_SEGMENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/;

export type AuthenticatedDemoRequest =
  | {
      ok: true;
      user: VerifiedFirebaseUser;
    }
  | {
      ok: false;
      response: NextResponse;
    };

export async function authenticateDemoRequest(
  request: Request,
): Promise<AuthenticatedDemoRequest> {
  try {
    return {
      ok: true,
      user: await requireFirebaseUser(request),
    };
  } catch (error) {
    if (error instanceof FirebaseAuthRequestError) {
      return {
        ok: false,
        response: jsonResponse(
          {
            ok: false,
            error:
              error.status === 401
                ? "Sign in before managing demo videos."
                : error.message,
          },
          error.status,
        ),
      };
    }

    console.error("Failed to verify demo requester:", error);

    return {
      ok: false,
      response: jsonResponse(
        {
          ok: false,
          error: "Could not verify your sign-in session.",
        },
        500,
      ),
    };
  }
}

export function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export function getMissingDemoRuntimeEnvVars(options: {
  includeStorage?: boolean;
  includeSupabase?: boolean;
}) {
  return Array.from(
    new Set([
      ...(options.includeStorage ? getMissingStorageEnvVars() : []),
      ...(options.includeSupabase ? getMissingDemoVideoStorageEnvVars() : []),
    ]),
  );
}

export async function readJsonBody<TBody>(request: Request) {
  try {
    return (await request.json()) as TBody;
  } catch {
    return null;
  }
}

export function getString(value: unknown, maxLength = 500) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

export function getNumber(value: unknown) {
  return typeof value === "number" ? value : Number.NaN;
}

export function getFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function getPositiveInteger(value: unknown) {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    Number.isFinite(value) &&
    value > 0
    ? value
    : null;
}

export function getProjectId(value: unknown) {
  const rawProjectId = getString(value, 96) || DEFAULT_DEMO_PROJECT_ID;

  return cleanPathSegment(rawProjectId, DEFAULT_DEMO_PROJECT_ID);
}

export function getDemoId(value: unknown) {
  return cleanPathSegment(getString(value, 96), "");
}

export function getProjectIdFromUrl(request: Request) {
  const url = new URL(request.url);

  return getProjectId(url.searchParams.get("projectId"));
}

export function getAwsDiagnostic(error: unknown) {
  if (!error || typeof error !== "object") {
    return null;
  }

  const awsError = error as {
    $metadata?: { httpStatusCode?: number; requestId?: string };
    Code?: string;
    code?: string;
    message?: string;
    name?: string;
  };

  return {
    code: awsError.Code ?? awsError.code ?? awsError.name ?? "Unknown",
    httpStatusCode: awsError.$metadata?.httpStatusCode ?? null,
    message: awsError.message ?? "No diagnostic message available",
    requestId: awsError.$metadata?.requestId ?? null,
  };
}

export function isS3NotFoundError(error: unknown) {
  const diagnostic = getAwsDiagnostic(error);

  return (
    diagnostic?.httpStatusCode === 404 ||
    diagnostic?.code === "NotFound" ||
    diagnostic?.code === "NoSuchKey"
  );
}

export function isDemoStorageNotFoundError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const storageError = error as {
    code?: string;
    message?: string;
  };

  return (
    storageError.code === "PGRST116" ||
    storageError.message?.includes("0 rows") === true ||
    storageError.message?.includes("JSON object requested") === true
  );
}

export function normalizeContentType(contentType: string | undefined) {
  return contentType?.split(";")[0]?.trim().toLowerCase() ?? "";
}

function cleanPathSegment(value: string, fallback: string) {
  const normalized = value.trim();

  if (!normalized || !SAFE_PATH_SEGMENT_PATTERN.test(normalized)) {
    return fallback;
  }

  return normalized;
}
