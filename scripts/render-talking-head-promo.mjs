import path from "node:path";
import fs from "node:fs";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import sharp from "sharp";

const root = process.cwd();
const outputDir = path.resolve(root, "output/remotion-review");
const publicCoverDir = path.resolve(root, "public/explore/covers");

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
if (!fs.existsSync(publicCoverDir)) fs.mkdirSync(publicCoverDir, { recursive: true });

async function main() {
  console.log("=== Step 1: Bundling Remotion composition (TalkingHeadDemoPromo) ===");
  const bundleLocation = await bundle({
    entryPoint: path.resolve(root, "remotion/index.tsx"),
    publicDir: path.resolve(root, "remotion/public"),
  });
  console.log("Bundle created at:", bundleLocation);

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: "TalkingHeadDemoPromo",
    port: 3457,
    timeoutInMilliseconds: 60000,
  });
  console.log(
    "Composition selected:",
    composition.id,
    `${composition.width}x${composition.height}`,
    `${composition.durationInFrames} frames @ ${composition.fps}fps`
  );

  const milestones = [
    { frame: 18, name: "th-015-cursor-audio-enter.png" },
    { frame: 48, name: "th-045-cursor-audio-approach.png" },
    { frame: 58, name: "th-062-audio-contact-pulse.png" },
    { frame: 85, name: "th-085-talking-head-active.png" },
    { frame: 125, name: "th-125-demo-card-appears.png" },
    { frame: 152, name: "th-148-cursor-drags-demo.png" },
    { frame: 166, name: "th-166-connector-flash.png" },
    { frame: 190, name: "th-190-camera-push-blur.png" },
    { frame: 202, name: "th-202-hero-type-slam.png" },
    { frame: 212, name: "th-212-orange-demo-expand.png" },
    { frame: 245, name: "th-245-camera-punch-settle.png" },
    { frame: 285, name: "th-285-final-hero-hold.png" },
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
      port: 3457,
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

  const contactSheetPath = path.join(outputDir, "talking-head-promo-contact-sheet.png");
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
  console.log("Contact sheet created at:", contactSheetPath);

  console.log("\n=== Step 4: Rendering Master 1920x1080 10s Promotional Video ===");
  const videoOutPath = path.join(publicCoverDir, "talking-head-demo-promo-v1.mp4");
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: "h264",
    outputLocation: videoOutPath,
    muted: true,
    videoBitrate: "6M",
    port: 3457,
    timeoutInMilliseconds: 120000,
    offthreadVideoCacheSizeInBytes: 1024 * 1024 * 1024,
    concurrency: 1,
  });
  console.log(
    "Master video exported to:",
    videoOutPath,
    `(${(fs.statSync(videoOutPath).size / 1024 / 1024).toFixed(2)} MB)`
  );

  const posterOutPath = path.join(publicCoverDir, "talking-head-demo-promo-v1.webp");
  await sharp(path.join(outputDir, "th-245-camera-punch-settle.png"))
    .webp({ quality: 92 })
    .toFile(posterOutPath);
  console.log("Poster frame created at:", posterOutPath);

  const brainDir = path.resolve(
    process.env.USERPROFILE || "C:/Users/chund",
    ".gemini/antigravity/brain/387564ce-d450-414c-be0e-ee4ca38a7c80"
  );
  if (fs.existsSync(brainDir)) {
    fs.copyFileSync(videoOutPath, path.join(brainDir, "talking-head-demo-promo-v1.mp4"));
    fs.copyFileSync(posterOutPath, path.join(brainDir, "talking-head-demo-promo-v1.webp"));
    fs.copyFileSync(contactSheetPath, path.join(brainDir, "talking-head-promo-contact-sheet.png"));
    for (const m of milestones) {
      fs.copyFileSync(path.join(outputDir, m.name), path.join(brainDir, m.name));
    }
    console.log("Copied deliverables to brain artifact directory.");
  }

  try {
    fs.rmSync(bundleLocation, { recursive: true, force: true });
    console.log("Cleaned temporary Remotion bundle:", bundleLocation);
  } catch {}

  console.log("\n=== Complete! ===");
}

main().catch((err) => {
  console.error("Render failed:", err);
  process.exit(1);
});
