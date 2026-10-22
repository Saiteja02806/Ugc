import assert from "node:assert/strict";
import test from "node:test";
import { hookKeyframeGenerationInputKey, hookKeyframePromptSha256, hookKeyframeSnapshotKey, hookKeyframeSourceRatio, isHookKeyframeImageInput,
  parseHookKeyframeGenerationReceipt, type HookKeyframeGenerationReceipt } from "./hook-keyframe-generation-contract.js";
const partial = { ownerId: "owner", draftId: "00000000-0000-4000-8000-000000000001", referenceId: "explore-hook-fixture", sourceSha256: "a".repeat(64),
  sourceFrame: { index: 0 as const, timeSeconds: 0 as const, width: 720, height: 1280, sha256: "b".repeat(64) },
  personImageAssetIds: ["00000000-0000-4000-8000-000000000002"], instructions: "Keep the same room." };
const receipt: HookKeyframeGenerationReceipt = { ...partial, version: 1, purpose: "hook_starting_frame", promptVersion: 1,
  inputKey: hookKeyframeGenerationInputKey(partial), promptSha256: hookKeyframePromptSha256("compiled-image-prompt") };
const scene = `https://media.test/${hookKeyframeSnapshotKey(receipt)}`;
test("receipt binds the decoded scene and ordered person IDs without accepting generic reference roles", () => {
  assert.deepEqual(parseHookKeyframeGenerationReceipt(receipt), receipt);
  assert.equal(isHookKeyframeImageInput({ receipt, ownerId: "owner", model: "nano_banana_2", aspectRatio: "9:16", prompt: "compiled-image-prompt",
    referenceImageUrl: scene, referenceImageUrls: [scene, "https://media.test/main.png"] }), true);
  for (const change of [{ ownerId: "other" }, { model: "gpt_image" }, { aspectRatio: "4:5" }, { prompt: "unbound instructions" },
    { referenceImageUrls: [scene] }]) {
    assert.equal(isHookKeyframeImageInput({ receipt, ownerId: "owner", model: "nano_banana_2", aspectRatio: "9:16", prompt: "compiled-image-prompt",
      referenceImageUrl: scene, referenceImageUrls: [scene, "https://media.test/main.png"], ...change }), false);
  }
});
test("the scene URL must bind both source and decoded frame hashes and all photo URLs must be HTTPS", () => {
  const valid = { receipt, ownerId: "owner", model: "nano_banana_2", aspectRatio: "9:16", prompt: "compiled-image-prompt", referenceImageUrl: scene, referenceImageUrls: [scene, "https://media.test/main.png"] };
  for (const changedScene of ["https://media.test/frame.png", scene.replace("a".repeat(64), "c".repeat(64)), scene.replace("b".repeat(64), "c".repeat(64)), `${scene}?wrong=1`]) {
    assert.equal(isHookKeyframeImageInput({ ...valid, referenceImageUrl: changedScene, referenceImageUrls: [changedScene, valid.referenceImageUrls[1]] }), false);
  }
  for (const photo of ["http://media.test/main.png", "not-a-url", "https://user:secret@media.test/main.png", "https://media.test/main.png#fragment", scene]) {
    assert.equal(isHookKeyframeImageInput({ ...valid, referenceImageUrls: [scene, photo] }), false);
  }
});
test("stale hash, image order, sourceframe and extra URL fields cannot reuse a receipt", () => {
  for (const change of [{ sourceSha256: "c".repeat(64) }, { personImageAssetIds: [...receipt.personImageAssetIds, receipt.personImageAssetIds[0]] },
    { sourceFrame: { ...receipt.sourceFrame, index: 1 } }, { sourceFrame: { ...receipt.sourceFrame, width: 719 } },
    { instructions: "Different room" }, { sourceUrl: "https://untrusted.test/video.mp4" }]) assert.equal(parseHookKeyframeGenerationReceipt({ ...receipt, ...change }), null);
  assert.equal(hookKeyframeSourceRatio(720, 1280), "9:16");
  assert.equal(hookKeyframeSourceRatio(719, 1280), null);
});

test("the new image prompt contract retains the legacy preparation key and accepted V1 receipt", () => {
  const v2 = { ...receipt, promptVersion: 2 as const, promptSha256: hookKeyframePromptSha256("new labelled image edit") };
  assert.deepEqual(parseHookKeyframeGenerationReceipt(v2), v2);
  assert.deepEqual(parseHookKeyframeGenerationReceipt(receipt), receipt);
  assert.equal(v2.inputKey, receipt.inputKey);
  assert.equal(parseHookKeyframeGenerationReceipt({ ...v2, promptVersion: 3 }), null);
});

test("model-aware receipts bind model into input identity while legacy receipts remain unchanged", () => {
  for (const model of ["gemini_3_pro", "nano_banana_2"] as const) {
    const selected = { ...receipt, version: 2 as const, imageModel: model, promptVersion: 2 as const };
    selected.inputKey = hookKeyframeGenerationInputKey(selected);
    assert.deepEqual(parseHookKeyframeGenerationReceipt(selected), selected);
    assert.notEqual(selected.inputKey, receipt.inputKey);
    assert.equal(isHookKeyframeImageInput({ receipt: selected, ownerId: "owner", model, aspectRatio: "9:16", prompt: "compiled-image-prompt",
      referenceImageUrl: scene, referenceImageUrls: [scene, "https://media.test/main.png"] }), true);
    assert.equal(isHookKeyframeImageInput({ receipt: selected, ownerId: "owner", model: model === "gemini_3_pro" ? "nano_banana_2" : "gemini_3_pro", aspectRatio: "9:16", prompt: "compiled-image-prompt",
      referenceImageUrl: scene, referenceImageUrls: [scene, "https://media.test/main.png"] }), false);
  }
  assert.equal(parseHookKeyframeGenerationReceipt({ ...receipt, version: 2 }), null);
  assert.equal(parseHookKeyframeGenerationReceipt({ ...receipt, imageModel: "gemini_3_pro" }), null);
  const fivePersonImages = Array.from({ length: 5 }, (_, index) => `00000000-0000-4000-8000-00000000000${index + 2}`);
  for (const model of ["gemini_3_pro", "nano_banana_2"] as const) {
    const selected = { ...receipt, version: 2 as const, imageModel: model, promptVersion: 2 as const, personImageAssetIds: fivePersonImages };
    selected.inputKey = hookKeyframeGenerationInputKey(selected);
    assert.equal(Boolean(parseHookKeyframeGenerationReceipt(selected)), model === "gemini_3_pro");
  }
});
