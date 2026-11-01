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
  console.log("=== Step 1: Bundling Remotion composition (V5) ===");
  const bundleLocation = await bundle({
    entryPoint: path.resolve(root, "remotion/index.tsx"),
    publicDir: path.resolve(root, "remotion/public"),
  });
  console.log("Bundle created at:", bundleLocation);

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: "WOTExploreCover",
    port: 3456,
    timeoutInMilliseconds: 60000,
  });
  console.log(
    "Composition selected:",
    composition.id,
    `${composition.width}x${composition.height}`,
    `${composition.durationInFrames} frames @ ${composition.fps}fps`
  );

  // Exact 16 milestones per V5 specifications:
  const milestones = [
    { frame: 0, name: "frame-000-opening-start.png", label: "000: Solid Opening" },
    { frame: 8, name: "frame-008-opening-mid.png", label: "008: Typographic Impact" },
    { frame: 15, name: "frame-015-opening-exit.png", label: "015: Contraction Wipe" },
    { frame: 20, name: "frame-020-hero1-settle.png", label: "020: Hero 1 Settled" },
    { frame: 37, name: "frame-037-hero1-drift.png", label: "037: Hero 1 Drift End" },
    { frame: 44, name: "frame-044-card-swap.png", label: "044: Directional Swap" },
    { frame: 55, name: "frame-055-hero2-settle.png", label: "055: Hero 2 Settled" },
    { frame: 69, name: "frame-069-remix-slam.png", label: "069: REMIX. Slam Start" },
    { frame: 77, name: "frame-077-remix-exit.png", label: "077: REMIX. Impact Peak" },
    { frame: 90, name: "frame-090-hero3-settle.png", label: "090: Hero 3 Settled" },
    { frame: 105, name: "frame-105-burst-motion.png", label: "105: 3-Card Burst" },
    { frame: 120, name: "frame-120-triptych.png", label: "120: Collage Assembled" },
    { frame: 140, name: "frame-140-collage-dev.png", label: "140: Collage Development" },
    { frame: 160, name: "frame-160-focus-left.png", label: "160: Focus Sequence (Left)" },
    { frame: 179, name: "frame-179-triptych-bal.png", label: "179: Balanced Triptych" },
    { frame: 188, name: "frame-188-loop-reset.png", label: "188: Seamless Loop Reset" },
  ];

  console.log("\n=== Step 2: Rendering 16 Milestone Stills for V5 Review ===");
  for (const m of milestones) {
    const outPath = path.join(outputDir, m.name);
    await renderStill({
      composition,
      serveUrl: bundleLocation,
      output: outPath,
      frame: m.frame,
      imageFormat: "png",
      port: 3456,
      timeoutInMilliseconds: 60000,
    });
    console.log(`Rendered frame ${m.frame.toString().padStart(3, "0")} -> ${m.name}`);
  }

  console.log("\n=== Step 3: Building 16-Panel Contact Sheet (4x4 Grid, 2560x1440) ===");
  const tileWidth = 640;
  const tileHeight = 360;
  const cols = 4;
  const rows = 4;
  const sheetWidth = tileWidth * cols; // 2560
  const sheetHeight = tileHeight * rows; // 1440

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

  const contactSheetPath = path.join(outputDir, "wot-contact-sheet.png");
  await sharp({
    create: {
      width: sheetWidth,
      height: sheetHeight,
      channels: 4,
      background: { r: 8, g: 9, b: 13, alpha: 1 },
    },
  })
    .composite(composites)
    .png()
    .toFile(contactSheetPath);
  console.log("Contact sheet created at:", contactSheetPath);

  // Also write to public covers for reference
  fs.copyFileSync(contactSheetPath, path.join(publicCoverDir, "wot-contact-sheet.png"));

  console.log("\n=== Step 4: Rendering Master Silent 16:9 Cover Video (V5) ===");
  const v5VideoPath = path.join(publicCoverDir, "wall-of-text-v5.mp4");
  const premiumVideoPath = path.join(publicCoverDir, "wall-of-text-cover-premium.mp4");

  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: "h264",
    outputLocation: v5VideoPath,
    muted: true,
    videoBitrate: "4M",
    port: 3456,
    timeoutInMilliseconds: 90000,
    offthreadVideoCacheSizeInBytes: 1024 * 1024 * 1024,
    concurrency: 1,
  });
  console.log(
    "V5 Master video exported to:",
    v5VideoPath,
    `(${(fs.statSync(v5VideoPath).size / 1024 / 1024).toFixed(2)} MB)`
  );

  // Copy as wall-of-text-cover-premium.mp4 alias
  fs.copyFileSync(v5VideoPath, premiumVideoPath);
  console.log("Copied to premium alias:", premiumVideoPath);

  console.log("\n=== Step 5: Generating High-Quality WebP Poster Frames ===");
  const v5PosterPath = path.join(publicCoverDir, "wall-of-text-v5.webp");
  const premiumPosterPath = path.join(publicCoverDir, "wall-of-text-cover-premium.webp");

  // Frame 20 represents Hero 1 settled with high clarity
  await sharp(path.join(outputDir, "frame-020-hero1-settle.png"))
    .webp({ quality: 92 })
    .toFile(v5PosterPath);
  console.log("V5 Poster frame created at:", v5PosterPath);

  fs.copyFileSync(v5PosterPath, premiumPosterPath);
  console.log("Copied to premium poster alias:", premiumPosterPath);

  // Copy to brain artifact directory if accessible
  const brainDir = path.resolve(
    process.env.APPDATA || "C:/Users/chund/AppData/Roaming",
    "../.gemini/antigravity/brain/387564ce-d450-414c-be0e-ee4ca38a7c80"
  );
  if (fs.existsSync(brainDir)) {
    console.log("\n=== Copying deliverables to brain artifact directory ===");
    fs.copyFileSync(v5VideoPath, path.join(brainDir, "wall-of-text-v5.mp4"));
    fs.copyFileSync(premiumVideoPath, path.join(brainDir, "wall-of-text-cover-premium.mp4"));
    fs.copyFileSync(v5PosterPath, path.join(brainDir, "wall-of-text-v5.webp"));
    fs.copyFileSync(premiumPosterPath, path.join(brainDir, "poster.webp"));
    fs.copyFileSync(contactSheetPath, path.join(brainDir, "wot-contact-sheet.png"));

    for (const m of milestones) {
      const src = path.join(outputDir, m.name);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(brainDir, m.name));
      }
    }
    console.log("Artifacts updated in brain directory.");
  }

  console.log("\n=== Complete! All V5 deliverables successfully produced ===");
}

main().catch((err) => {
  console.error("Render failed:", err);
  process.exit(1);
});
