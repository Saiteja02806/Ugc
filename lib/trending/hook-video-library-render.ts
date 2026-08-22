import "server-only";

import { createHash } from "node:crypto";

import {
  attachQueueMessageToBackgroundJob,
  createBackgroundJobWithCreationResult,
  getBackgroundJobById,
  getMissingBackgroundJobStorageEnvVars,
  markBackgroundJobFailed,
} from "@/lib/jobs/background-jobs";
import { getMissingMediaStorageEnvVars } from "@/lib/media/media-storage";
import type { MediaRatio } from "@/lib/media/types";
import {
  getMissingJobQueueEnvVars,
  getQueueNameForJobType,
  sendJobMessage,
} from "@/lib/queues/job-queue";
import {
  resolveDemoRenderAsset,
  resolveOpeningRenderAsset,
  type RenderableScheduleAsset,
} from "@/lib/scheduling/render-asset-resolution";
import { isTrustedStorageUrl } from "@/lib/storage/storage";
import { getLockedHookAudioForVideo } from "@/lib/trending/hook-audio-db";
import {
  attachHookVideoLibraryRenderJob,
  claimHookVideoLibraryRender,
  markHookVideoLibraryRenderQueueFailed,
} from "@/lib/trending/hook-video-db";
import type { persistHookVideoSelection } from "@/lib/trending/hook-video-service";
import { prepareOwnedHookMediaAsset } from "@/lib/trending/hook-video-sources";
import { getHookVideoTextPosition } from "@/lib/trending/hook-video-text-placement";
import { resolveTrendingTextColor } from "@/lib/trending/text-color";

const COMBINATION_RENDER_JOB_TYPE = "render_schedule_combination" as const;
const videoRatios = new Set<MediaRatio>(["9:16", "1:1", "4:5", "16:9"]);
type CombinationRenderRatio = "9:16" | "1:1" | "4:5" | "16:9";
type HookVideoComposition = Awaited<
  ReturnType<typeof persistHookVideoSelection>
>;

export function getMissingHookVideoLibraryRenderEnvVars() {
  return Array.from(
    new Set([
      ...getMissingBackgroundJobStorageEnvVars(),
      ...getMissingMediaStorageEnvVars(),
      ...getMissingJobQueueEnvVars([COMBINATION_RENDER_JOB_TYPE]),
    ]),
  );
}

export async function queueSavedHookVideoRender(params: {
  composition: HookVideoComposition;
  userId: string;
}) {
  const { composition, userId } = params;
  const ownedHook = await prepareOwnedHookMediaAsset({
    influencerId: composition.source.influencerId,
    sourceKind: composition.source.sourceKind,
    userId,
    videoId: composition.source.id,
  });
  const projectId =
    composition.demo.project_id ??
    ownedHook.project_id ??
    "trending-hook-videos";
  const [resolvedHook, resolvedDemo] = await Promise.all([
    resolveOpeningRenderAsset({ asset: ownedHook, userId }),
    composition.demo.source_type === "demo_upload"
      ? resolveDemoRenderAsset({
          asset: composition.demo,
          projectId,
          userId,
        })
      : resolveOpeningRenderAsset({ asset: composition.demo, userId }),
  ]);

  if (!resolvedHook.ok) {
    throw new HookVideoLibraryRenderError(
      resolvedHook.message,
      resolvedHook.status,
    );
  }

  if (!resolvedDemo.ok) {
    throw new HookVideoLibraryRenderError(
      resolvedDemo.message,
      resolvedDemo.status,
    );
  }

  if (
    !isTrustedStorageUrl(resolvedHook.asset.url) ||
    !isTrustedStorageUrl(resolvedDemo.asset.url)
  ) {
    throw new HookVideoLibraryRenderError(
      "The selected Hook and product videos are not available for rendering.",
      409,
    );
  }

  const hookAudio =
    composition.source.sourceKind === "catalog"
      ? await getLockedHookAudioForVideo({
          hookVideoId: composition.source.id,
        })
      : null;

  if (hookAudio && !isTrustedStorageUrl(hookAudio.audioUrl)) {
    throw new HookVideoLibraryRenderError(
      "The approved Hook sound is not available for rendering.",
      409,
    );
  }

  const editedHookContent =
    composition.creativeEdit?.content.format === "hook_video"
      ? composition.creativeEdit.content
      : null;
  const hookTextPosition =
    editedHookContent?.position ??
    getHookVideoTextPosition(composition.source.hookTextPlacement);
  const hookTextColor = resolveTrendingTextColor(
    editedHookContent?.textColor,
  );
  const ratio = getRenderRatio(resolvedDemo.asset, resolvedHook.asset);
  const compositionFingerprint = createCompositionFingerprint({
    demoUpdatedAt: resolvedDemo.asset.updated_at,
    demoVideoId: resolvedDemo.asset.id,
    hookAudioAssetId: hookAudio?.audioAssetId ?? null,
    hookAudioUrl: hookAudio?.audioUrl ?? null,
    hookSourceVersion:
      composition.source.sourceKind === "catalog"
        ? composition.source.storageKey
        : resolvedHook.asset.updated_at,
    hookText: composition.draft.hookText,
    hookTextColor,
    hookTextFontSize: composition.hookRenderSpec.fontSize,
    hookTextLines: composition.hookRenderSpec.lines,
    hookTextPosition,
    hookTrimEnd: composition.draft.trimEnd,
    hookTrimStart: composition.draft.trimStart,
    hookVideoId: resolvedHook.asset.id,
    ratio,
  });
  let claimed = await claimHookVideoLibraryRender({
    draftId: composition.draft.id,
    renderFingerprint: compositionFingerprint,
    userId,
  });

  if (claimed.renderStatus === "ready" && claimed.renderedVideoUrl) {
    return { draft: claimed, jobId: claimed.renderJobId };
  }

  if (claimed.renderJobId) {
    const existingJob = await getBackgroundJobById(claimed.renderJobId);

    if (
      existingJob &&
      !["cancelled", "failed"].includes(existingJob.status)
    ) {
      return { draft: claimed, jobId: existingJob.id };
    }

    if (claimed.renderId) {
      await markHookVideoLibraryRenderQueueFailed({
        draftId: claimed.id,
        errorMessage: "The previous Hook video render could not continue.",
        renderId: claimed.renderId,
        userId,
      });
      claimed = await claimHookVideoLibraryRender({
        draftId: claimed.id,
        renderFingerprint: compositionFingerprint,
        userId,
      });
    }
  }

  if (!claimed.renderId) {
    throw new HookVideoLibraryRenderError(
      "Could not prepare this saved Hook video.",
      409,
    );
  }

  const renderId = claimed.renderId;
  const creation = await createBackgroundJobWithCreationResult({
    idempotencyKey: `hook-video-library-render:${renderId}`,
    input: {
      autoFinalize: false,
      compositionFingerprint,
      demoVideoId: resolvedDemo.asset.id,
      demoVideoUrl: resolvedDemo.asset.url,
      hookAudio,
      hookText: composition.draft.hookText,
      hookTextColor,
      hookTextFontSize: composition.hookRenderSpec.fontSize,
      hookTextLines: composition.hookRenderSpec.lines,
      hookTextPosition,
      hookTrimEnd: composition.draft.trimEnd,
      hookTrimStart: composition.draft.trimStart,
      hookVideoDraftId: composition.draft.id,
      hookVideoId: resolvedHook.asset.id,
      hookVideoUrl: resolvedHook.asset.url,
      projectId,
      ratio,
      renderId,
      scheduleId: composition.draft.id,
      title: `${composition.draft.influencerName} Hook video`.slice(0, 140),
      userId,
    },
    jobType: COMBINATION_RENDER_JOB_TYPE,
    projectId,
    queueName: getQueueNameForJobType(COMBINATION_RENDER_JOB_TYPE),
    userId,
  });

  await attachHookVideoLibraryRenderJob({
    draftId: composition.draft.id,
    jobId: creation.job.id,
    renderId,
    userId,
  });

  try {
    const message = await sendJobMessage({
      jobId: creation.job.id,
      jobType: COMBINATION_RENDER_JOB_TYPE,
    });
    await attachQueueMessageToBackgroundJob({
      jobId: creation.job.id,
      queueMessageId: message.messageId,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Could not queue the render.";

    await Promise.allSettled([
      markBackgroundJobFailed({
        errorMessage,
        jobId: creation.job.id,
      }),
      markHookVideoLibraryRenderQueueFailed({
        draftId: composition.draft.id,
        errorMessage,
        renderId,
        userId,
      }),
    ]);

    throw new HookVideoLibraryRenderError(
      "Could not start preparing this saved Hook video.",
      500,
    );
  }

  return {
    draft: await claimHookVideoLibraryRender({
      draftId: composition.draft.id,
      renderFingerprint: compositionFingerprint,
      userId,
    }),
    jobId: creation.job.id,
  };
}

export class HookVideoLibraryRenderError extends Error {
  constructor(
    message: string,
    readonly status: 404 | 409 | 500 | 503 = 500,
  ) {
    super(message);
    this.name = "HookVideoLibraryRenderError";
  }
}

function getRenderRatio(
  demoAsset: RenderableScheduleAsset,
  hookAsset: RenderableScheduleAsset,
): CombinationRenderRatio {
  if (videoRatios.has(demoAsset.ratio)) {
    return demoAsset.ratio as CombinationRenderRatio;
  }

  if (videoRatios.has(hookAsset.ratio)) {
    return hookAsset.ratio as CombinationRenderRatio;
  }

  return "9:16";
}

function createCompositionFingerprint(value: {
  demoUpdatedAt: string;
  demoVideoId: string;
  hookAudioAssetId: string | null;
  hookAudioUrl: string | null;
  hookSourceVersion: string;
  hookText: string;
  hookTextColor: string;
  hookTextFontSize: number | null;
  hookTextLines: string[];
  hookTextPosition: { x: number; y: number } | null;
  hookTrimEnd: number | null;
  hookTrimStart: number;
  hookVideoId: string;
  ratio: CombinationRenderRatio;
}) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
