import assert from "node:assert/strict";
import test from "node:test";

import {
  CreateContentGeneratedCopyValidationError,
  CreateContentTextValidationError,
  normalizeAndValidateCreateContentText,
  normalizeAndValidateGeneratedCreateContentText,
} from "./generation-validation.ts";

test("generated Hooks are normalized through the final Trending Hook layout", async () => {
  const text = await normalizeAndValidateGeneratedCreateContentText({
    format: "hook_text",
    text: "I just found a calmer way to do this",
  });

  assert.ok(text.split("\n").length <= 3);
  assert.equal(text.replace(/\s+/gu, " ").trim(), "I just found a calmer way to do this");
});

test("generated Hooks that cannot fit the final renderer are rejected before display", async () => {
  await assert.rejects(
    () =>
      normalizeAndValidateGeneratedCreateContentText({
        format: "hook_text",
        text: "This Hook contains far too many separate words for the final video renderer to place safely",
      }),
    CreateContentGeneratedCopyValidationError,
  );
});

test("generated Wall copy is normalized to the final four-to-eight line contract", async () => {
  const text = await normalizeAndValidateGeneratedCreateContentText({
    format: "wall_text",
    text: "The clearest next\nstep makes everyday\ndecisions feel easier\nfor people doing work.",
  });

  assert.equal(text.split("\n").length, 4);
});

test("a one-word generated Wall is rejected before it can reach the renderer", async () => {
  await assert.rejects(
    () =>
      normalizeAndValidateGeneratedCreateContentText({
        format: "wall_text",
        text: "Hello",
      }),
    CreateContentGeneratedCopyValidationError,
  );
});

test("manual Hook text uses the same final layout gate before it can be saved", async () => {
  await assert.rejects(
    () =>
      normalizeAndValidateCreateContentText({
        format: "hook_text",
        position: { x: 0.5, y: 0.5 },
        text: "One two three four five six seven eight nine ten eleven twelve thirteen",
      }),
    CreateContentTextValidationError,
  );
});

test("manual Wall text with an overflowing final-render line is rejected", async () => {
  await assert.rejects(
    () =>
      normalizeAndValidateCreateContentText({
        format: "wall_text",
        position: { x: 0.5, y: 0.5 },
        text: Array.from({ length: 4 }, () => "W".repeat(100)).join("\n"),
      }),
    CreateContentTextValidationError,
  );
});
