import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import ffprobe from "ffprobe-static";
import sharp from "sharp";

const root = process.cwd();

test("Wall of Text Cover Video (V5): file assets exist and are non-empty", () => {
  const v5Video = path.resolve(root, "public/explore/covers/wall-of-text-v5.mp4");
  const premiumVideo = path.resolve(root, "public/explore/covers/wall-of-text-cover-premium.mp4");
  const v5Poster = path.resolve(root, "public/explore/covers/wall-of-text-v5.webp");
  const premiumPoster = path.resolve(root, "public/explore/covers/wall-of-text-cover-premium.webp");
  const contactSheet = path.resolve(root, "output/remotion-review/wot-contact-sheet.png");
  const configPath = path.resolve(root, "remotion/assets.config.ts");

  assert.ok(fs.existsSync(v5Video), "V5 Master video must exist");
  assert.ok(fs.statSync(v5Video).size > 1_000_000, "V5 Master video should be at least 1MB");

  assert.ok(fs.existsSync(premiumVideo), "Premium alias video must exist");
  assert.ok(fs.statSync(premiumVideo).size > 1_000_000, "Premium alias video should be at least 1MB");

  assert.ok(fs.existsSync(v5Poster), "V5 Poster frame must exist");
  assert.ok(fs.statSync(v5Poster).size > 10_000, "V5 Poster frame should be at least 10KB");

  assert.ok(fs.existsSync(premiumPoster), "Premium poster alias must exist");
  assert.ok(fs.existsSync(contactSheet), "Contact sheet must exist");
  assert.ok(fs.existsSync(configPath), "Asset config must exist");
});

test("Wall of Text Cover Video (V5): media stream parameters match specifications", () => {
  const videoPath = path.resolve(root, "public/explore/covers/wall-of-text-v5.mp4");
  const out = JSON.parse(
    execFileSync(ffprobe.path, ["-v", "error", "-show_streams", "-show_format", "-of", "json", videoPath], {
      windowsHide: true,
      encoding: "utf8",
    })
  );

  const videoStream = out.streams.find((s) => s.codec_type === "video");
  const audioStream = out.streams.find((s) => s.codec_type === "audio");

  assert.equal(videoStream.width, 1280, "Master width must be 1280");
  assert.equal(videoStream.height, 720, "Master height must be 720");
  assert.equal(Number(videoStream.nb_frames), 192, "Duration must be exactly 192 frames");
  assert.equal(videoStream.r_frame_rate, "24/1", "Frame rate must be 24 FPS");
  assert.equal(Number(videoStream.duration), 8, "Duration must be 8.00 seconds");
  assert.equal(videoStream.codec_name, "h264", "Codec must be h264");
  assert.equal(audioStream, undefined, "Video must be silent (0 audio tracks)");

  // Faststart check: moov must appear before mdat
  const bytes = fs.readFileSync(videoPath);
  const moov = bytes.indexOf(Buffer.from("moov"));
  const mdat = bytes.indexOf(Buffer.from("mdat"));
  assert.ok(moov > -1 && mdat > -1 && moov < mdat, "moov atom must precede mdat for faststart streaming");
});

test("Wall of Text Cover Video (V5): poster frame dimensions and format", async () => {
  const posterPath = path.resolve(root, "public/explore/covers/wall-of-text-v5.webp");
  const metadata = await sharp(posterPath).metadata();

  assert.equal(metadata.format, "webp", "Poster must be WebP format");
  assert.equal(metadata.width, 1280, "Poster width must be 1280");
  assert.equal(metadata.height, 720, "Poster height must be 720");
});

test("Wall of Text Cover Video (V5): 16-panel contact sheet dimensions (2560x1440)", async () => {
  const contactSheet = path.resolve(root, "output/remotion-review/wot-contact-sheet.png");
  const metadata = await sharp(contactSheet).metadata();

  assert.equal(metadata.width, 2560, "Contact sheet width must be 2560 (4 columns * 640)");
  assert.equal(metadata.height, 1440, "Contact sheet height must be 1440 (4 rows * 360)");
});

test("Wall of Text Cover Video (V5): source assets maintain 9:16 aspect ratio", () => {
  const sources = [
    "public/explore/covers/sources/wot-hero-1.mp4",
    "public/explore/covers/sources/wot-hero-2.mp4",
    "public/explore/covers/sources/wot-hero-3.mp4",
  ];

  for (const src of sources) {
    const full = path.resolve(root, src);
    assert.ok(fs.existsSync(full), `Source ${src} must exist`);
    const out = JSON.parse(
      execFileSync(ffprobe.path, ["-v", "error", "-show_streams", "-of", "json", full], {
        windowsHide: true,
        encoding: "utf8",
      })
    );
    const v = out.streams.find((s) => s.codec_type === "video");
    assert.equal(v.width, 720, "Source width must be 720");
    assert.equal(v.height, 1280, "Source height must be 1280");
    assert.equal(v.width / v.height, 9 / 16, "Source aspect ratio must be 9:16");
  }
});

test("Wall of Text Cover Video (V5): zero debug numbers, badges, or clutter in composition", () => {
  const compPath = path.resolve(root, "remotion/WOTExploreCover.tsx");
  const code = fs.readFileSync(compPath, "utf8");

  // Verify no debug frame counter strings
  assert.ok(!code.includes("FRAME {"), "Must not include live FRAME counter string");
  assert.ok(!code.includes("16:9 MASTER"), "Must not include 16:9 MASTER technical specs label");

  // Verify no numbered badges like '01 /', '02 /', '03 /'
  assert.ok(!code.includes('badge="01'), "Must not have 01 numbered badge");
  assert.ok(!code.includes('badge="02'), "Must not have 02 numbered badge");
  assert.ok(!code.includes('badge="03'), "Must not have 03 numbered badge");

  // Verify no '60+' vanity count string
  assert.ok(!code.includes("60+"), "Must not include 60+ vanity template count");

  // Verify no decorative flank watermarks
  assert.ok(!code.includes("PROVEN HOOK"), "Must not include PROVEN HOOK watermark");
  assert.ok(!code.includes("ZERO FILMING"), "Must not include ZERO FILMING watermark");
  assert.ok(!code.includes("SCROLL STOP"), "Must not include SCROLL STOP watermark");

  // Verify no top header pill clutter
  assert.ok(!code.includes("AI CREATIVE SUITE"), "Must not include AI CREATIVE SUITE header pill");
});
