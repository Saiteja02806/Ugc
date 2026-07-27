import "server-only";

import type { BusinessProfileRecord } from "@/lib/business-profiles/db";
import {
  generateBusinessTrendingHookTexts,
} from "@/lib/trending/generate-trending-hook-ideas";
import {
  createTrendingHookVideoSuggestions,
  ensureTrendingHookVideoAssignments,
  listActiveTrendingHookIdeas,
  listTrendingHookVideoSuggestions,
  type TrendingHookIdeaRecord,
} from "@/lib/trending/hook-video-db";
import { listHookVideoBrowseInventory } from "@/lib/trending/hook-video-sources";
import { selectTrendingHookCandidates } from "@/lib/trending/trending-hook-feed-logic";
import type { GeneratedTrendingHookText } from "@/lib/trending/trending-hook-text-logic";
import {
  createHookTrendingFeedProvider,
  createUnavailableTrendingFeedProvider,
  type TrendingFeedProviderResult,
  type TrendingHookVideoFeedItem,
  type TrendingHookVideoSourceRecord,
} from "@/lib/trending/feed-items";

export async function prepareTrendingHookIdeas(
  profile: BusinessProfileRecord,
) {
  const existing = await listTrendingHookVideoSuggestions({
    businessProfileId: profile.id,
    businessProfileVersion: profile.profileVersion,
    userId: profile.userId,
  });

  if (existing.length > 0) {
    return ensureTrendingHookVideoAssignments({
      businessProfileId: profile.id,
      businessProfileVersion: profile.profileVersion,
      suggestions: existing,
      userId: profile.userId,
    });
  }

  const inventory = await listHookVideoBrowseInventory(profile.userId);
  const candidates = selectTrendingHookCandidates(inventory);

  if (candidates.length === 0) {
    throw new TrendingHookPreparationError(
      "No vertical Hook videos with valid duration metadata are available.",
      409,
    );
  }

  const generated = await generateBusinessTrendingHookTexts({
    business: profile.context,
    candidates: candidates.map((candidate) => ({
      candidateIndex: candidate.candidateIndex,
      durationSeconds: candidate.durationSeconds,
    })),
  });
  const generatedByIndex = new Map(
    generated.map((hook) => [hook.candidateIndex, hook]),
  );
  const suggestions = await createTrendingHookVideoSuggestions({
    businessProfileId: profile.id,
    businessProfileVersion: profile.profileVersion,
    candidates: candidates.map((candidate) =>
      toStoredTrendingHookCandidate(
        candidate,
        getGeneratedHook(generatedByIndex, candidate.candidateIndex),
      ),
    ),
    userId: profile.userId,
  });

  return ensureTrendingHookVideoAssignments({
    businessProfileId: profile.id,
    businessProfileVersion: profile.profileVersion,
    suggestions,
    userId: profile.userId,
  });
}

export async function getTrendingHookFeedProvider(
  profile: BusinessProfileRecord,
): Promise<TrendingFeedProviderResult<TrendingHookVideoFeedItem>> {
  try {
    const ideas = await listActiveTrendingHookIdeas({
      businessProfileId: profile.id,
      businessProfileVersion: profile.profileVersion,
      userId: profile.userId,
    });

    if (ideas.length === 0) {
      return createUnavailableTrendingFeedProvider<TrendingHookVideoFeedItem>(
        "hook_video",
        "Hook ideas are being prepared from the business profile.",
      );
    }

    return createHookTrendingFeedProvider(ideas.map(toHookSourceRecord));
  } catch (error) {
    console.error("Could not load unified Trending Hook ideas:", error);
    return createUnavailableTrendingFeedProvider<TrendingHookVideoFeedItem>(
      "hook_video",
      "Hook ideas are temporarily unavailable.",
    );
  }
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

function getGeneratedHook(
  generatedByIndex: Map<number, GeneratedTrendingHookText>,
  candidateIndex: number,
) {
  const generated = generatedByIndex.get(candidateIndex);

  if (!generated) {
    throw new Error("A generated Trending Hook idea is missing.");
  }

  return generated;
}

function toStoredTrendingHookCandidate(
  candidate: ReturnType<typeof selectTrendingHookCandidates>[number],
  generated: GeneratedTrendingHookText,
) {
  return {
    candidateIndex: candidate.candidateIndex,
    durationSeconds: candidate.durationSeconds,
    hookText: generated.text,
    influencerId: candidate.entry.influencer.id,
    influencerName: candidate.entry.influencer.name,
    influencerVideoId: candidate.entry.video.id,
    influencerVideoTitle: candidate.entry.video.title,
    sourceKind: candidate.entry.video.sourceKind,
    sourceDurationSeconds: candidate.sourceDurationSeconds,
    thumbnailUrl: candidate.entry.video.thumbnailUrl,
    trimEnd: candidate.entry.video.trimEnd,
    trimStart: candidate.entry.video.trimStart,
  };
}

function toHookSourceRecord(
  idea: TrendingHookIdeaRecord,
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
      kind: "hook",
      placement: "center",
      styleVersion: "hook-overlay-v1",
      value: idea.hookText,
    },
    thumbnailUrl: idea.thumbnailUrl,
    title: idea.influencerVideoTitle,
    trimEnd: idea.trimEnd,
    trimStart: idea.trimStart,
    videoId: idea.influencerVideoId,
  };
}
