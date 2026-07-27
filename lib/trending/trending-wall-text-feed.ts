import "server-only";

import type { BusinessProfileRecord } from "@/lib/business-profiles/db";
import {
  generateBusinessTrendingWallTextIdeas,
  getTrendingWallTextModelName,
} from "@/lib/trending/generate-trending-wall-text-ideas";
import {
  createTrendingWallTextCreatives,
  ensureTrendingWallTextAssignments,
  listRecentWallTextBackgroundAssetIds,
  listTrendingWallTextCreatives,
  listWallTextVideoAssetInventory,
} from "@/lib/trending/wall-text-db";
import {
  selectTrendingWallTextCandidates,
} from "@/lib/trending/wall-text-feed-logic";

export async function prepareTrendingWallTextIdeas(
  profile: BusinessProfileRecord,
) {
  const existing = await listTrendingWallTextCreatives({
    businessProfileId: profile.id,
    businessProfileVersion: profile.profileVersion,
    userId: profile.userId,
  });

  if (existing.length > 0) {
    return ensureTrendingWallTextAssignments({
      businessProfileId: profile.id,
      businessProfileVersion: profile.profileVersion,
      creatives: existing,
      userId: profile.userId,
    });
  }

  const [inventory, recentlyUsedAssetIds] = await Promise.all([
    listWallTextVideoAssetInventory(),
    listRecentWallTextBackgroundAssetIds({ userId: profile.userId }),
  ]);
  const freshInventory = inventory.filter(
    (asset) => !recentlyUsedAssetIds.has(asset.id),
  );
  const freshCandidates = selectTrendingWallTextCandidates(freshInventory);
  const candidates =
    freshCandidates.length > 0
      ? freshCandidates
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

  try {
    creatives = await createTrendingWallTextCreatives({
      businessProfileId: profile.id,
      businessProfileVersion: profile.profileVersion,
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
