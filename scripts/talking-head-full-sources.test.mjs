import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import test from "node:test";
import { visibleTalkingHeadReferences } from "../lib/explore/talking-head-reference.ts";
const catalogue = JSON.parse(readFileSync("lib/explore/talking-head-reference-catalog.json", "utf8"));
const sources = JSON.parse(readFileSync("lib/explore/talking-head-source-manifest.json", "utf8"));
const frames = JSON.parse(readFileSync("lib/explore/talking-head-frames.json", "utf8"));
const full = [["talking-car-story",48.5],["talking-room-explainer",42.027],["talking-discovery",43.838]];
test("full Talking Head sources preserve duration, source links and archival recovery", () => {
  const visible = visibleTalkingHeadReferences(catalogue.items);
  assert.equal(visible.length,18);
  for (const [id,duration] of full) {
    const original = catalogue.items.find(item => item.id === id);
    const replacement = catalogue.items.find(item => item.id === id+"-full");
    assert.ok(original && replacement);
    assert.equal(replacement.sourceUrl,original.sourceUrl);
    assert.equal(replacement.title,original.title);
    assert.equal(replacement.durationSeconds,duration);
    assert.ok(replacement.durationSeconds > original.durationSeconds);
    assert.ok(!visible.some(item => item.id === id));
    assert.ok(visible.some(item => item.id === replacement.id));
    assert.ok(readFileSync("public"+original.videoUrl).length > 0);
  }
});
test("every reference has matching media and exact prepared opening-frame hashes", () => {
  const hash = bytes => createHash("sha256").update(bytes).digest("hex");
  assert.equal(catalogue.items.length,23);
  for (const reference of catalogue.items) {
    const source=sources.items.find(item=>item.id===reference.id);
    const frame=frames.items.find(item=>item.id===reference.id);
    assert.ok(source && frame,reference.id);
    assert.equal(hash(readFileSync("public"+reference.videoUrl)),source.sourceSha256);
    assert.equal(frame.sourceSha256,source.sourceSha256);
    assert.equal(hash(readFileSync("public"+frame.path)),frame.frameSha256);
    assert.equal(frame.frameIndex,0); assert.equal(frame.frameTimeSeconds,0);
    assert.equal(frame.width,source.width); assert.equal(frame.height,source.height);
  }
});
