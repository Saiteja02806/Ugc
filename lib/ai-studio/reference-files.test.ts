import assert from "node:assert/strict";
import test from "node:test";
import { getReferenceFileKind, validateReferenceFileBatch } from "./reference-files.ts";

test("recognizes supported image, video, and audio file types", () => {
  assert.equal(getReferenceFileKind("audio/mpeg"), "audio");
  assert.equal(getReferenceFileKind("audio/x-wav"), "audio");
  assert.equal(getReferenceFileKind("video/mp4"), "video");
  assert.equal(getReferenceFileKind("image/png"), "image");
  assert.equal(getReferenceFileKind("application/pdf"), null);
});
test("accepts mixed generation references within the combined allowance", () => {
  assert.equal(validateReferenceFileBatch(["image/jpeg", "video/mp4", "audio/mpeg"], [], ["image", "video", "audio"], 6), null);
  assert.match(validateReferenceFileBatch(["audio/mpeg"], Array(6).fill("image"), ["image", "video", "audio"], 6)!, /up to 6/);
});
test("rejects audio for image-only models before uploading", () => {
  assert.match(validateReferenceFileBatch(["audio/wav"], [], ["image"], 6)!, /image references only/);
  assert.match(validateReferenceFileBatch(["application/pdf"], [], ["image", "video", "audio"], 30)!, /Use JPG/);
});
test("does not accept two edit videos in one batch or across separate uploads", () => {
  assert.match(validateReferenceFileBatch(["video/mp4", "video/webm"], [], ["image", "video", "audio"], 30)!, /one reference video/);
  assert.match(validateReferenceFileBatch(["video/mp4"], ["video"], ["image", "video", "audio"], 30)!, /Remove the current video/);
});
test("rejects a second audio reference within a batch or across uploads", () => {
  assert.match(validateReferenceFileBatch(["audio/mpeg", "audio/wav"], [], ["image", "video", "audio"], 6) ?? "", /one audio/);
  assert.match(validateReferenceFileBatch(["audio/mpeg"], ["audio"], ["image", "video", "audio"], 6) ?? "", /Remove the current audio/);
});

test("image capacity is independent of the one video and audio reference", () => {
  for (const maxImages of [10, 30]) {
    assert.equal(validateReferenceFileBatch(Array(maxImages).fill("image/jpeg"), ["video", "audio"], ["image", "video", "audio"], maxImages + 2, maxImages), null);
    assert.match(validateReferenceFileBatch(Array(maxImages + 1).fill("image/jpeg"), [], ["image", "video", "audio"], maxImages + 2, maxImages)!, new RegExp(`up to ${maxImages} reference images`));
  }
});

test("switching to a smaller model rejects excess references without changing the selection", () => {
  const selected = Array(10).fill("image") as ("image" | "video" | "audio")[];
  const snapshot = [...selected];
  assert.match(validateReferenceFileBatch([], selected, ["image"], 6, 6)!, /up to 6/);
  assert.deepEqual(selected, snapshot);
});
