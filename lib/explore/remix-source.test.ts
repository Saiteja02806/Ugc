import assert from "node:assert/strict";
import test from "node:test";
import { readRemixSource, remixSourceFromJob, resolveRemixSource } from "./remix-source.ts";
import type { RecreateReference } from "./recreate-types.ts";

const hook: RecreateReference = { id: "hook-original", format: "hook", title: "Original hook", posterUrl: "", videoUrl: "https://catalog.test/original.mp4", category: null, categoryLabel: null, slides: [] };
const slides: RecreateReference = { ...hook, id: "slides-original", format: "slideshow", slides: [{ id: "slide-a", url: "https://catalog.test/a.jpg", width: 1080, height: 1350 }, { id: "slide-b", url: "https://catalog.test/b.jpg", width: 1080, height: 1350 }] };

test("the original generation job supplies the reference, without private prompt facts", () => {
  assert.deepEqual(remixSourceFromJob({ exploreFormat: "hook", referenceType: "hook", referenceId: hook.id, referenceUrl: hook.videoUrl, prompt: "private", businessContext: "private" }), { format: "hook", referenceId: hook.id, sourceUrl: hook.videoUrl });
  assert.equal(remixSourceFromJob({ exploreFormat: "hook", referenceType: "wall_text", referenceId: hook.id }), null);
  assert.equal(remixSourceFromJob({ prompt: "ordinary video" }), null);
});
test("a regenerated slideshow uses its primary source, independently of slide order", () => {
  const source = remixSourceFromJob({ exploreFormat: "slideshow", referenceImageUrl: slides.slides[1].url, referenceImageUrls: [slides.slides[1].url, slides.slides[0].url] });
  assert.deepEqual(resolveRemixSource(source, [slides], "slideshow"), { reference: slides, slideId: "slide-b" });
  assert.deepEqual(resolveRemixSource(source, [{ ...slides, slides: [...slides.slides].reverse() }], "slideshow").slideId, "slide-b");
});
test("changing posts never substitutes a different source, uploaded poster or workflow", () => {
  const source = remixSourceFromJob({ exploreFormat: "hook", referenceType: "hook", referenceId: hook.id, referenceUrl: hook.videoUrl });
  assert.equal(resolveRemixSource(source, [{ ...hook, id: "new-post" }], "hook").reference, null);
  assert.equal(resolveRemixSource(source, [hook], "wall_text").reference, null);
  assert.equal(resolveRemixSource({ format: "slideshow", referenceId: null, sourceUrl: slides.slides[0].url }, [{ ...slides, id: "uploaded:example" }], "slideshow").reference, null);
  assert.equal(resolveRemixSource({ ...source!, sourceUrl: "https://catalog.test/replaced.mp4" }, [hook], "hook").reference, null);
});
test("no linked source or malformed metadata requires manual text", () => {
  assert.equal(readRemixSource(null), null);
  assert.equal(readRemixSource({ format: "other" }), null);
  assert.equal(resolveRemixSource(null, [hook], "hook").reference, null);
  assert.equal(resolveRemixSource(undefined, [hook], "hook").reference, null);
});

test("v4 edits retain the accepted result's original source rather than its generated pixels or newly selected source", () => {
  const original = { format: "slideshow", referenceId: null, sourceUrl: slides.slides[1].url };
  const edited = { exploreFormat: "slideshow", referenceImageUrl: "https://owned.test/generated.png", slideshowReferenceContract: { version: 4 }, slideshowRemixSource: original };
  assert.deepEqual(remixSourceFromJob(edited), original);
  assert.equal(resolveRemixSource(remixSourceFromJob(edited), [slides], "slideshow").slideId, "slide-b");
  assert.equal(remixSourceFromJob({ ...edited, slideshowRemixSource: null }), null);
});
