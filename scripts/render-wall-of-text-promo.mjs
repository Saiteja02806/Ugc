import path from "node:path";
import fs from "node:fs";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import sharp from "sharp";

const root = process.cwd();
const customTempDir = "D:/remotion-temp-wot";
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
  console.log("=== Step 1: Bundling Remotion composition (WallOfTextPromo) ===");
  const bundleLocation = await bundle({
    entryPoint: path.resolve(root, "remotion/index.tsx"),
    publicDir: path.resolve(root, "remotion/public"),
  });
  console.log("Bundle created at:", bundleLocation);

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: "WallOfTextPromo",
    port: 3470,
    timeoutInMilliseconds: 60000,
  });
  console.log(
    "Composition selected:",
    composition.id,
    `${composition.width}x${composition.height}`,
    `${composition.durationInFrames} frames @ ${composition.fps}fps (${(composition.durationInFrames / composition.fps).toFixed(2)}s)`
  );

  const milestones = [
    { frame: 12, name: "wot-018-wall-builds-mid.png" },
    { frame: 32, name: "wot-034-wall-complete-coral-accent.png" },
    { frame: 54, name: "wot-052-blinds-split-open.png" },
    { frame: 66, name: "wot-070-source-window-settled.png" },
    { frame: 74, name: "wot-088-face-sticker-lands.png" },
    { frame: 84, name: "wot-104-ink-line-connects-face.png" },
    { frame: 94, name: "wot-123-scan-line-mid-swap.png" },
    { frame: 114, name: "wot-138-clean-result-revealed.png" },
    { frame: 138, name: "wot-162-words-pour-into-video.png" },
    { frame: 168, name: "wot-194-caption-complete-on-video.png" },
    { frame: 206, name: "wot-222-marquee-wall-enter.png" },
    { frame: 248, name: "wot-248-marquee-wall-finale-hold.png" },
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
      port: 3470,
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

  const contactSheetPath = path.join(outputDir, "wall-of-text-promo-contact-sheet.png");
  await sharp({
    create: {
      width: sheetWidth,
      height: sheetHeight,
      channels: 4,
      background: { r: 5, g: 7, b: 8, alpha: 1 },
    },
  })
    .composite(composites)
    .png()
    .toFile(contactSheetPath);
  console.log("Contact sheet created at:", contactSheetPath);

  console.log("\n=== Step 4: Rendering Master 1920x1080 9.0s Promotional Video ===");
  const tempVideoOutPath = path.join(customTempDir, "wall-of-text-promo-v1.mp4");
  const videoOutPath = path.join(publicCoverDir, "wall-of-text-promo-v1.mp4");
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: "h264",
    outputLocation: tempVideoOutPath,
    muted: true,
    videoBitrate: "6M",
    port: 3476,
    concurrency: 1,
    timeoutInMilliseconds: 120000,
    offthreadVideoCacheSizeInBytes: 1024 * 1024 * 1024,
  });
  fs.copyFileSync(tempVideoOutPath, videoOutPath);
  console.log(
    "Master video exported to:",
    videoOutPath,
    `(${(fs.statSync(videoOutPath).size / 1024 / 1024).toFixed(2)} MB)`
  );

  const posterOutPath = path.join(publicCoverDir, "wall-of-text-promo-v1.webp");
  await sharp(path.join(outputDir, "wot-248-marquee-wall-finale-hold.png"))
    .webp({ quality: 92 })
    .toFile(posterOutPath);
  console.log("Poster frame created at:", posterOutPath);

  const brainDir = path.resolve(
    process.env.USERPROFILE || "C:/Users/chund",
    ".gemini/antigravity/brain/387564ce-d450-414c-be0e-ee4ca38a7c80"
  );
  if (fs.existsSync(brainDir)) {
    fs.copyFileSync(videoOutPath, path.join(brainDir, "wall-of-text-promo-v1.mp4"));
    fs.copyFileSync(posterOutPath, path.join(brainDir, "wall-of-text-promo-v1.webp"));
    fs.copyFileSync(contactSheetPath, path.join(brainDir, "wall-of-text-promo-contact-sheet.png"));
    for (const m of milestones) {
      fs.copyFileSync(path.join(outputDir, m.name), path.join(brainDir, m.name));
    }
    console.log("Copied deliverables to brain artifact directory.");
  }

  try {
    fs.rmSync(bundleLocation, { recursive: true, force: true });
    fs.rmSync(customTempDir, { recursive: true, force: true });
    console.log("Cleaned temporary Remotion bundle and temp dir:", bundleLocation);
  } catch {}

  console.log("\n=== Complete! ===");
}

main().catch((err) => {
  console.error("Render failed:", err);
  process.exit(1);
});
