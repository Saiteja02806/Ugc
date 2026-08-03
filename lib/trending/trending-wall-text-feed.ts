import "server-only";

import type { BusinessProfileRecord } from "@/lib/business-profiles/db";
import {
  generateBusinessTrendingWallTextIdeas,
  getTrendingWallTextModelName,
} from "@/lib/trending/generate-trending-wall-text-ideas";
import {
  areTrendingWallTextCreativesCurrent,
  createTrendingWallTextCreatives,
  ensureWallTextOverlayAssetsForMediaAssets,
  ensureTrendingWallTextAssignments,
  getNextWallTextCandidateIndex,
  isTrendingWallTextCreativeCurrent,
  listActiveTrendingWallTextIdeas,
  listRecentWallTextBackgroundAssetIds,
  listTrendingWallTextCreatives,
  listWallTextOverlayAssetsForMediaAssetIds,
  listWallTextVideoAssetInventory,
  replaceTrendingWallTextCreativeCopy,
  type WallTextCreativeRow,
} from "@/lib/trending/wall-text-db";
import {
  createUnavailableTrendingFeedProvider,
  createWallTextTrendingFeedProvider,
  type TrendingFeedProviderResult,
  type TrendingWallTextFeedItem,
  type TrendingWallTextSourceRecord,
} from "@/lib/trending/feed-items";
import {
  createWallTextLayout,
  selectTrendingWallTextCandidates,
} from "@/lib/trending/wall-text-feed-logic";
import { getWallTextPreviewTitle } from "@/lib/trending/wall-text-text-logic";
import { resolveTrendingVideoSource } from "@/lib/trending/video-source-selection";

export async function prepareTrendingWallTextIdeas(
  profile: BusinessProfileRecord,
) {
  const source = await resolveTrendingVideoSource({
    format: "wall_text",
    userId: profile.userId,
  });
  const selectedInventory = source.selection
    ? await ensureWallTextOverlayAssetsForMediaAssets({
        assets: source.assets,
        userId: profile.userId,
      })
    : null;
  const selectedBackgroundAssetIds = selectedInventory?.map(
    (asset) => asset.id,
  );
  const existing = await listTrendingWallTextCreatives({
    backgroundAssetIds: selectedBackgroundAssetIds,
    businessProfileId: profile.id,
    businessProfileVersion: profile.profileVersion,
    userId: profile.userId,
  });

  if (areTrendingWallTextCreativesCurrent(existing)) {
    return ensureTrendingWallTextAssignments({
      businessProfileId: profile.id,
      businessProfileVersion: profile.profileVersion,
      creatives: existing,
      userId: profile.userId,
    });
  }

  if (existing.length > 0) {
    const inventory =
      selectedInventory ?? (await listWallTextVideoAssetInventory());

    return regenerateExistingTrendingWallTextIdeas(
      profile,
      existing,
      inventory,
    );
  }

  const [inventory, recentBackgrounds] = await Promise.all([
    selectedInventory ?? listWallTextVideoAssetInventory(),
    listRecentWallTextBackgroundAssetIds({ userId: profile.userId }),
  ]);
  const groupFreshInventory = inventory.filter(
    (asset) =>
      !recentBackgrounds.assetIds.has(asset.id) &&
      !recentBackgrounds.visualGroups.has(asset.visualGroup ?? ""),
  );
  const assetFreshInventory = inventory.filter(
    (asset) => !recentBackgrounds.assetIds.has(asset.id),
  );
  const groupFreshCandidates =
    selectTrendingWallTextCandidates(groupFreshInventory);
  const assetFreshCandidates =
    selectTrendingWallTextCandidates(assetFreshInventory);
  const candidates =
    groupFreshCandidates.length >= 6
      ? groupFreshCandidates
      : assetFreshCandidates.length > 0
        ? assetFreshCandidates
      : selectTrendingWallTextCandidates(inventory);

  if (candidates.length === 0) {
    throw new TrendingWallTextPreparationError(
      "No active 9:16 Wall-of-text background videos are available yet.",
      409,
    );
  }

  const generated = await generateBusinessTrendingWallTextIdeas({
    business: profile.context,
    candidates: candidates.map((candidate) => ({
      candidateIndex: candidate.candidateIndex,
      durationSeconds: candidate.durationSeconds,
    })),
  });
  const generatedByIndex = new Map(
    generated.map((idea) => [idea.candidateIndex, idea.content]),
  );
  let creatives: Awaited<
    ReturnType<typeof createTrendingWallTextCreatives>
  >;
  const candidateIndexOffset = source.selection
    ? await getNextWallTextCandidateIndex({
        businessProfileId: profile.id,
        businessProfileVersion: profile.profileVersion,
        userId: profile.userId,
      })
    : 0;

  try {
    creatives = await createTrendingWallTextCreatives({
      businessProfileId: profile.id,
      businessProfileVersion: profile.profileVersion,
      candidateIndexOffset,
      candidates: candidates.map((candidate) => ({
        backgroundAssetId: candidate.entry.id,
        candidateIndex: candidate.candidateIndex,
        durationSeconds: candidate.durationSeconds,
        layout: candidate.layout,
        text: getGeneratedWallText(
          generatedByIndex,
          candidate.candidateIndex,
        ),
      })),
      generatorModel: getTrendingWallTextModelName(),
      userId: profile.userId,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("wall_text_business_profile_changed")
    ) {
      throw new TrendingWallTextPreparationError(
        "Your Business Profile changed while Wall-of-text ideas were being prepared. Refresh and try again.",
        409,
      );
    }

    if (
      error instanceof Error &&
      error.message.includes("wall_text_background_not_ready")
    ) {
      throw new TrendingWallTextPreparationError(
        "A selected Wall-of-text background is no longer available. Try preparing again.",
        409,
      );
    }

    throw error;
  }

  return ensureTrendingWallTextAssignments({
    businessProfileId: profile.id,
    businessProfileVersion: profile.profileVersion,
    creatives,
    userId: profile.userId,
  });
}

export async function getTrendingWallTextFeedProvider(
  profile: BusinessProfileRecord,
): Promise<TrendingFeedProviderResult<TrendingWallTextFeedItem>> {
  try {
    const source = await resolveTrendingVideoSource({
      format: "wall_text",
      userId: profile.userId,
    });
    const selectedInventory = source.selection
      ? await listWallTextOverlayAssetsForMediaAssetIds({
          mediaAssetIds: source.assets.map((asset) => asset.id),
          userId: profile.userId,
        })
      : null;
    const backgroundAssetIds = selectedInventory?.map((asset) => asset.id);
    const [creatives, ideas] = await Promise.all([
      listTrendingWallTextCreatives({
        backgroundAssetIds,
        businessProfileId: profile.id,
        businessProfileVersion: profile.profileVersion,
        userId: profile.userId,
      }),
      listActiveTrendingWallTextIdeas({
        backgroundAssetIds,
        businessProfileId: profile.id,
        businessProfileVersion: profile.profileVersion,
        userId: profile.userId,
      }),
    ]);

    if (source.selection && source.assets.length === 0) {
      return createUnavailableTrendingFeedProvider<TrendingWallTextFeedItem>(
        "wall_text",
        "The selected Creative Assets source has no available videos.",
      );
    }

    if (
      creatives.length > 0 &&
      !areTrendingWallTextCreativesCurrent(creatives)
    ) {
      return createUnavailableTrendingFeedProvider<TrendingWallTextFeedItem>(
        "wall_text",
        "Wall-of-text ideas are being refreshed with the latest format.",
      );
    }

    if (ideas.length === 0) {
      return createUnavailableTrendingFeedProvider<TrendingWallTextFeedItem>(
        "wall_text",
        source.selection
          ? "Wall-of-text ideas are being prepared from the selected videos."
          : "Wall-of-text ideas are being prepared from the business profile.",
      );
    }

    return createWallTextTrendingFeedProvider(
      ideas.map(toWallTextSourceRecord),
    );
  } catch (error) {
    console.error("Could not load unified Trending Wall-of-text ideas:", error);
    return createUnavailableTrendingFeedProvider<TrendingWallTextFeedItem>(
      "wall_text",
      "Wall-of-text ideas are temporarily unavailable.",
    );
  }
}

export class TrendingWallTextPreparationError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "TrendingWallTextPreparationError";
  }
}

function getGeneratedWallText(
  generatedByIndex: Map<
    number,
    Awaited<
      ReturnType<typeof generateBusinessTrendingWallTextIdeas>
    >[number]["content"]
  >,
  candidateIndex: number,
) {
  const generated = generatedByIndex.get(candidateIndex);

  if (!generated) {
    throw new Error("A generated Trending Wall-of-text idea is missing.");
  }

  return generated;
}

function toWallTextSourceRecord(
  idea: Awaited<ReturnType<typeof listActiveTrendingWallTextIdeas>>[number],
): TrendingWallTextSourceRecord {
  return {
    aspectRatio: "9:16",
    assignmentId: idea.assignmentId,
    creativeId: idea.id,
    durationSeconds: idea.durationSeconds,
    feedItemId: idea.assignmentId,
    feedPosition: idea.position,
    feedSource: "new",
    layout: idea.layout,
    previewUrl: idea.previewUrl,
    text: idea.text,
    thumbnailUrl: idea.thumbnailUrl,
    title: getWallTextPreviewTitle(idea.text.fullText),
  };
}

async function regenerateExistingTrendingWallTextIdeas(
  profile: BusinessProfileRecord,
  existing: WallTextCreativeRow[],
  inventory: Awaited<ReturnType<typeof listWallTextVideoAssetInventory>>,
) {
  const staleCreatives = existing.filter(
    (creative) => !isTrendingWallTextCreativeCurrent(creative),
  );

  if (staleCreatives.length === 0) {
    return ensureTrendingWallTextAssignments({
      businessProfileId: profile.id,
      businessProfileVersion: profile.profileVersion,
      creatives: existing,
      userId: profile.userId,
    });
  }

  const generated = await generateBusinessTrendingWallTextIdeas({
    business: profile.context,
    candidates: staleCreatives.map((creative) => ({
      candidateIndex: creative.candidate_index,
      durationSeconds: creative.duration_seconds,
    })),
  });
  const generatedByIndex = new Map(
    generated.map((idea) => [idea.candidateIndex, idea.content]),
  );
  const creatives = await replaceTrendingWallTextCreativeCopy({
    businessProfileId: profile.id,
    businessProfileVersion: profile.profileVersion,
    creatives: staleCreatives.map((creative) => {
      const background = inventory.find(
        (asset) => asset.id === creative.overlay_media_asset_id,
      );

      if (!background) {
        throw new TrendingWallTextPreparationError(
          "A Wall-of-text background is no longer eligible for safe text placement.",
          409,
        );
      }

      return {
        candidateIndex: creative.candidate_index,
        id: creative.id,
        layout: createWallTextLayout(background),
        text: getGeneratedWallText(
          generatedByIndex,
          creative.candidate_index,
        ),
      };
    }),
    generatorModel: getTrendingWallTextModelName(),
    userId: profile.userId,
  });

  return ensureTrendingWallTextAssignments({
    businessProfileId: profile.id,
    businessProfileVersion: profile.profileVersion,
    creatives,
    userId: profile.userId,
  });
}
