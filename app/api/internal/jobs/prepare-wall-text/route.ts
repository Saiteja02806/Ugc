import { NextResponse } from "next/server";

import { getBusinessProfileForUser } from "@/lib/business-profiles/db";
import {
  INTERNAL_FINALIZATION_SIGNATURE_HEADER,
  INTERNAL_FINALIZATION_TIMESTAMP_HEADER,
} from "@/lib/scheduling/finalization-signature";
import {
  getMissingInternalFinalizationEnvVars,
  verifyInternalFinalizationRequest,
} from "@/lib/scheduling/internal-finalization-auth";
import {
  prepareTrendingWallTextIdeas,
  TrendingWallTextPreparationError,
} from "@/lib/trending/trending-wall-text-feed";
import { recordWallTextFailureDiagnostic } from "@/lib/trending/wall-text-db";
import {
  classifyWallTextGenerationFailure,
  getWallTextFailurePrivateMessage,
  WALL_TEXT_DAILY_DELIVERY_SHORTFALL,
  wasWallTextFailureDiagnosticRecorded,
} from "@/lib/trending/wall-text-generation-failure";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_LENGTH = 4_096;

type PrepareWallTextInput = {
  businessProfileId?: unknown;
  businessProfileVersion?: unknown;
  dailyFeedId?: unknown;
  earlyPlanId?: unknown;
  recoveryIteration?: unknown;
  recoveryKey?: unknown;
  refillKey?: unknown;
  requestedCount?: unknown;
  requestKey?: unknown;
  userId?: unknown;
};

export async function POST(request: Request) {
  if (getMissingInternalFinalizationEnvVars().length > 0) {
    return json({ ok: false, error: "Internal job auth is not configured." }, 503);
  }

  const rawBody = await request.text();

  if (!rawBody || Buffer.byteLength(rawBody, "utf8") > MAX_BODY_LENGTH) {
    return json({ ok: false, error: "Invalid request body." }, 400);
  }

  if (
    !verifyInternalFinalizationRequest({
      body: rawBody,
      signature: request.headers.get(INTERNAL_FINALIZATION_SIGNATURE_HEADER),
      timestamp: request.headers.get(INTERNAL_FINALIZATION_TIMESTAMP_HEADER),
    })
  ) {
    return json({ ok: false, error: "Unauthorized." }, 401);
  }

  const input = parseInput(rawBody);

  if (!input) {
    return json({ ok: false, error: "Invalid Wall-of-text job input." }, 400);
  }

  try {
    const profile = await getBusinessProfileForUser(input.userId);

    if (
      !profile ||
      profile.id !== input.businessProfileId ||
      profile.profileVersion !== input.businessProfileVersion
    ) {
      return json({ ok: false, error: "Business Profile changed." }, 409);
    }

    const result = await prepareTrendingWallTextIdeas(profile, {
      dailyFeedId: input.dailyFeedId,
      earlyPlanId: input.earlyPlanId,
      mode: input.refillKey ? "refill" : "initial",
      recoveryIteration: input.recoveryIteration,
      recoveryKey: input.recoveryKey,
      requestedCount: input.requestedCount,
      requestKey: input.requestKey,
    });

    // A daily delivery owns a fixed set of feed slots. Returning a smaller
    // historical-library count must never settle that delivery as complete.
    if (input.dailyFeedId && result.ideaCount !== input.requestedCount) {
      throw new TrendingWallTextPreparationError(
        `Wall-of-text daily delivery prepared ${result.ideaCount} of ${input.requestedCount} required items.`,
        409,
        WALL_TEXT_DAILY_DELIVERY_SHORTFALL,
      );
    }

    return json({ ideaCount: result.ideaCount, ok: true });
  } catch (error) {
    const failure = classifyWallTextGenerationFailure(error);
    if (!wasWallTextFailureDiagnosticRecorded(error)) {
      try {
        await recordWallTextFailureDiagnostic({
          details: failure.diagnostic,
          errorCode: failure.errorCode,
          errorMessage: getWallTextFailurePrivateMessage(error),
          requestKey: input.requestKey,
          retryable: failure.retryable,
          userId: input.userId,
        });
      } catch (diagnosticError) {
        console.error("Could not record private Wall-of-text preparation diagnostic", {
          error: diagnosticError instanceof Error
            ? diagnosticError.message
            : String(diagnosticError),
          requestKey: input.requestKey,
        });
      }
    }

    if (error instanceof TrendingWallTextPreparationError) {
      return json(
        {
          error: "Wall-of-text preparation is temporarily unavailable.",
          errorCode: error.code,
          ok: false,
        },
        error.status,
      );
    }

    console.error("Background Wall-of-text preparation failed", {
      errorCode: failure.errorCode,
      errorMessage: getWallTextFailurePrivateMessage(error),
      errorName: error instanceof Error ? error.name : typeof error,
      recoveryIteration: input.recoveryIteration,
      recoveryKey: input.recoveryKey,
      requestKey: input.requestKey,
      requestedCount: input.requestedCount,
      retryable: failure.retryable,
    });
    return json(
      {
        // This endpoint is worker-only, but retaining a generic body ensures a
        // future caller cannot receive model, database, or provider details.
        error: "Wall-of-text preparation is temporarily unavailable.",
        errorCode: failure.errorCode,
        ok: false,
      },
      failure.retryable ? 500 : 422,
    );
  }
}

function parseInput(rawBody: string) {
  try {
    const input = JSON.parse(rawBody) as PrepareWallTextInput;
    const businessProfileId = getString(input.businessProfileId);
    const dailyFeedId = getOptionalString(input.dailyFeedId);
    const earlyPlanId = getOptionalString(input.earlyPlanId);
    const recoveryKey = getOptionalString(input.recoveryKey);
    const refillKey = getOptionalString(input.refillKey);
    const recoveryIteration =
      input.recoveryIteration === null || input.recoveryIteration === undefined
        ? null
        : input.recoveryIteration;
    const userId = getString(input.userId);
    const businessProfileVersion = input.businessProfileVersion;
    const requestedCount =
      input.requestedCount === null || input.requestedCount === undefined
        ? 6
        : input.requestedCount;
    const requestKey =
      getString(input.requestKey) ||
      (businessProfileId &&
      typeof businessProfileVersion === "number" &&
      Number.isInteger(businessProfileVersion) &&
      businessProfileVersion > 0
        ? [
            "legacy-wall-job",
            businessProfileId,
            `v${businessProfileVersion}`,
            ...(refillKey ? [`refill-${refillKey}`] : []),
          ].join(":")
        : "");

    return businessProfileId &&
      userId &&
      typeof businessProfileVersion === "number" &&
      Number.isInteger(businessProfileVersion) &&
      businessProfileVersion > 0 &&
      typeof requestedCount === "number" &&
      Number.isInteger(requestedCount) &&
      requestedCount >= 1 &&
      requestedCount <= 50 &&
      (recoveryIteration === null ||
        (typeof recoveryIteration === "number" &&
          Number.isInteger(recoveryIteration) &&
          recoveryIteration >= 0 &&
          recoveryIteration <= 20)) &&
      requestKey
      ? {
          businessProfileId,
          businessProfileVersion,
          dailyFeedId,
          earlyPlanId,
          recoveryIteration,
          recoveryKey,
          refillKey,
          requestedCount,
          requestKey,
          userId,
        }
      : null;
  } catch {
    return null;
  }
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 200)
    : "";
}

function getOptionalString(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 200)
    : null;
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
}
