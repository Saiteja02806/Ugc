import assert from "node:assert/strict";
import test from "node:test";

import {
  createWallTextDuplicateSignature,
  findWallTextDuplicate,
} from "./wall-text-duplicate-logic.ts";

test("Wall duplicate signatures ignore casing, spacing and punctuation", () => {
  const first = createWallTextDuplicateSignature("I tracked every large expense, but missed the small ones.");
  const second = createWallTextDuplicateSignature("  i TRACKED every large expense but missed the small ones! ");
  assert.equal(first.contentHash, second.contentHash);
  assert.equal(findWallTextDuplicate({ candidate: second, history: [first] })?.reason, "exact_duplicate");
});

test("basic local similarity catches repeated meaning without embeddings", () => {
  const history = createWallTextDuplicateSignature(
    "I kept tracking the biggest purchases but ignored the small daily expenses that changed the total.",
  );
  const candidate = createWallTextDuplicateSignature(
    "I kept tracking the biggest purchases but ignored small daily expenses that changed the total.",
  );
  assert.equal(
    findWallTextDuplicate({ candidate, history: [history] })?.reason,
    "near_duplicate",
  );
});
