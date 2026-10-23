import assert from "node:assert/strict";
import test from "node:test";
import { getAdditionalStartingFrameSources } from "./starting-frame-reference-source.ts";
import { getTalkingHeadReferences } from "./talking-head-reference-catalog.ts";
import { createHookSourceFrameService, resolveStartingFrameSource } from "./hook-source-frame.ts";

test("the source registry covers packaged Talking Head references and keeps retired Wall IDs unavailable", async () => {
  const sources = getAdditionalStartingFrameSources();
  assert.equal(new Set(sources.map(source => source.id)).size, sources.length);
  const talking = getTalkingHeadReferences();
  assert.equal(talking.length, 9);
  for (const reference of talking) {
    const source = await resolveStartingFrameSource(reference.id);
    assert.equal(source.workflow, "talking_head");
    assert.equal(source.localFile, reference.videoUrl);
    assert.equal(source.videoSha256, reference.sourceSha256);
    assert.match(source.videoSha256, /^[a-f0-9]{64}$/);
  }
  for (const id of ["explore-wall-text-01", "explore-wall-text-08", "explore-wall-text-09"]) {
    await assert.rejects(resolveStartingFrameSource(id), { status: 404 });
  }
  const wall = await resolveStartingFrameSource("explore-wall-text-02");
  assert.equal(wall.workflow, "wall_text");
  assert.ok(sources.some(source => source.workflow === "wall_text" && source.id.startsWith("explore-paired-")));
});

test("every packaged Talking Head video yields its real hash-verified first frame at full resolution", async () => {
  const getFrame = createHookSourceFrameService();
  for (const reference of getTalkingHeadReferences()) {
    const source = await resolveStartingFrameSource(reference.id);
    const frame = await getFrame(reference.id);
    assert.equal(frame.workflow, "talking_head");
    assert.equal(frame.sourceSha256, reference.sourceSha256);
    assert.equal(frame.frameIndex, 0);
    assert.equal(frame.width, source.width); assert.equal(frame.height, source.height);
    assert.equal(frame.png.readUInt32BE(16), source.width); assert.equal(frame.png.readUInt32BE(20), source.height);
  }
});
