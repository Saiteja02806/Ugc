import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getSlideshowFaceSwapCredits, planSlideshowFaceSwaps } from "../lib/explore/slideshow-face-swap.ts";

const workspace = readFileSync(new URL("../components/workspace/ugc-chat-workspace.tsx", import.meta.url), "utf8");
const picker = readFileSync(new URL("../components/explore/slideshow-reference-picker.tsx", import.meta.url), "utf8");
const composer = readFileSync(new URL("../components/generation/ai-studio-composer.tsx", import.meta.url), "utf8");

test("slideshow face swap is chosen in the composer and applied only to marked slides", () => {
  assert.match(workspace, /aria-label="Face swap"/);
  assert.match(workspace, /planSlideshowFaceSwaps/);
  assert.doesNotMatch(workspace, /onFaceSwap=\{row\.asset/);
  assert.match(picker, /Face swap for source slide/);
  assert.match(picker, /slides can use this face/);
  assert.match(picker, /Choose the slides to recreate/);
  assert.match(composer, /promptCornerControl/);
});

test("face swap plans follow the generated slide order and skip an empty choice", () => {
  const sources = ["a", "b", "c"].map(slideId => ({ slideId }));
  const jobs = [1, 2, 3, 2].map((slideIndex, index) => ({ jobId: `job-${index}`, slideshowGeneration: { version: 1, batchKey: "batch", slideIndex, slideCount: 3, versionIndex: index < 3 ? 1 : 2, versionCount: 2 } }));
  assert.deepEqual(planSlideshowFaceSwaps({ jobs, sources, slideIds: ["b"], influencerAssetId: "face-1" }).map(item => item.jobId), ["job-1"]);
  assert.deepEqual(planSlideshowFaceSwaps({ jobs, sources, slideIds: [], influencerAssetId: "face-1" }), []);
  assert.deepEqual(planSlideshowFaceSwaps({ jobs, sources, slideIds: ["b"], influencerAssetId: null }), []);
  assert.deepEqual(planSlideshowFaceSwaps({ jobs: [{ jobId: "plain" }], sources, slideIds: ["a"], influencerAssetId: "face-1" }), []);
});

test("face marks never expand normal generation or multiply the quote by versions", () => {
  const format = readFileSync(new URL("../components/explore/format-workspace.tsx", import.meta.url), "utf8");
  assert.match(format, /const contextSlides = reference\?\.slides\.filter\(slide => selectedSlideIds\.includes\(slide.id\)\)/);
  assert.doesNotMatch(workspace, /const faceSwapOutputCount[^;]*quantity/);
});
test("duplicate marked sources and multiple versions produce one swap per slide", () => {
  const slot = {version:1,batchKey:"batch",slideIndex:1,slideCount:1,versionIndex:1,versionCount:2};
  const jobs = [{jobId:"first",slideshowGeneration:slot},{jobId:"duplicate",slideshowGeneration:slot},{jobId:"second",slideshowGeneration:{...slot,versionIndex:2}}];
  assert.deepEqual(planSlideshowFaceSwaps({jobs,sources:[{slideId:"a"}],slideIds:["a","a"],influencerAssetId:"face"}),[{jobId:"first",influencerAssetId:"face"}]);
});


test("selected-face affordability includes one charge per distinct slide and keeps the base quote separate", () => {
  const baseCredits = 6 * 3;
  const faceCredits = getSlideshowFaceSwapCredits(["a", "b", "a"], "face", 1);
  assert.equal(faceCredits, 2);
  assert.equal(baseCredits + faceCredits, 20);
  assert.equal(getSlideshowFaceSwapCredits(["a"], null, 1), 0);
  assert.equal(getSlideshowFaceSwapCredits([], "face", 1), 0);
  assert.equal(getSlideshowFaceSwapCredits(["a", "b"], "face", 2), 4);
  assert.match(workspace, /creditsRemaining < totalRequiredCredits/);
  assert.match(workspace, /totalRequiredCredits = requiredCredits \+ faceSwapCredits/);
  assert.match(workspace, /This generation uses \$\{requiredCredits\}/);
});
