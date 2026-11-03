import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();

test("WallOfTextPromo (9.0s 1920x1080): assets exist, silent 30fps, and distinct design contract", () => {
  const videoPath = path.resolve(root, "public/explore/covers/wall-of-text-promo-v1.mp4");
  const posterPath = path.resolve(root, "public/explore/covers/wall-of-text-promo-v1.webp");
  const contactSheetPath = path.resolve(
    root,
    "output/remotion-review/wall-of-text-promo-contact-sheet.png"
  );

  assert.ok(fs.existsSync(videoPath), "Master MP4 must exist");
  assert.ok(fs.existsSync(posterPath), "WebP poster must exist");
  assert.ok(fs.existsSync(contactSheetPath), "Contact sheet PNG must exist");

  const probeJson = JSON.parse(
    execSync(
      `ffprobe -v error -show_entries stream=codec_type,width,height,r_frame_rate,nb_frames:format=duration -of json "${videoPath}"`,
      { encoding: "utf-8" }
    )
  );

  const videoStream = probeJson.streams.find((s) => s.codec_type === "video");
  const audioStream = probeJson.streams.find((s) => s.codec_type === "audio");

  assert.ok(videoStream, "Video stream must exist");
  assert.equal(audioStream, undefined, "WallOfTextPromo must be completely silent (no audio stream)");
  assert.equal(videoStream.width, 1920, "Width must be 1920");
  assert.equal(videoStream.height, 1080, "Height must be 1080");
  assert.equal(videoStream.r_frame_rate, "30/1", "Frame rate must be 30fps");
  assert.equal(Number(videoStream.nb_frames), 270, "Frame count must be 270 (9.0s)");
});

test("WallOfTextPromo source code enforces cursor face-swap + Wall of Text drag, zero pills, and non-green Violet/Sky palette", () => {
  const compPath = path.resolve(root, "remotion/WallOfTextPromo.tsx");
  const src = fs.readFileSync(compPath, "utf-8");

  assert.ok(!src.includes("plus-symbol"), "Must NOT use plus-symbol.png");
  assert.ok(
    src.includes("CursorActor") && src.includes("InfluencerPortraitBadge") && src.includes("RemixWallOfTextOverlay"),
    "Must use CursorActor to drag InfluencerPortraitBadge onto the source video and drag RemixWallOfTextOverlay up over the video"
  );
  assert.ok(
    !src.includes("CHRISTIAN") && !src.includes("TREE IN EDEN"),
    "Must NOT render the background religious paragraph wall text"
  );
  assert.ok(
    !src.includes("#4ADE80") && !src.includes("#C8FF3D") && !src.includes("FINAL • YOUR FACE"),
    "Must NOT use green glass colors or bottom/top image pills"
  );
  assert.ok(
    src.includes("#07080C") && src.includes("#7C3AED") && src.includes("#38BDF8"),
    "Must use the Electric Violet (#7C3AED) + Sky Blue (#38BDF8) + Dark Studio (#07080C) palette"
  );
  assert.ok(
    src.includes('"TEXT ON SCREEN"') && src.includes('"DRAG TEXT ON SCREEN"') && !src.includes('"WALL OF TEXT"'),
    "Must use the updated format name TEXT ON SCREEN instead of WALL OF TEXT"
  );
  assert.ok(
    src.includes("✦ NEW STORY SCRIPT ✦") &&
      src.includes("WebkitTextStroke") &&
      !src.includes("wotOrbitGrad") &&
      !src.includes("FourPointStar") &&
      !src.includes("ribbons.map("),
    "Must use clean unboxed 3D foreground typography with inline '✦ NEW STORY SCRIPT ✦' stars and NO orbital dashed line, circular dots, floating stars, or rectangular ribbon backgrounds"
  );

  const stickerMatch = src.match(/STICKER\s*=\s*\{\s*w:\s*(\d+),\s*h:\s*(\d+)/);
  assert.ok(stickerMatch, "STICKER dimensions must be defined");
  assert.ok(Number(stickerMatch[1]) <= 240 && Number(stickerMatch[2]) <= 240, "Sticker must remain <= 240px");
});
