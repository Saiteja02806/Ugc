import assert from "node:assert/strict";
import test from "node:test";
import { getPostDragScrollTop, getPostDragSnapTop, isPostDoubleTap, isPostTap, shouldSkipScrolledPost, type PostTap } from "./post-interaction.ts";

const tap: PostTap = { itemId: "first-post", x: 100, y: 120, time: 1000 };

test("a like requires two quick taps on the same post and near the same point", () => {
  assert.equal(isPostDoubleTap(null, tap), false);
  assert.equal(isPostDoubleTap(tap, { ...tap, time: 1180, x: 105 }), true);
  assert.equal(isPostDoubleTap(tap, { ...tap, time: 1500 }), false);
  assert.equal(isPostDoubleTap(tap, { ...tap, time: 900 }), false);
  assert.equal(isPostDoubleTap(tap, { ...tap, time: 1180, itemId: "next-post" }), false);
  assert.equal(isPostDoubleTap(tap, { ...tap, time: 1180, y: 200 }), false);
});

test("a scroll, drag or long press cannot be the second tap of a like", () => {
  assert.equal(isPostTap(tap, { ...tap, time: 1120, x: 106, y: 122 }), true);
  assert.equal(isPostTap(tap, { ...tap, time: 1120, y: 200 }), false);
  assert.equal(isPostTap(tap, { ...tap, time: 1500 }), false);
  assert.equal(isPostTap(tap, { ...tap, time: 1120, itemId: "next-post" }), false);
});

test("skip requires a deliberate scroll to the next post, with interactions enabled", () => {
  const input = { scrollTop: 500, height: 500, userInitiated: true, disabled: false };
  assert.equal(shouldSkipScrolledPost(input), true);
  assert.equal(shouldSkipScrolledPost({ ...input, scrollTop: 100 }), false);
  assert.equal(shouldSkipScrolledPost({ ...input, scrollTop: 0 }), false);
  assert.equal(shouldSkipScrolledPost({ ...input, userInitiated: false }), false);
  assert.equal(shouldSkipScrolledPost({ ...input, disabled: true }), false);
  assert.equal(shouldSkipScrolledPost({ ...input, height: 0 }), false);
});

test("mouse dragging follows vertical movement and can reverse without going beyond the next post", () => {
  const input = { startScrollTop: 0, startY: 400, y: 250, height: 500 };
  assert.equal(getPostDragScrollTop(input), 150);
  assert.equal(getPostDragScrollTop({ ...input, y: 450 }), 0);
  assert.equal(getPostDragScrollTop({ ...input, y: -300 }), 500);
  assert.equal(getPostDragScrollTop({ ...input, startScrollTop: 200, y: 450 }), 150);
  assert.equal(getPostDragScrollTop({ ...input, height: 0 }), 0);
});

test("a short or reversed drag returns to the current post; a deliberate drag snaps to one next post", () => {
  assert.equal(getPostDragSnapTop(80, 500), 0);
  assert.equal(getPostDragSnapTop(0, 500), 0);
  assert.equal(getPostDragSnapTop(200, 500), 500);
  assert.equal(getPostDragSnapTop(900, 500), 500);
  assert.equal(getPostDragSnapTop(200, 0), 0);
});

test("a deliberate upward flick advances without requiring a long drag, but jitter and downward motion do not", () => {
  assert.equal(getPostDragSnapTop(90, 500, 1.2), 500);
  assert.equal(getPostDragSnapTop(90, 500, 0.3), 0);
  assert.equal(getPostDragSnapTop(90, 500, -1.2), 0);
  assert.equal(getPostDragSnapTop(20, 500, 3), 0);
  assert.equal(getPostDragSnapTop(0, 500, 3), 0);
});

test("dragging with history follows both directions and is bounded to one adjacent post", () => {
  const input = { startScrollTop: 500, startY: 200, y: 400, height: 500, anchor: 500, hasPrevious: true };
  assert.equal(getPostDragScrollTop(input), 300);
  assert.equal(getPostDragScrollTop({ ...input, y: 1200 }), 0);
  assert.equal(getPostDragScrollTop({ ...input, y: -1200 }), 1000);
  assert.equal(getPostDragScrollTop({ ...input, hasPrevious: false }), 500);
});

test("backward release mirrors forward distance and flick thresholds without skipping through history", () => {
  assert.equal(getPostDragSnapTop(300, 500, 0, 500, true), 0);
  assert.equal(getPostDragSnapTop(420, 500, -1.2, 500, true), 0);
  assert.equal(getPostDragSnapTop(420, 500, -.3, 500, true), 500);
  assert.equal(getPostDragSnapTop(480, 500, -3, 500, true), 500);
  assert.equal(getPostDragSnapTop(420, 500, 1.2, 500, true), 500);
  assert.equal(getPostDragSnapTop(300, 500, -1.2, 500, false), 500);
  assert.equal(getPostDragSnapTop(580, 500, 1.2, 500, true), 1000);
});
