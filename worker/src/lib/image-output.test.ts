import assert from "node:assert/strict";
import test from "node:test";

import sharp from "sharp";

import {
  AI_STUDIO_IMAGE_HEIGHT,
  AI_STUDIO_IMAGE_RATIO,
  AI_STUDIO_IMAGE_WIDTH,
  prepareAIStudioImageOutput,
} from "./image-output.js";

test("prepares one exact 4:5 PNG for AI Studio", async () => {
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

  assert.equal(AI_STUDIO_IMAGE_RATIO, "4:5");
  assert.equal(metadata.format, "png");
  assert.equal(metadata.width, AI_STUDIO_IMAGE_WIDTH);
  assert.equal(metadata.height, AI_STUDIO_IMAGE_HEIGHT);
});
