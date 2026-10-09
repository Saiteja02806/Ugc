import assert from "node:assert/strict";
import test from "node:test";
import { getCarouselEditRenderStatus, shouldApplyCarouselEditRefresh } from "./carousel-edit-render-status.ts";

test("only a completed render claims Edited; queued and rendering edits say Updating", () => {
  assert.equal(getCarouselEditRenderStatus(null), null);
  for (const renderState of ["queued", "rendering"] as const) {
    assert.deepEqual(getCarouselEditRenderStatus({ renderState, renderError: null }),
      { label: "Updating", tone: "pending", message: null });
  }
  assert.deepEqual(getCarouselEditRenderStatus({ renderState: "ready", renderError: null }),
    { label: "Edited", tone: "ready", message: null });
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
