import assert from "node:assert/strict";
import test from "node:test";
import { getVideoGenerationState } from "./video-generation-state.ts";

test("a new submission stays busy while the previous failed job is still cached", () => {
  assert.equal(getVideoGenerationState({ submitting: true, loading: false, jobs: [{ status: "failed" }], fallback: "generating" }), "generating");
});

test("a failed or cancelled job releases the composer lock", () => {
  for (const status of ["failed", "cancelled"] as const) {
    assert.equal(getVideoGenerationState({ submitting: false, loading: false, jobs: [{ status }], fallback: "generating" }), "failed");
  }
});

test("dismissal or a missing job cannot leave a stale generating lock", () => {
  assert.equal(getVideoGenerationState({ submitting: false, loading: false, jobs: [], fallback: "generating" }), "empty");
});

test("an active sibling in a batch stays busy even if another job has failed", () => {
  assert.equal(getVideoGenerationState({ submitting: false, loading: false, jobs: [{ status: "failed" }, { status: "processing" }], fallback: "failed" }), "generating");
});

test("completed jobs unlock even before media restoration finishes", () => {
  assert.equal(getVideoGenerationState({ submitting: false, loading: false, jobs: [{ status: "completed" }], fallback: "generating" }), "completed");
});

test("completion without a video remains an error and releases the lock", () => {
  assert.equal(getVideoGenerationState({ submitting: false, loading: false, jobs: [{ status: "completed" }], fallback: "generating", missingOutput: true }), "failed");
});
