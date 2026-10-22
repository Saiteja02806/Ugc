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

test("opted-in Hook output removes provider-grid margins without stretching the scene", async () => {
  // Actual failed generation dimensions: the provider's nominal 9:16 JPEG was
  // 768x1376. Containing it in 720x1280 adds three white columns on each side.
  const source = await sharp({ create: { width: 768, height: 1376, channels: 3, background: "#008000" } })
    .composite([
      { input: { create: { width: 768, height: 20, channels: 3, background: "#ff0000" } }, top: 0, left: 0 },
      { input: { create: { width: 768, height: 20, channels: 3, background: "#0000ff" } }, top: 1356, left: 0 },
      { input: { create: { width: 20, height: 1376, channels: 3, background: "#ffff00" } }, top: 0, left: 0 },
      { input: { create: { width: 20, height: 1376, channels: 3, background: "#ff00ff" } }, top: 0, left: 748 },
    ]).png().toBuffer();
  const legacy = await prepareAIStudioImageOutput(source, "9:16", { preserveComposition: true });
  const output = await prepareAIStudioImageOutput(source, "9:16", { preserveComposition: true, cropNearRatioPadding: true });
  const legacyPixels = await sharp(legacy).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = await sharp(output).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const at = (image: typeof pixels, x: number, y: number) => {
    const offset = (y * image.info.width + x) * image.info.channels;
    return [...image.data.subarray(offset, offset + 3)];
  };
  for (const x of [0, 1, 2, 717, 718, 719]) {
    assert.deepEqual(at(legacyPixels, x, 640), [255, 255, 255], `legacy column ${x} adds white padding`);
  }
  assert.equal(pixels.info.width, 720);
  assert.equal(pixels.info.height, 1280);
  assert.deepEqual(at(pixels, 0, 640), [255, 255, 0], "left source edge survives");
  assert.deepEqual(at(pixels, 719, 640), [255, 0, 255], "right source edge survives");
  assert.deepEqual(at(pixels, 360, 0), [255, 0, 0], "top marker survives the five-pixel crop");
  assert.deepEqual(at(pixels, 360, 1279), [0, 0, 255], "bottom marker survives the five-pixel crop");
  assert.deepEqual(at(pixels, 360, 640), [0, 128, 0]);
  // A centered aspect-preserving crop, rather than independently stretching axes.
  const expected = await sharp(source).resize({ width: 720, height: 1280, fit: "cover", position: "centre" }).png().toBuffer();
  assert.deepEqual(output, expected);
});

test("Hook minor-ratio policy also removes landscape rounding margins", async () => {
  const source = await sharp({ create: { width: 1376, height: 768, channels: 3, background: "#13579b" } }).png().toBuffer();
  const output = await prepareAIStudioImageOutput(source, "16:9", { preserveComposition: true, cropNearRatioPadding: true });
  const { data, info } = await sharp(output).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 1280);
  assert.equal(info.height, 720);
  assert.deepEqual([...data.subarray(0, 3)], [19, 87, 155]);
  assert.deepEqual([...data.subarray(data.length - 3)], [19, 87, 155]);
});

test("Hook minor-ratio policy preserves legacy contain for more than one percent crop", async () => {
  // 1379 is just inside one percent before rounding, but its covered canvas
  // can round to 1293px: cropping 13/1293 exceeds the permitted one percent.
  for (const height of [1379, 1400]) {
    const source = await sharp({ create: { width: 768, height, channels: 3, background: "#13579b" } }).png().toBuffer();
    const legacy = await prepareAIStudioImageOutput(source, "9:16", { preserveComposition: true });
    const output = await prepareAIStudioImageOutput(source, "9:16", { preserveComposition: true, cropNearRatioPadding: true });
    assert.deepEqual(output, legacy, "a larger aspect mismatch must not trigger an unbounded scene crop");
  }
});
