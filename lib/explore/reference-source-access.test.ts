import assert from "node:assert/strict";
import test from "node:test";
import { canOpenReferenceSource } from "./reference-source-access.ts";

const ready = { isSuccess: true, isFetching: false, isError: false };

test("free generation grants never permit original-post access, including spent grants", () => {
  for (const remaining of [0, 5]) {
    const data = { isActive: false, planKey: "free", freeGenerationCredits: { granted: 5, remaining } };
    assert.equal(canOpenReferenceSource({ ...ready, data }), false);
    assert.equal(canOpenReferenceSource({ ...ready, data: { ...data, isActive: true } }), false);
  }
});

test("only verified active Starter and Growth plans open originals", () => {
  for (const planKey of ["starter", "growth"]) {
    const data = { isActive: true, planKey };
    assert.equal(canOpenReferenceSource({ ...ready, data }), true);
    assert.equal(canOpenReferenceSource({ ...ready, data: { ...data, isActive: false } }), false);
    assert.equal(canOpenReferenceSource({ ...ready, data, isFetching: true }), false);
    assert.equal(canOpenReferenceSource({ ...ready, data, isError: true }), false);
    assert.equal(canOpenReferenceSource({ ...ready, data, isSuccess: false }), false);
  }
  assert.equal(canOpenReferenceSource({ ...ready }), false);
  assert.equal(canOpenReferenceSource({}), false);
  assert.equal(canOpenReferenceSource({ ...ready, data: { isActive: true, planKey: "unknown" } }), false);
});
