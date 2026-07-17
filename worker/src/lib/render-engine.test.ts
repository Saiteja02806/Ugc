import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import test from "node:test";

import sharp from "sharp";

import { buildEditOverlayTextLayout } from "./edit-overlay-render-spec.js";
import {
  buildScheduleCombinationSegmentArgs,
  buildPreparedTextOverlaySvg,
  ensureEditOverlayFontRegistered,
} from "./render-engine.js";

test("applies Hook trim and text only to the opening segment", () => {
  const preparedTextOverlay = {
    imagePath: "hook-overlay.png",
    layout: buildEditOverlayTextLayout(
      "The old way takes twice the effort.",
      "minimal",
      "9:16",
    ),
    position: "bottom" as const,
    style: "minimal" as const,
  };
  const payload = {
    autoFinalize: false,
    compositionFingerprint: "fingerprint-1",
    demoVideoId: "demo-1",
    demoVideoUrl: "https://cdn.example.com/demo.mp4",
    hookText: "The old way takes twice the effort.",
    hookTrimEnd: 4.5,
    hookTrimStart: 1.25,
    hookVideoId: "hook-1",
    hookVideoUrl: "https://cdn.example.com/hook.mp4",
    projectId: "project-1",
    ratio: "9:16" as const,
    renderId: "render-1",
    scheduleId: "schedule-1",
    title: "Combined schedule",
    userId: "user-1",
  };
  const hookArgs = buildScheduleCombinationSegmentArgs({
    hasAudio: false,
    inputPath: "hook.mp4",
    outputPath: "hook-normalized.mp4",
    payload,
    preparedTextOverlay,
    segmentLabel: "hook",
  });
  const demoArgs = buildScheduleCombinationSegmentArgs({
    hasAudio: true,
    inputPath: "demo.mp4",
    outputPath: "demo-normalized.mp4",
    payload,
    preparedTextOverlay: null,
    segmentLabel: "demo",
  });

  assert.deepEqual(hookArgs.slice(0, 5), [
    "-y",
    "-ss",
    "1.250",
    "-i",
    "hook.mp4",
  ]);
  assert.ok(hookArgs.includes("hook-overlay.png"));
  assert.ok(hookArgs.includes("-filter_complex"));
  assert.ok(hookArgs.includes("3.250"));
  assert.ok(hookArgs.includes("2:a:0"));
  assert.equal(demoArgs.includes("-ss"), false);
  assert.equal(demoArgs.includes("-t"), false);
  assert.equal(demoArgs.includes("-filter_complex"), false);
});

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
        dirname(registration.fontPath),
        "..",
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
