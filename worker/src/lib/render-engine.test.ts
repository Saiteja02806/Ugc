import assert from "node:assert/strict";
import test from "node:test";

import sharp from "sharp";

import { buildEditOverlayTextLayout } from "./edit-overlay-render-spec.js";
import {
  buildPreparedTextOverlaySvg,
  getEditOverlayFontDataUri,
} from "./render-engine.js";

test("rasterizes the shared overlay plan without distorting the font", async () => {
  const layout = buildEditOverlayTextLayout(
    "After seeing this onboarding, i got to know how much time i wasted",
    "bubble",
    "9:16",
  );
  const svg = buildPreparedTextOverlaySvg(
    {
      imagePath: "unused-in-svg-test.png",
      layout,
      position: "middle",
      style: "bubble",
    },
    await getEditOverlayFontDataUri(),
  );

  assert.match(svg, /viewBox="0 0 1080 1920"/);
  assert.match(svg, /@font-face/);
  assert.match(svg, /data:font\/ttf;base64,/);
  assert.match(svg, /font-family="UgcEditOverlay/);
  assert.doesNotMatch(svg, /textLength=|lengthAdjust=/);
  assert.equal(svg.match(/<text /g)?.length, layout.lines.length * 2);

  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const image = sharp(png);
  const [metadata, stats] = await Promise.all([
    image.metadata(),
    image.stats(),
  ]);
  const alpha = stats.channels[3];

  assert.equal(metadata.width, 1080);
  assert.equal(metadata.height, 1920);
  assert.ok(png.length > 1_000);
  assert.ok(alpha);
  assert.equal(alpha.min, 0);
  assert.equal(alpha.max, 255);
});
