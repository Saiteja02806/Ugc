import assert from "node:assert/strict";
import test from "node:test";
import { buildHookKeyframeImagePrompt, HOOK_KEYFRAME_IMAGE_PROMPT_MAX_LENGTH } from "./hook-keyframe-image-prompt.ts";

test("scene and intended person are explicit and retain their real multi-image order", () => {
  const result = buildHookKeyframeImagePrompt({ personImageCount: 3 });
  assert.deepEqual(result.roles, [
    { imageIndex: 1, role: "scene" }, { imageIndex: 2, role: "main_face" },
    { imageIndex: 3, role: "supporting_face" }, { imageIndex: 4, role: "supporting_face" },
  ]);
  assert.equal(result.imageCount, 4);
  assert.equal(result.version, 2);
  assert.match(result.prompt, /BASE_SCENE_TO_EDIT/); assert.match(result.prompt, /MAIN_FACE_IDENTITY/);
  assert.match(result.prompt, /Image 1 supplies the scene/);
  assert.match(result.prompt, /Image 2 is the main face photo/);
  assert.match(result.prompt, /Image 3, Image 4 are additional views of the SAME person/);
  assert.match(result.prompt, /eye shape and spacing, brows, nose, lips, jawline/);
  assert.match(result.prompt, /Do not average this face/);
  assert.match(result.prompt, /source hairstyle/);
  assert.match(result.prompt, /hands and existing occlusions/);
  assert.match(result.prompt, /Remove creator-added captions/);
  assert.match(result.prompt, /Preserve text physically belonging to objects/);
  assert.doesNotMatch(result.prompt, /@Video|@Image|watch the|original video|first_frame|last_frame/);
});

test("only a source-matched reviewed opening still supplies concrete scene guidance, without later motion beats", () => {
  const scope = { referenceId: "explore-paired-hook-4585ee949081c4e5cd835cd3", sourceSha256: "ba0fbb042edc19951270e602dbad9ebb413ebecda1069092bf6d63b2066c1e49" };
  const reviewed = buildHookKeyframeImagePrompt({ personImageCount: 2, ...scope });
  assert.match(reviewed.prompt, /VERIFIED OPENING SCENE — The performer sits behind a pink keyboard/);
  assert.doesNotMatch(reviewed.prompt, /Lift the hand from screen-right to cover the mouth|Follow the reaching arm|ENDING STATE/);
  for (const changed of [{ sourceSha256: "a".repeat(64) }, { referenceId: "unknown-hook" }]) {
    assert.doesNotMatch(buildHookKeyframeImagePrompt({ personImageCount: 2, ...scope, ...changed }).prompt, /VERIFIED OPENING SCENE/);
  }
});

test("one main photo is enough to prepare and supporting views never become mandatory or invented", () => {
  const result = buildHookKeyframeImagePrompt({ personImageCount: 1 });
  assert.equal(result.imageCount, 2);
  assert.match(result.prompt, /only identity photo/);
  assert.doesNotMatch(result.prompt, /Image 3|SUPPORTING VIEWS/);
  const two = buildHookKeyframeImagePrompt({ personImageCount: 2 });
  assert.match(two.prompt, /Image 3 is an additional view/);
});

test("user image directions stay visible with preservation defaults and a bounded prompt budget", () => {
  const text = "Make the room background slightly darker.";
  const result = buildHookKeyframeImagePrompt({ personImageCount: 5, instructions: text });
  assert.match(result.prompt, /Apply explicit user-requested image changes/);
  assert.ok(result.prompt.endsWith(`USER IMAGE INSTRUCTIONS:\n${text}`));
  assert.ok(buildHookKeyframeImagePrompt({ personImageCount: 5, instructions: "x".repeat(2_000) }).prompt.length < HOOK_KEYFRAME_IMAGE_PROMPT_MAX_LENGTH);
});

test("invalid capacities and control text fail before any image request can be built", () => {
  for (const personImageCount of [0, 6, 1.5, NaN, Infinity]) assert.throws(() => buildHookKeyframeImagePrompt({ personImageCount }));
  assert.throws(() => buildHookKeyframeImagePrompt({ personImageCount: 1, instructions: "x".repeat(2_001) }));
  assert.throws(() => buildHookKeyframeImagePrompt({ personImageCount: 1, instructions: "bad\u0000text" }));
});
