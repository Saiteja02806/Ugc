import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import ffprobe from "ffprobe-static";
import sharp from "sharp";

const root = process.cwd();

test("Hook Video Promo (10.6s 1920x1080): assets exist, duration is NOT 10.0s, and meet specifications", async () => {
  const videoPath = path.resolve(root, "public/explore/covers/hook-video-promo-v1.mp4");
  const posterPath = path.resolve(root, "public/explore/covers/hook-video-promo-v1.webp");
  const contactSheet = path.resolve(root, "output/remotion-review/hook-video-promo-contact-sheet.png");

  assert.ok(fs.existsSync(videoPath), "Master Hook Video promo MP4 must exist");
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
  assert.equal(Number(videoStream.nb_frames), 270, "Frame count must be 270 (9.00s)");
  assert.notEqual(Number(videoStream.nb_frames), 300, "Frame count must NOT be 300 (10.0s)");
  assert.equal(videoStream.r_frame_rate, "30/1", "Frame rate must be 30 FPS");
  assert.equal(Number(videoStream.duration), 9.0, "Duration must be 9.00 seconds (not 10.0s)");
  assert.equal(audioStream, undefined, "Promo cover must be silent (0 audio tracks)");

  const sheetMeta = await sharp(contactSheet).metadata();
  assert.equal(sheetMeta.width, 2560, "Contact sheet width must be 2560");
  assert.equal(sheetMeta.height, 1080, "Contact sheet height must be 1080");
});

test("HookVideoPromo & PerspectiveFoldTypography: uses new glasses Hook sources, NO LuminousMistEffect glow, and Higgsfield slanted ribbon stack", () => {
  const hookCode = fs.readFileSync(
    path.resolve(root, "remotion/HookVideoPromo.tsx"),
    "utf8"
  );
  assert.ok(hookCode.includes("hook-explore-video.mp4"), "Must use Hook source video");
  assert.ok(hookCode.includes("hook-recreated-video.mp4"), "Must use recreated Hook video source");
  assert.ok(hookCode.includes("hook-influencer-face.jpg"), "Must use reference face image");
  assert.ok(hookCode.includes("hook-demo-video.mp4"), "Must use Product Demo source");
  assert.ok(!hookCode.includes("LuminousMistEffect"), "Must NOT render LuminousMistEffect face glow");
  assert.ok(!hookCode.includes("hook-video-v2.mp4"), "Must NOT use old AI-generated hook-video-v2.mp4");
  assert.ok(
    hookCode.includes("RemixHookTextOverlay") &&
      hookCode.includes("REMIX HOOK TEXT") &&
      hookCode.includes("This can make content for me ✅") &&
      !hookCode.includes("BUSINESS CONTEXT") &&
      !hookCode.includes("REMIXED FOR YOUR APP"),
    "Must include subtle container-free RemixHookTextOverlay dragged onto the video without blue boxes or badges"
  );

  const typoCode = fs.readFileSync(
    path.resolve(root, "remotion/effects/PerspectiveFoldTypography.tsx"),
    "utf8"
  );
  assert.ok(
    typoCode.includes("KlickpinHeaderBand") && typoCode.includes("PerspectiveFoldTypography"),
    "Must export KlickpinHeaderBand and PerspectiveFoldTypography"
  );
  assert.ok(
    typoCode.includes("skewX") && !typoCode.includes("rotateY"),
    "Must implement fast 2D Higgsfield slanted ribbon stack without slow 3D rotateY wobble"
  );
  assert.ok(
    typoCode.includes("#FF176B") && typoCode.includes("#00F0FF"),
    "Must use distinct Hot Viral Magenta (#FF176B) and Electric Cyan (#00F0FF) palette"
  );
  assert.ok(
    typoCode.includes("VIDMAKE • HOOK STUDIO") && !typoCode.includes("UGC PILOT"),
    "Must use VIDMAKE • HOOK STUDIO eyebrow and never UGC PILOT"
  );
  assert.ok(
    !typoCode.includes("#FFE50E") && !hookCode.includes("#FFE50E"),
    "Must NOT duplicate TalkingHeadDemoPromo's yellow (#FFE50E) text/billboard palette"
  );
});
