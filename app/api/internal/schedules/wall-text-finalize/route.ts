import { NextResponse } from "next/server";

import {
  INTERNAL_FINALIZATION_SIGNATURE_HEADER,
  INTERNAL_FINALIZATION_TIMESTAMP_HEADER,
} from "@/lib/scheduling/finalization-signature";
import {
  getMissingInternalFinalizationEnvVars,
  verifyInternalFinalizationRequest,
} from "@/lib/scheduling/internal-finalization-auth";
import {
  finalizeWallTextSchedulesFromWorker,
  getMissingSchedulingRuntimeEnvVars,
  SchedulingRequestError,
  type FinalizeWallTextSchedulesInput,
} from "@/lib/scheduling/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_LENGTH = 4_096;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const missingRuntimeEnv = [
    ...getMissingInternalFinalizationEnvVars(),
    ...getMissingSchedulingRuntimeEnvVars(),
  ];

  if (missingRuntimeEnv.length > 0) {
    console.error("Internal Wall-of-text finalization is not configured", {
      missingRuntimeEnv,
    });
    return jsonResponse(
      {
        ok: false,
        message: "Internal Wall-of-text finalization is not configured.",
      },
      503,
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");

  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_LENGTH) {
    return jsonResponse({ ok: false, message: "Request body is too large." }, 413);
  }

  const rawBody = await request.text();

  if (!rawBody || rawBody.length > MAX_BODY_LENGTH) {
    return jsonResponse({ ok: false, message: "Request body is invalid." }, 400);
  }

  if (
    !verifyInternalFinalizationRequest({
      body: rawBody,
      signature: request.headers.get(INTERNAL_FINALIZATION_SIGNATURE_HEADER),
      timestamp: request.headers.get(INTERNAL_FINALIZATION_TIMESTAMP_HEADER),
    })
  ) {
    return jsonResponse({ ok: false, message: "Unauthorized." }, 401);
  }

  let input: FinalizeWallTextSchedulesInput;

  try {
    input = JSON.parse(rawBody) as FinalizeWallTextSchedulesInput;
  } catch {
    return jsonResponse({ ok: false, message: "Send valid JSON." }, 400);
  }

  if (!isValidInput(input)) {
    return jsonResponse(
      { ok: false, message: "Wall-of-text finalization details are invalid." },
      400,
    );
  }

  try {
    const result = await finalizeWallTextSchedulesFromWorker(input);

    return jsonResponse({ ...result, ok: true });
  } catch (error) {
    if (error instanceof SchedulingRequestError) {
      return jsonResponse(
        { code: error.code, message: error.message, ok: false },
        error.status,
      );
    }

    console.error("Failed to finalize rendered Wall-of-text schedules:", error);
    return jsonResponse(
      {
        ok: false,
        message: "Could not finalize this Wall-of-text schedule right now.",
      },
      500,
    );
  }
}

function isValidInput(
  value: unknown,
): value is FinalizeWallTextSchedulesInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const input = value as Record<string, unknown>;

  return (
    typeof input.assignmentId === "string" &&
    UUID_PATTERN.test(input.assignmentId) &&
    typeof input.mediaAssetId === "string" &&
    UUID_PATTERN.test(input.mediaAssetId) &&
    typeof input.renderId === "string" &&
    UUID_PATTERN.test(input.renderId) &&
    typeof input.userId === "string" &&
    input.userId.trim().length > 0 &&
    input.userId.length <= 128
  );
}

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
