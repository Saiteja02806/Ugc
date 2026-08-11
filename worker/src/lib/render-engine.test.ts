import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import test from "node:test";

import sharp from "sharp";

import { buildEditOverlayTextLayout } from "./edit-overlay-render-spec.js";
import {
  buildWallTextVideoArgs,
  buildScheduleCombinationSegmentArgs,
  buildPreparedTextOverlaySvg,
  ensureEditOverlayFontRegistered,
  validateRenderedVideoProbe,
} from "./render-engine.js";
import {
  buildWallTextOverlaySvg,
  buildWallTextRenderLayout,
} from "./wall-text-render-spec.js";

test("applies Hook trim and text only to the opening segment", () => {
  const preparedTextOverlay = {
    imagePath: "hook-overlay.png",
    layout: buildEditOverlayTextLayout(
      "The old way takes twice the effort.",
      "hook",
      "9:16",
    ),
    position: "middle" as const,
    style: "hook" as const,
  };
  const payload = {
    autoFinalize: false,
    compositionFingerprint: "fingerprint-1",
    demoVideoId: "demo-1",
    demoVideoUrl: "https://cdn.example.com/demo.mp4",
    hookText: "The old way takes twice the effort.",
    hookTextColor: "#ffffff",
    hookAudio: {
      audioAssetId: "hook_audio_029",
      audioUrl: "https://cdn.example.com/EWW.mp3",
      durationSeconds: 14.08,
      selectionSource: "video_locked" as const,
    },
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
    hookAudioPath: "EWW.mp3",
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
  assert.ok(hookArgs.includes("EWW.mp3"));
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
    "#f472b6",
  );
  const svg = buildPreparedTextOverlaySvg({
    imagePath: "unused-in-svg-test.png",
    layout,
    position: "middle",
    style: "bubble",
  });

  assert.match(svg, /viewBox="0 0 1080 1920"/);
  assert.match(
    svg,
    /font-family="Geist, Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, Noto Sans CJK SC/,
  );
  assert.match(svg, /fill="#f472b6"/);
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

test("rasterizes a reference-style three-line Hook with an emoji", async () => {
  const layout = buildEditOverlayTextLayout(
    "Meal logging\ninterrupts the day\nagain 😩",
    "hook",
    "9:16",
  );
  const svg = buildPreparedTextOverlaySvg({
    imagePath: "unused-hook-emoji-test.png",
    layout,
    position: "middle",
    style: "hook",
  });

  assert.equal(layout.fontSize, 60);
  assert.equal(layout.lines.length, 3);
  assert.match(svg, /Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji/);
  assert.match(svg, /stroke-width="5"/);
  assert.match(svg, /again 😩/);

  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const metadata = await sharp(png).metadata();

  assert.equal(metadata.width, 1080);
  assert.equal(metadata.height, 1920);
  assert.ok(png.length > 1_000);
});

test("renders six-second Wall copy with Inter Bold and no background box", () => {
  const content = {
    fullText:
      "I logged every meal but skipped drinks oil and small bites. Those missing details quietly changed the final total.",
    segments: [
      {
        lines: ["I logged every meal"],
        role: "lead" as const,
      },
      {
        lines: ["but skipped drinks", "oil and small bites."],
        role: "support" as const,
      },
      {
        lines: ["Those missing details", "quietly changed", "the final total."],
        role: "closing" as const,
      },
    ],
  };
  const layout = buildWallTextRenderLayout({
    content,
    safeArea: {
      bottom: 460 / 1920,
      left: 120 / 1080,
      right: 200 / 1080,
      top: 280 / 1920,
    },
    textBox: {
      height: 480 / 1920,
      width: 620 / 1080,
      x: 230 / 1080,
      y: 660 / 1920,
    },
  });
  const svg = buildWallTextOverlaySvg({
    content,
    placement: "middle",
    textBox: {
      height: 480 / 1920,
      width: 620 / 1080,
      x: 230 / 1080,
      y: 660 / 1920,
    },
  });

  assert.equal(layout.canvasWidth, 1080);
  assert.equal(layout.canvasHeight, 1920);
  assert.equal(layout.segments[0]?.fontSize, 48);
  assert.equal(layout.segments[1]?.fontSize, 48);
  assert.doesNotMatch(svg, /wallTextScrim|radialGradient/);
  assert.match(svg, /font-family="Inter, Arial/);
  assert.match(svg, /stroke-width="4"/);
  assert.equal(svg.match(/<text /g)?.length, 6);
});

test("renders Wall text with the selected library audio and ignores source audio", () => {
  const args = buildWallTextVideoArgs({
    audioPath: "wall-audio.mp3",
    inputPath: "wall-background.mp4",
    outputPath: "wall-output.mp4",
    overlayPath: "wall-overlay.png",
    payload: {
      audio: {
        assetDurationSeconds: 12.5,
        assetId: "audio_001_segment_01",
        audioUrl: "https://cdn.example.com/wall-audio.mp3",
        cueStartSeconds: 0.25,
        fadeOutSeconds: 0.2,
        fitMode: "trim",
        matchingVersion: "wall-audio-match-v1",
        selectionId: "selection-1",
      },
      durationSeconds: 5.056,
    },
  });

  assert.deepEqual(args.slice(0, 11), [
    "-y",
    "-i",
    "wall-background.mp4",
    "-loop",
    "1",
    "-framerate",
    "30",
    "-i",
    "wall-overlay.png",
    "-i",
    "wall-audio.mp3",
  ]);
  assert.ok(args.includes("5.056"));
  assert.ok(args.includes("[wall_audio]"));
  assert.equal(args.filter((value) => value === "-i").length, 3);
  assert.equal(args.filter((value) => value.endsWith(".mp4")).length, 2);
  assert.equal(args.some((value) => /demo/i.test(value)), false);
  assert.equal(args.some((value) => value === "0:a:0"), false);
  assert.match(
    args[args.indexOf("-filter_complex") + 1] ?? "",
    /atrim=start=0\.250:end=12\.500[\s\S]+apad=pad_dur=5\.056[\s\S]+atrim=duration=5\.056[\s\S]+afade=t=out:st=4\.856:d=0\.200/,
  );
});

test("loops only an audio selection explicitly marked with loop fit", () => {
  const args = buildWallTextVideoArgs({
    audioPath: "short-loop.mp3",
    inputPath: "wall-background.mp4",
    outputPath: "wall-output.mp4",
    overlayPath: "wall-overlay.png",
    payload: {
      audio: {
        assetDurationSeconds: 5,
        assetId: "audio_002",
        audioUrl: "https://cdn.example.com/short-loop.mp3",
        cueStartSeconds: 0,
        fadeOutSeconds: 0.2,
        fitMode: "loop",
        matchingVersion: "wall-audio-match-v1",
        selectionId: "selection-2",
      },
      durationSeconds: 10,
    },
  });

  assert.match(
    args[args.indexOf("-filter_complex") + 1] ?? "",
    /aloop=loop=-1:size=240000:start=0[\s\S]+atrim=duration=10\.000/,
  );
});

test("does not loop an exact seven-second audio selection", () => {
  const args = buildWallTextVideoArgs({
    audioPath: "exact.mp3",
    inputPath: "wall-background.mp4",
    outputPath: "wall-output.mp4",
    overlayPath: "wall-overlay.png",
    payload: {
      audio: {
        assetDurationSeconds: 7.02,
        assetId: "audio_003",
        audioUrl: "https://cdn.example.com/exact.mp3",
        cueStartSeconds: 0,
        fadeOutSeconds: 0.2,
        fitMode: "exact",
        matchingVersion: "wall-audio-match-v1",
        selectionId: "selection-3",
      },
      durationSeconds: 7,
    },
  });

  const filter = args[args.indexOf("-filter_complex") + 1] ?? "";
  assert.doesNotMatch(filter, /aloop=/);
  assert.match(filter, /apad=pad_dur=7\.000/);
  assert.match(filter, /atrim=duration=7\.000/);
});

test("accepts only rendered MP4 probes with a playable video stream", () => {
  assert.deepEqual(
    validateRenderedVideoProbe({
      format: { duration: "4.2", format_name: "mov,mp4,m4a,3gp,3g2,mj2" },
      streams: [
        {
          codec_name: "h264",
          codec_type: "video",
          height: 1920,
          width: 1080,
        },
      ],
    }),
    {
      codecName: "h264",
      durationSeconds: 4.2,
      height: 1920,
      width: 1080,
    },
  );

  assert.throws(
    () =>
      validateRenderedVideoProbe({
        format: { duration: "0" },
        streams: [],
      }),
    /missing a playable video stream/i,
  );
});

test("requires Wall renders to keep the expected duration and AAC audio", () => {
  const validWallProbe = {
    format: { duration: "7.000", format_name: "mov,mp4,m4a,3gp,3g2,mj2" },
    streams: [
      {
        codec_name: "h264",
        codec_type: "video",
        height: 1920,
        width: 1080,
      },
      {
        codec_name: "aac",
        codec_type: "audio",
      },
    ],
  };

  assert.doesNotThrow(() =>
    validateRenderedVideoProbe(validWallProbe, {
      expectedAudioCodecName: "aac",
      expectedDurationSeconds: 7,
      requireAudio: true,
    }),
  );
  assert.throws(
    () =>
      validateRenderedVideoProbe(
        { ...validWallProbe, streams: [validWallProbe.streams[0]] },
        { expectedDurationSeconds: 7, requireAudio: true },
      ),
    /missing a playable audio stream/i,
  );
  assert.throws(
    () =>
      validateRenderedVideoProbe(
        { ...validWallProbe, format: { duration: "6.7" } },
        {
          expectedAudioCodecName: "aac",
          expectedDurationSeconds: 7,
          requireAudio: true,
        },
      ),
    /does not match the expected/i,
  );
});
