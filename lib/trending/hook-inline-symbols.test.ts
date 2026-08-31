import assert from "node:assert/strict";
import test from "node:test";

import {
  hasUnsupportedHookEmoji,
  tokenizeHookInlineSymbols,
} from "./hook-inline-symbols.ts";

test("turns approved Hook emoji characters into named cross/check tokens", () => {
  assert.deepEqual(
    tokenizeHookInlineSymbols(
      "Time-consuming meal logging ❌ AI-assisted meal logging ✅",
    ),
    [
      { kind: "text", value: "Time-consuming meal logging " },
      { kind: "symbol", name: "cross" },
      { kind: "text", value: " AI-assisted meal logging " },
      { kind: "symbol", name: "check" },
    ],
  );
  assert.equal(
    hasUnsupportedHookEmoji(
      "Time-consuming meal logging ❌ AI-assisted meal logging ✅",
    ),
    false,
  );
});

test("keeps unsupported emoji out of the visual Hook renderer", () => {
  assert.deepEqual(tokenizeHookInlineSymbols("Meal logging again 😩"), [
    { kind: "text", value: "Meal logging again " },
    { kind: "unsupported", value: "😩" },
  ]);
  assert.equal(hasUnsupportedHookEmoji("Meal logging again 😩"), true);
});
