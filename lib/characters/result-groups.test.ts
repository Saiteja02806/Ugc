import assert from "node:assert/strict";
import test from "node:test";
import { characterResultGroups } from "./result-groups.ts";

test("results retain batch order and original image indexes without merging identical prompts", () => {
  const receipts = ["a", "b", "c"].map(jobId => ({ jobId, generationId: jobId }));
  const jobs = receipts.map(({ jobId }, index) => ({ id: jobId, batchId: index < 2 ? "first" : "second", prompt: "Identical prompt", status: "queued" as const, isTerminal: false, error: null, output: null }));
  const groups = characterResultGroups(receipts, jobs);
  assert.deepEqual(groups.map(group => [group.id, group.prompt, group.items.map(item => item.index)]), [["first", "Identical prompt", [0, 1]], ["second", "Identical prompt", [2]]]);
  assert.deepEqual(characterResultGroups(receipts.slice(1), jobs)[0].items.map(item => item.receipt.jobId), ["b"]);
});

test("missing metadata never borrows a draft or another generation's prompt", () => {
  const receipts = ["a", "b"].map(jobId => ({ jobId, generationId: jobId }));
  assert.deepEqual(characterResultGroups(receipts).map(group => group.prompt), [null, null]);
  assert.deepEqual(characterResultGroups([], []), []);
});
