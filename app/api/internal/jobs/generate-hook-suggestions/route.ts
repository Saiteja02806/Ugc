import { NextResponse } from "next/server";

import { getBusinessProfileForUser } from "@/lib/business-profiles/db";
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
  createHookVideoSuggestions,
  listHookVideoSuggestionsForJob,
} from "@/lib/trending/hook-video-db";
import { generateBusinessHookSuggestions } from "@/lib/trending/generate-hook-suggestions";
import {
  getHookDemoAsset,
  getHookInfluencerForUser,
  resolveHookVideoSource,
} from "@/lib/trending/hook-video-sources";
import { HookSuggestionRequestSchema } from "@/lib/trending/hook-video-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    return json({ error: "Invalid Hook suggestion job input.", ok: false }, 400);
  }

  try {
    const job = await getBackgroundJobById(jobId);

    if (
      !job ||
      job.jobType !== "hook_text_generation" ||
      !job.userId ||
      !["processing", "waiting_external_service"].includes(job.status)
    ) {
      return json({ error: "Hook suggestion job is not executable.", ok: false }, 409);
    }

    const input = getRecord(job.input);
    const parsed = HookSuggestionRequestSchema.safeParse({
      demoAssetId: input?.demoAssetId,
      influencerId: input?.influencerId,
      influencerVideoId: input?.influencerVideoId,
      sourceKind: input?.sourceKind,
    });

    if (
      !input ||
      input.operation !== "composition_suggestions" ||
      input.userId !== job.userId ||
      !parsed.success
    ) {
      return json({ error: "Hook suggestion job input is invalid.", ok: false }, 400);
    }

    const profile = await getBusinessProfileForUser(job.userId);

    if (!profile) {
      return json({ error: "Business profile is required.", ok: false }, 409);
    }

    const existingSuggestions = await listHookVideoSuggestionsForJob({
      generationJobId: job.id,
      userId: job.userId,
    });

    if (existingSuggestions.length > 0) {
      return json({
        demoAssetId: parsed.data.demoAssetId,
        influencerId: parsed.data.influencerId,
        influencerVideoId: parsed.data.influencerVideoId,
        ok: true,
        operation: "composition_suggestions",
        suggestions: existingSuggestions,
      });
    }

    const [influencer, source, demo] = await Promise.all([
      getHookInfluencerForUser({
        influencerId: parsed.data.influencerId,
        sourceKind: parsed.data.sourceKind,
        userId: job.userId,
      }),
      resolveHookVideoSource({
        influencerId: parsed.data.influencerId,
        sourceKind: parsed.data.sourceKind,
        userId: job.userId,
        videoId: parsed.data.influencerVideoId,
      }),
      getHookDemoAsset({
        assetId: parsed.data.demoAssetId,
        userId: job.userId,
      }),
    ]);
    const texts = await generateBusinessHookSuggestions({
      business: profile.context,
      demoTitle: demo.title,
      influencerName: influencer.name,
    });
    const suggestions = await createHookVideoSuggestions({
      businessProfileId: profile.id,
      demoAssetId: demo.id,
      generationJobId: job.id,
      influencerId: influencer.id,
      influencerVideoId: source.id,
      sourceKind: source.sourceKind,
      texts,
      userId: job.userId,
    });

    return json({
      demoAssetId: demo.id,
      influencerId: influencer.id,
      influencerVideoId: source.id,
      ok: true,
      operation: "composition_suggestions",
      suggestions,
    });
  } catch (error) {
    console.error("Background Hook suggestion generation failed:", error);
    return json({ error: "Hook suggestion generation failed.", ok: false }, 500);
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
