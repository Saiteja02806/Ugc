import "server-only";

import { createHash } from "node:crypto";

import type { BusinessProfileRecord } from "@/lib/business-profiles/db";
import { listMediaAssets } from "@/lib/media/media-storage";
import { listReadyAvatarAssets } from "@/lib/avatars/avatar-storage";
import {
  listActiveTrendingHookIdeas,
  listTrendingHookVideoSuggestions,
  type TrendingHookIdeaRecord,
} from "@/lib/trending/hook-video-db";
import {
  TRENDING_HOOK_PROMPT_VERSION,
  TRENDING_HOOK_REACTION_SELECTION_VERSION,
  type TrendingHookPreparationStatus,
} from "@/lib/trending/trending-hook-copy-contract";
import {
  enqueueTrendingHookCopyJob,
  findActiveLegacyTrendingHookCopyJob,
} from "@/lib/trending/trending-hook-copy-jobs";
import {
  attachTrendingHookGenerationChunkJob,
  createOrResumeAndReserveTrendingHookGenerationChunk,
  releaseUnattachedTrendingHookGenerationChunk,
} from "@/lib/trending/trending-hook-generation-runs";
import { getHookPerformanceSignals } from "@/lib/trending/hook-performance";
import { listHookVideoBrowseInventory } from "@/lib/trending/hook-video-sources";
import {
  getHookVideoTextPosition,
  parseHookVideoTextPlacement,
  type HookVideoTextPosition,
} from "@/lib/trending/hook-video-text-placement";
import { selectTrendingHookCandidates } from "@/lib/trending/trending-hook-feed-logic";
import { resolveTrendingVideoSource } from "@/lib/trending/video-source-selection";
import {
  createHookTrendingFeedProvider,
  createUnavailableTrendingFeedProvider,
  type TrendingFeedProviderResult,
  type TrendingHookVideoFeedItem,
  type TrendingHookVideoSourceRecord,
} from "@/lib/trending/feed-items";

export async function prepareTrendingHookIdeas(
  profile: BusinessProfileRecord,
  options: {
    mode?: "initial" | "refill";
    targetActive?: number;
  } = {},
) {
  let mode = options.mode ?? "initial";
  const targetActive = Math.max(Math.trunc(options.targetActive ?? 6), 1);
  const source = await resolveTrendingVideoSource({
    format: "hook_video",
    userId: profile.userId,
  });
  const selectedAssetIds = source.selection
    ? new Set(source.assets.map((asset) => asset.id))
    : null;
  const allExisting = await listTrendingHookVideoSuggestions({
    businessProfileId: profile.id,
    businessProfileVersion: profile.profileVersion,
    promptVersion: TRENDING_HOOK_PROMPT_VERSION,
    userId: profile.userId,
  });
  const existing = selectedAssetIds
    ? allExisting.filter((idea) =>
        selectedAssetIds.has(idea.influencer_video_id),
      )
    : allExisting;
  let activeCount = 0;

  if (existing.length > 0) {
    const allActive = await listActiveTrendingHookIdeas({
      businessProfileId: profile.id,
      businessProfileVersion: profile.profileVersion,
      promptVersion: TRENDING_HOOK_PROMPT_VERSION,
      userId: profile.userId,
    });
    const active = filterHookIdeasBySelectedAssets(
      allActive,
      selectedAssetIds,
    );
    activeCount = active.length;

    if (mode === "initial" && active.length === 0) {
      // Older accounts may have valid historical suggestions but no active
      // assignments left. Treat that as a refill instead of falsely reporting
      // that their feed is ready.
      mode = "refill";
    } else if (mode === "initial" || active.length >= targetActive) {
      return {
        exhausted: false,
        ideaCount: active.length,
        jobId: existing[0]?.generation_job_id ?? null,
        status: "ready" as const,
      };
    }
  }

  const fullInventory = await listHookVideoBrowseInventory(
    profile.userId,
    selectedAssetIds
      ? { mediaAssetIds: [...selectedAssetIds] }
      : undefined,
  );
  const usedVideoIds = new Set(
    existing.map((idea) => idea.influencer_video_id),
  );
  const unusedInventory = fullInventory.filter(
    (entry) => !usedVideoIds.has(entry.video.id),
  );
  // Once the approved Hook library has completed a full rotation, start a new
  // rotation instead of permanently exhausting the user's daily allowance.
  const inventory =
    mode === "refill" && unusedInventory.length > 0
      ? unusedInventory
      : fullInventory;
  const targetValidCount = Math.max(targetActive - activeCount, 1);
  // Keep eligible source metadata available to the durable run, but send only
  // the exact outstanding target to a worker. Backup metadata is not an AI
  // generation attempt; it lets a continuation choose a fresh source if one
  // result still fails the lean technical checks.
  const candidatePoolCount = 600;
  const candidates = selectTrendingHookCandidates(
    inventory,
    candidatePoolCount,
    profile.context,
  );

  if (candidates.length === 0) {
    if (mode === "refill") {
      const active = await listActiveTrendingHookIdeas({
        businessProfileId: profile.id,
        businessProfileVersion: profile.profileVersion,
        promptVersion: TRENDING_HOOK_PROMPT_VERSION,
        userId: profile.userId,
      });

      return {
        exhausted: true,
        ideaCount: filterHookIdeasBySelectedAssets(
          active,
          selectedAssetIds,
        ).length,
        jobId: null,
        status: "ready" as const,
      };
    }

    throw new TrendingHookPreparationError(
      "No reviewed Hook videos with enough business evidence are available.",
      409,
    );
  }

  const sourceSelectionKey = source.selection
    ? createSourceSelectionKey(
        source.selection.selectionKind,
        source.assets.map((asset) => asset.id),
      )
    : null;
  const activeLegacyJob = await findActiveLegacyTrendingHookCopyJob({
    businessProfileId: profile.id,
    businessProfileVersion: profile.profileVersion,
    userId: profile.userId,
  });

  if (activeLegacyJob) {
    return {
      exhausted: false,
      ideaCount: activeCount,
      jobId: activeLegacyJob.id,
      status:
        activeLegacyJob.status === "created" || activeLegacyJob.status === "queued"
          ? "queued"
          : "processing",
    };
  }
  const chunk = await createOrResumeAndReserveTrendingHookGenerationChunk({
    businessProfileId: profile.id,
    businessProfileVersion: profile.profileVersion,
    candidatePool: candidates.map(toHookCopyJobCandidate),
    promptVersion: TRENDING_HOOK_PROMPT_VERSION,
    selectionVersion: TRENDING_HOOK_REACTION_SELECTION_VERSION,
    sourceSelectionKey,
    targetValidCount,
    userId: profile.userId,
  });
  const run = chunk;

  if (chunk.status === "source_exhausted") {
    throw new TrendingHookPreparationError(
      "No unused eligible Hook videos remain to complete this feed.",
      409,
    );
  }

  if (chunk.status === "completed") {
    return {
      exhausted: false,
      ideaCount: activeCount + chunk.completedValidCount,
      jobId: null,
      status: "ready" as const,
    };
  }

  if (!chunk.chunkId || chunk.candidates.length === 0) {
    throw new TrendingHookPreparationError(
      "The Hook generation run could not reserve its next video chunk.",
      503,
    );
  }

  const performanceSignals = await getHookPerformanceSignals({
    businessProfileId: profile.id,
    userId: profile.userId,
  });

  const job = await enqueueTrendingHookCopyJob({
    businessProfile: profile.context,
    businessProfileId: profile.id,
    businessProfileVersion: profile.profileVersion,
    beforeDispatch: async (backgroundJob) => {
      try {
        const attached = await attachTrendingHookGenerationChunkJob({
          backgroundJobId: backgroundJob.id,
          chunkId: chunk.chunkId!,
        });

        if (attached) {
          return;
        }

        throw new Error(
          "The Hook generation run no longer owns this background job.",
        );
      } catch (error) {
        // This is safe after an uncertain RPC result: the database releases
        // only a reservation that has no physical job attached to it.
        await releaseUnattachedTrendingHookGenerationChunk({
          chunkId: chunk.chunkId!,
          errorMessage:
            error instanceof Error
              ? error.message
              : "Could not attach the Hook generation task.",
        }).catch((releaseError) => {
          console.error(
            "Could not release an unattached Hook generation chunk:",
            releaseError,
          );
        });

        throw error;
      }
    },
    candidates: chunk.candidates,
    generationRun: {
      chunkId: chunk.chunkId,
      id: run.id,
      remainingValidCount: chunk.remainingValidCount,
    },
    performanceSignals,
    sourceSelectionKey,
    selectionVersion: TRENDING_HOOK_REACTION_SELECTION_VERSION,
    userId: profile.userId,
  });

  if (job.status === "failed" || job.status === "cancelled") {
    throw new TrendingHookPreparationError(
      job.errorMessage ||
        "The Hook-copy worker could not prepare these ideas.",
      503,
    );
  }

  if (job.status === "completed") {
    throw new TrendingHookPreparationError(
      "The Hook-copy job completed without saving validated ideas.",
      500,
    );
  }

  return {
    exhausted: false,
    ideaCount: 0,
    jobId: job.id,
    status: (
      job.status === "created" || job.status === "queued"
        ? "queued"
        : "processing"
    ) satisfies TrendingHookPreparationStatus,
  };
}

function createSourceSelectionKey(
  selectionKind: "asset" | "group",
  assetIds: string[],
) {
  return createHash("sha256")
    .update(`${selectionKind}:${[...assetIds].sort().join(",")}`)
    .digest("hex")
    .slice(0, 24);
}

export async function getTrendingHookFeedProvider(
  profile: BusinessProfileRecord,
  options: {
    pinnedAssignmentIds?: readonly string[];
  } = {},
): Promise<TrendingFeedProviderResult<TrendingHookVideoFeedItem>> {
  try {
    const pinnedAssignmentIds = new Set(options.pinnedAssignmentIds ?? []);
    const [allIdeas, source, catalogAssets, readyMediaAssets] = await Promise.all([
      listActiveTrendingHookIdeas({
        businessProfileId: profile.id,
        businessProfileVersion: profile.profileVersion,
        pinnedAssignmentIds: options.pinnedAssignmentIds,
        promptVersion: TRENDING_HOOK_PROMPT_VERSION,
        userId: profile.userId,
      }),
      resolveTrendingVideoSource({
        format: "hook_video",
        userId: profile.userId,
      }),
      listReadyAvatarAssets(),
      listMediaAssets({ userId: profile.userId }),
    ]);
    const textPositionByVideoId = new Map(
      catalogAssets.map((asset) => [
        asset.id,
        getHookVideoTextPosition(
          parseHookVideoTextPlacement(asset.hook_text_placement),
        ),
      ]),
    );
    const selectedAssetIds = source.selection
      ? new Set(source.assets.map((asset) => asset.id))
      : null;
    const availableVideoIds = new Set([
      ...catalogAssets.map((asset) => asset.id),
      ...readyMediaAssets
        .filter(
          (asset) =>
            (asset.collection === "influencer" || asset.collection === "video") &&
            asset.mime_type.startsWith("video/"),
        )
        .map((asset) => asset.id),
    ]);
    const ideas = filterHookIdeasBySelectedAssets(
      allIdeas,
      selectedAssetIds,
      pinnedAssignmentIds,
      availableVideoIds,
    );

    if (
      source.selection &&
      selectedAssetIds?.size === 0 &&
      pinnedAssignmentIds.size === 0
    ) {
      return createUnavailableTrendingFeedProvider<TrendingHookVideoFeedItem>(
        "hook_video",
        "The selected Creative Assets source has no available videos.",
      );
    }

    if (ideas.length === 0) {
      return createUnavailableTrendingFeedProvider<TrendingHookVideoFeedItem>(
        "hook_video",
        source.selection
          ? "Hook ideas are being prepared from the selected videos."
          : "Hook ideas are being prepared from the business profile.",
      );
    }

    return createHookTrendingFeedProvider(
      ideas.map((idea) =>
        toHookSourceRecord(
          idea,
          textPositionByVideoId.get(idea.influencerVideoId) ?? null,
        ),
      ),
    );
  } catch (error) {
    console.error("Could not load unified Trending Hook ideas:", error);
    return createUnavailableTrendingFeedProvider<TrendingHookVideoFeedItem>(
      "hook_video",
      "Hook ideas are temporarily unavailable.",
    );
  }
}

function filterHookIdeasBySelectedAssets<
  T extends { assignmentId: string; influencerVideoId: string },
>(
  ideas: T[],
  selectedAssetIds: Set<string> | null,
  pinnedAssignmentIds: Set<string> = new Set(),
  availableVideoIds: Set<string> | null = null,
) {
  return ideas.filter(
    (idea) =>
      (!availableVideoIds || availableVideoIds.has(idea.influencerVideoId)) &&
      (!selectedAssetIds ||
        selectedAssetIds.has(idea.influencerVideoId) ||
        pinnedAssignmentIds.has(idea.assignmentId)),
  );
}

export class TrendingHookPreparationError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "TrendingHookPreparationError";
  }
}

function toHookCopyJobCandidate(
  candidate: ReturnType<typeof selectTrendingHookCandidates>[number],
) {
  return {
    candidateIndex: candidate.candidateIndex,
    durationSeconds: candidate.durationSeconds,
    influencerId: candidate.entry.influencer.id,
    influencerKey: candidate.entry.video.influencerKey,
    influencerName: candidate.entry.influencer.name,
    influencerVideoId: candidate.entry.video.id,
    influencerVideoTitle: candidate.entry.video.title,
    reactionType: candidate.entry.video.reactionType,
    sourceKind: candidate.entry.video.sourceKind,
    sourceDurationSeconds: candidate.sourceDurationSeconds,
    thumbnailUrl: candidate.entry.video.thumbnailUrl,
    trimEnd: candidate.entry.video.trimEnd,
    trimStart: candidate.entry.video.trimStart,
    visualGroup: candidate.entry.video.visualGroup,
  };
}

function toHookSourceRecord(
  idea: TrendingHookIdeaRecord,
  textPosition: HookVideoTextPosition | null,
): TrendingHookVideoSourceRecord {
  return {
    aspectRatio: "9:16",
    assignmentId: idea.assignmentId,
    creativeId: idea.id,
    durationSeconds: idea.durationSeconds,
    feedItemId: idea.assignmentId,
    feedPosition: idea.position,
    feedSource: "new",
    influencerId: idea.influencerId,
    influencerName: idea.influencerName,
    previewSessionEndpoint: `/api/trending/hook-videos/videos/${encodeURIComponent(idea.influencerVideoId)}/preview-session`,
    sourceKind: idea.sourceKind,
    sourceDurationSeconds: idea.sourceDurationSeconds,
    text: {
      fontSize: idea.overlayFontSize,
      hookTextFormatId: idea.hookTextFormatId,
      kind: "hook",
      layoutVersion: idea.overlayLayoutVersion,
      lines: idea.openingLines,
      patternId: idea.patternId,
      placement: textPosition ? "catalog" : "default",
      position: textPosition,
      styleVersion:
        idea.overlayLayoutVersion === "hook-overlay-layout-v2-fixed"
          ? "hook-overlay-v4-fixed-type"
          : "hook-overlay-v3",
      value: idea.hookText,
      writingFormatId: idea.writingFormatId,
    },
    thumbnailUrl: idea.thumbnailUrl,
    title: idea.influencerVideoTitle,
    trimEnd: idea.trimEnd,
    trimStart: idea.trimStart,
    videoId: idea.influencerVideoId,
  };
}
