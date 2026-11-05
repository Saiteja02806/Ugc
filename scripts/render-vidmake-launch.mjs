import path from "node:path";
import fs from "node:fs";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import sharp from "sharp";

const root = process.cwd();
const customTempDir = "D:/remotion-temp-vidmake";
if (fs.existsSync(customTempDir)) {
  try {
    fs.rmSync(customTempDir, { recursive: true, force: true });
  } catch {}
}
fs.mkdirSync(customTempDir, { recursive: true });
process.env.TEMP = customTempDir;
process.env.TMP = customTempDir;
process.env.TMPDIR = customTempDir;

const outDir = path.resolve(root, "output/remotion-review/vidmake-launch-2026-11-05");
fs.mkdirSync(outDir, { recursive: true });

function copyFileSafe(src, dest) {
  fs.writeFileSync(dest, fs.readFileSync(src));
}

const MILESTONES = [
  { frame: 30, name: "vm4-01-logo-ignition.png" },
  { frame: 80, name: "vm4-02-vidmake-meaning.png" },
  { frame: 190, name: "vm4-03-not-with-vidmake.png" },
  { frame: 262, name: "vm4-04-hook-library-4x2.png" },
  { frame: 320, name: "vm4-05-hook-isolate-recreate.png" },
  { frame: 390, name: "vm4-06-hook-recreated.png" },
  { frame: 466, name: "vm4-07-th-library-4x2.png" },
  { frame: 514, name: "vm4-08-th-isolate-recreate.png" },
  { frame: 575, name: "vm4-09-th-recreated-demo.png" },
  { frame: 690, name: "vm4-10-slideshow-isolate-recreate.png" },
  { frame: 750, name: "vm4-11-slideshow-6slides.png" },
  { frame: 870, name: "vm4-12-vidmake-finale.png" },
];

async function main() {
  console.log("=== Step 1: Bundling VidmakeLaunchPromo (900 frames, 30.00s @ 30fps) ===");
  const serveUrl = await bundle({
    entryPoint: path.resolve(root, "remotion/vidmake-launch-index.tsx"),
    publicDir: path.resolve(root, "remotion/public"),
  });

  const composition = await selectComposition({
    serveUrl,
    id: "VidmakeLaunchPromo",
    port: 3495,
    timeoutInMilliseconds: 60000,
  });
  console.log(
    `Selected ${composition.id}: ${composition.width}x${composition.height}, ${composition.durationInFrames} frames @ ${composition.fps}fps`
  );

  console.log("\n=== Step 2: Rendering 12 Milestone Stills ===");
  for (const m of MILESTONES) {
    const outPath = path.join(outDir, m.name);
    await renderStill({
      composition,
      serveUrl,
      output: outPath,
      frame: m.frame,
      imageFormat: "png",
      port: 3495,
      timeoutInMilliseconds: 60000,
    });
    console.log(`Rendered frame ${String(m.frame).padStart(4, "0")} -> ${m.name}`);
  }

  console.log("\n=== Step 3: Building 12-Panel Contact Sheet (2560x1080) ===");
  const tileW = 640;
  const tileH = 360;
  const cols = 4;
  const rows = 3;
  const composites = [];
  for (let i = 0; i < MILESTONES.length; i++) {
    const buf = await sharp(path.join(outDir, MILESTONES[i].name))
      .resize(tileW, tileH)
      .toBuffer();
    composites.push({
      input: buf,
      left: (i % cols) * tileW,
      top: Math.floor(i / cols) * tileH,
    });
  }
  const sheetPath = path.join(outDir, "vidmake-launch-v4-sheet.png");
  await sharp({
    create: {
      width: tileW * cols,
      height: tileH * rows,
      channels: 4,
      background: { r: 3, g: 4, b: 10, alpha: 1 },
    },
  })
    .composite(composites)
    .png()
    .toFile(sheetPath);
  console.log("Saved contact sheet ->", sheetPath);

  const brainDir =
    "C:/Users/chund/.gemini/antigravity/brain/387564ce-d450-414c-be0e-ee4ca38a7c80";
  if (fs.existsSync(brainDir)) {
    copyFileSafe(sheetPath, path.join(brainDir, "vidmake-launch-v4-sheet.png"));
    for (const m of MILESTONES) {
      copyFileSafe(path.join(outDir, m.name), path.join(brainDir, m.name));
    }
  }

  if (process.env.VIDMAKE_STILLS_ONLY === "1") {
    console.log("VIDMAKE_STILLS_ONLY=1 -> skipping full MP4 render.");
    return;
  }

  console.log("\n=== Step 4: Rendering Full 30s MP4 Video (Hand-Drawn Storyboard v4) ===");
  const mp4Path = path.join(outDir, "vidmake-launch-v4.mp4");
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: mp4Path,
    pixelFormat: "yuv420p",
    crf: 18,
    muted: false,
    concurrency: 4,
    port: 3496,
    timeoutInMilliseconds: 300000,
    onProgress: ({ progress }) => {
      const pct = Math.round(progress * 100);
      if (pct % 10 === 0) {
        process.stdout.write(`\rRendering Vidmake Launch v4 MP4: ${pct}%`);
      }
    },
  });
  console.log("\nSaved MP4 ->", mp4Path);
  if (fs.existsSync(brainDir)) {
    copyFileSafe(mp4Path, path.join(brainDir, "vidmake-launch-v4.mp4"));
  }
  const publicCoverPath = path.resolve(root, "public/explore/covers/vidmake-launch.mp4");
  copyFileSafe(mp4Path, publicCoverPath);
  console.log("Updated public cover ->", publicCoverPath);
}

main().catch((err) => {
  console.error("Render failed:", err);
  process.exit(1);
});
