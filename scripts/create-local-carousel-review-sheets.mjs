import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";

import sharp from "sharp";

const DEFAULT_OUTPUT_ROOT = ".tmp/local-carousel-review-sheets";
const GAP = 14;
const MARGIN = 22;

const args = parseArgs(process.argv.slice(2));
const auditReportPath = args["audit-report"]
  ? path.resolve(args["audit-report"])
  : null;
const importManifestPath = args["import-manifest"]
  ? path.resolve(args["import-manifest"])
  : null;

if (auditReportPath && importManifestPath) {
  throw new Error("Use either --audit-report or --import-manifest, not both.");
}

const importManifest = importManifestPath
  ? JSON.parse(readFileSync(importManifestPath, "utf8"))
  : null;
const reviewMapPath = auditReportPath
  ? null
  : path.resolve(
      args["review-map"] ??
        "scripts/data/slideshows-carousel-review-2026-07-28.json",
    );
const reviewMap = reviewMapPath
  ? JSON.parse(readFileSync(reviewMapPath, "utf8"))
  : null;
const sourceDir = reviewMap?.sourceFolder
  ? path.resolve(reviewMap.sourceFolder)
  : null;
const mode = args.mode ?? (auditReportPath || importManifestPath ? "all" : "approved");
const layout = auditReportPath || importManifestPath
  ? { columns: 5, imageHeight: 300, labelHeight: 66, rows: 4, tileWidth: 250 }
  : { columns: 3, imageHeight: 450, labelHeight: 72, rows: 2, tileWidth: 360 };
const pageSize = layout.columns * layout.rows;
const outputRoot = path.resolve(args["out-dir"] ?? DEFAULT_OUTPUT_ROOT);
const outputDir = path.join(
  outputRoot,
  new Date().toISOString().replace(/[:.]/g, "-"),
);

const approvedFiles = (reviewMap?.approvedGroups ?? []).flatMap((group) =>
  (group.files ?? []).map((fileName) => ({
    decision: "approved",
    fileName,
    group: `${group.runtimeCategory}/${group.broadVisualBucket}`,
  })),
);
const rejectedFiles = (reviewMap?.rejected ?? []).map((item) => ({
  decision: "rejected",
  fileName: item.file,
  group: item.reason,
}));
const files = auditReportPath
  ? getAuditFiles(auditReportPath, args.category)
  : importManifestPath
    ? getPreparedFiles({
        importManifest,
        importManifestPath,
        maxQualityScore: args["max-quality-score"],
      })
  : mode === "all"
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
  pageIndex < Math.ceil(files.length / pageSize);
  pageIndex += 1
) {
  const pageFiles = files.slice(
    pageIndex * pageSize,
    (pageIndex + 1) * pageSize,
  );
  const width =
    MARGIN * 2 +
    layout.columns * layout.tileWidth +
    (layout.columns - 1) * GAP;
  const height =
    MARGIN * 2 +
    layout.rows * (layout.imageHeight + layout.labelHeight) +
    (layout.rows - 1) * GAP;
  const composites = [];

  for (let localIndex = 0; localIndex < pageFiles.length; localIndex += 1) {
    const item = pageFiles[localIndex];
    const globalIndex = pageIndex * pageSize + localIndex + 1;
    const column = localIndex % layout.columns;
    const row = Math.floor(localIndex / layout.columns);
    const left = MARGIN + column * (layout.tileWidth + GAP);
    const top =
      MARGIN + row * (layout.imageHeight + layout.labelHeight + GAP);
    const thumbnail = await sharp(
      item.absolutePath ?? path.join(sourceDir, item.fileName),
    )
      .rotate()
      .resize(layout.tileWidth, layout.imageHeight, {
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
      `<svg width="${layout.tileWidth}" height="${layout.labelHeight}">
        <rect width="100%" height="100%" fill="#ffffff"/>
        <text x="8" y="22" font-family="Arial, sans-serif" font-size="16" font-weight="700" fill="#111111">${globalIndex}. ${escapeXml(shortName)}</text>
        <text x="8" y="49" font-family="Arial, sans-serif" font-size="13" fill="#444444">${escapeXml(shortGroup)}</text>
      </svg>`,
    );

    composites.push({ input: thumbnail, left, top });
    composites.push({ input: label, left, top: top + layout.imageHeight });
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
      auditReportPath,
      importManifestPath,
      reviewMapPath,
      sourceDir,
    },
    null,
    2,
  )}\n`,
);

console.log(`Created ${Math.ceil(files.length / pageSize)} review sheets.`);
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

function getAuditFiles(reportPath, requestedCategory) {
  const report = JSON.parse(readFileSync(reportPath, "utf8"));
  const supportedRecommendations = new Set([
    "canonical_original",
    "cropped_only_candidate",
    "flat_candidate",
  ]);

  return (report.recommendations ?? [])
    .filter(
      (item) =>
        supportedRecommendations.has(item.recommendation) &&
        (!requestedCategory || item.categorySlug === requestedCategory),
    )
    .map((item) => ({
      absolutePath: path.join(item.rootPath, item.relativePath),
      decision: "pending",
      fileName: item.relativePath,
      group: `${item.categorySlug}/${item.recommendation}`,
    }));
}

function getPreparedFiles({
  importManifest,
  importManifestPath,
  maxQualityScore,
}) {
  const manifestDir = path.dirname(importManifestPath);
  const numericMaxQualityScore =
    maxQualityScore === undefined ? null : Number(maxQualityScore);

  if (
    numericMaxQualityScore !== null &&
    (!Number.isFinite(numericMaxQualityScore) || numericMaxQualityScore < 0)
  ) {
    throw new Error("--max-quality-score must be a non-negative number.");
  }

  return (importManifest.assets ?? [])
    .filter(
      (asset) =>
        numericMaxQualityScore === null ||
        Number(asset.qualityScore) <= numericMaxQualityScore,
    )
    .map((asset) => {
      const absolutePath = path.resolve(manifestDir, asset.files?.base ?? "");

      if (!absolutePath.startsWith(`${manifestDir}${path.sep}`)) {
        throw new Error(`Prepared file escapes manifest directory: ${asset.assetKey}`);
      }

      return {
        absolutePath,
        decision: asset.rendition?.qualityReviewStatus ?? "pending",
        fileName: asset.assetKey,
        group: `${asset.categorySlug}/${asset.broadVisualBucket} | source ${asset.width}x${asset.height} | q${asset.qualityScore}`,
      };
    });
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
