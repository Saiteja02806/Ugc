import assert from "node:assert/strict";
import test from "node:test";
import { buildExploreGenerationInstructions } from "./generation-input-instructions.ts";

test("editing binds the source and six ordered photos without instructing a new performance", () => {
  const result = buildExploreGenerationInstructions({ model: "seedance_2_5", personPhotos: true, imageCount: 6, hasVideo: true, referenceVideoMode: "edit", generateAudio: false });
  assert.equal(result.intent, "replace_face");
  assert.match(result.instructions, /In @Video 1, replace the original performer's facial identity with the person in @Image 1/);
  assert.match(result.instructions, /@Image 2, @Image 3, @Image 4, @Image 5, @Image 6/);
  assert.match(result.instructions, /face shape, eye spacing, nose, lips and jawline/);
  assert.match(result.instructions, /source video's actions, emotions, expressions/);
  assert.doesNotMatch(result.instructions, /body may be regenerated|NEW PERFORMANCE|inspiration for a new clip/);
  assert.match(result.instructions, /SOUND SETTING: OFF/);
});

test("person photos guide a new performance without inventing a video source", () => {
  const result = buildExploreGenerationInstructions({ model: "seedance_2_5", personPhotos: true, imageCount: 3, hasVideo: false, generateAudio: false });
  assert.equal(result.intent, "create_performance");
  assert.match(result.instructions, /@Image 1 is the main face photo/);
  assert.match(result.instructions, /@Image 2, @Image 3 are supporting views/);
  assert.match(result.instructions, /NEW PERFORMANCE/);
  assert.doesNotMatch(result.instructions, /@Video|PERFORMANCE SOURCE/);
  assert.match(result.instructions, /SOUND SETTING: OFF/);
  assert.match(result.instructions, /mouth movements without sound/);
});

test("video recreation binds the main face and every supporting view using each provider's syntax", () => {
  for (const model of ["seedance_2_5", "wan_3_0", "google_omni"]) {
    const result = buildExploreGenerationInstructions({ model, personPhotos: true, imageCount: 5, hasVideo: true, generateAudio: true });
    assert.equal(result.intent, "recreate_performance");
    assert.match(result.instructions, /facial identity and proportions/);
    assert.match(result.instructions, /body may be regenerated/);
    assert.match(result.instructions, /clothing/);
    assert.match(result.instructions, /SOUND SETTING: ON/);
    if (model === "seedance_2_5") {
      assert.match(result.instructions, /@Video 1/);
      assert.match(result.instructions, /@Image 2, @Image 3, @Image 4, @Image 5/);
    } else {
      assert.doesNotMatch(result.instructions, /@Image|@Video/);
      assert.match(result.instructions, /Image 2, Image 3, Image 4, Image 5/);
    }
  }
});

test("general images and prompt-only creation do not receive face replacement instructions", () => {
  for (const imageCount of [0, 2]) {
    const result = buildExploreGenerationInstructions({ model: "seedance_2_5", personPhotos: false, imageCount, hasVideo: false });
    assert.equal(result.intent, "general");
    assert.equal(result.instructions, "");
  }
});
