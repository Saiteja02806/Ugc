import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { buildOriginalOpeningImagePrompt } from "./hook-keyframe-image-prompt.ts";
import { withStartingFrameReferenceOptions } from "../../worker/src/lib/starting-frame-reference-options.ts";
import { reviewedStartingFrameScene } from "../../worker/src/lib/starting-frame-reviewed-scene.ts";
import { parseHookKeyframeGenerationReceipt, hookKeyframeGenerationInputKey } from "../../worker/src/lib/hook-keyframe-generation-contract.ts";
import { createHookSourceTimeline } from "../../worker/src/lib/hook-source-timeline.ts";
import { verifiedHookKeyframeJob } from "./hook-keyframe-client.ts";
const source = { referenceId: "explore-paired-hook-17133540b2315e0a3a05bfbd", sourceSha256: "fef0dfdcf3482917368e74bea434b0918144662f5924ccc6b05c4eff86beb9fd" };
const options = { background: "source", outfit: "source", hairstyle: "source" } as const;

test("new source opening preserves expression, spatial sides and physical lighting without the old conflicting instructions", () => {
  const result = buildOriginalOpeningImagePrompt({ ...source, personImageCount: 2 });
  assert.equal(result.version, 9); assert.equal(result.imageCount, 3);
  assert.doesNotMatch(result.prompt, /COMPLEXION & YOUTH|subtle expression|relaxed lower eyelids|exact same.*brightness|without harsh dark shadows/);
  for (const phrase of [/Do not mirror/, /mouth opening/, /shadow variation/, /different brightness and shadows/, /raised hand is on screen-left/, /circular ceiling fixture/, /same shot, not a newly staged portrait/]) assert.match(result.prompt, phrase);
  const selected = withStartingFrameReferenceOptions(result.prompt, { background: "photo", outfit: "photo", hairstyle: "photo" });
  assert.match(selected, /BACKGROUND: Use Image2's environment/); assert.match(selected, /OUTFIT: Use Image2's clothing/);
  assert.match(selected, /HAIRSTYLE: Use Image2's hairstyle/);
});
test("source-specific description is bound to the reviewed video bytes and never leaks to a different reference", () => {
  assert.equal(reviewedStartingFrameScene(source.referenceId, "a".repeat(64)), "");
  assert.equal(reviewedStartingFrameScene("another-reference", source.sourceSha256), "");
  const generic = buildOriginalOpeningImagePrompt({ personImageCount: 1 });
  assert.doesNotMatch(generic.prompt, /circular ceiling|raised hand is on screen-left/);
  assert.match(generic.prompt, /original screen side/);
});
test("frozen version7 matches the exact historical audited prompt hash; version8 preserves supplied custom directions", () => {
  const old = buildOriginalOpeningImagePrompt({ personImageCount: 2, version: 7 });
  const sha = createHash("sha256").update(withStartingFrameReferenceOptions(old.prompt, options)).digest("hex");
  assert.equal(sha, "062bd2f91c65f54383977a7bc754f04115a86aa92b742d0257fb422ab4737e11");
  assert.match(old.prompt, /subtle expression/);
  const current = buildOriginalOpeningImagePrompt({ ...source, personImageCount: 2, instructions: "No extra fingers. Keep the source gesture." });
  assert(current.prompt.endsWith("USER IMAGE INSTRUCTIONS:\nNo extra fingers. Keep the source gesture."));
});
test("new8 and historical7 receipts and source timelines validate while other receipt versions cannot claim8", () => {
  const partial = { version: 5 as const, ownerId: "owner", draftId: "10000000-0000-4000-8000-000000000001", ...source,
    sourceFrame: { index: 0, timeSeconds: 0, width: 576, height: 1024, sha256: "b".repeat(64) }, imageModel: "gemini_3_pro" as const,
    preparationInputKey: "frozen-preparation", personImageAssetIds: ["10000000-0000-4000-8000-000000000002"], instructions: "" };
  partial.preparationInputKey = JSON.stringify({ version: 4, ownerId: partial.ownerId, draftId: partial.draftId, referenceId: partial.referenceId,
    sourceSha256: partial.sourceSha256, sourceFrame: partial.sourceFrame, imageAssetIds: partial.personImageAssetIds, instructions: partial.instructions, imageModel: partial.imageModel });
  for (const promptVersion of [7, 8, 9] as const) {
    const receipt = { ...partial, purpose: "hook_starting_frame" as const, promptVersion, promptSha256: "c".repeat(64), inputKey: hookKeyframeGenerationInputKey(partial) };
    assert(parseHookKeyframeGenerationReceipt(receipt));
    assert.equal(createHookSourceTimeline(receipt, 5, 5).actionDurationSeconds, 5);
    const checkpoint = { version: 1 as const, scope: { ownerId: partial.ownerId, draftId: partial.draftId, ...source },
      inputKey: partial.preparationInputKey, requestKey: partial.draftId, jobId: null };
    assert.equal(verifiedHookKeyframeJob({ id: partial.draftId, receipt, status: "queued", isTerminal: false, error: null, output: null }, checkpoint).receipt.promptVersion, promptVersion);
    if (promptVersion === 8) assert.equal(parseHookKeyframeGenerationReceipt({ ...receipt, version: 2 }), null);
  }
});

test("stage2Version 2 prompt locks spatial sides, hand separation, and open-mouth expression while scoping reviewed scene to exact source hash", async () => {
  const { buildHookKeyframeStage2Prompt } = await import("./hook-keyframe-image-prompt.ts");
  const matched = buildHookKeyframeStage2Prompt({
    stage2Version: 2,
    supportingImageCount: 1,
    referenceId: source.referenceId,
    sourceSha256: source.sourceSha256,
  });
  assert.match(matched, /STAGE 2 IDENTITY LOCK \(FACE SWAP & CAPTION CLEANUP ONLY\):/);
  assert.match(matched, /POSE, HAND & EXPRESSION LOCK/);
  assert.match(matched, /raised hand is on screen-left/);
  assert.match(matched, /Do not copy the closed mouth or neutral expression from Image 2/);
  assert.match(matched, /Do not import any background, clothing, or hairstyle from the face crops/);

  const unmatched = buildHookKeyframeStage2Prompt({
    stage2Version: 2,
    supportingImageCount: 0,
    referenceId: source.referenceId,
    sourceSha256: "a".repeat(64),
  });
  assert.doesNotMatch(unmatched, /raised hand is on screen-left/);
  assert.match(unmatched, /Image 2 is the only close-up identity face photo/);
});
