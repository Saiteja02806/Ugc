import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { harmonizeStartingFrameImage, STARTING_FRAME_HARMONIZER_GRAIN } from "./image-harmonizer.js";

test("harmonizer grain is 1.2 percent of the lightness range", () => {
  assert.equal(STARTING_FRAME_HARMONIZER_GRAIN, 0.012);
});

test("harmonizeStartingFrameImage moves a bright face toward darker skin and keeps the scene", async () => {
  const width = 80;
  const height = 120;
  const pixels = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 3;
      const face = x >= 24 && x < 56 && y >= 14 && y < 55;
      const hands = y >= 78 && y < 112 && x >= 8 && x < 72;
      const color = face ? [232, 196, 168] : hands ? [110, 72, 54] : [30, 48, 140];
      pixels[offset] = color[0];
      pixels[offset + 1] = color[1];
      pixels[offset + 2] = color[2];
    }
  }
  const inputBuffer = await sharp(pixels, { raw: { width, height, channels: 3 } }).png().toBuffer();
  const { buffer, width: outWidth, height: outHeight } = await harmonizeStartingFrameImage(inputBuffer, {
    grainIntensity: 0,
  });

  assert.equal(outWidth, width);
  assert.equal(outHeight, height);
  const output = await sharp(buffer).removeAlpha().raw().toBuffer();
  const face = (40 + 34 * width) * 3;
  const hand = (40 + 90 * width) * 3;
  const scene = 0;
  assert.ok(output[face] < pixels[face] - 6, `face red ${output[face]} should darken from ${pixels[face]}`);
  assert.ok(Math.abs(output[hand] - pixels[hand]) <= 1);
  assert.ok(Math.abs(output[scene] - pixels[scene]) <= 1);
  assert.ok(Math.abs(output[scene + 2] - pixels[scene + 2]) <= 1);
});

test("harmonizeStartingFrameImage adds deterministic grain without resizing", async () => {
  const inputBuffer = await sharp({
    create: { width: 64, height: 64, channels: 3, background: { r: 140, g: 140, b: 140 } },
  }).png().toBuffer();

  const first = await harmonizeStartingFrameImage(inputBuffer);
  const second = await harmonizeStartingFrameImage(inputBuffer);
  assert.equal(first.width, 64);
  assert.equal(first.height, 64);
  assert.deepEqual(first.buffer, second.buffer);

  const source = await sharp(inputBuffer).removeAlpha().raw().toBuffer();
  const output = await sharp(first.buffer).removeAlpha().raw().toBuffer();
  let changed = 0;
  let largest = 0;
  for (let i = 0; i < source.length; i += 1) {
    const delta = Math.abs(output[i] - source[i]);
    if (delta > 0) changed += 1;
    if (delta > largest) largest = delta;
  }
  assert.ok(changed > 0);
  assert.ok(largest < 25);
});

test("harmonizeStartingFrameImage rejects an unreadable image", async () => {
  await assert.rejects(() => harmonizeStartingFrameImage(Buffer.from("not-an-image")));
});
