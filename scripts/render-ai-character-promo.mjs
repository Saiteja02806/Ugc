import path from "node:path";
import fs from "node:fs";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import sharp from "sharp";

const root = process.cwd();
const customTempDir = "D:/remotion-temp-aichar";
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
const publicCharacterDir = path.resolve(root, "public/explore/characters");

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
if (!fs.existsSync(publicCoverDir)) fs.mkdirSync(publicCoverDir, { recursive: true });
if (!fs.existsSync(publicCharacterDir)) fs.mkdirSync(publicCharacterDir, { recursive: true });

// OneDrive can transiently lock files for the copyfile syscall; read/write avoids it.
function copyFileSafe(src, dest) {
  fs.writeFileSync(dest, fs.readFileSync(src));
}

async function main() {
  console.log("=== Step 1: Bundling Remotion composition (AICharacterPromo) ===");
  const bundleLocation = await bundle({
    entryPoint: path.resolve(root, "remotion/index.tsx"),
    publicDir: path.resolve(root, "remotion/public"),
  });
  console.log("Bundle created at:", bundleLocation);

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: "AICharacterPromo",
    port: 3482,
    timeoutInMilliseconds: 60000,
  });
  console.log(
    "Composition selected:",
    composition.id,
    `${composition.width}x${composition.height}`,
    `${composition.durationInFrames} frames @ ${composition.fps}fps (${(composition.durationInFrames / composition.fps).toFixed(2)}s)`
  );

  const milestones = [
    { frame: 34, name: "aichar-034-type-extreme-3d-pick.png" },
    { frame: 50, name: "aichar-050-type-docks-to-stack.png" },
    { frame: 90, name: "aichar-090-scene-studio-wall-male25.png" },
    { frame: 138, name: "aichar-138-heritage-middle-eastern-olive.png" },
    { frame: 186, name: "aichar-186-face-chiseled-round-eyes.png" },
    { frame: 226, name: "aichar-226-hair-curls-3d-pick.png" },
    { frame: 242, name: "aichar-242-hair-black-platinum.png" },
    { frame: 286, name: "aichar-286-outfit-crew-tee-black-half.png" },
    { frame: 312, name: "aichar-312-generate-traits-orbit.png" },
    { frame: 330, name: "aichar-330-generate-3d-click.png" },
    { frame: 372, name: "aichar-372-finale-reveal.png" },
    { frame: 430, name: "aichar-430-finale-hold.png" },
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
      port: 3482,
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

  const contactSheetPath = path.join(outputDir, "ai-character-promo-contact-sheet.png");
  const publicContactSheetPath = path.join(publicCoverDir, "ai-character-promo-contact-sheet.png");
  await sharp({
    create: {
      width: sheetWidth,
      height: sheetHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    },
  })
    .composite(composites)
    .png()
    .toFile(contactSheetPath);
  copyFileSafe(contactSheetPath, publicContactSheetPath);
  console.log("Saved contact sheet ->", contactSheetPath);

  if (process.env.AICHAR_STILLS_ONLY === "1") {
    console.log("AICHAR_STILLS_ONLY=1 -> skipping MP4/WebP render.");
    return;
  }

  console.log("\n=== Step 4: Rendering Full MP4 Video (450 frames @ 30fps = 15.00s, 1920x1080) ===");
  const mp4Path = path.join(publicCoverDir, "ai-character-promo-v1.mp4");
  const liveCharacterMp4Path = path.join(publicCharacterDir, "ai-character-create-yours-v5.mp4");
  const tempMp4Path = path.join(customTempDir, "ai-character-promo-v1.mp4");
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: "h264",
    outputLocation: tempMp4Path,
    pixelFormat: "yuv420p",
    crf: 18,
    muted: true,
    concurrency: 4,
    port: 3483,
    timeoutInMilliseconds: 180000,
    onProgress: ({ progress }) => {
      const pct = Math.round(progress * 100);
      if (pct % 20 === 0) {
        process.stdout.write(`\rRendering MP4: ${pct}%`);
      }
    },
  });
  copyFileSafe(tempMp4Path, mp4Path);
  copyFileSafe(tempMp4Path, liveCharacterMp4Path);
  console.log("\nSaved MP4 ->", mp4Path);
  console.log("Saved Live Explore Card MP4 ->", liveCharacterMp4Path);

  console.log("\n=== Step 5: Generating WebP Poster Frame ===");
  const webpPath = path.join(publicCoverDir, "ai-character-promo-v1.webp");
  const liveCharacterWebpPath = path.join(publicCharacterDir, "ai-character-create-yours-v5.webp");
  await sharp(path.join(outputDir, "aichar-430-finale-hold.png"))
    .webp({ quality: 92 })
    .toFile(webpPath);
  copyFileSafe(webpPath, liveCharacterWebpPath);
  console.log("Saved WebP poster ->", webpPath);
  console.log("Saved Live Explore Card WebP poster ->", liveCharacterWebpPath);

  console.log("\n=== Step 6: Copying Artifacts to Brain Folder for Visual Review ===");
  const brainDir =
    "C:/Users/chund/.gemini/antigravity/brain/387564ce-d450-414c-be0e-ee4ca38a7c80";
  if (fs.existsSync(brainDir)) {
    copyFileSafe(contactSheetPath, path.join(brainDir, "ai-character-promo-contact-sheet.png"));
    copyFileSafe(mp4Path, path.join(brainDir, "ai-character-promo-v1.mp4"));
    copyFileSafe(webpPath, path.join(brainDir, "ai-character-promo-v1.webp"));
    for (const m of milestones) {
      copyFileSafe(
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
