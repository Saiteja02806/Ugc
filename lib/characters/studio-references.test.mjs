import test from "node:test";
import assert from "node:assert/strict";
import { ACCESSORIES, DEFAULT_INFLUENCER_SELECTION } from "./influencer-registry.ts";
import { compileInfluencerPrompt } from "./master-prompt-compiler.ts";
import {
  orderedStudioReferences,
  resolveStudioReferenceUrls,
  studioReferenceOrderLine,
  studioReferenceSize,
} from "./studio-references.ts";

test("ordered studio references start with the selected character face and stay within ten images", () => {
  const references = orderedStudioReferences(DEFAULT_INFLUENCER_SELECTION);
  assert.equal(references[0].id, "char_average");
  assert.equal(references[0].role, "character face");
  assert.equal(references[0].imagePath, "/explore/influencer-studio/characters/1.png");
  assert.equal(references[1].id, "bg_modern_workspace");
  assert.equal(references[1].role, "background");
  assert.ok(references.length > 1);
  assert.ok(references.length <= 10);
  assert.equal(new Set(references.map((reference) => reference.imagePath)).size, references.length);
  const prompt = `${compileInfluencerPrompt(DEFAULT_INFLUENCER_SELECTION).prompt}${studioReferenceOrderLine(references.map((reference) => reference.role))}`;
  assert.ok(prompt.length <= 4000);
  assert.match(prompt, /1 character face/);
  assert.match(prompt, /2 background/);
  assert.match(prompt, /one full-body person standing in the selected room/);
  assert.match(prompt, /Show the whole person from head to feet/);
  assert.match(prompt, /Do not copy a white backdrop/);
  const halfPrompt = `${compileInfluencerPrompt({ ...DEFAULT_INFLUENCER_SELECTION, framing: "half" }).prompt}${studioReferenceOrderLine(references.map((reference) => reference.role), "half")}`;
  assert.match(halfPrompt, /Frame the person from the head through the waist/);
  assert.match(halfPrompt, /one person framed from the head through the waist/);
  assert.doesNotMatch(halfPrompt, /full-body|head to feet|missing legs/);
  assert.ok(halfPrompt.length <= 4000);
  const withAccessories = orderedStudioReferences({ ...DEFAULT_INFLUENCER_SELECTION, accessoryIds: ACCESSORIES.map((trait) => trait.id) });
  const accessoryPrompt = `${compileInfluencerPrompt({ ...DEFAULT_INFLUENCER_SELECTION, accessoryIds: ACCESSORIES.map((trait) => trait.id) }).prompt}${studioReferenceOrderLine(withAccessories.map((reference) => reference.role))}`;
  assert.ok(withAccessories.length <= 10);
  assert.ok(accessoryPrompt.length <= 4000);
});

test("studio reference ids resolve to public studio image URLs and reject unknown ids", () => {
  const references = orderedStudioReferences(DEFAULT_INFLUENCER_SELECTION);
  const urls = resolveStudioReferenceUrls(references.map((reference) => reference.id));
  assert.equal(urls.length, references.length);
  assert.match(urls[0], /^https:\/\/[^/]+\/explore\/influencer-studio\/characters\/1\.png$/);
  assert.throws(() => resolveStudioReferenceUrls(["upload_custom_face"]), /studio/);
  assert.throws(() => resolveStudioReferenceUrls(["char_average", "char_average"]), /10 different/);
});

test("a custom uploaded face is not treated as a catalog studio image", () => {
  const custom = {
    id: "upload_face",
    label: "Mine",
    category: "character_type",
    imagePath: "blob:http://localhost/face",
    promptSnippet: "uploaded face",
    isCustomUpload: true,
  };
  const references = orderedStudioReferences({ ...DEFAULT_INFLUENCER_SELECTION, characterTypeId: custom.id }, [custom]);
  assert.equal(references.some((reference) => reference.id === "upload_face" || reference.id === "char_average"), false);
  assert.equal(references[0].role, "background");
});

test("an outfit photo takes a reference slot ahead of the accessories", () => {
  const references = orderedStudioReferences({ ...DEFAULT_INFLUENCER_SELECTION, outfitId: "outfit_1950s_grey_suit" });
  assert.equal(references.length, 10);
  assert.ok(references.some((reference) => reference.role === "outfit" && reference.id === "outfit_1950s_grey_suit"));
  assert.equal(references.some((reference) => reference.role === "accessory"), false);
  const prompt = compileInfluencerPrompt({ ...DEFAULT_INFLUENCER_SELECTION, outfitId: "outfit_1950s_grey_suit", outfitColorId: "outfit_color_navy" }).prompt;
  assert.match(prompt, /1950s tailored suit/);
  assert.match(prompt, /Do not copy its face/);
  assert.match(prompt, /Dye the main garment navy/);
});

test("background setting is included in ordered studio references and anchors room scene", () => {
  const references = orderedStudioReferences(DEFAULT_INFLUENCER_SELECTION);
  const bgRef = references.find((r) => r.role === "background");
  assert.ok(bgRef, "background must be included in studio references");
  assert.equal(bgRef.id, "bg_modern_workspace");
  assert.equal(bgRef.imagePath, "/explore/influencer-studio/backgrounds/modern-workspace.png");
});

test("studio reference photos are limited to a 1280px longest side", () => {
  assert.deepEqual(studioReferenceSize(1254, 1254), { width: 1254, height: 1254 });
  assert.deepEqual(studioReferenceSize(2000, 1000), { width: 1280, height: 640 });
  assert.throws(() => studioReferenceSize(0, 100), /no usable size/);
});
