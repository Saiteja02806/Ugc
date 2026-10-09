import assert from "node:assert/strict";
import test from "node:test";
import { getCarouselEditRenderStatus, getLatestTrendingEdit, shouldApplyCarouselEditRefresh } from "./carousel-edit-render-status.ts";
import type { TrendingCreativeEditRecord } from "./creative-edit-contract.ts";

test("only a completed render claims Edited; queued and rendering edits say Updating", () => {
  assert.equal(getCarouselEditRenderStatus(null), null);
  for (const renderState of ["queued", "rendering"] as const) {
    assert.deepEqual(getCarouselEditRenderStatus({ renderState, renderError: null }),
      { label: "Updating", tone: "pending", message: null });
  }
  assert.deepEqual(getCarouselEditRenderStatus({ renderState: "ready", renderError: null }),
    { label: "Edited", tone: "ready", message: null });
});

test("a returned card prefers the completed live revision over its pending history snapshot", () => {
  const snapshot = { revision: 2, updatedAt: "2026-10-09T20:02:12Z", renderState: "queued" } as TrendingCreativeEditRecord;
  const ready = { ...snapshot, updatedAt: "2026-10-09T20:06:05Z", renderState: "ready" as const };
  assert.equal(getLatestTrendingEdit(ready, snapshot), ready);
  assert.equal(getLatestTrendingEdit(ready, null), ready);
  assert.equal(getLatestTrendingEdit(undefined, snapshot), snapshot);
  assert.equal(getLatestTrendingEdit(snapshot, ready), ready);
  assert.equal(getLatestTrendingEdit({ ...ready, revision: 1 }, snapshot), snapshot);
});

test("a refresh failure never claims render failure or completed output", () => {
  const status = getCarouselEditRenderStatus({ renderState: "rendering", renderError: null, refreshError: "offline" });
  assert.equal(status?.label, "Checking update");
  assert.equal(status?.tone, "pending");
  assert.match(status?.message ?? "", /Retrying automatically/);
});

test("render failures explain the next action instead of claiming Edited", () => {
  const failure = getCarouselEditRenderStatus({ renderState: "failed",
    renderError: "Carousel text could not fit within 4 lines at the fixed 84px font size." });
  assert.equal(failure?.label, "Update failed");
  assert.match(failure?.message ?? "", /shorten it/);
  assert.match(getCarouselEditRenderStatus({ renderState: "failed", renderError: "Storage upload failed" })?.message ?? "", /save again/);
  assert.equal(getCarouselEditRenderStatus({ renderState: "draft", renderError: null })?.label, "Not rendered");
});

test("an old polling response cannot replace a newer revision or revert a completed render", () => {
  const previous = { revision: 2, updatedAt: "2026-10-09T18:01:00Z" };
  assert.equal(shouldApplyCarouselEditRefresh(previous, { revision: 1, updatedAt: "2026-10-09T18:02:00Z" }), false);
  assert.equal(shouldApplyCarouselEditRefresh(previous, { revision: 2, updatedAt: "2026-10-09T18:00:00Z" }), false);
  assert.equal(shouldApplyCarouselEditRefresh(previous, { revision: 3, updatedAt: null }), true);
  assert.equal(shouldApplyCarouselEditRefresh(previous, previous), true);
});
