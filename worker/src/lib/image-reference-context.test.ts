import assert from "node:assert/strict";
import { test } from "node:test";
import { parseImageReferenceContext } from "./image-reference-context.js";

test("reference context preserves all chosen URLs and ordering", () => {
  const urls = Array.from({ length: 14 }, (_, index) => `https://storage.test/${index}.png`);
  assert.deepEqual(parseImageReferenceContext(urls), urls);
  assert.deepEqual(parseImageReferenceContext([urls[7], urls[2]]), [urls[7], urls[2]]);
});

test("context rejects empty, duplicate, oversized and unsafe lists", () => {
  for (const value of [null, [], "https://storage.test/a.png", ["http://storage.test/a.png"], ["https://user:secret@storage.test/a.png"], [2], ["https://storage.test/a.png", "https://storage.test/a.png"], Array.from({ length: 15 }, (_, i) => `https://storage.test/${i}.png`)]) {
    assert.throws(() => parseImageReferenceContext(value));
  }
});
