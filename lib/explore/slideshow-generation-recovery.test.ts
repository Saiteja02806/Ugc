import assert from "node:assert/strict";
import test from "node:test";
import { readSlideshowClarification, slideshowClarificationKey } from "./slideshow-generation-recovery.ts";

test("planning explanations survive serialization and reject foreign, corrupt and oversized records", () => {
  const feedback = { version: 1, owner: "owner", scope: "source-five", prompt: "Use my screen on the laptop", items: ["Which screen?"] };
  assert.deepEqual(readSlideshowClarification(JSON.stringify(feedback), "owner"), feedback);
  for (const raw of [null, "{", "x".repeat(100_001), JSON.stringify({ ...feedback, owner: "other" }),
    JSON.stringify({ ...feedback, items: [] }), JSON.stringify({ ...feedback, items: [55] }),
    JSON.stringify({ ...feedback, items: ["x".repeat(501)] }), JSON.stringify({ ...feedback, version: 2 })]) {
    assert.equal(readSlideshowClarification(raw, "owner"), null);
  }
  assert.notEqual(slideshowClarificationKey("owner"), slideshowClarificationKey("other"));
});
