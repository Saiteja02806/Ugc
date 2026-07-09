import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createJiti } from "jiti";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "..");
const jiti = createJiti(import.meta.url, {
  alias: { "@": workspaceRoot },
});
const {
  analyzeCarouselImageSubject,
  IMAGE_SUBJECT_ANALYZER_VERSION,
} = await jiti.import("../lib/carousel/image-subject-safety.ts");

loadEnvFile(path.join(workspaceRoot, ".env.local"));

const args = parseArgs(process.argv.slice(2));
const categorySlug = args.category || args["category-slug"] || "marketing-saas";
const persist = args.persist === "true";
const limit = parsePositiveInteger(args.limit, null);
const outputDir = path.resolve(
  workspaceRoot,
  args["out-dir"] ||
    `.tmp/carousel-subject-audit-${categorySlug}-${fileTimestamp()}`,
);
const imageDir = path.join(outputDir, "images");
const sheetDir = path.join(outputDir, "contact-sheets");
const supabase = createClient(
  getRequiredEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
  getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { autoRefreshToken: false, persistSession: false } },
);

await mkdir(imageDir, { recursive: true });
await mkdir(sheetDir, { recursive: true });

const assets = await listReadyAssets(categorySlug, limit);
const results = [];
const failures = [];

console.log(
  `Scanning ${assets.length} ready ${categorySlug} carousel images with ${IMAGE_SUBJECT_ANALYZER_VERSION}.`,
);

for (let index = 0; index < assets.length; index += 1) {
  const asset = assets[index];

  try {
    const sourceBuffer = await downloadAsset(asset);
    const analysis = await analyzeCarouselImageSubject(sourceBuffer);
    const fileName = `${safeFileName(asset.visual_bucket || "unbucketed")}-${String(
      index + 1,
    ).padStart(3, "0")}-${safeFileName(asset.pexels_photo_id || asset.id)}.webp`;
    const filePath = path.join(imageDir, fileName);

    await sharp(sourceBuffer)
      .rotate()
      .resize({ height: 675, width: 540, fit: "cover", position: "attention" })
      .webp({ quality: 84 })
      .toFile(filePath);

    if (persist) {
      const { error } = await supabase
        .from("category_image_assets")
        .update({
          face_count: analysis.faceCount,
          has_human: analysis.hasHuman,
          image_subject_class: analysis.imageSubjectClass,
          max_face_area_ratio: analysis.maxFaceAreaRatio,
          person_count: analysis.personCount,
          subject_analysis: analysis,
          subject_analyzed_at: new Date().toISOString(),
          subject_analyzer_version: analysis.analyzerVersion,
        })
        .eq("id", asset.id);

      if (error) {
        throw new Error(`Could not persist classification: ${error.message}`);
      }
    }

    results.push({
      analysis,
      assetId: asset.id,
      bucketId: asset.visual_bucket,
      imageQuery: asset.image_query,
      localFilePath: filePath,
      pexelsPhotoId: asset.pexels_photo_id,
      pexelsPhotoUrl: asset.pexels_photo_url,
      sourceUrl: asset.thumb_url || asset.base_url,
    });

    console.log(
      `[${index + 1}/${assets.length}] ${analysis.imageSubjectClass} ${asset.visual_bucket || "unbucketed"}/${asset.pexels_photo_id || asset.id}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    failures.push({ assetId: asset.id, bucketId: asset.visual_bucket, message });
    console.error(`[${index + 1}/${assets.length}] FAILED ${asset.id}: ${message}`);
  }
}

const groupedResults = Object.fromEntries(
  ["clear-face", "faceless-human", "object-only"].map((subjectClass) => [
    subjectClass,
    results.filter((result) => result.analysis.imageSubjectClass === subjectClass),
  ]),
);
const contactSheets = {};

for (const [subjectClass, classResults] of Object.entries(groupedResults)) {
  contactSheets[subjectClass] = await buildContactSheets({
    outputDir: sheetDir,
    results: classResults,
    subjectClass,
  });
}

const bucketCountsBefore = countBy(assets, (asset) => asset.visual_bucket || "unbucketed");
const bucketClassification = {};

for (const result of results) {
  const bucketId = result.bucketId || "unbucketed";
  const counts = bucketClassification[bucketId] || {
    "clear-face": 0,
    "faceless-human": 0,
    "object-only": 0,
  };

  counts[result.analysis.imageSubjectClass] += 1;
  bucketClassification[bucketId] = counts;
}

const report = {
  analyzerVersion: IMAGE_SUBJECT_ANALYZER_VERSION,
  bucketClassification,
  bucketCountsBefore,
  categorySlug,
  classifications: Object.fromEntries(
    Object.entries(groupedResults).map(([subjectClass, classResults]) => [
      subjectClass,
      classResults.map((result) => result.assetId),
    ]),
  ),
  contactSheets,
  failures,
  generatedAt: new Date().toISOString(),
  persisted: persist,
  results,
  summary: {
    clearFace: groupedResults["clear-face"].length,
    facelessHuman: groupedResults["faceless-human"].length,
    failed: failures.length,
    objectOnly: groupedResults["object-only"].length,
    scanned: results.length,
    total: assets.length,
  },
};
const reportPath = path.join(outputDir, "subject-audit-report.json");
const reviewPath = path.join(outputDir, "clear-face-review.json");

await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
await writeFile(
  reviewPath,
  `${JSON.stringify(
    {
      categorySlug,
      instructions:
        "Review every clear-face contact sheet. Change decision to archive only after visual confirmation.",
      items: groupedResults["clear-face"].map((result) => ({
        assetId: result.assetId,
        bucketId: result.bucketId,
        decision: "pending",
        localFilePath: result.localFilePath,
        pexelsPhotoId: result.pexelsPhotoId,
      })),
    },
    null,
    2,
  )}\n`,
);

console.log("");
console.log(JSON.stringify({ outputDir, reportPath, reviewPath, ...report.summary }, null, 2));

if (failures.length > 0) {
  process.exitCode = 1;
}

async function listReadyAssets(category, maxCount) {
  let query = supabase
    .from("category_image_assets")
    .select(
      "id,base_url,thumb_url,image_query,pexels_photo_id,pexels_photo_url,visual_bucket,created_at",
    )
    .eq("category_slug", category)
    .eq("status", "ready")
    .order("visual_bucket", { ascending: true })
    .order("created_at", { ascending: true });

  if (maxCount) {
    query = query.limit(maxCount);
  } else {
    query = query.limit(1_000);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Could not list carousel images: ${error.message}`);
  }

  return data || [];
}

async function downloadAsset(asset) {
  const urls = [asset.base_url, asset.thumb_url].filter(Boolean);
  let lastError = "No image URL is available.";

  for (const url of urls) {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  throw new Error(lastError);
}

async function buildContactSheets({ outputDir: targetDir, results: items, subjectClass }) {
  const pages = chunk(items, 20);
  const paths = [];

  if (pages.length === 0) {
    return paths;
  }

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const outputPath = path.join(
      targetDir,
      `${subjectClass}-${String(pageIndex + 1).padStart(2, "0")}.png`,
    );

    await buildContactSheet({
      items: pages[pageIndex],
      outputPath,
      pageIndex,
      pageCount: pages.length,
      subjectClass,
    });
    paths.push(outputPath);
  }

  return paths;
}

async function buildContactSheet({ items, outputPath, pageIndex, pageCount, subjectClass }) {
  const columns = 5;
  const tileWidth = 180;
  const imageHeight = 225;
  const captionHeight = 76;
  const tileHeight = imageHeight + captionHeight;
  const gap = 12;
  const padding = 24;
  const titleHeight = 78;
  const rows = Math.max(1, Math.ceil(items.length / columns));
  const width = padding * 2 + columns * tileWidth + (columns - 1) * gap;
  const height = titleHeight + padding + rows * tileHeight + (rows - 1) * gap;
  const composites = [
    {
      input: Buffer.from(
        `<svg width="${width}" height="${titleHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#f5f5f3"/><text x="24" y="32" font-family="Arial" font-size="23" font-weight="700" fill="#111827">${escapeXml(subjectClass)}</text><text x="24" y="57" font-family="Arial" font-size="13" fill="#667085">Page ${pageIndex + 1} of ${pageCount} - ${items.length} images on this page</text></svg>`,
      ),
      left: 0,
      top: 0,
    },
  ];

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const row = Math.floor(index / columns);
    const column = index % columns;
    const left = padding + column * (tileWidth + gap);
    const top = titleHeight + row * (tileHeight + gap);
    const id = item.pexelsPhotoId || item.assetId.slice(0, 8);
    const metrics = `faces ${item.analysis.faceCount} | people ${item.analysis.personCount} | area ${(item.analysis.maxFaceAreaRatio * 100).toFixed(1)}%`;

    composites.push({
      input: await sharp(item.localFilePath)
        .resize({ width: tileWidth, height: imageHeight, fit: "cover", position: "attention" })
        .png()
        .toBuffer(),
      left,
      top,
    });
    composites.push({
      input: Buffer.from(
        `<svg width="${tileWidth}" height="${captionHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#ffffff"/><text x="9" y="19" font-family="Arial" font-size="11" font-weight="700" fill="#111827">${escapeXml(truncate(item.bucketId || "unbucketed", 25))}</text><text x="9" y="39" font-family="Arial" font-size="10" fill="#475467">${escapeXml(truncate(id, 24))}</text><text x="9" y="59" font-family="Arial" font-size="9" fill="#667085">${escapeXml(metrics)}</text></svg>`,
      ),
      left,
      top: top + imageHeight,
    });
  }

  await sharp({
    create: { width, height, channels: 4, background: "#f5f5f3" },
  })
    .composite(composites)
    .png()
    .toFile(outputPath);
}

function parseArgs(values) {
  const parsed = {};

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];

    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    const next = values[index + 1];

    if (!next || next.startsWith("--")) {
      parsed[key] = "true";
    } else {
      parsed[key] = next;
      index += 1;
    }
  }

  return parsed;
}

function loadEnvFile(envPath) {
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);

    if (!match || process.env[match[1]] !== undefined) continue;
    const raw = match[2].trim();
    process.env[match[1]] =
      (raw.startsWith('"') && raw.endsWith('"')) ||
      (raw.startsWith("'") && raw.endsWith("'"))
        ? raw.slice(1, -1)
        : raw;
  }
}

function getRequiredEnv(...names) {
  for (const name of names) {
    if (process.env[name]?.trim()) return process.env[name].trim();
  }

  throw new Error(`Missing ${names.join(" or ")}`);
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function fileTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function safeFileName(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 60);
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

function countBy(items, getKey) {
  return items.reduce((counts, item) => {
    const key = getKey(item);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function truncate(value, maxLength) {
  const text = String(value);
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 3)}...`;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
