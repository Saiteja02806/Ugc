import assert from "node:assert/strict";
import test from "node:test";
import { ReactionTextEditRequestSchema, getReactionTextEditState } from "./reaction-edit-contract.ts";

const request = {
  assignmentId: "2d6f3916-2c5a-4937-9978-c38aa167ec70",
  expectedUpdatedAt: "2026-09-07T10:14:37.799811+00:00",
  text: "Me realizing the deadline was yesterday",
};

test("accepts text and line breaks while rejecting source or style changes", () => {
  assert.equal(ReactionTextEditRequestSchema.safeParse(request).success, true);
  assert.equal(ReactionTextEditRequestSchema.safeParse({ ...request, text: "Me realizing\nthe deadline\nwas yesterday" }).success, true);
  for (const field of ["clipAssetId", "backgroundAssetId", "position", "treatment", "mediaAssetId"]) {
    assert.equal(ReactionTextEditRequestSchema.safeParse({ ...request, [field]: "replacement" }).success, false);
  }
});

test("rejects blank, overly long, and unversioned edits", () => {
  for (const text of ["", "two words", "word ".repeat(21), "Me\nrealizing\nthe deadline\nwas yesterday"]) {
    assert.equal(ReactionTextEditRequestSchema.safeParse({ ...request, text }).success, false);
  }
  assert.equal(ReactionTextEditRequestSchema.safeParse({ ...request, expectedUpdatedAt: undefined }).success, false);
});

test("tracks preparation and failure separately from the original ready preview", () => {
  assert.equal(getReactionTextEditState({}), "ready");
  for (const [status, expected] of [["queued", "preparing"], ["failed", "failed"], ["ready", "ready"]]) {
    assert.equal(getReactionTextEditState({ userTextEdit: { lines: [request.text], revision: 1, status } }), expected);
  }
});
