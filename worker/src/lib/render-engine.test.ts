import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import sharp from "sharp";

import { buildEditOverlayTextLayout } from "./edit-overlay-render-spec.js";
import {
  buildPreparedTextOverlaySvg,
  ensureEditOverlayFontRegistered,
} from "./render-engine.js";

test("rasterizes the shared overlay plan without distorting the font", async () => {
  const registration = await ensureEditOverlayFontRegistered();
  const layout = buildEditOverlayTextLayout(
    "After seeing this onboarding, i got to know how much time i wasted",
    "bubble",
    "9:16",
  );
  const svg = buildPreparedTextOverlaySvg({
    imagePath: "unused-in-svg-test.png",
    layout,
    position: "middle",
    style: "bubble",
  });

  assert.match(svg, /viewBox="0 0 1080 1920"/);
  assert.match(svg, /font-family="Geist, Noto Sans CJK SC/);
  assert.doesNotMatch(svg, /@font-face|data:font\/ttf;base64,/);
  assert.doesNotMatch(svg, /textLength=|lengthAdjust=/);
  assert.equal(svg.match(/<text /g)?.length, layout.lines.length * 2);
  assert.match(registration.fontPath, /Geist-SemiBold\.ttf$/);
  assert.ok(
    Math.abs(
      registration.directBounds.width - registration.registeredBounds.width,
    ) <= 2,
  );
  assert.ok(
    Math.abs(
      registration.directBounds.height - registration.registeredBounds.height,
    ) <= 2,
  );

  const monoProbe = await sharp({
    text: {
      dpi: 72,
      font: "Geist Mono SemiBold 64",
      fontfile: join(
        process.cwd(),
        "node_modules",
        "geist",
        "dist",
        "fonts",
        "geist-mono",
        "GeistMono-SemiBold.ttf",
      ),
      rgba: true,
      text: "MW@gi 0123",
      wrap: "none",
    },
  })
    .trim({ background: { alpha: 0, b: 0, g: 0, r: 0 } })
    .metadata();

  assert.ok(monoProbe.width);
  assert.ok(
    Math.abs(registration.registeredBounds.width - monoProbe.width) > 10,
  );

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
