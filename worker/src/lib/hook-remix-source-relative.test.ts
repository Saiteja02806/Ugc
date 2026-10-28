import assert from "node:assert/strict";
import test from "node:test";
import { hookRemixBlockBudgets, assertSourceRelativeHookLength, HOOK_SOURCE_RELATIVE_REMIX_VERSION } from "./hook-remix-source-relative.ts";

const source = (...text: string[]) => ({ blocks: text.map(text => ({ text })) });
test("short and long sources retain their own budgets, with no universal 80-character allowance", () => {
  assert.equal(HOOK_SOURCE_RELATIVE_REMIX_VERSION, 9);
  assert.deepEqual(hookRemixBlockBudgets(source("Wait?!", "A".repeat(180)), {}), [6, 180]);
  assertSourceRelativeHookLength(["Wait?!", "A".repeat(180)], source("Wait?!", "A".repeat(180)), {});
  assert.throws(() => assertSourceRelativeHookLength(["Wait, this works?!", "A"], source("Wait?!", "A".repeat(180)), {}));
});
test("only an explicit named-tool slot grants exact longer-brand allowance", () => {
  const text = "POV: how to use Claude for marketing";
  assert.deepEqual(hookRemixBlockBudgets(source(text), { businessName: "UGCPilot" }), [text.length + 2]);
  assertSourceRelativeHookLength([text.replace("Claude", "UGCPilot")], source(text), { businessName: "UGCPilot" });
  assert.throws(() => assertSourceRelativeHookLength([text.replace("Claude", "UGCPilot") + "!"], source(text), { businessName: "UGCPilot" }));
  assert.deepEqual(hookRemixBlockBudgets(source("Wait, THIS works?"), { businessName: "A very long company name" }), [17]);
});
test("Unicode, source immutability, block order and individual limits are preserved", () => {
  const input = source("Wow 😭", "One\ntwo\nthree"); const before = JSON.stringify(input);
  assert.deepEqual(hookRemixBlockBudgets(input, {}), [5, 13]);
  assertSourceRelativeHookLength(["Wow 😭", "One\ntwo\nthree"], input, {});
  assert.throws(() => assertSourceRelativeHookLength(["123456", "a"], input, {}));
  assert.throws(() => assertSourceRelativeHookLength(["Wow 😭"], input, {}));
  assert.equal(JSON.stringify(input), before);
});
