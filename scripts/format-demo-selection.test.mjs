import assert from "node:assert/strict";
import test from "node:test";
import { readFormatDemoSelection } from "../lib/explore/format-demo-selection.ts";

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
test("demo restoration keeps the original and edited identities separate and bound to the account and hook", () => {
  const selection = { version: 1, ownerId: "owner-a", sourceAssetId: id(1), demoAssetId: id(2), editedDemoAssetId: id(3), dirty: false };
  assert.deepEqual(readFormatDemoSelection(JSON.stringify(selection), "owner-a", id(1)), selection);
  assert.equal(readFormatDemoSelection(JSON.stringify(selection), "owner-b", id(1)), null);
  assert.equal(readFormatDemoSelection(JSON.stringify(selection), "owner-a", id(9)), null);
  assert.equal(readFormatDemoSelection(JSON.stringify({ ...selection, demoAssetId: null }), "owner-a", id(1)), null);
  assert.equal(readFormatDemoSelection("not-json", "owner-a", id(1)), null);
});
