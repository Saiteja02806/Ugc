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

  const contraction = createWallTextDuplicateSignature("Don't let a good lead go cold.");
  const withoutApostrophe = createWallTextDuplicateSignature("dont let a good lead go cold");
  assert.equal(contraction.contentHash, withoutApostrophe.contentHash);
  assert.equal(
    findWallTextDuplicate({ candidate: withoutApostrophe, history: [contraction] })?.reason,
    "exact_duplicate",
  );
});

test("wording variations and related situations remain allowed", () => {
  const history = createWallTextDuplicateSignature(
    "I kept tracking biggest purchases but ignored small daily expenses that changed total.",
  );
  const candidate = createWallTextDuplicateSignature(
    "Small daily expenses that changed total; I kept tracking biggest purchases but ignored.",
  );
  assert.equal(findWallTextDuplicate({ candidate, history: [history] }), null);

  const related = createWallTextDuplicateSignature(
    "A delayed reply can turn an interested customer into a lost opportunity.",
  );
  assert.equal(findWallTextDuplicate({ candidate: related, history: [history] }), null);
});
