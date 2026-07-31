import assert from "node:assert/strict";
import test from "node:test";

import { assertGeneratedMp4 } from "./video-output.js";

test("accepts an ISO base media MP4 header", () => {
  const buffer = Buffer.concat([
    Buffer.from([0, 0, 0, 24]),
    Buffer.from("ftypmp42", "ascii"),
    Buffer.alloc(12),
  ]);

  assert.equal(assertGeneratedMp4(buffer), buffer);
});

test("rejects empty or incomplete video output", () => {
  assert.throws(() => assertGeneratedMp4(Buffer.alloc(0)), /empty or incomplete/);
});

test("rejects a non-MP4 response", () => {
  assert.throws(
    () => assertGeneratedMp4(Buffer.from("not an mp4 response", "utf8")),
    /not a valid MP4/,
  );
});
