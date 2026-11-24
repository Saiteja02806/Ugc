import assert from "node:assert/strict";
import test from "node:test";

import { generateHookLines } from "./hook-line-templates.ts";

test("hook lines stay empty until the task is specific", () => {
  const result = generateHookLines({ task: "   ", product: "North", pattern: "situation" });
  assert.equal(result.error, "Describe the task the app helps with.");
  assert.deepEqual(result.lines, []);
});

test("hook lines use the product and task the visitor typed", () => {
  const result = generateHookLines({ task: "split a receipt", product: "North", pattern: "demo" });
  assert.equal(result.error, null);
  assert.equal(result.lines.length, 3);
  for (const line of result.lines) {
    assert.match(line, /North/);
    assert.match(line, /split a receipt/);
  }
});

test("an unknown pattern is rejected", () => {
  const result = generateHookLines({ task: "split a receipt", product: "North", pattern: "viral" });
  assert.equal(result.lines.length, 0);
  assert.match(result.error, /pattern/);
});
