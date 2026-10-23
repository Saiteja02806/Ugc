import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import release from "../worker/src/lib/explore-hook-reference-oct23-refresh-release.json" with { type: "json" };
import { getHookReferenceGalleryItems } from "../worker/src/lib/explore-hook-reference-release.ts";
import { validateHookAdditionRelease } from "./hook-reference-addition-release-readiness.mjs";
import { getRecreateReferences } from "../lib/explore/recreate-catalog.ts";
import { getReferenceText } from "../lib/explore/reference-text-store.ts";
import { orderReferenceGallery } from "../lib/explore/recreate-types.ts";
import { getHookKeyframeMotionReviewDraft, buildHookAnimationPrompt, hookMotionPlanDirections } from "../lib/explore/hook-keyframe-motion.ts";
import { createHookKeyframeDraft, updateHookKeyframeDraft } from "../lib/explore/hook-keyframe-draft.ts";
import { getHookKeyframePromptPreview } from "../lib/explore/hook-keyframe-prompt-preview.ts";
import { HOOK_KEYFRAME_IMAGE_PROMPT_VERSION } from "../lib/explore/hook-keyframe-image-prompt.ts";
import { remixInputSource } from "../lib/explore/remix-text-input.ts";
import { validateRemixOutput } from "../lib/explore/reference-text.ts";
import { applyVideoTextRemix } from "../lib/explore/remix-text-edit.ts";
process.env.GCP_STORAGE_BUCKET ??= "fixture";
process.env.GCP_STORAGE_PUBLIC_BASE_URL ??= "https://fixture.test";
const json = file => JSON.parse(readFileSync(new URL(file, import.meta.url), "utf8"));
const text = json("../lib/explore/reference-text-catalog.json");
const reviewData = json("./data/hook-refresh-oct23-reviews.json");
const expected = [
  [2, "405670a27856c31e698a0ef13b178ece82c18cc379c0cec7489b0c1c1414fa1e", 112],
  [3, "cd230e98db5d44712ca1541712b3ccc34c241af65c1142a3bb4c5136c581df22", 113],
  [5, "ddb24f03edb483ef194be7cbe0c74d26a9ec4ae39507642efd2d334759fddf35", 81],
  [6, "109ec5d49c4f33800c23a26329107d1ffd26d98b5048c8a210d8534164a1e7c6", 87],
  [7, "7e43f6ca3c30d32d362c8370e7e1d82dd722604f4146db11ad1f4fbb0bdceb22", 100],
  [8, "05738540ee02c011cf73cfe2db7cae40b88c0886af99c23a99704e630bbfc955", 53],
  [9, "b9b0c519f1e061ae9cdc91965cb6797777cee0f763d1e1f94cf0614f1d438f06", 82],
  [10, "3b75bff5ce95145b5779f91b8bb9a235009e69f4829d756679ee1b6cc0ee79a2", 28],
];

test("refresh registers exactly eight reaction-only sources and preserves the duplicate Hook 83", () => {
  assert.equal(release.mediaStatus, "published"); assert.equal(release.activation, "active");
  assert.equal(release.items.length, 8);
  const { eligible, assets } = validateHookAdditionRelease(release, text);
  assert.equal(eligible.length, 8); assert.equal(assets.length, 32);
  assert.deepEqual(release.items.map(item => [item.sourceFolder, item.videoSha256]), expected.map(([folder, hash]) => [`New folder (${folder})`, hash]));
  assert.equal(release.items.some(item => item.sourceFolder === "New folder (4)"), false);
  const gallery = getHookReferenceGalleryItems();
  const samePost = gallery.filter(item => item.sourceUrl === "https://www.tiktok.com/@salem_raena.ai/video/7457211945104575752");
  assert.equal(samePost.length, 1);
  assert.equal(samePost[0].id, "explore-paired-hook-607bfccda5e91e0d8731fa94");
  assert.equal(samePost[0].videoSha256, "3205ad7a9a13b1f49e411498ec8a8a028ec6d649d3fcb374381981ec019315ba");
});

test("source-bound captions and four-second motion previews cover all 656 retained frames without paid admission", () => {
  let frameCount = 0;
  for (const [index, item] of release.items.entries()) {
    const review = reviewData.items.find(value => value.folder === item.sourceFolder);
    const source = getReferenceText(item.id, null, "hook");
    assert.equal(source.sourceSha256, item.videoSha256); assert.equal(source.blocks[0].text, review.text);
    assert.equal(source.blocks[0].endMs, Math.ceil(item.durationSeconds * 1000));
    const draft = getHookKeyframeMotionReviewDraft(item.id, item.videoSha256);
    assert.equal(draft.staticReview.frameCount, expected[index][2]);
    frameCount += draft.staticReview.frameCount;
    assert.deepEqual(draft.staticReview.sampledFrameIndices, Array.from({ length: expected[index][2] }, (_, index) => index));
    assert.equal(draft.canSubmitPaidAnimation, false); assert.equal(draft.staticReview.visualQualification, "not_tested");
    assert.doesNotThrow(() => buildHookAnimationPrompt({ directions: hookMotionPlanDirections(draft.candidatePlan), durationSeconds: 4, generateAudio: false }));
  }
  assert.equal(frameCount, 656);
});

test("folder two uses the approved default track while the other pairs preserve supplied audio identities", () => {
  const defaultItem = release.items[0];
  assert.equal(defaultItem.sourceFolder, "New folder (2)");
  assert.equal(defaultItem.audioTitle, "Default background music");
  assert.equal(defaultItem.audioSha256, "486d51877209ee7c3f8347fe0da2891135a7aa9ea220d37ddd4107c18464bb56");
  assert.ok(defaultItem.audioDurationSeconds > defaultItem.durationSeconds);
  const supplied = { 3: "d52c625ce78bb44cd2e3fe81c97f32b96ed76506b03bc42e0a4cf6792c230fd0", 5: "0c07bfbc3ab603a1d9d0ff2e407ff7d758b973a7cd2ca82b9b7fe768d9670eb7", 8: "8396ff1f8f30db9e5811a16e99cec25aaa54d9ef05bd035926a09dc288e32896", 9: "1721fb8ad697e187a7a4c18bd6af20defa9d58dcf38ca76d39c99a84fdcee413" };
  for (const item of release.items) {
    assert.equal(item.audioPolicy, undefined); assert.notEqual(item.previewSha256, item.videoSha256);
    const n = Number(item.sourceFolder.match(/\d+/)[0]);
    if (supplied[n]) assert.equal(item.audioSha256, supplied[n]);
    else if (n !== 2) assert.ok(item.audioDurationSeconds - item.durationSeconds < .1, "TikTok audio ends with the retained reaction interval");
  }
});

test("the second Hook batch leads within each platform, retires the first Hook badge and leaves slideshow badges intact", () => {
  const refs = getRecreateReferences();
  const hooks = orderReferenceGallery(refs.filter(item => item.format === "hook"), "hook");
  for (const platform of ["instagram", "tiktok"]) {
    const expected = release.items.filter(item => item.sourcePlatform === platform).map(item => item.id);
    assert.deepEqual(hooks.filter(item => item.sourcePlatform === platform).slice(0, expected.length).map(item => item.id), expected);
  }
  assert.deepEqual(new Set(hooks.filter(item => item.isNew).map(item => item.id)), new Set(release.items.map(item => item.id)));
  assert.equal(hooks.find(item => item.id === "explore-paired-hook-17133540b2315e0a3a05bfbd").isNew, undefined);
  assert.equal(refs.filter(item => item.format === "slideshow" && item.isNew).length, 4);
});

test("every new Hook connects actual Remix source to v4 starting-image and separate motion prompt previews", () => {
  assert.equal(HOOK_KEYFRAME_IMAGE_PROMPT_VERSION, 4);
  const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  for (const item of release.items) {
    const draft = createHookKeyframeDraft({ ownerId: "test-owner", draftId: uuid(1), referenceId: item.id, sourceSha256: item.videoSha256 });
    const initial = getHookKeyframePromptPreview(draft);
    assert.equal(initial.sourceMatched, true); assert.equal(initial.imagePrompt, null);
    assert.equal(initial.requiresDecision, false); assert.equal(initial.animationError, null);
    const photos = updateHookKeyframeDraft(draft, { imageAssetIds: [uuid(2), uuid(3)] });
    const preview = getHookKeyframePromptPreview(photos);
    const motion = getHookKeyframeMotionReviewDraft(item.id, item.videoSha256);
    assert.match(preview.imagePrompt, /^Generate a new photograph of my influencer shown in Image 2/);
    assert.match(preview.imagePrompt, /Image 1 \(VISUAL_REFERENCE\)/);
    assert.match(preview.imagePrompt, /SUPPORTING VIEWS — Image 3/);
    assert.ok(preview.imagePrompt.includes(`VERIFIED OPENING SCENE — ${motion.candidatePlan.openingState}`));
    assert.match(preview.imagePrompt, /Omit creator-added captions, hook text, subtitles, emojis and graphic overlays/);
    assert.doesNotMatch(preview.imagePrompt, /ENDING STATE:|MIDDLE:/);
    assert.equal(preview.requiresDecision, false); assert.equal(preview.animationError, null);
    assert.match(preview.animationPrompt, /4-second video/);
    assert.doesNotMatch(preview.animationPrompt, /@Video|Image 2|MY_INFLUENCER|original performance/);
    // These are nonbillable previews; no generated image or paid receipt is manufactured.
    assert.equal(preview.canSubmitPaidAnimation, false);
    assert.equal(photos.generatedImage, null); assert.equal(photos.approval, null);
    const original = getReferenceText(item.id, null, "hook");
    const source = remixInputSource({ requestKey: uuid(4), referenceId: item.id, slideId: null, format: "hook", instructions: "" }, original);
    const copy = validateRemixOutput({ blocks: source.blocks.map(block => block.text), heading: "", body: "" }, source);
    const editing = applyVideoTextRemix({ version: 1, format: "hook", trimStartMs: 0, trimEndMs: 4000, originalVolume: 0, musicVolume: .2, text: null }, copy, source);
    assert.equal(editing.textOverlays.length, source.blocks.length);
    assert.equal(editing.textOverlays[0].startMs, 0);
    assert.equal(editing.textOverlays.at(-1).endMs, 4000);
    assert.equal(original.blocks[0].text, reviewData.items.find(review => review.folder === item.sourceFolder).text);
  }
});
