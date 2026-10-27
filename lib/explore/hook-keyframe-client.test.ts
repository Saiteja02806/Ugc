import assert from "node:assert/strict";
import test from "node:test";
import { createHookKeyframeCheckpoint, verifiedHookKeyframeJob } from "./hook-keyframe-client.ts";
import { createHookKeyframeDraft, updateHookKeyframeDraft } from "./hook-keyframe-draft.ts";
const scope = { ownerId: "owner", draftId: "11111111-1111-4111-8111-111111111111", referenceId: "hook-fixture", sourceSha256: "a".repeat(64) };

test("client admission binds the completed image to the selected image model as well as its saved input key", () => {
  const draft = updateHookKeyframeDraft(createHookKeyframeDraft(scope), {
    sourceFrame: { index: 0, timeSeconds: 0, width: 720, height: 1280, sha256: "b".repeat(64) },
    imageAssetIds: ["22222222-2222-4222-8222-222222222222"],
  });
  const checkpoint = createHookKeyframeCheckpoint(draft, "33333333-3333-4333-8333-333333333333");
  const job = { id: "44444444-4444-4444-8444-444444444444", status: "completed", isTerminal: true, error: null,
    receipt: { ...scope, version: 2 as const, imageModel: "gemini_3_pro" as const, promptVersion: 2 as const, purpose: "hook_starting_frame" as const, inputKey: checkpoint.inputKey },
    output: { mediaAssetId: "55555555-5555-4555-8555-555555555555", url: "https://media.test/generated.png", width: 720, height: 1280 } };
  assert.equal(verifiedHookKeyframeJob(job, checkpoint).output!.mediaAssetId, job.output.mediaAssetId);
  assert.equal(verifiedHookKeyframeJob({ ...job, receipt: { ...job.receipt, promptVersion: 3 } }, checkpoint).output!.mediaAssetId, job.output.mediaAssetId);
  assert.equal(verifiedHookKeyframeJob({ ...job, receipt: { ...job.receipt, promptVersion: 4 } }, checkpoint).output!.mediaAssetId, job.output.mediaAssetId);
  assert.throws(() => verifiedHookKeyframeJob({ ...job, receipt: { ...job.receipt, imageModel: "nano_banana_2" } }, checkpoint));
  const switched = updateHookKeyframeDraft(draft, { imageModel: "nano_banana_2" });
  assert.throws(() => verifiedHookKeyframeJob(job, createHookKeyframeCheckpoint(switched, checkpoint.requestKey)));
});

test("v4 pilot recovery stays bound to the exact browser preparation without exposing server frame roles", () => {
  const inputKey = JSON.stringify({ version: 3, imageModel: "gemini_3_pro" });
  const checkpoint = {
    version: 1 as const,
    scope,
    inputKey,
    requestKey: "66666666-6666-4666-8666-666666666666",
    jobId: "77777777-7777-4777-8777-777777777777",
  };
  const job = {
    id: checkpoint.jobId,
    status: "completed",
    isTerminal: true,
    error: null,
    receipt: {
      ...scope,
      version: 4 as const,
      imageModel: "gemini_3_pro" as const,
      promptVersion: 5 as const,
      purpose: "hook_starting_frame" as const,
      inputKey: "server-only-v4-frame-binding",
      preparationInputKey: inputKey,
    },
    output: {
      mediaAssetId: "88888888-8888-4888-8888-888888888888",
      url: "https://media.test/generated-opening.png",
      width: 720,
      height: 1280,
    },
  };

  assert.equal(verifiedHookKeyframeJob(job, checkpoint).output!.url, job.output.url);
  assert.throws(() => verifiedHookKeyframeJob({
    ...job,
    receipt: { ...job.receipt, preparationInputKey: `${inputKey}changed` },
  }, checkpoint));
  assert.throws(() => verifiedHookKeyframeJob({
    ...job,
    receipt: { ...job.receipt, imageModel: "nano_banana_2" as const },
  }, checkpoint));
});
