import assert from "node:assert/strict";
import test from "node:test";
import { assembleQuotaHistory, selectQuotaHistoryPage } from "./quota-review-history.ts";
import type { DailyTrendingFeedSlotRecord } from "./unified-daily-feed-db";
import type { TrendingFeedItem } from "./feed-items";

const slots: DailyTrendingFeedSlotRecord[] = Array.from({ length: 45 }, (_, position) => ({
  id: `slot-${position}`, assignmentId: `assignment-${position}`, feedId: "quota-a", format: "reaction", position, source: "new", state: "decided",
}));
const decisions = slots.map(slot => ({ assignment_id: slot.assignmentId!, creative_id: `creative-${slot.position}`, format: slot.format,
  decision: "rejected" as const, decided_at: "2026-10-19T01:00:00Z" }));
const items = slots.map(slot => ({ id: slot.assignmentId!, assignmentId: slot.assignmentId!, creativeId: `creative-${slot.position}`,
  feedItemId: slot.assignmentId!, format: "reaction", position: 0, readiness: "preview_ready", source: "new",
  creative: { previewUrl: "/preview.mp4", caption: "Saved caption", title: "Saved post" } })) as TrendingFeedItem[];

test("pages recover a quota backwards without gaps or duplicates", () => {
  const seen: number[] = [];
  let before: number | null = null;
  do {
    const page = selectQuotaHistoryPage(slots, decisions, before);
    assert.ok(page.slots.length <= 20);
    seen.push(...page.slots.map(slot => slot.position));
    before = page.nextBefore;
  } while (before !== null);
  assert.deepEqual(seen, slots.map(slot => slot.position).reverse());
});

test("only reviewed assignments in this delivered quota are returned", () => {
  const page = selectQuotaHistoryPage(slots.slice(0, 3), [...decisions.slice(0, 2), { ...decisions[2], assignment_id: "other-quota" }], null);
  assert.deepEqual(page.slots.map(slot => slot.position), [1, 0]);
  assert.equal(page.nextBefore, null);
});

test("restores original slot IDs and order, keeps likes, and refuses mismatched creatives", () => {
  const page = selectQuotaHistoryPage(slots.slice(0, 3), decisions.slice(0, 3), null);
  page.byAssignment.set("reaction:assignment-0", { ...decisions[0], decision: "accepted" });
  const entries = assembleQuotaHistory(page.slots, page.byAssignment, [items[2], { ...items[1], creativeId: "wrong-creative" }, items[0]]);
  assert.deepEqual(entries.map(entry => [entry.id, entry.position, entry.decision]), [["reaction:slot-0", 0, "liked"], ["reaction:slot-2", 2, "skipped"]]);
  assert.equal(entries[0].value.item.feedItemId, "slot-0");
  assert.equal(entries[0].value.item.position, 0);
});

test("unavailable previews produce an explicit shortfall, never invented placeholder posts", () => {
  const page = selectQuotaHistoryPage(slots.slice(0, 3), decisions, null);
  const entries = assembleQuotaHistory(page.slots, page.byAssignment, []);
  assert.equal(page.slots.length - entries.length, 3);
});
