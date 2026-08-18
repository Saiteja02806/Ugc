import assert from "node:assert/strict";
import test from "node:test";

import { classifyWallTextEdit } from "./wall-text-edit-attribution.ts";

test("unchanged and small Wall edits retain format learning", () => {
  const original = "The crowded plan looked productive until every important task competed for the same hour.";
  assert.equal(classifyWallTextEdit({ editedText: original.toUpperCase(), originalText: original }).classification, "none");
  const minor = classifyWallTextEdit({
    editedText: "The crowded plan seemed productive until every important task competed for the same hour.",
    originalText: original,
  });
  assert.equal(minor.classification, "minor");
  assert.equal(minor.formatLearningEligible, true);
});

test("a structural rewrite is major but still receives a duplicate signature", () => {
  const result = classifyWallTextEdit({
    editedText: "Protect one quiet hour before accepting new meetings, because attention disappears when the calendar becomes crowded.",
    originalText: "The crowded plan looked productive until every important task competed for the same hour.",
  });
  assert.equal(result.classification, "major");
  assert.equal(result.formatLearningEligible, false);
  assert.match(result.duplicateSignature.contentHash, /^[a-f0-9]{64}$/u);
});
