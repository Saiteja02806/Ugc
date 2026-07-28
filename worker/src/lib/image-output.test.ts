import assert from "node:assert/strict";
import test from "node:test";

import sharp from "sharp";

import {
  AI_STUDIO_IMAGE_HEIGHT,
  AI_STUDIO_IMAGE_RATIO,
  AI_STUDIO_IMAGE_WIDTH,
  prepareAIStudioImageOutput,
} from "./image-output.js";

test("prepares generated images as one 4:5 PNG", async () => {
  const source = await sharp({
    create: {
      background: { alpha: 1, b: 48, g: 96, r: 192 },
      channels: 4,
      height: 768,
      width: 1_024,
    },
  })
    .png()
    .toBuffer();
  const output = await prepareAIStudioImageOutput(source);
  const metadata = await sharp(output).metadata();

  assert.equal(metadata.format, "png");
  assert.equal(metadata.width, AI_STUDIO_IMAGE_WIDTH);
  assert.equal(metadata.height, AI_STUDIO_IMAGE_HEIGHT);
  assert.equal(
    `${metadata.width! / 256}:${metadata.height! / 256}`,
    AI_STUDIO_IMAGE_RATIO,
  );
});
