import assert from "node:assert/strict";
import test from "node:test";

import {
  CreateContentGeneratedCopyValidationError,
  normalizeAndValidateGeneratedCreateContentText,
} from "./generation-validation.ts";

test("generated Hooks are normalized through the final Trending Hook layout", () => {
  const text = normalizeAndValidateGeneratedCreateContentText({
    format: "hook_text",
    text: "I just found a calmer way to do this",
  });

  assert.ok(text.split("\n").length <= 3);
  assert.equal(text.replace(/\s+/gu, " ").trim(), "I just found a calmer way to do this");
});

test("generated Hooks that cannot fit the final renderer are rejected before display", () => {
  assert.throws(
    () =>
      normalizeAndValidateGeneratedCreateContentText({
        format: "hook_text",
        text: "This Hook contains far too many separate words for the final video renderer to place safely",
      }),
    CreateContentGeneratedCopyValidationError,
  );
});

test("generated Wall copy is normalized to the final five-to-eight line contract", () => {
  const text = normalizeAndValidateGeneratedCreateContentText({
    format: "wall_text",
    text: "The clearest next step makes everyday decisions feel easier for the people doing the work.",
  });

  assert.equal(text.split("\n").length, 5);
});

test("a one-word generated Wall is rejected before it can reach the renderer", () => {
  assert.throws(
    () =>
      normalizeAndValidateGeneratedCreateContentText({
        format: "wall_text",
        text: "Hello",
      }),
    CreateContentGeneratedCopyValidationError,
  );
});
