import assert from "node:assert/strict";
import test from "node:test";
import { insertReferenceSlides } from "./slideshow-assembly.ts";

test("selected originals fill the gaps between regenerated master slides 1 and 5", () => {
  const generated = [{ id: "G1", source: 1 }, { id: "G5", source: 5 }];
  const originals = [10, 4, 2, 3, 6, 7, 8, 9].map(source => ({ id: `R${source}`, source }));
  assert.deepEqual(insertReferenceSlides(generated, originals, slide => slide.source).map(slide => slide.id), ["G1", "R2", "R3", "R4", "G5", "R6", "R7", "R8", "R9", "R10"]);
  assert.deepEqual(generated.map(slide => slide.id), ["G1", "G5"]);
});
test("adding a chosen subset never adds the unselected master slides", () => {
  assert.deepEqual(insertReferenceSlides([1, 2], [8, 3, 5], value => value), [1, 2, 3, 5, 8]);
});
test("existing custom order and unrelated images are retained", () => {
  const current = [{ id: "G5", source: 5 }, { id: "upload", source: null }, { id: "G1", source: 1 }];
  const next = insertReferenceSlides(current, [{ id: "R3", source: 3 }], slide => slide.source);
  assert.deepEqual(next.filter(slide => slide.id !== "R3"), current);
  assert.equal(next.length, 4);
});
