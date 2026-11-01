import assert from "node:assert/strict";
import test from "node:test";
import { getVideoReferencePolicy, getVideoTimedReferenceError } from "./video-reference-policy.ts";

test("Seedance audio policy requires five seconds without raising the video minimum", () => {
  assert.equal(getVideoReferencePolicy("seedance_2_5").minAudioDuration, 5);
  for (const duration of [1.996916, 2, 4.999]) assert.match(getVideoTimedReferenceError("seedance_2_5", "audio", duration)!, /at least 5 seconds/);
  for (const duration of [5, 10, 30]) assert.equal(getVideoTimedReferenceError("seedance_2_5", "audio", duration), null);
  assert.match(getVideoTimedReferenceError("seedance_2_5", "audio", 30.1)!, /up to 30 seconds/);
  assert.equal(getVideoTimedReferenceError("seedance_2_5", "video", 2), null);
  assert.equal(getVideoTimedReferenceError("wan_3_0", "audio", 1), null);
});

test("connected routes expose independent image and timed-reference capacities", () => {
  for (const [model, maxImages, maxFiles] of [["seedance_2_5", 30, 32], ["wan_3_0", 10, 12], ["kling_3_0", 2, 2]] as const) {
    assert.equal(getVideoReferencePolicy(model).maxImages, maxImages);
    assert.equal(getVideoReferencePolicy(model).maxFiles, maxFiles);
    assert.equal(getVideoReferencePolicy(model, { hasTimedReferences: true }).maxImages, maxImages);
  }
  // Same-family Enterprise specification; this test checks application policy,
  // not direct stable-route provider acceptance or generated output quality.
  assert.equal(getVideoReferencePolicy("google_omni").maxImages, 3);
  assert.equal(getVideoReferencePolicy("google_omni", { allowOmniVideo: true }).maxImages, 3);
  assert.equal(getVideoReferencePolicy("google_omni", { allowOmniVideo: true }).maxFiles, 4);
});
