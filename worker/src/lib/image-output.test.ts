import assert from "node:assert/strict";
import test from "node:test";

import sharp from "sharp";

import { AI_STUDIO_IMAGE_RATIO, prepareAIStudioImageOutput } from "./image-output.js";

test("prepares one exact default 9:16 PNG for AI Studio", async () => {
  const source = await sharp({
    create: {
      background: { alpha: 1, b: 60, g: 40, r: 20 },
      channels: 4,
      height: 150,
      width: 100,
    },
  })
    .png()
    .toBuffer();

  const output = await prepareAIStudioImageOutput(source);
  const metadata = await sharp(output).metadata();

  assert.equal(AI_STUDIO_IMAGE_RATIO, "9:16");
  assert.equal(metadata.format, "png");
  assert.equal(metadata.width, 720);
  assert.equal(metadata.height, 1_280);
});

test("prepares exact outputs for every supported AI Studio ratio", async () => {
  const source = await sharp({
    create: {
      background: { alpha: 1, b: 60, g: 40, r: 20 },
      channels: 4,
      height: 300,
      width: 300,
    },
  })
    .png()
    .toBuffer();

  for (const [ratio, width, height] of [
    ["1:1", 1_024, 1_024],
    ["4:5", 1_024, 1_280],
    ["9:16", 720, 1_280],
    ["16:9", 1_280, 720],
  ] as const) {
    const metadata = await sharp(
      await prepareAIStudioImageOutput(source, ratio),
    ).metadata();

    assert.equal(metadata.width, width);
    assert.equal(metadata.height, height);
  }
});

test("slideshow output keeps pixels on every edge when a provider returns a different ratio", async () => {
  const source = await sharp({ create: { width: 100, height: 150, channels: 3, background: "#008000" } })
    .composite([
      { input: { create: { width: 100, height: 10, channels: 3, background: "#ff0000" } }, top: 0, left: 0 },
      { input: { create: { width: 100, height: 10, channels: 3, background: "#0000ff" } }, top: 140, left: 0 },
    ]).png().toBuffer();
  const output = await prepareAIStudioImageOutput(source, "4:5", { preserveComposition: true });
  const { data, info } = await sharp(output).raw().toBuffer({ resolveWithObject: true });
  let topMarker = 0, bottomMarker = 0;
  for (let p = 0; p < data.length; p += info.channels) {
    if (data[p] > 240 && data[p + 1] < 10 && data[p + 2] < 10) topMarker++;
    if (data[p + 2] > 240 && data[p] < 10 && data[p + 1] < 10) bottomMarker++;
  }
  assert.ok(topMarker > 0, "The top edge must survive");
  assert.ok(bottomMarker > 0, "The bottom edge must survive");
  assert.equal(info.width, 1024);
  assert.equal(info.height, 1280);
});

test("native-ratio slideshow outputs preserve the complete image without adding margins", async () => {
  const source = await sharp({ create: { width: 1024, height: 1280, channels: 3, background: "#13579b" } }).png().toBuffer();
  const output = await prepareAIStudioImageOutput(source, "4:5", { preserveComposition: true });
  assert.deepEqual(await sharp(output).raw().toBuffer(), await sharp(source).raw().toBuffer());
});
