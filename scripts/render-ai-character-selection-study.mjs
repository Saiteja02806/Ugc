import path from "node:path";
import fs from "node:fs";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import sharp from "sharp";

// Study only: writes to output/remotion-review/ai-character-selection-study-2026-11-03/.
// Never touches public/ cover videos or posters.
const root = process.cwd();
const outDir = path.resolve(root, "output/remotion-review/ai-character-selection-study-2026-11-03");
fs.mkdirSync(outDir, { recursive: true });

const FRAMES = [0, 10, 20, 26, 30, 38, 44, 50, 58, 64, 70, 82, 89];

async function main() {
  const serveUrl = await bundle({
    entryPoint: path.resolve(root, "remotion/selection-study-index.tsx"),
    publicDir: path.resolve(root, "remotion/public"),
  });
  const composition = await selectComposition({ serveUrl, id: "AICharacterSelectionStudy", port: 3491 });
  console.log(`${composition.id} ${composition.width}x${composition.height} ${composition.durationInFrames}f`);

  const stills = [];
  for (const frame of FRAMES) {
    const out = path.join(outDir, `study-${String(frame).padStart(3, "0")}.png`);
    await renderStill({ composition, serveUrl, output: out, frame, imageFormat: "png", port: 3491 });
    stills.push(out);
    console.log("still", frame);
  }

  // Native contact sheet (4 columns) and a 390px-wide cover-size sheet
  const makeSheet = async (tileW, file) => {
    const tileH = Math.round((tileW * 1080) / 1920);
    const cols = 4;
    const rows = Math.ceil(stills.length / cols);
    const composites = [];
    for (let i = 0; i < stills.length; i++) {
      composites.push({
        input: await sharp(stills[i]).resize(tileW, tileH).toBuffer(),
        left: (i % cols) * (tileW + 8),
        top: Math.floor(i / cols) * (tileH + 8),
      });
    }
    await sharp({
      create: {
        width: cols * (tileW + 8),
        height: rows * (tileH + 8),
        channels: 3,
        background: { r: 40, g: 40, b: 40 },
      },
    })
      .composite(composites)
      .jpeg({ quality: 90 })
      .toFile(path.join(outDir, file));
  };
  await makeSheet(640, "study-sheet-640.jpg");
  await makeSheet(390, "study-sheet-390-cover-size.jpg");

  if (process.env.STUDY_STILLS_ONLY === "1") return;

  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: path.join(outDir, "ai-character-selection-study.mp4"),
    pixelFormat: "yuv420p",
    crf: 18,
    muted: true,
    concurrency: 4,
    port: 3492,
  });
  console.log("mp4 done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
