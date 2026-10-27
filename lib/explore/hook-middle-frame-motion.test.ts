import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, mkdirSync, mkdtempSync } from "node:fs";
import { resolve } from "node:path";
import publicFrames from "../../worker/src/lib/hook-curated-frames.json" with { type: "json" };
import privateFrames from "../../worker/src/lib/creator-source-frames.json" with { type: "json" };
import { getHookFullRecreationPilot } from "../../worker/src/lib/hook-full-recreation-pilot.ts";
import { buildSourceMotionDirections, getPublicMiddleFrameMotionEntry, retimeSourceMotionDirections, validateMiddleFrameMotionEntry } from "./hook-middle-frame-motion.ts";
import { buildHookAnimationPrompt } from "./hook-keyframe-motion.ts";
import { buildHookFullRecreationOpeningImagePrompt } from "./hook-keyframe-image-prompt.ts";
import { getCreatorMiddleFramePrompt, creatorAccountDirections, getCreatorAccountSource, readCreatorStartingFrame, getCreatorAccounts } from "./creator-accounts.ts";
import { readCreatorPrivateJson } from "./creator-private-files.ts";
import { getHookKeyframePromptPreview } from "./hook-keyframe-prompt-preview.ts";
import { createHookKeyframeDraft, updateHookKeyframeDraft } from "./hook-keyframe-draft.ts";
import { hookKeyframeGenerationInputKey, hookKeyframePromptSha256, isHookKeyframeImageInput, parseHookKeyframeGenerationReceipt } from "../../worker/src/lib/hook-keyframe-generation-contract.ts";
import { creatorSceneCanonicalUrl, resolveCreatorSceneDelivery, verifyCreatorSceneDelivery } from "../../worker/src/lib/creator-scene-delivery.ts";

const privateCandidates = JSON.parse(readFileSync(new URL("../../docs/prompt-reviews/middle-frame-private-2026-10-26.json", import.meta.url), "utf8")).items;
const privatePackageAvailable = Boolean(getCreatorMiddleFramePrompt(privateFrames.frames[0].referenceId, privateFrames.frames[0].sourceSha256));

test("all31 respective references compile full-source assignments and role-bound receipts", () => {
  const all = [...publicFrames.frames, ...privateFrames.frames.filter(f => f.index > 0)];
  assert.equal(all.length, 31);
  for (const frame of all) {
    const privateCase = frame.referenceId.startsWith("creator-account-");
    const entry = privateCase ? getCreatorMiddleFramePrompt(frame.referenceId, frame.sourceSha256) ?? privateCandidates.find((row: { referenceId: string }) => row.referenceId === frame.referenceId) : getPublicMiddleFrameMotionEntry(frame.referenceId, frame.sourceSha256, frame.index);
    assert.ok(entry, frame.referenceId);
    assert.ok(validateMiddleFrameMotionEntry(entry));
    if (privateCase) assert.equal(getCreatorMiddleFramePrompt(frame.referenceId, "f".repeat(64)), undefined);
    else {
      assert.equal(getPublicMiddleFrameMotionEntry(frame.referenceId, "f".repeat(64), frame.index), undefined);
      assert.equal(getPublicMiddleFrameMotionEntry(frame.referenceId, frame.sourceSha256, frame.index + 1), undefined);
    }
    assert.ok(getHookFullRecreationPilot(frame.referenceId, frame.sourceSha256));
    assert.equal(getHookFullRecreationPilot(frame.referenceId, "f".repeat(64)), undefined);
    const directions = privateCase ? creatorAccountDirections(frame.referenceId, frame.sourceSha256, frame.index, frame.sha256) ?? buildSourceMotionDirections(entry) : buildSourceMotionDirections(entry);
    assert.match(directions, /OPENING: PHASE \[0/);
    for (const durationSeconds of [3, 4, 8, 10]) {
      const prompt = buildHookAnimationPrompt({ directions, durationSeconds, generateAudio: false });
      assert.match(prompt, new RegExp(`–${durationSeconds}s:`));
      assert.ok(prompt.includes(entry.endingState));
      assert.doesNotMatch(prompt, /PHASE \[/);
    }
    const image = buildHookFullRecreationOpeningImagePrompt({ personImageCount: 2, referenceId: frame.referenceId, sourceSha256: frame.sourceSha256, assignedEntry: privateCase ? entry : undefined });
    assert.equal(image.imageCount, 4);
    assert.match(image.prompt, /Image 1/); assert.match(image.prompt, /Image 2/); assert.match(image.prompt, /Image 3/);
    const sourceFrame = { index: frame.index, timeSeconds: frame.timeSeconds, sha256: frame.sha256, width: frame.width, height: frame.height };
    const partial = { version: 4 as const, ownerId: "owner", draftId: "11111111-1111-4111-8111-111111111111", referenceId: frame.referenceId, sourceSha256: frame.sourceSha256, sourceFrame,
      animationOpeningFrame: { index: 0, timeSeconds: 0, sha256: "c".repeat(64), width: frame.width, height: frame.height }, imageModel: "gemini_3_pro" as const,
      personImageAssetIds: ["22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333"], instructions: "", preparationInputKey: "" };
    partial.preparationInputKey = JSON.stringify({ version: 3, ownerId: partial.ownerId, draftId: partial.draftId, referenceId: partial.referenceId, sourceSha256: partial.sourceSha256, sourceFrame, imageAssetIds: partial.personImageAssetIds, instructions: "", imageModel: partial.imageModel });
    const receipt = { ...partial, purpose: "hook_starting_frame" as const, promptVersion: 5 as const, inputKey: hookKeyframeGenerationInputKey(partial), promptSha256: hookKeyframePromptSha256(image.prompt) };
    assert.ok(parseHookKeyframeGenerationReceipt(receipt));
    assert.equal(parseHookKeyframeGenerationReceipt({ ...receipt, sourceFrame: { ...sourceFrame, timeSeconds: 0 } }), null);
    if (privateCase) {
      const urls = [creatorSceneCanonicalUrl(receipt, "opening"), creatorSceneCanonicalUrl(receipt), "https://owned.example/a.png", "https://owned.example/b.png"];
      const input = { receipt, ownerId: "owner", model: "gemini_3_pro", aspectRatio: "9:16", prompt: image.prompt, referenceImageUrl: urls[0], referenceImageUrls: urls };
      assert.ok(isHookKeyframeImageInput(input));
      assert.equal(isHookKeyframeImageInput({ ...input, referenceImageUrl: urls[1], referenceImageUrls: [urls[1], urls[0], ...urls.slice(2)] }), false);
      assert.equal(isHookKeyframeImageInput({ ...input, referenceImageUrl: urls[0].replace("www.getugcpilot.com", "evil.example"), referenceImageUrls: [urls[0].replace("www.getugcpilot.com", "evil.example"), ...urls.slice(1)] }), false);
    }
  }
});

test("new assigned defaults preserve explicit edits and old selected-pose image continuations", () => {
  for (const frame of publicFrames.frames) {
    const draft = updateHookKeyframeDraft(createHookKeyframeDraft({ ownerId: "owner", draftId: "11111111-1111-4111-8111-111111111111", referenceId: frame.referenceId, sourceSha256: frame.sourceSha256 }), { sourceFrame: { index: frame.index, timeSeconds: frame.timeSeconds, sha256: frame.sha256, width: frame.width, height: frame.height }, imageAssetIds: ["22222222-2222-4222-8222-222222222222"] });
    assert.equal(getHookKeyframePromptPreview(draft).animationError, null);
    const edited = { ...draft, motionInstructions: "Keep my deliberate slow glance and smile." };
    assert.equal(getHookKeyframePromptPreview(edited).directions, edited.motionInstructions);
    assert.equal(retimeSourceMotionDirections(edited.motionInstructions, 3), edited.motionInstructions);
    const legacy = { ...draft, generatedImage: { assetId: draft.imageAssetIds[0], inputKey: "old", promptVersion: 4 as const } };
    assert.doesNotMatch(getHookKeyframePromptPreview(legacy).directions, /PHASE \[/);
    assert.equal(getHookKeyframePromptPreview({ ...draft, motionInstructions: "" }).directions, "");
  }
  assert.throws(() => retimeSourceMotionDirections("PHASE [0–0.5]: hold", 3));
});

test("private assignment stays gated and original opening plus anchor remain signed private stills", { skip: !privatePackageAvailable && "Private source package unavailable; metadata/compiler coverage remains active." }, async () => {
  assert.deepEqual(getCreatorAccounts({ email: "other@example.com", emailVerified: true }), []);
  process.env.CREATOR_REFERENCE_SIGNING_SECRET = "a-fixture-secret-of-at-least-32-characters";
  try {
    for (const frame of privateFrames.frames.filter(f => f.index > 0)) {
      const source = getCreatorAccountSource(frame.referenceId)!;
      const opening = await readCreatorStartingFrame(frame.referenceId, source.posterSha256);
      assert.equal(opening?.frame.index, 0); assert.equal(opening?.frame.timeSeconds, 0);
      const receipt = { version: 4, referenceId: frame.referenceId, sourceSha256: frame.sourceSha256, sourceFrame: { sha256: frame.sha256 }, animationOpeningFrame: { sha256: source.posterSha256 } };
      for (const role of ["opening", "source"] as const) {
        const signed = resolveCreatorSceneDelivery(creatorSceneCanonicalUrl(receipt, role), receipt);
        assert.equal(verifyCreatorSceneDelivery(new URL(signed))?.frameSha256, role === "opening" ? source.posterSha256 : frame.sha256);
      }
      assert.throws(() => resolveCreatorSceneDelivery(creatorSceneCanonicalUrl(receipt).replace(frame.sha256, "f".repeat(64)), receipt));
    }
  } finally { delete process.env.CREATOR_REFERENCE_SIGNING_SECRET; }
  const publicBundle = readFileSync(new URL("./hook-middle-frame-public.json", import.meta.url), "utf8");
  assert.doesNotMatch(publicBundle, /creator-account-/);
});


test("an older private release without new ciphertext keeps unrelated routes loadable", () => {
  const directory = process.cwd();
  mkdirSync(resolve(directory, ".tmp"), { recursive: true });
  const fixture = mkdtempSync(resolve(directory, ".tmp/middle-frame-missing-package-"));
  const environment = process.env as Record<string, string | undefined>;
  const mode = environment.NODE_ENV, key = environment.CREATOR_PRIVATE_PACKAGE_KEY;
  try {
    process.chdir(fixture);
    environment.NODE_ENV = "production";
    process.env.CREATOR_PRIVATE_PACKAGE_KEY = "a".repeat(64);
    const absent = { entries: [] };
    assert.equal(readCreatorPrivateJson("creator-middle-frame-prompts.json", absent), absent);
    assert.throws(() => buildHookFullRecreationOpeningImagePrompt({ personImageCount: 1, referenceId: "creator-account-1-01", sourceSha256: privateFrames.frames[0].sourceSha256 }));
  } finally {
    process.chdir(directory);
    if (mode === undefined) delete environment.NODE_ENV; else environment.NODE_ENV = mode;
    if (key === undefined) delete process.env.CREATOR_PRIVATE_PACKAGE_KEY; else process.env.CREATOR_PRIVATE_PACKAGE_KEY = key;
  }
});
