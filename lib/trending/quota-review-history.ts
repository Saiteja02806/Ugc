import type { TrendingFeedItem } from "./feed-items";
import type { ReviewedPost } from "./post-review-history";
import { isRecoverableTrendingReview, type ReviewedTrendingCandidate } from "./reviewed-feed-candidate";
import type { DailyTrendingFeedSlotRecord } from "./unified-daily-feed-db";

export const QUOTA_HISTORY_PAGE_SIZE = 20;
export type QuotaDecision = { assignment_id: string; creative_id: string; format: string; decision: "accepted" | "rejected"; decided_at: string };

/** Slot order is stable even if a user reconsiders a decision hours later. */
export function selectQuotaHistoryPage(slots: DailyTrendingFeedSlotRecord[], decisions: QuotaDecision[], before: number | null) {
  const byAssignment = new Map(decisions.map(decision => [`${decision.format}:${decision.assignment_id}`, decision]));
  const eligible = slots.filter(slot => (before === null || slot.position < before) &&
    slot.assignmentId && byAssignment.has(`${slot.format}:${slot.assignmentId}`))
    .sort((a, b) => b.position - a.position);
  const page = eligible.slice(0, QUOTA_HISTORY_PAGE_SIZE);
  return { slots: page, byAssignment, nextBefore: eligible.length > page.length ? page.at(-1)!.position : null };
}

export function assembleQuotaHistory(slots: DailyTrendingFeedSlotRecord[], decisions: Map<string, QuotaDecision>, items: TrendingFeedItem[]) {
  const byAssignment = new Map(items.map(item => [`${item.format}:${item.assignmentId}`, item]));
  const entries: ReviewedPost<ReviewedTrendingCandidate>[] = [];
  for (const slot of [...slots].sort((a, b) => a.position - b.position)) {
    const key = `${slot.format}:${slot.assignmentId}`;
    const source = byAssignment.get(key), decision = decisions.get(key);
    if (!source || !decision || source.creativeId !== decision.creative_id) continue;
    const item = { ...source, id: `${slot.format}:${slot.id}`, feedItemId: slot.id, position: slot.position, source: slot.source };
    const value = item.format === "carousel"
      ? { format: item.format, item, carousel: item.creative, slides: item.creative.slides.filter(slide => slide.status === "ready" && slide.renderedUrl) }
      : { format: item.format, item };
    if (!isRecoverableTrendingReview(value)) continue;
    entries.push({ id: item.id, value, position: slot.position,
      decision: decision.decision === "accepted" ? "liked" : "skipped", reviewedAt: Date.parse(decision.decided_at) });
  }
  return entries;
}
