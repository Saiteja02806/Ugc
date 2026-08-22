import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import sharp from "sharp";

const require = createRequire(import.meta.url);
const ffmpegPath = require("ffmpeg-static");
const repositoryRoot = process.cwd();
const reviewRoot = path.join(
  repositoryRoot,
  "artifacts",
  "hook-video-placement-review",
);
const framesRoot = path.join(reviewRoot, "first-frames");
const sheetsRoot = path.join(reviewRoot, "sheets");
const proofSheetsRoot = path.join(reviewRoot, "proof-sheets");
const BATCH_SIZE = 12;
const CELL_WIDTH = 240;
const FRAME_HEIGHT = 427;
const LABEL_HEIGHT = 58;
const CELL_HEIGHT = FRAME_HEIGHT + LABEL_HEIGHT;
const COLUMNS = 3;
const REVIEW_VERSION = "hook-first-frame-placement-v1";
const REVIEWED_AT = "2026-08-19";
const ABOVE_HEAD_REVIEW_INDICES = new Set([
  1, 4, 6, 7, 8, 9, 10, 12, 16, 17, 18, 19, 20, 22, 24, 31, 37, 42, 45, 46,
  53, 54, 55, 74, 75, 79, 94, 98, 106, 107,
]);

const exportedBatches = [
  path.join(
    repositoryRoot,
    "artifacts",
    "hook-video-backend-review",
    "hook-silent-2026-07-29",
  ),
  path.join(
    repositoryRoot,
    "artifacts",
    "hook-video-backend-review",
    "hook-silent-2026-08-11-approved-28",
  ),
];

const lockedReference = {
  backendId: "f8493ecd-9ce1-4918-9c36-94d740382321",
  catalogName: "creator-022-confusion-skepticism-7851a78d9e",
  destinationFileName: "0313-2065-4d4d-9069-3c70167134d2.mp4",
  influencerKey: "creator_022",
  reactionType: "confusion_skepticism",
  sourceFileSha256:
    "7851a78d9eac288c787792907f7ec29749e08b4cb83aaacaaa7084739956d702",
  sourceBatch: "hook-silent-locked-reference-2026-08-09",
  sourcePath: path.join(
    "C:\\Users\\chund\\OneDrive\\Desktop\\videos_real",
    "0313-2065-4d4d-9069-3c70167134d2.mp4",
  ),
  fallbackFramePath: path.join(
    repositoryRoot,
    "artifacts",
    "hook-audio-canary",
    "creator-022-confusion-skepticism-EWW-v6-canary-frame.png",
  ),
  visualGroup: "desk_laptop_reaction",
};

function loadReviewItems() {
  const items = [];

  for (const batchRoot of exportedBatches) {
    const manifestPath = path.join(batchRoot, "backend-review-manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

    for (const file of manifest.files) {
      items.push({
        backendId: file.backendId,
        catalogName: file.catalogName,
        destinationFileName: file.destinationFileName,
        influencerKey: file.influencerKey,
        reactionType: file.reactionType,
        sourceFileSha256: file.sha256,
        sourceBatch: file.sourceBatch,
        sourcePath: path.join(batchRoot, file.destinationFileName),
        visualGroup: file.visualGroup,
      });
    }
  }

  if (
    existsSync(lockedReference.sourcePath) ||
    existsSync(lockedReference.fallbackFramePath)
  ) {
    items.push(lockedReference);
  } else {
    console.warn(
      `Locked reference video was not found at ${lockedReference.sourcePath}; the 106 exported catalog videos will still be prepared.`,
    );
  }

  return items.map((item, index) => ({
    ...item,
    reviewIndex: index + 1,
  }));
}

function extractFirstFrame(item) {
  const outputPath = path.join(
    framesRoot,
    `${String(item.reviewIndex).padStart(3, "0")}-${item.backendId}.webp`,
  );

  if (
    item.fallbackFramePath &&
    !existsSync(item.sourcePath) &&
    existsSync(item.fallbackFramePath)
  ) {
    return sharp(item.fallbackFramePath)
      .resize(CELL_WIDTH, FRAME_HEIGHT, {
        background: "#000000",
        fit: "contain",
      })
      .webp({ quality: 90 })
      .toFile(outputPath)
      .then(() => outputPath);
  }

  const result = spawnSync(
    ffmpegPath,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      item.sourcePath,
      "-vf",
      `select=eq(n\\,0),scale=${CELL_WIDTH}:${FRAME_HEIGHT - 1},pad=${CELL_WIDTH}:${FRAME_HEIGHT}:0:(oh-ih)/2:black`,
      "-frames:v",
      "1",
      outputPath,
    ],
    { encoding: "utf8" },
  );

  if (result.status !== 0 || !existsSync(outputPath)) {
    throw new Error(
      `Could not extract first frame for ${item.destinationFileName}: ${result.stderr || "ffmpeg failed"}`,
    );
  }

  return outputPath;
}

function labelSvg(item) {
  const primary = `${String(item.reviewIndex).padStart(3, "0")} · ${item.reactionType}`;
  const secondary = `${item.visualGroup} · ${item.backendId.slice(0, 8)}`;
  return Buffer.from(`
    <svg width="${CELL_WIDTH}" height="${LABEL_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#171717"/>
      <text x="10" y="22" fill="#ffffff" font-family="Arial, sans-serif" font-size="13" font-weight="700">${escapeXml(primary)}</text>
      <text x="10" y="43" fill="#b8b8b8" font-family="Arial, sans-serif" font-size="10">${escapeXml(secondary)}</text>
    </svg>
  `);
}

async function buildSheet(batch, batchNumber) {
  const rows = Math.ceil(batch.length / COLUMNS);
  const sheet = sharp({
    create: {
      background: "#0a0a0a",
      channels: 4,
      height: rows * CELL_HEIGHT,
      width: COLUMNS * CELL_WIDTH,
    },
  });
  const composites = [];

  for (const [index, item] of batch.entries()) {
    const left = (index % COLUMNS) * CELL_WIDTH;
    const top = Math.floor(index / COLUMNS) * CELL_HEIGHT;
    composites.push({ input: item.framePath, left, top });
    composites.push({ input: labelSvg(item), left, top: top + FRAME_HEIGHT });
  }

  const outputPath = path.join(
    sheetsRoot,
    `batch-${String(batchNumber).padStart(2, "0")}.jpg`,
  );
  await sheet.composite(composites).jpeg({ quality: 90 }).toFile(outputPath);
  return outputPath;
}

function getPlacement(reviewIndex) {
  const preset = ABOVE_HEAD_REVIEW_INDICES.has(reviewIndex)
    ? "above_head"
    : "below_face";

  return {
    preset,
    reviewVersion: REVIEW_VERSION,
    reviewedAt: REVIEWED_AT,
    x: 0.5,
    y: preset === "above_head" ? 0.15 : 0.68,
  };
}

function proofOverlaySvg(item) {
  const placement = getPlacement(item.reviewIndex);
  const centerY = placement.y * FRAME_HEIGHT;
  const lines = ["A clearer way to", "show the value", "without the guesswork"];
  const lineHeight = 17;
  const firstBaseline = centerY - lineHeight;
  const text = lines
    .map(
      (line, index) =>
        `<text x="${CELL_WIDTH / 2}" y="${firstBaseline + index * lineHeight}" text-anchor="middle">${escapeXml(line)}</text>`,
    )
    .join("");

  return Buffer.from(`
    <svg width="${CELL_WIDTH}" height="${FRAME_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <g fill="#ffffff" font-family="Arial, sans-serif" font-size="13" font-weight="800" paint-order="stroke" stroke="#000000" stroke-linejoin="round" stroke-width="3">
        ${text}
      </g>
      <rect x="5" y="5" rx="9" width="91" height="21" fill="#111111" fill-opacity="0.84"/>
      <text x="13" y="20" fill="#ffffff" font-family="Arial, sans-serif" font-size="10" font-weight="700">${placement.preset.replaceAll("_", " ")}</text>
    </svg>
  `);
}

async function buildProofSheet(batch, batchNumber) {
  const rows = Math.ceil(batch.length / COLUMNS);
  const sheet = sharp({
    create: {
      background: "#0a0a0a",
      channels: 4,
      height: rows * CELL_HEIGHT,
      width: COLUMNS * CELL_WIDTH,
    },
  });
  const composites = [];

  for (const [index, item] of batch.entries()) {
    const left = (index % COLUMNS) * CELL_WIDTH;
    const top = Math.floor(index / COLUMNS) * CELL_HEIGHT;
    composites.push({ input: item.framePath, left, top });
    composites.push({ input: proofOverlaySvg(item), left, top });
    composites.push({ input: labelSvg(item), left, top: top + FRAME_HEIGHT });
  }

  const outputPath = path.join(
    proofSheetsRoot,
    `batch-${String(batchNumber).padStart(2, "0")}.jpg`,
  );
  await sheet.composite(composites).jpeg({ quality: 90 }).toFile(outputPath);
  return outputPath;
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

async function main() {
  mkdirSync(framesRoot, { recursive: true });
  mkdirSync(sheetsRoot, { recursive: true });
  mkdirSync(proofSheetsRoot, { recursive: true });

  const items = [];

  for (const item of loadReviewItems()) {
    items.push({
      ...item,
      framePath: await extractFirstFrame(item),
    });
  }
  const sheetPaths = [];
  const proofSheetPaths = [];

  for (let index = 0; index < items.length; index += BATCH_SIZE) {
    sheetPaths.push(
      await buildSheet(
        items.slice(index, index + BATCH_SIZE),
        Math.floor(index / BATCH_SIZE) + 1,
      ),
    );
    proofSheetPaths.push(
      await buildProofSheet(
        items.slice(index, index + BATCH_SIZE),
        Math.floor(index / BATCH_SIZE) + 1,
      ),
    );
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    placementContract: {
      allowedPresets: ["above_head", "below_face"],
      coordinateSystem: "normalized_0_to_1_center_anchor",
      reviewVersion: REVIEW_VERSION,
    },
    videoCount: items.length,
    videos: items.map((item) => ({
      backendId: item.backendId,
      catalogName: item.catalogName,
      firstFrame: path.relative(repositoryRoot, item.framePath),
      influencerKey: item.influencerKey,
      placement: getPlacement(item.reviewIndex),
      reactionType: item.reactionType,
      reviewIndex: item.reviewIndex,
      sourceBatch: item.sourceBatch,
      sourceFileSha256: item.sourceFileSha256,
      sourceFileName: item.destinationFileName,
      visualGroup: item.visualGroup,
    })),
  };
  writeFileSync(
    path.join(reviewRoot, "placement-review-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  console.log(
    JSON.stringify(
      {
        manifest: path.join(reviewRoot, "placement-review-manifest.json"),
        sheets: sheetPaths,
        proofSheets: proofSheetPaths,
        videoCount: items.length,
      },
      null,
      2,
    ),
  );
}

await main();
