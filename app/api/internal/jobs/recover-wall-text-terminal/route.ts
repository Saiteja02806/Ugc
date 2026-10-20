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
import { enqueueTrendingWallTextRefill } from "@/lib/trending/trending-wall-text-feed";
import { requestWallTextDailyTerminalReplacement } from "@/lib/trending/wall-text-early-delivery";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_LENGTH = 4_096;

export async function POST(request: Request) {
  if (getMissingInternalFinalizationEnvVars().length > 0) {
    return json({ ok: false }, 503);
  }

  const body = await request.text();
  if (!body || Buffer.byteLength(body, "utf8") > MAX_BODY_LENGTH) {
    return json({ ok: false }, 400);
  }
  if (!verifyInternalFinalizationRequest({
    body,
    signature: request.headers.get(INTERNAL_FINALIZATION_SIGNATURE_HEADER),
    timestamp: request.headers.get(INTERNAL_FINALIZATION_TIMESTAMP_HEADER),
  })) {
    return json({ ok: false }, 401);
  }

  const input = parseInput(body);
  if (!input) return json({ ok: false }, 400);

  const profile = await getBusinessProfileForUser(input.userId);
  if (!profile || profile.id !== input.businessProfileId || profile.profileVersion !== input.businessProfileVersion) {
    return json({ ok: true, replacementScheduled: false });
  }

  try {
    if (input.dailyFeedId) {
      const retryKey = await requestWallTextDailyTerminalReplacement({
        dailyFeedId: input.dailyFeedId,
        expectedRecoveryKey: input.recoveryKey,
        failedJobId: input.failedJobId,
        userId: input.userId,
      });

      // The worker will now complete and emit the normal reconciliation event.
      // That event first exposes any successfully persisted creatives, then
      // asks for only the remaining empty daily slots under this new retry key.
      return json({
        jobId: null,
        ok: true,
        replacementScheduled: retryKey !== null,
      });
    }

    const replacement = await enqueueTrendingWallTextRefill(profile, {
      recoveryKey: `${input.recoveryKey ?? `profile:${input.businessProfileId}`}:terminal:${input.failedJobId}`,
      refillKey: `terminal:${input.failedJobId}`,
      targetActive: input.requestedCount,
    });
    return json({
      jobId: replacement.status === "scheduled" ? replacement.jobId : null,
      ok: true,
      replacementScheduled: replacement.status === "scheduled",
    });
  } catch (error) {
    console.error("Could not schedule a terminal Wall replacement", {
      error: error instanceof Error ? error.message : String(error),
      failedJobId: input.failedJobId,
    });
    return json({ ok: false }, 503);
  }
}

function parseInput(body: string) {
  try {
    const value = JSON.parse(body) as Record<string, unknown>;
    const businessProfileId = stringValue(value.businessProfileId);
    const dailyFeedId = optionalString(value.dailyFeedId);
    const errorCode = stringValue(value.errorCode);
    const failedJobId = stringValue(value.failedJobId);
    const recoveryKey = optionalString(value.recoveryKey);
    const userId = stringValue(value.userId);
    const businessProfileVersion = value.businessProfileVersion;
    const requestedCount = value.requestedCount;
    if (
      !isUuid(businessProfileId) || (dailyFeedId !== null && !isUuid(dailyFeedId)) || !isUuid(failedJobId) ||
      !userId || ![
        "wall_text_render_fit_rejected",
        "content_retry_exhausted",
        "model_output_refusal",
      ].includes(errorCode) ||
      !Number.isInteger(businessProfileVersion) || typeof businessProfileVersion !== "number" || businessProfileVersion < 1 ||
      !Number.isInteger(requestedCount) || typeof requestedCount !== "number" || requestedCount < 1 || requestedCount > 50
    ) return null;
    return { businessProfileId, businessProfileVersion, dailyFeedId, failedJobId, recoveryKey, requestedCount, userId };
  } catch {
    return null;
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 200) : "";
}

function optionalString(value: unknown) {
  const parsed = stringValue(value);
  return parsed || null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
