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
