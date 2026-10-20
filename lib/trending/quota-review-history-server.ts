import "server-only";
import { findOwnedDailyTrendingFeed } from "./unified-daily-feed-db";
import { listTrendingCreativeDecisions } from "./creative-decisions";
import { listReviewedTrendingCarousels } from "./daily-feed";
import { listActiveTrendingHookIdeas } from "./hook-video-db";
import { listActiveTrendingWallTextIdeas } from "./wall-text-db";
import { listActiveTrendingReactionIdeas } from "./reaction-feed";
import { toHookSourceRecord } from "./trending-hook-feed";
import { toWallTextSourceRecord } from "./trending-wall-text-feed";
import { listReadyAvatarAssets } from "@/lib/avatars/avatar-storage";
import { getHookVideoTextPosition, parseHookVideoTextPlacement } from "./hook-video-text-placement";
import { createCarouselTrendingFeedProvider, createHookTrendingFeedProvider, createWallTextTrendingFeedProvider, createReactionTrendingFeedProvider } from "./feed-items";
import { assembleQuotaHistory, selectQuotaHistoryPage } from "./quota-review-history";

/** Deliberately read-only: never prepare a feed, mark shown, or record a decision. */
export async function readQuotaReviewHistory(userId: string, feedId: string, before: number | null) {
  const quota = await findOwnedDailyTrendingFeed(feedId, userId);
  if (!quota) return null;
  const decisions = await listTrendingCreativeDecisions(userId, quota.slots.flatMap(slot => slot.assignmentId ? [slot.assignmentId] : []));
  const page = selectQuotaHistoryPage(quota.slots, decisions, before);
  const params = (format: string) => {
    const ids = page.slots.filter(slot => slot.format === format).map(slot => slot.assignmentId!);
    return { userId, businessProfileId: quota.feed.businessProfileId, businessProfileVersion: quota.feed.businessProfileVersion,
      reviewedAssignmentIds: ids, pinnedAssignmentIds: ids };
  };
  const [carousels, hooks, walls, reactions, catalog] = await Promise.all([
    listReviewedTrendingCarousels(userId, params("carousel").reviewedAssignmentIds),
    listActiveTrendingHookIdeas(params("hook_video")),
    listActiveTrendingWallTextIdeas(params("wall_text")),
    listActiveTrendingReactionIdeas(params("reaction")),
    params("hook_video").reviewedAssignmentIds.length ? listReadyAvatarAssets() : Promise.resolve([]),
  ]);
  const placements = new Map(catalog.map(asset => [asset.id, getHookVideoTextPosition(parseHookVideoTextPlacement(asset.hook_text_placement))]));
  const entries = assembleQuotaHistory(page.slots, page.byAssignment, [
    ...createCarouselTrendingFeedProvider(carousels).items,
    ...createHookTrendingFeedProvider(hooks.map(idea => toHookSourceRecord(idea, placements.get(idea.influencerVideoId) ?? null))).items,
    ...createWallTextTrendingFeedProvider(walls.map(toWallTextSourceRecord)).items,
    ...createReactionTrendingFeedProvider(reactions).items,
  ]);
  return { feedId, entries, nextBefore: page.nextBefore, unavailableCount: page.slots.length - entries.length };
}
