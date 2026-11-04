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
  { frame: 48, name: "vm-01-act1-pain-pills.png" },
  { frame: 148, name: "vm-02-act1-vidmake-reveal.png" },
  { frame: 232, name: "vm-03-act2-url-typing-macro.png" },
  { frame: 320, name: "vm-04-act2-brand-avatars-fan.png" },
  { frame: 465, name: "vm-05-act3-character-selector.png" },
  { frame: 605, name: "vm-06-act3-4k-creator-finale.png" },
  { frame: 720, name: "vm-07-act4a-hook-remix-split.png" },
  { frame: 840, name: "vm-08-act4b-talking-head-timeline.png" },
  { frame: 945, name: "vm-09-act4c-phone-reel-eject.png" },
  { frame: 1035, name: "vm-10-act4d-carousel-6slides.png" },
  { frame: 1170, name: "vm-11-act5-autopilot-schedule.png" },
  { frame: 1400, name: "vm-12-act6-vidmake-cta-finale.png" },
];

async function main() {
  console.log("=== Step 1: Bundling VidmakeLaunchPromo (1440 frames, 48.00s @ 30fps) ===");
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
  const sheetPath = path.join(outDir, "vidmake-launch-contact-sheet.png");
  await sharp({
    create: {
      width: tileW * cols,
      height: tileH * rows,
      channels: 4,
      background: { r: 12, g: 13, b: 16, alpha: 1 },
    },
  })
    .composite(composites)
    .png()
    .toFile(sheetPath);
  console.log("Saved contact sheet ->", sheetPath);

  const brainDir =
    "C:/Users/chund/.gemini/antigravity/brain/387564ce-d450-414c-be0e-ee4ca38a7c80";
  if (fs.existsSync(brainDir)) {
    copyFileSafe(sheetPath, path.join(brainDir, "vidmake-launch-contact-sheet.png"));
    for (const m of MILESTONES) {
      copyFileSafe(path.join(outDir, m.name), path.join(brainDir, m.name));
    }
  }

  if (process.env.VIDMAKE_STILLS_ONLY === "1") {
    console.log("VIDMAKE_STILLS_ONLY=1 -> skipping full MP4 render.");
    return;
  }

  console.log("\n=== Step 4: Rendering Full 48s MP4 Video ===");
  const mp4Path = path.join(outDir, "vidmake-launch-v1.mp4");
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: mp4Path,
    pixelFormat: "yuv420p",
    crf: 18,
    muted: true,
    concurrency: 4,
    port: 3496,
    timeoutInMilliseconds: 300000,
    onProgress: ({ progress }) => {
      const pct = Math.round(progress * 100);
      if (pct % 10 === 0) {
        process.stdout.write(`\rRendering Vidmake Launch MP4: ${pct}%`);
      }
    },
  });
  console.log("\nSaved MP4 ->", mp4Path);
  if (fs.existsSync(brainDir)) {
    copyFileSafe(mp4Path, path.join(brainDir, "vidmake-launch-v1.mp4"));
  }
}

main().catch((err) => {
  console.error("Render failed:", err);
  process.exit(1);
});
