import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { getCuratedHookMotionPlan } from "./hook-curated-motion.ts";
import { getHookFullRecreationPilot, hookFullRecreationPilot } from "./hook-full-recreation-pilot.ts";
import { buildHookFullRecreationOpeningImagePrompt } from "./hook-keyframe-image-prompt.ts";
import { hookMotionPlanDirections } from "./hook-keyframe-motion.ts";
import {
  hookKeyframeAnchorBytesMatch,
  hookKeyframeGenerationInputKey,
  hookKeyframeProviderImageLabels,
  hookKeyframePromptSha256,
  hookKeyframeReferenceImageCount,
  hookKeyframeSceneBytesMatch,
  hookKeyframeSnapshotKey,
  isHookKeyframeImageInput,
  parseHookKeyframeGenerationReceipt,
  type HookKeyframeGenerationReceipt,
} from "../../worker/src/lib/hook-keyframe-generation-contract.ts";

const ownerId = "pilot-owner";
const draftId = "00000000-0000-4000-8000-000000000001";
const personImageAssetIds = ["00000000-0000-4000-8000-000000000002", "00000000-0000-4000-8000-000000000003"];
const pngHash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
function openingPng() {
  const png = Buffer.alloc(80);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png);
  png.write("IHDR", 12); png.writeUInt32BE(720, 16); png.writeUInt32BE(1280, 20);
  return png;
}

async function fixture() {
  const pilot = hookFullRecreationPilot, opening = openingPng();
  const anchor = await readFile(join(process.cwd(), "public", "explore", "curated-hook-frames", "v1", `${pilot.identityClarityAnchor.sha256}.png`));
  const sourceFrame = { index: pilot.identityClarityAnchor.index, timeSeconds: pilot.identityClarityAnchor.timeSeconds,
    width: pilot.identityClarityAnchor.width, height: pilot.identityClarityAnchor.height, sha256: pilot.identityClarityAnchor.sha256 };
  const animationOpeningFrame = { index: 0, timeSeconds: 0, width: 720, height: 1280, sha256: pngHash(opening) };
  const instructions = "Preserve the opening hand-to-glasses contact.";
  const preparationInputKey = JSON.stringify({ version: 3, ownerId, draftId, referenceId: pilot.referenceId,
    sourceSha256: pilot.sourceSha256, sourceFrame, imageAssetIds: personImageAssetIds, instructions, imageModel: "nano_banana_2" });
  const prompt = buildHookFullRecreationOpeningImagePrompt({ personImageCount: personImageAssetIds.length, instructions,
    referenceId: pilot.referenceId, sourceSha256: pilot.sourceSha256 }).prompt;
  const partial = { version: 4 as const, imageModel: "nano_banana_2" as const, ownerId, draftId, referenceId: pilot.referenceId,
    sourceSha256: pilot.sourceSha256, sourceFrame, animationOpeningFrame, preparationInputKey, personImageAssetIds, instructions };
  const receipt: HookKeyframeGenerationReceipt = { ...partial, purpose: "hook_starting_frame", promptVersion: 5,
    inputKey: hookKeyframeGenerationInputKey(partial), promptSha256: hookKeyframePromptSha256(prompt) };
  return { anchor, opening, prompt, receipt };
}

test("Hook 100 retains its frozen receipt identity while its assigned motion and its motion covers true t=0 through ending", () => {
  const pilot = hookFullRecreationPilot;
  assert.equal(getHookFullRecreationPilot(pilot.referenceId, pilot.sourceSha256), pilot);
  assert.equal(getHookFullRecreationPilot(pilot.referenceId, "a".repeat(64)), undefined);
  assert.equal(getHookFullRecreationPilot("explore-paired-hook-neighbor", pilot.sourceSha256), undefined);
  const plan = getCuratedHookMotionPlan(pilot.referenceId, pilot.sourceSha256, pilot.identityClarityAnchor.index)!;
  const directions = hookMotionPlanDirections(plan);
  assert.match(directions, /OPENING: PHASE \[0/);
  assert.match(directions, /Pull the glasses forward/);
  assert.match(directions, /Blink and turn/);
  assert.match(directions, /final frame/);
  assert.doesNotMatch(directions, /glasses are already off|do not repeat a gesture that has already finished/);
});

test("pilot opening-image prompt keeps opening, clarity and influencer roles separate", () => {
  const prompt = buildHookFullRecreationOpeningImagePrompt({ personImageCount: 2, referenceId: hookFullRecreationPilot.referenceId,
    sourceSha256: hookFullRecreationPilot.sourceSha256 }).prompt;
  assert.match(prompt, /Image 1 is the sole blueprint for output time t=0\.000/);
  assert.match(prompt, /Image 2 .*not the output pose, not video time zero and not an identity photo/);
  assert.match(prompt, /Image 3 is the main identity photo and the only person/);
  assert.match(prompt, /round eyeglasses on the face/);
  assert.match(prompt, /do not jump ahead to a clear front-facing pose/);
  assert.match(prompt, /REQUIRED CAPTION DELETION/);
  assert.match(prompt, /"POV: you finally understand" \/ "how to use Claude" \/ "for marketing"/);
  assert.match(prompt, /approximately y=63% to 80%/);
  assert.match(prompt, /Remove every white letter, black outline and shadow/);
  assert.match(prompt, /Scene-preservation instructions apply to the physical scene/);
  assert.throws(() => buildHookFullRecreationOpeningImagePrompt({ personImageCount: 1, referenceId: "other", sourceSha256: hookFullRecreationPilot.sourceSha256 }));
});

test("v4 receipt and provider order bind opening, anchor and identities and fail closed when altered", async () => {
  const { anchor, opening, prompt, receipt } = await fixture();
  assert.ok(parseHookKeyframeGenerationReceipt(receipt));
  assert.equal(hookKeyframeReferenceImageCount(receipt), 4);
  assert.ok(hookKeyframeSceneBytesMatch(receipt, { buffer: opening, contentType: "image/png" }));
  assert.ok(hookKeyframeAnchorBytesMatch(receipt, { buffer: anchor, contentType: "image/png" }));
  const openingUrl = `https://owned-media.example.test/${hookKeyframeSnapshotKey({ ...receipt, sourceFrame: receipt.animationOpeningFrame! })}`;
  const anchorUrl = `https://owned-media.example.test/${hookKeyframeSnapshotKey(receipt)}`;
  const urls = [openingUrl, anchorUrl, "https://owned-media.example.test/person-main.png", "https://owned-media.example.test/person-support.png"];
  assert.ok(isHookKeyframeImageInput({ receipt, ownerId, model: "nano_banana_2", aspectRatio: "9:16", prompt,
    referenceImageUrl: openingUrl, referenceImageUrls: urls }));
  assert.equal(isHookKeyframeImageInput({ receipt, ownerId, model: "nano_banana_2", aspectRatio: "9:16", prompt,
    referenceImageUrl: anchorUrl, referenceImageUrls: [anchorUrl, openingUrl, ...urls.slice(2)] }), false);
  const labels = hookKeyframeProviderImageLabels(2, 5);
  assert.match(labels[0], /ANIMATION_OPENING_FRAME_BLUEPRINT/); assert.match(labels[1], /IDENTITY_CLARITY_ANCHOR/);
  assert.match(labels[2], /MAIN_INFLUENCER_IDENTITY/); assert.equal(labels.length, 4);
  for (const changed of [
    { sourceFrame: { ...receipt.sourceFrame, timeSeconds: 0 } },
    { animationOpeningFrame: { ...receipt.animationOpeningFrame!, timeSeconds: 0.1 } },
    { preparationInputKey: `${receipt.preparationInputKey}changed` },
    { promptVersion: 4 },
  ]) assert.equal(parseHookKeyframeGenerationReceipt({ ...receipt, ...changed }), null);
});
