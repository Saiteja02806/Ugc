import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { buildSourceMotionDirections } from "./hook-middle-frame-motion.ts";
import { createHookKeyframeDraft, updateHookKeyframeDraft } from "./hook-keyframe-draft.ts";
import { getHookKeyframePromptPreview } from "./hook-keyframe-prompt-preview.ts";

const hash = "a".repeat(64), poster = "b".repeat(64), anchor = "c".repeat(64);
const revised = "OPENING STATE: Quiet opening.\nOPENING: PHASE [0–0.75]: Retain the pause.\nENDING: PHASE [0.75–1]: Complete the late gaze.\nCAMERA: Steady.\nENDING STATE: Gaze lowered.";
const makeSource = (id: string, index: number) => ({ id, sourceSha256: hash, posterSha256: poster, durationSeconds: 2, width: 720, height: 1280, startingFrame: { index, timeSeconds: index / 30, sha256: anchor } });
const normal = makeSource("creator-account-fixture-normal", 0), middle = makeSource("creator-account-fixture-middle", 1);
const entry = { referenceId: middle.id, sourceSha256: hash, sourceDurationSeconds: 2, sourceFps: 30, sourceFrameCount: 60,
 clarityFrame: { index: 1, timeSeconds: 1 / 30, sha256: anchor }, openingState: "Quiet opening.", camera: "Steady.", endingState: "Earlier ending.", openingImageRequirement: "Keep opening.",
 beats: [{ startSeconds: 0, endSeconds: 2, action: "Earlier movement." }], captionCleanup: { text: "", region: "" }, visualQualification: "not_tested" as const };
const reviews = [normal, middle].map(source => ({ id: source.id, sourceSha256: hash, directions: "PHASE [0–1]: Earlier normal movement.", selectedFrameDirections: "Earlier selected-pose continuation.", selectedFrameSha256: anchor, caption: "Fixture text", originalOpeningDirections: revised }));
await mock.module("./creator-private-files.ts", { namedExports: {
 readCreatorPrivateFile: () => Buffer.alloc(0),
 readCreatorPrivateJson: (path: string, empty: unknown) => path === "creator-accounts.json" ? { accounts: [{ id: "fixture", label: "Fixture", items: [normal, middle] }] }
  : path === "creator-account-reviews.json" ? { items: reviews } : path === "creator-middle-frame-prompts.json" ? { entries: [entry] } : empty,
} });
// The synthetic IDs are deliberately outside the real image-pilot catalogue.
// This test isolates direction selection; real-package image admission is checked separately.
await mock.module("./hook-keyframe-image-prompt.ts", { namedExports: {
 buildHookFullRecreationOpeningImagePrompt: () => ({ prompt: "Fixture image preparation." }),
} });
const { creatorAccountDirections, getCreatorAccounts } = await import("./creator-accounts.ts");

test("source-bound opening revisions reach both account routes while legacy directions stay unchanged", () => {
 for (const source of [normal, middle]) {
  assert.equal(creatorAccountDirections(source.id, hash, 0, poster, true), revised);
  assert.equal(creatorAccountDirections(source.id, "f".repeat(64), 0, poster, true), undefined);
  assert.equal(creatorAccountDirections(source.id, hash, 1, poster, true), undefined);
  assert.equal(creatorAccountDirections(source.id, hash, 0, "f".repeat(64), true), undefined);
 }
 assert.equal(creatorAccountDirections(normal.id, hash, 0, anchor), reviews[0].selectedFrameDirections);
 assert.equal(creatorAccountDirections(middle.id, hash, 1, anchor), buildSourceMotionDirections(entry));
 const accounts = getCreatorAccounts({ email: "vtu19403@veltech.edu.in", emailVerified: true });
 assert.deepEqual(accounts[0].items.map(item => item.generationPrompt), [revised, revised]);
 assert.deepEqual(getCreatorAccounts({ email: "other@example.com", emailVerified: true }), []);
 assert.deepEqual(getCreatorAccounts({ email: "vtu19403@veltech.edu.in", emailVerified: false }), []);
});

test("an absent revision keeps the prior default, while an empty or untimed revision fails closed", () => {
 const review = reviews[0], previous = review.originalOpeningDirections;
 try {
  Reflect.deleteProperty(review, "originalOpeningDirections");
  assert.equal(creatorAccountDirections(normal.id, hash, 0, poster, true), review.directions);
  review.originalOpeningDirections = "";
  assert.equal(creatorAccountDirections(normal.id, hash, 0, poster, true), undefined);
  review.originalOpeningDirections = "Untimed replacement.";
  assert.equal(creatorAccountDirections(normal.id, hash, 0, poster, true), undefined);
 } finally { review.originalOpeningDirections = previous; }
});

test("new opening revision compiles source-speed timing and explicit saved edits stay authoritative", () => {
 const draft = updateHookKeyframeDraft(createHookKeyframeDraft({ ownerId: "owner", draftId: "11111111-1111-4111-8111-111111111111", referenceId: normal.id, sourceSha256: hash }), { sourceFrame: { index: 0, timeSeconds: 0, sha256: poster, width: 720, height: 1280 } });
 const preview = getHookKeyframePromptPreview(draft, "hook", revised, undefined, undefined, 2);
 assert.match(preview.animationPrompt!, /1\.5–2s: Complete the late gaze/);
 assert.match(preview.animationPrompt!, /FINAL HOLD 2–3s/);
 for (const motionInstructions of ["Keep my own motion.", ""]) {
  assert.equal(getHookKeyframePromptPreview({ ...draft, motionInstructions }, "hook", revised).directions, motionInstructions);
 }
});
