import assert from "node:assert/strict";
import test from "node:test";
import { applyReferenceUploadBatches, type ReferenceUploadBatch } from "./reference-upload-batches.ts";
import { filterReferences, interleaveReferenceCategories, prioritizeRecentReferences, type RecreateReference } from "./recreate-types.ts";
const ref = (id: string, format: RecreateReference["format"] = "hook", category: string | null = null): RecreateReference => ({ id, format, category, categoryLabel: category, title: id, posterUrl: "https://example.test/poster.png", slides: [] });
const batch = (id: string, format: RecreateReference["format"], sequence: number, referenceIds: string[], status: ReferenceUploadBatch["status"] = "published"): ReferenceUploadBatch => ({ id, format, sequence, referenceIds, status });
test("New stays on the latest complete published batch per workflow until that workflow gets another batch", () => {
  const items = [ref("old"), ref("a"), ref("b"), ref("s", "slideshow"), ref("w", "wall_text")];
  const first = [batch("h1", "hook", 1, ["a"]), batch("s1", "slideshow", 1, ["s"]), batch("w1", "wall_text", 1, ["w"])];
  assert.deepEqual(applyReferenceUploadBatches(items, first).filter(x => x.isNew).map(x => x.id), ["a", "s", "w"]);
  assert.deepEqual(applyReferenceUploadBatches(items, [...first, batch("h2", "hook", 2, ["b"])]).filter(x => x.isNew).map(x => x.id), ["b", "s", "w"]);
  assert.equal(applyReferenceUploadBatches(items, first).find(x => x.id === "old")?.isNew, undefined);
});
test("staged, failed-to-appear and archived uploads do not retire the previous batch", () => {
  const items = [ref("a"), ref("b")];
  const releases = [batch("old", "hook", 1, ["a"]), batch("staged", "hook", 2, ["b"], "staged"), batch("incomplete", "hook", 3, ["missing"])];
  assert.equal(applyReferenceUploadBatches(items, releases).find(x => x.isNew)?.id, "a");
  assert.equal(applyReferenceUploadBatches(items, releases, true).find(x => x.isNew)?.id, "b");
  assert.equal(applyReferenceUploadBatches([items[0], { ...items[1], archived: true }], releases, true).find(x => x.isNew)?.id, "a");
});
test("ordering puts the latest batch ahead of category mixing without mutating slides or filter behavior", () => {
  const items = [ref("old-a", "slideshow", "a"), ref("old-b", "slideshow", "b"), ref("new-a", "slideshow", "a"), ref("new-a2", "slideshow", "a")];
  const originals = JSON.stringify(items);
  const marked = applyReferenceUploadBatches(items, [batch("new", "slideshow", 1, ["new-a", "new-a2"])]);
  const ordered = prioritizeRecentReferences(interleaveReferenceCategories(marked));
  assert.deepEqual(ordered.map(x => x.id), ["new-a", "new-a2", "old-a", "old-b"]);
  assert.deepEqual(prioritizeRecentReferences(filterReferences(marked, "slideshow", ["a"])).map(x => x.id), ["new-a", "new-a2", "old-a"]);
  assert.equal(JSON.stringify(items), originals);
  assert.equal(ordered[0].slides, items[2].slides);
});
test("batch state removes stale New fields and rejects ambiguous ordering and duplicate imports", () => {
  assert.equal(applyReferenceUploadBatches([{ ...ref("a"), isNew: true, uploadBatchSequence: 999 }], [])[0].isNew, undefined);
  assert.throws(() => applyReferenceUploadBatches([ref("a"), ref("b")], [batch("x", "hook", 1, ["a"]), batch("y", "hook", 1, ["b"])]), /Duplicate/);
  assert.throws(() => applyReferenceUploadBatches([ref("a")], [batch("x", "hook", 1, ["a"]), batch("y", "hook", 2, ["a"])]), /republished/);
});
