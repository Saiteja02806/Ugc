import { NextResponse } from "next/server";

import {
  listInstagramAccountInsightsForOwner,
  type InstagramInsightsRangeDays,
} from "@/lib/analytics/instagram";
import { listInstagramContentInsightsForOwner } from "@/lib/analytics/instagram-content";
import { listTikTokPublicVideoAnalyticsForOwner } from "@/lib/analytics/tiktok";
import { getBackgroundJobById, type Json } from "@/lib/jobs/background-jobs";
import {
  INTERNAL_FINALIZATION_SIGNATURE_HEADER,
  INTERNAL_FINALIZATION_TIMESTAMP_HEADER,
} from "@/lib/scheduling/finalization-signature";
import {
  getMissingInternalFinalizationEnvVars,
  verifyInternalFinalizationRequest,
} from "@/lib/scheduling/internal-finalization-auth";
import {
  recordInstagramHookPerformance,
  recordTikTokHookPerformance,
} from "@/lib/trending/hook-performance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supportedRanges = new Set<InstagramInsightsRangeDays>([7, 30, 90]);

export async function POST(request: Request) {
  if (getMissingInternalFinalizationEnvVars().length > 0) {
    return json({ error: "Internal job auth is not configured.", ok: false }, 503);
  }

  const rawBody = await request.text();

  if (
    !rawBody ||
    Buffer.byteLength(rawBody, "utf8") > 2_048 ||
    !verifyInternalFinalizationRequest({
      body: rawBody,
      signature: request.headers.get(INTERNAL_FINALIZATION_SIGNATURE_HEADER),
      timestamp: request.headers.get(INTERNAL_FINALIZATION_TIMESTAMP_HEADER),
    })
  ) {
    return json({ error: "Unauthorized.", ok: false }, 401);
  }

  const jobId = parseJobId(rawBody);

  if (!jobId) {
    return json({ error: "Invalid analytics job input.", ok: false }, 400);
  }

  try {
    const job = await getBackgroundJobById(jobId);

    if (
      !job ||
      job.jobType !== "analytics_sync" ||
      !job.userId ||
      !["processing", "waiting_external_service"].includes(job.status)
    ) {
      return json({ error: "Analytics job is not executable.", ok: false }, 409);
    }

    // Keep the authenticated owner in a local constant. TypeScript cannot carry
    // the earlier null check through the async callbacks used for attribution.
    const userId = job.userId;

    const input = getRecord(job.input);

    if (!input || input.userId !== userId) {
      return json({ error: "Analytics job ownership does not match.", ok: false }, 409);
    }

    if (input.operation === "tiktok_videos") {
      const accounts = await listTikTokPublicVideoAnalyticsForOwner({
        userId,
      });

      await recordHookPerformanceSafely(() =>
        recordTikTokHookPerformance({ accounts, userId }),
      );

      return json({ accounts, ok: true, operation: input.operation });
    }

    const days = Number(input.days);

    if (!supportedRanges.has(days as InstagramInsightsRangeDays)) {
      return json({ error: "Analytics date range is invalid.", ok: false }, 400);
    }

    if (input.operation === "instagram_insights") {
      const accounts = await listInstagramAccountInsightsForOwner({
        days: days as InstagramInsightsRangeDays,
        userId,
      });

      return json({ accounts, days, ok: true, operation: input.operation });
    }

    if (input.operation === "instagram_content") {
      const accounts = await listInstagramContentInsightsForOwner({
        days: days as InstagramInsightsRangeDays,
        userId,
      });

      await recordHookPerformanceSafely(() =>
        recordInstagramHookPerformance({ accounts, userId }),
      );

      return json({ accounts, days, ok: true, operation: input.operation });
    }

    return json({ error: "Unsupported analytics operation.", ok: false }, 400);
  } catch (error) {
    console.error("Background analytics synchronization failed:", error);
    return json({ error: "Analytics synchronization failed.", ok: false }, 500);
  }
}

async function recordHookPerformanceSafely(
  record: () => Promise<unknown>,
) {
  try {
    await record();
  } catch (error) {
    console.error(
      "Published analytics loaded, but Hook attribution could not be stored:",
      error,
    );
  }
}

function parseJobId(rawBody: string) {
  try {
    const value = JSON.parse(rawBody) as { jobId?: unknown };
    return typeof value.jobId === "string" ? value.jobId.trim() : "";
  } catch {
    return "";
  }
}

function getRecord(value: Json) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : null;
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
}
