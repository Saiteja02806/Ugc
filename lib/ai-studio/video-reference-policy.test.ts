import assert from "node:assert/strict";
import test from "node:test";
import { getVideoReferencePolicy } from "./video-reference-policy.ts";

test("connected routes expose independent image and timed-reference capacities", () => {
  for (const [model, maxImages, maxFiles] of [["seedance_2_5", 30, 32], ["wan_3_0", 10, 12], ["kling_3_0", 2, 2]] as const) {
    assert.equal(getVideoReferencePolicy(model).maxImages, maxImages);
    assert.equal(getVideoReferencePolicy(model).maxFiles, maxFiles);
    assert.equal(getVideoReferencePolicy(model, { hasTimedReferences: true }).maxImages, maxImages);
  }
  // Same-family Enterprise specification; this test checks application policy,
  // not direct stable-route provider acceptance or generated output quality.
  assert.equal(getVideoReferencePolicy("google_omni").maxImages, 10);
  assert.equal(getVideoReferencePolicy("google_omni", { allowOmniVideo: true }).maxImages, 10);
  assert.equal(getVideoReferencePolicy("google_omni", { allowOmniVideo: true }).maxFiles, 11);
});
