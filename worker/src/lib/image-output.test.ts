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
