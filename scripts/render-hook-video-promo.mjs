import path from "node:path";
import fs from "node:fs";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import sharp from "sharp";

const root = process.cwd();
const customTempDir = "D:/remotion-temp";
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
  console.log("=== Step 1: Bundling Remotion composition (HookVideoPromo) ===");
  const bundleLocation = await bundle({
    entryPoint: path.resolve(root, "remotion/index.tsx"),
    publicDir: path.resolve(root, "remotion/public"),
  });
  console.log("Bundle created at:", bundleLocation);

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: "HookVideoPromo",
    port: 3458,
    timeoutInMilliseconds: 60000,
  });
  console.log(
    "Composition selected:",
    composition.id,
    `${composition.width}x${composition.height}`,
    `${composition.durationInFrames} frames @ ${composition.fps}fps (${(composition.durationInFrames / composition.fps).toFixed(2)}s)`
  );

  const milestones = [
    { frame: 16, name: "hk-018-source-hook-glasses-start.png" },
    { frame: 34, name: "hk-044-source-hook-glasses-on.png" },
    { frame: 62, name: "hk-078-cursor-face-drop-on-face.png" },
    { frame: 74, name: "hk-088-recreated-hook-swap-clean.png" },
    { frame: 86, name: "hk-116-remix-card-extracted-text.png" },
    { frame: 94, name: "hk-134-remix-card-business-context.png" },
    { frame: 112, name: "hk-156-cursor-drags-remix-to-video.png" },
    { frame: 132, name: "hk-184-remixed-text-locked-on-hook.png" },
    { frame: 148, name: "hk-198-fast-demo-pullup.png" },
    { frame: 170, name: "hk-214-dual-card-plus-lockup.png" },
    { frame: 202, name: "hk-247-higgsfield-ribbon-wipe-2.png" },
    { frame: 240, name: "hk-272-higgsfield-final-hero-hold.png" },
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
      port: 3458,
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

  const contactSheetPath = path.join(outputDir, "hook-video-promo-contact-sheet.png");
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

  console.log("\n=== Step 4: Rendering Master 1920x1080 12.0s Promotional Video ===");
  const videoOutPath = path.join(publicCoverDir, "hook-video-promo-v1.mp4");
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: "h264",
    outputLocation: videoOutPath,
    muted: true,
    videoBitrate: "6M",
    port: 3466,
    concurrency: 1,
    timeoutInMilliseconds: 120000,
    offthreadVideoCacheSizeInBytes: 1024 * 1024 * 1024,
  });
  console.log(
    "Master video exported to:",
    videoOutPath,
    `(${(fs.statSync(videoOutPath).size / 1024 / 1024).toFixed(2)} MB)`
  );

  const posterOutPath = path.join(publicCoverDir, "hook-video-promo-v1.webp");
  await sharp(path.join(outputDir, "hk-272-higgsfield-final-hero-hold.png"))
    .webp({ quality: 92 })
    .toFile(posterOutPath);
  console.log("Poster frame created at:", posterOutPath);

  const brainDir = path.resolve(
    process.env.USERPROFILE || "C:/Users/chund",
    ".gemini/antigravity/brain/387564ce-d450-414c-be0e-ee4ca38a7c80"
  );
  if (fs.existsSync(brainDir)) {
    fs.copyFileSync(videoOutPath, path.join(brainDir, "hook-video-promo-v1.mp4"));
    fs.copyFileSync(posterOutPath, path.join(brainDir, "hook-video-promo-v1.webp"));
    fs.copyFileSync(contactSheetPath, path.join(brainDir, "hook-video-promo-contact-sheet.png"));
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
