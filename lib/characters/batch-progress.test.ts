import assert from "node:assert/strict";
import test from "node:test";
import { characterBatchProgress } from "./batch-progress.ts";
import type { CharacterJobStatusResponse } from "./types.ts";

const receipts = [1, 2].map(n => ({ jobId: `job-${n}`, generationId: `image-${n}` }));
const completed = { id: "job-1", model: "gpt_image_2_5", status: "completed", isTerminal: true, error: null,
  output: { url: "https://example.test/image.png", mediaAssetId: "asset", generationId: "image-1", width: 720, height: 1280, ratio: "9:16" } } satisfies CharacterJobStatusResponse["job"];
const failed = { id: "job-2", model: "gpt_image_2_5", status: "failed", isTerminal: true, error: "Content moderation", output: null } satisfies CharacterJobStatusResponse["job"];

test("a two-image batch with a rejected second candidate reports partial success", () => {
  assert.deepEqual(characterBatchProgress(receipts, [failed, completed]), {
    created: 1, unavailable: 1, pending: 0, message: "1 of 2 images created · 1 image could not be created.",
  });
});
test("unfinished candidates remain counted when another image has already completed", () => {
  assert.equal(characterBatchProgress(receipts, [completed]).message, "1 of 2 images created · 1 still processing.");
  assert.equal(characterBatchProgress(receipts).pending, 2);
});
test("completed status without a saved output is not presented as a created image", () => {
  assert.equal(characterBatchProgress(receipts, [{ ...completed, output: null }, failed]).message,
    "0 of 2 images created · 1 image could not be created · 1 still processing.");
});
test("counts only this batch's candidates even when statuses contain unrelated images", () => {
  const result = characterBatchProgress(receipts, [completed, { ...completed, id: "job-2" }, { ...failed, id: "other-job" }]);
  assert.equal(result.message, "2 of 2 images created. Saved to My influencers.");
});
