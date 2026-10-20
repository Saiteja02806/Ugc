import assert from "node:assert/strict";
import test from "node:test";
import {
  emptyPostReviewState, getPostReviewHistoryKey, mergePostReviewHistory, parsePostReviewHistory,
  POST_REVIEW_RETENTION_MS, POST_REVIEW_STORAGE_LIMIT, serializePostReviewHistory,
} from "./post-review-history.ts";
import { isRecoverableTrendingReview } from "./reviewed-feed-candidate.ts";

const now = Date.now();
const config = { ownerId: "owner-a", isValue: (value: unknown): value is string => typeof value === "string" };
const entry = (id: string, reviewedAt = now) => ({ id, reviewedAt, value: `Post ${id}`, decision: "skipped" as const });

test("refresh restores ordered snapshots, liked decisions and the selected historical post", () => {
  const state = { entries: [entry("1"), { ...entry("2"), decision: "liked" as const }], activeId: "1" };
  assert.deepEqual(parsePostReviewHistory(serializePostReviewHistory(state, config.ownerId), config, now), state);
});

test("another account never receives the stored posts or position", () => {
  assert.notEqual(getPostReviewHistoryKey("owner:a"), getPostReviewHistoryKey("owner/a"));
  const raw = serializePostReviewHistory({ entries: [entry("1")], activeId: "1" }, config.ownerId);
  assert.deepEqual(parsePostReviewHistory(raw, { ...config, ownerId: "owner-b" }, now), emptyPostReviewState());
});

test("invalid, incompatible and oversized storage recover as an empty history", () => {
  for (const raw of [null, "{broken", "null", "[]", JSON.stringify({ version: 2, ownerId: config.ownerId, entries: [entry("1")] }), " ".repeat(POST_REVIEW_STORAGE_LIMIT + 1)]) {
    assert.deepEqual(parsePostReviewHistory(raw, config, now), emptyPostReviewState());
  }
});

test("corrupt individual entries, expired snapshots and future dates do not break recovery", () => {
  const raw = JSON.stringify({ version: 1, ownerId: config.ownerId, activeId: "expired", entries: [
    null, entry("expired", now - POST_REVIEW_RETENTION_MS - 1), entry("future", now + 120_000),
    { ...entry("bad"), value: {} }, { ...entry("bad-decision"), decision: "publish" }, entry("good"), entry("good"),
  ] });
  assert.deepEqual(parsePostReviewHistory(raw, config, now), { entries: [entry("good")], activeId: null });
});

test("history stays bounded and retains the most recent 120 posts", () => {
  const state = { entries: Array.from({ length: 140 }, (_, i) => entry(String(i), now + i)), activeId: "0" };
  const restored = parsePostReviewHistory(serializePostReviewHistory(state, config.ownerId), config, now + 200);
  assert.equal(restored.entries.length, 120);
  assert.equal(restored.entries[0].id, "20");
  assert.equal(restored.entries.at(-1)?.id, "139");
  assert.equal(restored.activeId, null);
});

test("a large snapshot cannot exhaust the full local-storage quota", () => {
  const raw = serializePostReviewHistory({ entries: [{ ...entry("large"), value: "x".repeat(POST_REVIEW_STORAGE_LIMIT) }, entry("recent")], activeId: "large" }, config.ownerId);
  assert.ok(raw.length < POST_REVIEW_STORAGE_LIMIT);
  assert.deepEqual(parsePostReviewHistory(raw, config, now), { entries: [entry("recent")], activeId: null });
});

test("a stale tab keeps reviews from the other tab and cannot undo an explicit like", () => {
  const merged = mergePostReviewHistory(
    { entries: [{ ...entry("1", now - 2), decision: "liked" }, entry("2", now - 1)], activeId: null },
    { entries: [entry("1", now - 2), entry("3")], activeId: "1" },
  );
  assert.deepEqual(merged.entries.map(post => [post.id, post.decision]), [["1", "liked"], ["2", "skipped"], ["3", "skipped"]]);
  assert.equal(merged.activeId, "1");
});

test("quota history cannot leak between quotas or accept the legacy unscoped cache", () => {
  const state = { entries: [entry("1")], activeId: "1" };
  const scoped = { ...config, scopeId: "quota-a" };
  const raw = serializePostReviewHistory(state, config.ownerId, scoped.scopeId);
  assert.deepEqual(parsePostReviewHistory(raw, scoped, now + 2 * 60 * 60 * 1000), state);
  assert.deepEqual(parsePostReviewHistory(raw, { ...scoped, scopeId: "quota-b" }, now), emptyPostReviewState());
  assert.deepEqual(parsePostReviewHistory(serializePostReviewHistory(state, config.ownerId), scoped, now), emptyPostReviewState());
  assert.notEqual(getPostReviewHistoryKey(config.ownerId, "quota-a"), getPostReviewHistoryKey(config.ownerId, "quota-b"));
});

test("recovering older quota pages preserves the current post, local edits and original slot order", () => {
  const current = { entries: [{ ...entry("2"), position: 2, value: "Edited locally" }, { ...entry("3"), position: 3 }], activeId: "2" };
  const recovered = { entries: [{ ...entry("1", now + 100), position: 1 }, { ...entry("2", now + 200), position: 2, decision: "liked" as const }], activeId: null };
  const merged = mergePostReviewHistory(recovered, current);
  assert.deepEqual(merged.entries.map(post => post.id), ["1", "2", "3"]);
  assert.equal(merged.activeId, "2");
  assert.equal(merged.entries[1].value, "Edited locally");
  assert.equal(merged.entries[1].decision, "liked");
  assert.deepEqual(mergePostReviewHistory(recovered, merged), merged, "Repeated recovery must be idempotent");
});

const item = { id: "post", assignmentId: "assignment", creativeId: "creative", feedItemId: "feed", readiness: "preview_ready" };
const slide = { headline: "A useful habit", renderedUrl: "/slide.webp", slideNumber: 1, status: "ready" };
const carousel = { carouselId: "carousel", status: "completed", slideCount: 1, slides: [slide] };
const formats = [
  { format: "carousel", item: { ...item, format: "carousel", creative: carousel }, carousel, slides: [slide] },
  { format: "reaction", item: { ...item, format: "reaction", creative: { previewUrl: "/reaction.mp4", caption: "Watch", title: "Reaction" } } },
  { format: "hook_video", item: { ...item, format: "hook_video", creative: { previewSessionEndpoint: "/api/hook/preview", videoId: "video", title: "Hook", text: { lines: ["Try this"], value: "Try this" } } } },
  { format: "wall_text", item: { ...item, format: "wall_text", creative: { previewUrl: "/wall.mp4", title: "Wall", text: { fullText: "Try this", segments: [{ lines: ["Try this"] }] }, layout: { textBox: {}, safeArea: {} }, audio: {} } } },
];

test("all four Trending formats can recover; incomplete render structures are rejected", () => {
  for (const value of formats) {
    assert.equal(isRecoverableTrendingReview(value), true, value.format);
    assert.equal(isRecoverableTrendingReview({ ...value, item: { ...value.item, creative: {} } }), false, value.format);
    assert.equal(isRecoverableTrendingReview({ ...value, format: "unknown" }), false);
    assert.equal(isRecoverableTrendingReview({ ...value, reviewedEdit: { content: {} } }), false);
  }
  assert.equal(isRecoverableTrendingReview({ ...formats[0], slides: [null] }), false);
});
