import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { buildHookKeyframeImagePrompt, HOOK_KEYFRAME_IMAGE_PROMPT_MAX_LENGTH } from "./hook-keyframe-image-prompt.ts";

test("the default reproduces the exact v4 prompt used in the user-approved image test", () => {
  const result = buildHookKeyframeImagePrompt({
    personImageCount: 3, instructions: "",
    referenceId: "explore-paired-hook-892b0f65083c8cf03270a7c9",
    sourceSha256: "03fbedda9e51efe9f318241f16aaed14cbb5f150c516e6e3c14ef4d0ea9c451f",
  });
  assert.equal(result.version, 4);
  assert.equal(createHash("sha256").update(result.prompt).digest("hex"),
    "f3d622fdc0b37c225bf0e1d40367cba76e12425a1e5ca15e7b8a55a650fb1c76");
});

test("scene and intended person are explicit and retain their real multi-image order", () => {
  const result = buildHookKeyframeImagePrompt({ personImageCount: 3 });
  assert.deepEqual(result.roles, [
    { imageIndex: 1, role: "scene" }, { imageIndex: 2, role: "main_face" },
    { imageIndex: 3, role: "supporting_face" }, { imageIndex: 4, role: "supporting_face" },
  ]);
  assert.equal(result.imageCount, 4);
  assert.equal(result.version, 4);
  assert.match(result.prompt, /^Generate a new photograph of my influencer/);
  assert.match(result.prompt, /VISUAL_REFERENCE/); assert.match(result.prompt, /MY_INFLUENCER/);
  assert.match(result.prompt, /Image 2 is the main face photo/);
  assert.match(result.prompt, /Image 3, Image 4 are additional views of the SAME person/);
  assert.match(result.prompt, /eye shape and spacing, brows, nose, lips, jawline/);
  assert.match(result.prompt, /recognizable likeness takes priority/);
  assert.doesNotMatch(result.prompt, /swap|replace|Edit Image 1|exact positions|source hairstyle|Recreate only the facial regions/i);
  assert.match(result.prompt, /face covered by hands or objects/);
  assert.match(result.prompt, /Omit creator-added captions/);
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

test("v5 is opt-in, retains image roles and uses only source-matched opening guidance", () => {
  const scope = { personImageCount: 3, referenceId: "explore-paired-hook-4585ee949081c4e5cd835cd3", sourceSha256: "ba0fbb042edc19951270e602dbad9ebb413ebecda1069092bf6d63b2066c1e49" };
  const baseline = buildHookKeyframeImagePrompt(scope);
  const candidate = buildHookKeyframeImagePrompt({ ...scope, promptVersion: 5, instructions: "Make the room background slightly darker." });
  assert.equal(baseline.version, 4);
  assert.equal(candidate.version, 5);
  assert.deepEqual(candidate.roles, baseline.roles);
  assert.equal(candidate.imageCount, baseline.imageCount);
  assert.match(candidate.prompt, /VERIFIED OPENING SCENE — The performer sits behind a pink keyboard/);
  assert.doesNotMatch(candidate.prompt, /Lift the hand from screen-right to cover the mouth|ENDING STATE/);
  assert.ok(candidate.prompt.endsWith("USER IMAGE INSTRUCTIONS:\nMake the room background slightly darker."));
  assert.doesNotMatch(buildHookKeyframeImagePrompt({ ...scope, promptVersion: 5, sourceSha256: "a".repeat(64) }).prompt, /VERIFIED OPENING SCENE/);
  assert.doesNotMatch(buildHookKeyframeImagePrompt({ personImageCount: 1, promptVersion: 5 }).prompt, /Image 3|SUPPORTING VIEWS/);
  assert.ok(buildHookKeyframeImagePrompt({ ...scope, promptVersion: 5, personImageCount: 5, instructions: "x".repeat(2_000) }).prompt.length < HOOK_KEYFRAME_IMAGE_PROMPT_MAX_LENGTH);
  // A malformed test-harness version must never silently run a different prompt.
  assert.throws(() => buildHookKeyframeImagePrompt({ personImageCount: 1, promptVersion: 99 as 5 }));
});

test("v6 remains opt-in with the same input order, source provenance and instruction budget", () => {
  const scope = { personImageCount: 3, referenceId: "explore-paired-hook-4585ee949081c4e5cd835cd3", sourceSha256: "ba0fbb042edc19951270e602dbad9ebb413ebecda1069092bf6d63b2066c1e49" };
  const baseline = buildHookKeyframeImagePrompt(scope);
  const candidate = buildHookKeyframeImagePrompt({ ...scope, promptVersion: 6 });
  assert.equal(baseline.version, 4);
  assert.equal(candidate.version, 6);
  assert.deepEqual(candidate.roles, baseline.roles);
  assert.equal(candidate.imageCount, baseline.imageCount);
  assert.match(candidate.prompt, /VERIFIED OPENING SCENE — The performer sits behind a pink keyboard/);
  assert.doesNotMatch(candidate.prompt, /Lift the hand from screen-right to cover the mouth|ENDING STATE/);
  assert.doesNotMatch(buildHookKeyframeImagePrompt({ ...scope, promptVersion: 6, sourceSha256: "a".repeat(64) }).prompt, /VERIFIED OPENING SCENE|The opening description is supplementary/);
  assert.doesNotMatch(buildHookKeyframeImagePrompt({ personImageCount: 1, promptVersion: 6 }).prompt, /Image 3|SUPPORTING VIEWS/);
  const instructions = "x".repeat(2_000);
  const full = buildHookKeyframeImagePrompt({ ...scope, promptVersion: 6, personImageCount: 5, instructions });
  assert.ok(full.prompt.endsWith(`USER IMAGE INSTRUCTIONS:\n${instructions}`));
  assert.ok(full.prompt.length < HOOK_KEYFRAME_IMAGE_PROMPT_MAX_LENGTH);
});
