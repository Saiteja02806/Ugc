import assert from "node:assert/strict";
import test from "node:test";
import { groupSlideshowResultRows, slideshowGenerationGroups } from "./slideshow-generation-groups.ts";
import { slideshowGenerationSlot } from "../../worker/src/lib/slideshow-generation-batch.ts";
import { remixSourceFromJob } from "./remix-source.ts";
import type { AIStudioImageResult } from "../ai-studio/media-results.ts";

test("ten out-of-order completions restore two complete five-slide versions without combining their order", () => {
  const images: AIStudioImageResult[] = Array.from({ length: 10 }, (_, index) => ({ id: String(index), aspectRatio: "4:5", createdAt: "", title: "Generated", url: `https://media.test/${index}.png`, slideshowGeneration: slideshowGenerationSlot("batch", 5, 2, index) }));
  const groups = slideshowGenerationGroups([images[8], images[2], images[0], images[7], images[1], images[9], images[4], images[6], images[3], images[5]]);
  assert.equal(groups.length, 2);
  for (const group of groups) { assert.equal(group.complete, true); assert.deepEqual(group.images.map(image => image.slideshowGeneration!.slideIndex), [1, 2, 3, 4, 5]); }
  assert.equal(slideshowGenerationGroups(images.slice(0, 4))[0].complete, false);
  assert.equal(slideshowGenerationGroups([...images.slice(0, 4), images[0]])[0].complete, false);
  assert.equal(slideshowGenerationGroups([{ ...images[0], slideshowGeneration: undefined }]).length, 0);
});

test("each generated slide keeps its own reference text instead of all slides inheriting slide one", () => {
  const urls = ["https://media.test/one.png", "https://media.test/two.png"];
  assert.equal(remixSourceFromJob({ exploreFormat: "slideshow", referenceImageUrl: urls[0], referenceImageUrls: urls, slideshowGeneration: slideshowGenerationSlot("batch", 2, 1, 1), slideshowReferenceContract: { styleReferenceIndices: [2, 1] } })?.sourceUrl, urls[1]);
  assert.equal(remixSourceFromJob({ exploreFormat: "slideshow", referenceImageUrl: urls[0] })?.sourceUrl, urls[0]);
});

test("version previews retain pending neighbors, keep batches separate and leave legacy images ungrouped", () => {
  const row = (key: string, batch: string, index: number, ready: boolean) => ({ key, ready, slideshowGeneration: slideshowGenerationSlot(batch, 2, 2, index) });
  const rows = [row("a2", "a", 1, true), row("a1", "a", 0, false), row("v2", "a", 2, true), row("b1", "b", 0, true), { key: "legacy", ready: true, slideshowGeneration: undefined }];
  const result = groupSlideshowResultRows(rows);
  assert.equal(result.versions.length, 3);
  assert.deepEqual(result.versions[0].rows.map(row => row.key), ["a1", "a2"]);
  assert.equal(result.versions[0].rows[0].ready, false);
  assert.deepEqual(result.individual.map(row => row.key), ["legacy"]);
  assert.equal(result.versions.flatMap(group => group.rows).length + result.individual.length, rows.length);
});

test("inconsistent saved version metadata is not silently folded into the version", () => {
  const slot = slideshowGenerationSlot("batch", 2, 1, 0);
  const result = groupSlideshowResultRows([{ key: "one", slideshowGeneration: slot }, { key: "invalid", slideshowGeneration: { ...slot, slideCount: 3 } }]);
  assert.deepEqual(result.versions[0].rows.map(row => row.key), ["one"]);
  assert.deepEqual(result.individual.map(row => row.key), ["invalid"]);
});
