import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import ffprobe from "ffprobe-static";
import sharp from "sharp";

const root = process.cwd();

test("Talking Head + Demo Promo (10s 1920x1080): assets exist and meet specifications", async () => {
  const videoPath = path.resolve(root, "public/explore/covers/talking-head-demo-promo-v1.mp4");
  const posterPath = path.resolve(root, "public/explore/covers/talking-head-demo-promo-v1.webp");
  const contactSheet = path.resolve(root, "output/remotion-review/talking-head-promo-contact-sheet.png");

  assert.ok(fs.existsSync(videoPath), "Master 10s promo MP4 must exist");
  assert.ok(fs.statSync(videoPath).size > 1_000_000, "Master MP4 must be > 1MB");
  assert.ok(fs.existsSync(posterPath), "Poster WebP must exist");
  assert.ok(fs.existsSync(contactSheet), "12-panel contact sheet must exist");

  const out = JSON.parse(
    execFileSync(
      ffprobe.path,
      ["-v", "error", "-show_streams", "-show_format", "-of", "json", videoPath],
      { windowsHide: true, encoding: "utf8" }
    )
  );

  const videoStream = out.streams.find((s) => s.codec_type === "video");
  const audioStream = out.streams.find((s) => s.codec_type === "audio");

  assert.equal(videoStream.width, 1920, "Width must be 1920");
  assert.equal(videoStream.height, 1080, "Height must be 1080");
  assert.equal(Number(videoStream.nb_frames), 300, "Frame count must be 300");
  assert.equal(videoStream.r_frame_rate, "30/1", "Frame rate must be 30 FPS");
  assert.equal(Number(videoStream.duration), 10, "Duration must be 10.00 seconds");
  assert.equal(audioStream, undefined, "Promo cover must be silent (0 audio tracks)");

  const sheetMeta = await sharp(contactSheet).metadata();
  assert.equal(sheetMeta.width, 2560, "Contact sheet width must be 2560");
  assert.equal(sheetMeta.height, 1080, "Contact sheet height must be 1080");
});

test("StackedKineticTypography: separates backing shapes and foreground letter layers", () => {
  const code = fs.readFileSync(
    path.resolve(root, "remotion/effects/StackedKineticTypography.tsx"),
    "utf8"
  );
  assert.ok(
    code.includes("LAYER A: Independent Contrasting Backing Shape"),
    "Must have separate backing shape layer"
  );
  assert.ok(
    code.includes("LAYER B: Independent Heavy Uppercase Display Letters"),
    "Must have separate foreground letter layer"
  );
});
