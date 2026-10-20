import assert from "node:assert/strict";
import test from "node:test";
import { refreshTrendingCarouselEdit } from "./carousel-edit-refresh.ts";
import { shouldApplyCarouselEditRefresh } from "./carousel-edit-render-status.ts";
import type { TrendingCarouselEditStatus, TrendingCreativeEditRecord } from "./creative-edit-contract.ts";

const pending = {
  assignmentId: "assignment", creativeId: "creative", format: "carousel", id: "edit",
  revision: 3, renderState: "queued", renderError: null, renderJobId: "job",
  updatedAt: "2026-10-11T00:00:00Z", source: null, renderOutput: null,
  content: { format: "carousel", version: "trending-creative-edit-v1", slides: [{ slideNumber: 1 }] },
} as TrendingCreativeEditRecord;
const status = (changes: Partial<TrendingCarouselEditStatus> = {}): TrendingCarouselEditStatus => ({
  assignmentId: pending.assignmentId, creativeId: pending.creativeId, format: "carousel",
  id: pending.id, revision: pending.revision, renderState: "rendering", renderError: null,
  updatedAt: "2026-10-11T00:01:00Z", ...changes,
});
const ready = { ...pending, ...status({ renderState: "ready" }),
  renderOutput: { slides: [{ slideNumber: 1, renderedS3Key: "new.png", renderedUrl: "https://output.test/new.png" }] } };

test("repeated pending checks load only status; completion fetches the full edit once", async () => {
  let fullReads = 0, checks = 0;
  const full = async () => { fullReads++; return ready; };
  let edit = pending;
  for (let index = 0; index < 5; index++) {
    edit = await refreshTrendingCarouselEdit(edit, async () => { checks++; return status(); }, full);
    assert.equal(edit.renderState, "rendering");
    assert.strictEqual(edit.content, pending.content);
  }
  assert.equal(fullReads, 0);
  edit = await refreshTrendingCarouselEdit(edit, async () => { checks++; return status({ renderState: "ready" }); }, full);
  assert.equal(edit.renderState, "ready");
  assert.equal(edit.renderOutput?.slides[0].renderedUrl, "https://output.test/new.png");
  await refreshTrendingCarouselEdit(edit, async () => { checks++; return status(); }, full);
  assert.equal(fullReads, 1); assert.equal(checks, 6);
});

test("failed status is displayed without fetching a finished image", async () => {
  const result = await refreshTrendingCarouselEdit(pending, async () => status({ renderState: "failed", renderError: "Render failed" }),
    async () => { throw new Error("Must not load editor"); });
  assert.equal(result.renderState, "failed"); assert.equal(result.renderError, "Render failed");
  assert.equal(result.refreshError, null);
});

test("old, foreign and incomplete completion responses never make old slides ready", async () => {
  for (const invalid of [
    { ...ready, revision: 2 }, { ...ready, updatedAt: pending.updatedAt },
    { ...ready, creativeId: "foreign" }, { ...ready, assignmentId: "foreign" },
    { ...ready, renderState: "rendering" as const }, { ...ready, renderOutput: null },
    { ...ready, renderOutput: { slides: [] } },
  ]) {
    const result = await refreshTrendingCarouselEdit(pending, async () => status({ renderState: "ready" }), async () => invalid);
    assert.equal(result.renderState, "queued"); assert.ok(result.refreshError);
    assert.strictEqual(result.content, pending.content);
  }
  const stale = await refreshTrendingCarouselEdit(pending, async () => status({ revision: 2 }), async () => ready);
  assert.strictEqual(stale, pending);
});

test("a newer revision loads its own content and stale in-flight responses cannot overwrite Save", async () => {
  const newer = { ...ready, revision: 4, renderState: "rendering" as const,
    content: { ...pending.content, slides: [] } };
  const result = await refreshTrendingCarouselEdit(pending, async () => status({ revision: 4 }), async () => newer);
  assert.strictEqual(result.content, newer.content); assert.equal(result.revision, 4);
  assert.equal(shouldApplyCarouselEditRefresh(result, ready), false);
  assert.equal(shouldApplyCarouselEditRefresh(ready, { ...pending, updatedAt: null }), false);
});

test("status errors, aborted checks and failed final reads retain pending state for retry", async () => {
  for (const load of [async () => { throw new Error("Unavailable"); }, async () => { throw new DOMException("Aborted", "AbortError"); }]) {
    const result = await refreshTrendingCarouselEdit(pending, load, async () => ready);
    assert.equal(result.renderState, "queued"); assert.ok(result.refreshError);
  }
  const failure = await refreshTrendingCarouselEdit(pending, async () => status({ renderState: "ready" }), async () => { throw new Error("503"); });
  assert.equal(failure.renderState, "queued");
  const retry = await refreshTrendingCarouselEdit(failure, async () => status({ renderState: "ready" }), async () => ready);
  assert.equal(retry.renderState, "ready"); assert.equal(retry.refreshError, null);
  const foreign = await refreshTrendingCarouselEdit(pending, async () => status({ creativeId: "foreign" }), async () => ready);
  assert.equal(foreign.renderState, "queued"); assert.ok(foreign.refreshError);
});

test("a save awaiting job attachment keeps polling until the newer revision is queued and ready", async () => {
  let fullReads = 0;
  const loadDraft = async () => { fullReads++; return { ...pending, revision: 4, renderState: "draft" as const }; };
  for (const revision of [3, 4]) {
    const result = await refreshTrendingCarouselEdit(pending, async () => status({ revision, renderState: "draft" }), loadDraft);
    assert.equal(result.renderState, "queued");
    assert.equal(result.revision, pending.revision);
    assert.strictEqual(result.content, pending.content);
    assert.ok(result.refreshError);
  }
  assert.equal(fullReads, 0, "temporary draft status does not reload editor data every second");
  const next = { ...pending, ...status({ revision: 4, renderState: "queued" }) };
  const queued = await refreshTrendingCarouselEdit(pending, async () => status({ revision: 4, renderState: "queued" }), async () => next);
  assert.equal(queued.revision, 4); assert.equal(queued.renderState, "queued");
  const completed = { ...ready, revision: 4 };
  const result = await refreshTrendingCarouselEdit(queued, async () => status({ revision: 4, renderState: "ready" }), async () => completed);
  assert.equal(result.revision, 4); assert.equal(result.renderState, "ready");
  assert.equal(result.refreshError, null);
});

test("a concurrent save between status and full reads cannot stop polling at draft", async () => {
  const result = await refreshTrendingCarouselEdit(pending, async () => status({ revision: 4 }),
    async () => ({ ...pending, ...status({ revision: 5, renderState: "draft" }) }));
  assert.equal(result.renderState, "queued"); assert.equal(result.revision, 3);
  assert.strictEqual(result.content, pending.content); assert.ok(result.refreshError);
  const completed = { ...ready, revision: 5 };
  const retry = await refreshTrendingCarouselEdit(result, async () => status({ revision: 5, renderState: "ready" }), async () => completed);
  assert.equal(retry.renderState, "ready"); assert.equal(retry.revision, 5);
});
