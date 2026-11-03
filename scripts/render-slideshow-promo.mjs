import path from "node:path";
import fs from "node:fs";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import sharp from "sharp";

const root = process.cwd();
const customTempDir = "D:/remotion-temp-slideshow";
if (fs.existsSync(customTempDir)) {
  try {
    fs.rmSync(customTempDir, { recursive: true, force: true });
  } catch {}
}
fs.mkdirSync(customTempDir, { recursive: true });
process.env.TEMP = customTempDir;
process.env.TMP = customTempDir;
process.env.TMPDIR = customTempDir;

const outputDir = path.resolve(root, "output/remotion-review");
const publicCoverDir = path.resolve(root, "public/explore/covers");

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
if (!fs.existsSync(publicCoverDir)) fs.mkdirSync(publicCoverDir, { recursive: true });

async function main() {
  console.log("=== Step 1: Bundling Remotion composition (SlideshowPromo) ===");
  const bundleLocation = await bundle({
    entryPoint: path.resolve(root, "remotion/index.tsx"),
    publicDir: path.resolve(root, "remotion/public"),
  });
  console.log("Bundle created at:", bundleLocation);

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: "SlideshowPromo",
    port: 3472,
    timeoutInMilliseconds: 60000,
  });
  console.log(
    "Composition selected:",
    composition.id,
    `${composition.width}x${composition.height}`,
    `${composition.durationInFrames} frames @ ${composition.fps}fps (${(composition.durationInFrames / composition.fps).toFixed(2)}s)`
  );

  const milestones = [
    { frame: 8, name: "slide-008-source-deck-fanout.png" },
    { frame: 22, name: "slide-022-source-push-up-widen.png" },
    { frame: 38, name: "slide-038-source-wide-showcase-hold.png" },
    { frame: 50, name: "slide-050-regenerate-button-enter.png" },
    { frame: 63, name: "slide-063-cursor-hovers-regenerate.png" },
    { frame: 71, name: "slide-071-button-click-splash-burst.png" },
    { frame: 82, name: "slide-082-button-loading-progress-mid.png" },
    { frame: 93, name: "slide-093-loading-complete-flip-start.png" },
    { frame: 103, name: "slide-103-regenerated-flip-and-widen.png" },
    { frame: 132, name: "slide-132-updated-wide-showcase-hold.png" },
    { frame: 164, name: "slide-164-hero-finale-enter.png" },
    { frame: 194, name: "slide-194-hero-finale-hold.png" },
  ];

  console.log("\n=== Step 2: Rendering 12 Milestone Stills ===");
  for (const m of milestones) {
    const outPath = path.join(outputDir, m.name);
    await renderStill({
      composition,
      serveUrl: bundleLocation,
      output: outPath,
      frame: m.frame,
      imageFormat: "png",
      port: 3472,
      timeoutInMilliseconds: 60000,
    });
    console.log(`Rendered frame ${m.frame.toString().padStart(3, "0")} -> ${m.name}`);
  }

  console.log("\n=== Step 3: Building 12-Panel Contact Sheet (4x3 Grid, 2560x1080) ===");
  const tileWidth = 640;
  const tileHeight = 360;
  const cols = 4;
  const rows = 3;
  const sheetWidth = tileWidth * cols; // 2560
  const sheetHeight = tileHeight * rows; // 1080

  const composites = [];
  for (let i = 0; i < milestones.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const left = col * tileWidth;
    const top = row * tileHeight;

    const imgBuffer = await sharp(path.join(outputDir, milestones[i].name))
      .resize(tileWidth, tileHeight)
      .toBuffer();

    composites.push({
      input: imgBuffer,
      left,
      top,
    });
  }

  const contactSheetPath = path.join(outputDir, "slideshow-promo-contact-sheet.png");
  const publicContactSheetPath = path.join(publicCoverDir, "slideshow-promo-contact-sheet.png");
  await sharp({
    create: {
      width: sheetWidth,
      height: sheetHeight,
      channels: 4,
      background: { r: 7, g: 8, b: 12, alpha: 1 },
    },
  })
    .composite(composites)
    .png()
    .toFile(contactSheetPath);
  fs.copyFileSync(contactSheetPath, publicContactSheetPath);
  console.log("Saved contact sheet ->", contactSheetPath);

  console.log("\n=== Step 4: Rendering Full MP4 Video (210 frames @ 30fps = 7.00s, 1920x1080) ===");
  const mp4Path = path.join(publicCoverDir, "slideshow-promo-v1.mp4");
  const tempMp4Path = path.join(customTempDir, "slideshow-promo-v1.mp4");
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: "h264",
    outputLocation: tempMp4Path,
    pixelFormat: "yuv420p",
    crf: 18,
    muted: true,
    concurrency: 1,
    port: 3473,
    timeoutInMilliseconds: 120000,
    onProgress: ({ progress }) => {
      const pct = Math.round(progress * 100);
      if (pct % 20 === 0) {
        process.stdout.write(`\rRendering MP4: ${pct}%`);
      }
    },
  });
  fs.copyFileSync(tempMp4Path, mp4Path);
  console.log("\nSaved MP4 ->", mp4Path);

  console.log("\n=== Step 5: Generating WebP Poster Frame ===");
  const webpPath = path.join(publicCoverDir, "slideshow-promo-v1.webp");
  await sharp(path.join(outputDir, "slide-194-hero-finale-hold.png"))
    .webp({ quality: 92 })
    .toFile(webpPath);
  console.log("Saved WebP poster ->", webpPath);

  console.log("\n=== Step 6: Copying Artifacts to Brain Folder for Visual Review ===");
  const brainDir =
    "C:/Users/chund/.gemini/antigravity/brain/387564ce-d450-414c-be0e-ee4ca38a7c80";
  if (fs.existsSync(brainDir)) {
    fs.copyFileSync(contactSheetPath, path.join(brainDir, "slideshow-promo-contact-sheet.png"));
    fs.copyFileSync(mp4Path, path.join(brainDir, "slideshow-promo-v1.mp4"));
    fs.copyFileSync(webpPath, path.join(brainDir, "slideshow-promo-v1.webp"));
    for (const m of milestones) {
      fs.copyFileSync(
        path.join(outputDir, m.name),
        path.join(brainDir, m.name)
      );
    }
    console.log("Copied contact sheet, stills, MP4, and WebP to brain folder!");
  }
}

main().catch((err) => {
  console.error("Render failed:", err);
  process.exit(1);
});
