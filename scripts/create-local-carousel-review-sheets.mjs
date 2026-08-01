import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";

import sharp from "sharp";

const DEFAULT_OUTPUT_ROOT = ".tmp/local-carousel-review-sheets";
const COLUMNS = 3;
const ROWS = 2;
const TILE_WIDTH = 360;
const IMAGE_HEIGHT = 450;
const LABEL_HEIGHT = 72;
const GAP = 14;
const MARGIN = 22;
const PAGE_SIZE = COLUMNS * ROWS;

const args = parseArgs(process.argv.slice(2));
const reviewMapPath = path.resolve(
  args["review-map"] ??
    "scripts/data/slideshows-carousel-review-2026-07-28.json",
);
const reviewMap = JSON.parse(readFileSync(reviewMapPath, "utf8"));
const sourceDir = path.resolve(reviewMap.sourceFolder);
const mode = args.mode ?? "approved";
const outputRoot = path.resolve(args["out-dir"] ?? DEFAULT_OUTPUT_ROOT);
const outputDir = path.join(
  outputRoot,
  new Date().toISOString().replace(/[:.]/g, "-"),
);

const approvedFiles = (reviewMap.approvedGroups ?? []).flatMap((group) =>
  (group.files ?? []).map((fileName) => ({
    decision: "approved",
    fileName,
    group: `${group.runtimeCategory}/${group.broadVisualBucket}`,
  })),
);
const rejectedFiles = (reviewMap.rejected ?? []).map((item) => ({
  decision: "rejected",
  fileName: item.file,
  group: item.reason,
}));
const files =
  mode === "all"
    ? [...approvedFiles, ...rejectedFiles]
    : mode === "rejected"
      ? rejectedFiles
      : approvedFiles;

if (files.length === 0) {
  throw new Error(`Review map has no files for mode=${mode}.`);
}

files.sort((left, right) =>
  left.fileName.localeCompare(right.fileName, undefined, { numeric: true }),
);
await mkdir(outputDir, { recursive: true });

const manifest = [];

for (
  let pageIndex = 0;
  pageIndex < Math.ceil(files.length / PAGE_SIZE);
  pageIndex += 1
) {
  const pageFiles = files.slice(
    pageIndex * PAGE_SIZE,
    (pageIndex + 1) * PAGE_SIZE,
  );
  const width =
    MARGIN * 2 + COLUMNS * TILE_WIDTH + (COLUMNS - 1) * GAP;
  const height =
    MARGIN * 2 +
    ROWS * (IMAGE_HEIGHT + LABEL_HEIGHT) +
    (ROWS - 1) * GAP;
  const composites = [];

  for (let localIndex = 0; localIndex < pageFiles.length; localIndex += 1) {
    const item = pageFiles[localIndex];
    const globalIndex = pageIndex * PAGE_SIZE + localIndex + 1;
    const column = localIndex % COLUMNS;
    const row = Math.floor(localIndex / COLUMNS);
    const left = MARGIN + column * (TILE_WIDTH + GAP);
    const top =
      MARGIN + row * (IMAGE_HEIGHT + LABEL_HEIGHT + GAP);
    const thumbnail = await sharp(path.join(sourceDir, item.fileName))
      .rotate()
      .resize(TILE_WIDTH, IMAGE_HEIGHT, {
        background: "#f5f4f1",
        fit: "contain",
      })
      .jpeg({ quality: 90 })
      .toBuffer();
    const shortName =
      item.fileName.length > 43
        ? `${item.fileName.slice(0, 40)}...`
        : item.fileName;
    const shortGroup =
      item.group.length > 43 ? `${item.group.slice(0, 40)}...` : item.group;
    const label = Buffer.from(
      `<svg width="${TILE_WIDTH}" height="${LABEL_HEIGHT}">
        <rect width="100%" height="100%" fill="#ffffff"/>
        <text x="8" y="22" font-family="Arial, sans-serif" font-size="16" font-weight="700" fill="#111111">${globalIndex}. ${escapeXml(shortName)}</text>
        <text x="8" y="49" font-family="Arial, sans-serif" font-size="13" fill="#444444">${escapeXml(shortGroup)}</text>
      </svg>`,
    );

    composites.push({ input: thumbnail, left, top });
    composites.push({ input: label, left, top: top + IMAGE_HEIGHT });
    manifest.push({
      ...item,
      index: globalIndex,
      page: pageIndex + 1,
    });
  }

  await sharp({
    create: {
      background: "#deddd9",
      channels: 3,
      height,
      width,
    },
  })
    .composite(composites)
    .png()
    .toFile(path.join(outputDir, `carousel-review-${pageIndex + 1}.png`));
}

await writeFile(
  path.join(outputDir, "manifest.json"),
  `${JSON.stringify(
    {
      files: manifest,
      mode,
      reviewMapPath,
      sourceDir,
    },
    null,
    2,
  )}\n`,
);

console.log(`Created ${Math.ceil(files.length / PAGE_SIZE)} review sheets.`);
console.log(`Files: ${files.length}`);
console.log(`Output: ${outputDir}`);

function parseArgs(rawArgs) {
  const parsed = {};

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];

    if (!arg.startsWith("--")) {
      continue;
    }

    const key = arg.slice(2);
    const next = rawArgs[index + 1];

    if (!next || next.startsWith("--")) {
      parsed[key] = true;
      continue;
    }

    parsed[key] = next;
    index += 1;
  }

  return parsed;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
