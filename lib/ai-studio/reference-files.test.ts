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
test("accepts a mixed Seedance batch within the combined reference allowance", () => {
  assert.equal(validateReferenceFileBatch(["image/jpeg", "video/mp4", "audio/mpeg"], [], ["image", "video", "audio"], 30), null);
  assert.match(validateReferenceFileBatch(["audio/mpeg"], Array(30).fill("image"), ["image", "video", "audio"], 30)!, /up to 30/);
});
test("rejects audio for image-only models before uploading", () => {
  assert.match(validateReferenceFileBatch(["audio/wav"], [], ["image"], 6)!, /Select Seedance/);
  assert.match(validateReferenceFileBatch(["application/pdf"], [], ["image", "video", "audio"], 30)!, /Use JPG/);
});
test("does not accept two edit videos in one batch or across separate uploads", () => {
  assert.match(validateReferenceFileBatch(["video/mp4", "video/webm"], [], ["image", "video", "audio"], 30)!, /one reference video/);
  assert.match(validateReferenceFileBatch(["video/mp4"], ["video"], ["image", "video", "audio"], 30)!, /Remove the current video/);
});
