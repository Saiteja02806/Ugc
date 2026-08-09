import { randomUUID } from "node:crypto";

import { getBusinessProfileForUser } from "@/lib/business-profiles/db";
import { getBusinessProfileOnboardingGate } from "@/lib/business-profiles/onboarding-access";
import { getPublicBackgroundJob } from "@/lib/jobs/background-job-contract";
import { getMissingBackgroundJobStorageEnvVars } from "@/lib/jobs/background-jobs";
import { getMissingBackgroundJobCloudTasksEnvVars } from "@/lib/jobs/gcp-cloud-tasks";
import {
  authenticateHookVideoRequest,
  hookVideoErrorResponse,
  hookVideoJson,
} from "@/lib/trending/hook-video-api";
import { enqueueHookSuggestionJob } from "@/lib/trending/hook-suggestion-jobs";
import { getHookPerformanceSignals } from "@/lib/trending/hook-performance";
import {
  getHookDemoAsset,
  getHookInfluencerForUser,
  resolveHookVideoSource,
} from "@/lib/trending/hook-video-sources";
import { HookSuggestionRequestSchema } from "@/lib/trending/hook-video-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await authenticateHookVideoRequest(request);

  if (!auth.ok) {
    return auth.response;
  }

  const parsed = HookSuggestionRequestSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return hookVideoJson(
      { error: "Choose an influencer video and product demo first.", ok: false },
      400,
    );
  }

  try {
    const profile = await getBusinessProfileForUser(auth.user.uid);
    const onboardingGate = getBusinessProfileOnboardingGate(profile);

    if (onboardingGate || !profile) {
      return hookVideoJson(
        {
          code: onboardingGate?.code ?? "onboarding_required",
          error:
            onboardingGate?.message ??
            "Complete the required business onboarding before using Trending.",
          ok: false,
        },
        onboardingGate?.status ?? 409,
      );
    }

    const missing = Array.from(
      new Set([
        ...getMissingBackgroundJobStorageEnvVars(),
        ...getMissingBackgroundJobCloudTasksEnvVars(["hook_text_generation"]),
      ]),
    );

    if (missing.length > 0) {
      return hookVideoJson(
        {
          error: `Hook generation jobs are not configured. Add ${missing.join(", ")}.`,
          ok: false,
        },
        501,
      );
    }

    const idempotencyKey =
      request.headers.get("Idempotency-Key")?.trim().slice(0, 200) ||
      randomUUID();
    const [demo, influencer, performanceSignals, source] = await Promise.all([
      getHookDemoAsset({
        assetId: parsed.data.demoAssetId,
        userId: auth.user.uid,
      }),
      getHookInfluencerForUser({
        influencerId: parsed.data.influencerId,
        sourceKind: parsed.data.sourceKind,
        userId: auth.user.uid,
      }),
      getHookPerformanceSignals({
        businessProfileId: profile.id,
        userId: auth.user.uid,
      }),
      resolveHookVideoSource({
        influencerId: parsed.data.influencerId,
        sourceKind: parsed.data.sourceKind,
        userId: auth.user.uid,
        videoId: parsed.data.influencerVideoId,
      }),
    ]);
    const sourceDurationSeconds = source.durationSeconds;
    const trimEnd = source.trimEnd ?? sourceDurationSeconds;
    const durationSeconds =
      sourceDurationSeconds === null || trimEnd === null
        ? null
        : trimEnd - source.trimStart;

    if (
      sourceDurationSeconds === null ||
      durationSeconds === null ||
      !Number.isFinite(durationSeconds) ||
      durationSeconds <= 0
    ) {
      return hookVideoJson(
        {
          error: "This influencer video is still missing its duration.",
          ok: false,
        },
        409,
      );
    }

    const job = await enqueueHookSuggestionJob({
      generationContext: {
        businessProfile: profile.context,
        businessProfileId: profile.id,
        businessProfileVersion: profile.profileVersion,
        candidate: {
          durationSeconds,
          influencerId: influencer.id,
          influencerKey: source.influencerKey,
          influencerName: influencer.name,
          influencerVideoId: source.id,
          influencerVideoTitle: source.title,
          reactionType: source.reactionType,
          sourceDurationSeconds,
          sourceKind: source.sourceKind,
          thumbnailUrl: source.thumbnailUrl,
          trimEnd,
          trimStart: source.trimStart,
          visualGroup: source.visualGroup,
        },
        performanceSignals,
      },
      idempotencyKey,
      input: { ...parsed.data, demoAssetId: demo.id },
      userId: auth.user.uid,
    });

    return hookVideoJson(
      {
        job: getPublicBackgroundJob(job),
        jobId: job.id,
        ok: true,
      },
      job.status === "completed" ? 200 : 202,
    );
  } catch (error) {
    console.error("Could not queue Hook suggestions:", error);
    return hookVideoErrorResponse(error, "Could not start Hook generation.");
  }
}
