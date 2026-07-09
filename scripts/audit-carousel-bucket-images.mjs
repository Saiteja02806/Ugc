import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const DEFAULT_BUCKETS = [
  "laptop-desk",
  "phone-notification",
  "desk-chaos",
  "calendar-overload",
];
const DEFAULT_CATEGORY_SLUG = "marketing-saas";
const DEFAULT_LIMIT_PER_BUCKET = 10;
const DEFAULT_COLUMN_COUNT = 5;

loadEnvFile(path.resolve(".env.local"));

const args = parseArgs(process.argv.slice(2));
const categorySlug =
  args.category || args.categorySlug || DEFAULT_CATEGORY_SLUG;
const bucketIds = parseList(args.buckets || args.bucket || "").length
  ? parseList(args.buckets || args.bucket || "")
  : DEFAULT_BUCKETS;
const limitPerBucket = parsePositiveInteger(
  args.limit || args.limitPerBucket,
  DEFAULT_LIMIT_PER_BUCKET,
);
const reviewStatus = normalizeReviewStatus(
  args.reviewStatus || args["review-status"],
);
const sortOrder = normalizeSortOrder(args.sort);
const columnCount = parsePositiveInteger(
  args.columns || args.cols,
  DEFAULT_COLUMN_COUNT,
);
const outputRoot = path.resolve(
  args.outDir || args["out-dir"] || ".tmp/carousel-visual-qa",
);
const outputDir = path.join(outputRoot, categorySlug);

const supabase = createClient(
  getRequiredEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
  getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

await mkdir(outputDir, { recursive: true });

const bucketReports = [];
const errors = [];

for (const bucketId of bucketIds) {
  const bucketDir = path.join(outputDir, bucketId);

  await mkdir(bucketDir, { recursive: true });

  const assets = await listReadyBucketAssets({
    bucketId,
    categorySlug,
    limit: limitPerBucket,
    reviewStatus,
    sortOrder,
  });
  const downloads = [];

  for (let index = 0; index < assets.length; index += 1) {
    const asset = assets[index];
    const fileName = `${String(index + 1).padStart(2, "0")}-${safeFileName(
      asset.pexels_photo_id || asset.id,
    )}.webp`;
    const filePath = path.join(bucketDir, fileName);

    try {
      const { buffer, sourceUrl } = await downloadAssetImage(asset);
      const normalizedBuffer = await sharp(buffer)
        .rotate()
        .resize({
          width: 540,
          height: 675,
          fit: "cover",
          position: "attention",
        })
        .webp({ quality: 86 })
        .toBuffer();

      await writeFile(filePath, normalizedBuffer);

      downloads.push({
        asset,
        error: null,
        filePath,
        index: index + 1,
        sourceUrl,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      errors.push(`${bucketId}/${asset.id}: ${message}`);
      downloads.push({
        asset,
        error: message,
        filePath: null,
        index: index + 1,
        sourceUrl: asset.thumb_url || asset.base_url || null,
      });
    }
  }

  const contactSheetPath = path.join(outputDir, `${bucketId}-contact-sheet.png`);

  await buildContactSheet({
    bucketId,
    categorySlug,
    columnCount,
    contactSheetPath,
    downloads,
    expectedCount: limitPerBucket,
  });

  bucketReports.push({
    bucketId,
    contactSheetPath,
    expectedCount: limitPerBucket,
    readyCount: assets.length,
    downloadedCount: downloads.filter((download) => !download.error).length,
    failedCount: downloads.filter((download) => download.error).length,
    metadataCoverage: getMetadataCoverage(assets, bucketId),
    sourceDiversity: getSourceDiversity(assets),
    assets: downloads.map((download) => ({
      id: download.asset.id,
      index: download.index,
      localFilePath: download.filePath,
      avgColor: download.asset.avg_color,
      bestForSlideTypes: download.asset.best_for_slide_types,
      bucketType: download.asset.bucket_type,
      contentTags: download.asset.content_tags,
      error: download.error,
      hasHuman: download.asset.has_human,
      imageSubjectClass: download.asset.image_subject_class,
      imageQuery: download.asset.image_query,
      moodTags: download.asset.mood_tags,
      orientation: download.asset.orientation,
      sourceQuery: download.asset.source_query,
      pexelsPhotoId: download.asset.pexels_photo_id,
      pexelsPhotoUrl: download.asset.pexels_photo_url,
      pexelsPhotographer: download.asset.pexels_photographer,
      pexelsPhotographerUrl: download.asset.pexels_photographer_url,
      primaryVertical: download.asset.primary_vertical,
      qualityScore: download.asset.quality_score,
      sourceProvider: download.asset.source_provider,
      sourceUrl: download.sourceUrl,
      status: download.asset.status,
      subjectReviewStatus: download.asset.subject_review_status,
      usableVerticals: download.asset.usable_verticals,
      visualBucket: download.asset.visual_bucket,
      visualKeywords: download.asset.visual_keywords,
      visualSetting: download.asset.visual_setting,
      visualStyle: download.asset.visual_style,
      width: download.asset.width,
      height: download.asset.height,
      createdAt: download.asset.created_at,
    })),
  });
}

const report = {
  categorySlug,
  generatedAt: new Date().toISOString(),
  outputDir,
  limitPerBucket,
  reviewStatus,
  sortOrder,
  bucketCount: bucketReports.length,
  totalExpectedCount: bucketReports.length * limitPerBucket,
  totalReadyCount: bucketReports.reduce(
    (total, bucket) => total + bucket.readyCount,
    0,
  ),
  totalDownloadedCount: bucketReports.reduce(
    (total, bucket) => total + bucket.downloadedCount,
    0,
  ),
  totalFailedCount: bucketReports.reduce(
    (total, bucket) => total + bucket.failedCount,
    0,
  ),
  buckets: bucketReports,
  errors,
};
const reportPath = path.join(outputDir, "visual-qa-report.json");

await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(`Carousel bucket visual QA for ${categorySlug}`);
console.log(`Output: ${outputDir}`);
console.log(`Report: ${reportPath}`);
console.log("");

for (const bucket of bucketReports) {
  const status =
    bucket.readyCount >= limitPerBucket && bucket.failedCount === 0
      ? "READY"
      : "CHECK";
  const completeMetadataCount = bucket.metadataCoverage.completeCount;

  console.log(
    `${status} ${bucket.bucketId}: ${bucket.downloadedCount}/${limitPerBucket} downloaded, ${completeMetadataCount}/${bucket.readyCount} metadata-complete, sheet ${bucket.contactSheetPath}`,
  );
}

if (
  bucketReports.some((bucket) => bucket.readyCount < limitPerBucket) ||
  errors.length > 0
) {
  process.exitCode = 1;
}

async function listReadyBucketAssets({
  bucketId,
  categorySlug,
  limit,
  reviewStatus,
  sortOrder,
}) {
  const query = supabase
    .from("category_image_assets")
    .select(
      [
        "id",
        "avg_color",
        "base_url",
        "best_for_slide_types",
        "bucket_type",
        "content_tags",
        "has_human",
        "image_subject_class",
        "thumb_url",
        "image_query",
        "mood_tags",
        "orientation",
        "source_query",
        "pexels_photo_id",
        "pexels_photo_url",
        "pexels_photographer",
        "pexels_photographer_url",
        "primary_vertical",
        "quality_score",
        "source_provider",
        "status",
        "subject_review_status",
        "usable_verticals",
        "visual_bucket",
        "visual_keywords",
        "visual_setting",
        "visual_style",
        "width",
        "height",
        "created_at",
      ].join(","),
    )
    .eq("category_slug", categorySlug)
    .eq("visual_bucket", bucketId)
    .eq("status", "ready");
  const reviewQuery =
    reviewStatus === "all"
      ? query
      : query.eq("subject_review_status", reviewStatus);
  const { data, error } = await reviewQuery
    .order("created_at", { ascending: sortOrder === "oldest" })
    .limit(limit);

  if (error) {
    throw new Error(`Could not list ${bucketId} assets: ${error.message}`);
  }

  return data ?? [];
}

function getMetadataCoverage(assets, expectedBucketId) {
  const requiredFields = [
    "base_url",
    "best_for_slide_types",
    "bucket_type",
    "content_tags",
    "height",
    "image_query",
    "image_subject_class",
    "mood_tags",
    "orientation",
    "pexels_photo_id",
    "pexels_photo_url",
    "pexels_photographer",
    "pexels_photographer_url",
    "quality_score",
    "source_provider",
    "status",
    "subject_review_status",
    "thumb_url",
    "usable_verticals",
    "visual_bucket",
    "visual_setting",
    "visual_style",
    "width",
  ];
  const missingByField = Object.fromEntries(
    requiredFields.map((field) => [field, 0]),
  );
  let bucketMismatchCount = 0;
  let completeCount = 0;
  let pexelsProviderCount = 0;
  let readyStatusCount = 0;

  for (const asset of assets) {
    let missingCount = 0;

    for (const field of requiredFields) {
      if (isMissingMetadataValue(asset[field])) {
        missingByField[field] += 1;
        missingCount += 1;
      }
    }

    if (asset.visual_bucket !== expectedBucketId) {
      bucketMismatchCount += 1;
    }

    if (asset.source_provider === "pexels") {
      pexelsProviderCount += 1;
    }

    if (asset.status === "ready") {
      readyStatusCount += 1;
    }

    if (missingCount === 0 && asset.visual_bucket === expectedBucketId) {
      completeCount += 1;
    }
  }

  return {
    bucketMismatchCount,
    checkedCount: assets.length,
    completeCount,
    missingByField,
    pexelsProviderCount,
    readyStatusCount,
    taggedBestForSlideTypesCount: assets.filter((asset) =>
      hasNonEmptyArray(asset.best_for_slide_types),
    ).length,
    taggedContentTagsCount: assets.filter((asset) =>
      hasNonEmptyArray(asset.content_tags),
    ).length,
    taggedMoodTagsCount: assets.filter((asset) =>
      hasNonEmptyArray(asset.mood_tags),
    ).length,
    taggedUsableVerticalsCount: assets.filter((asset) =>
      hasNonEmptyArray(asset.usable_verticals),
    ).length,
  };
}

function normalizeReviewStatus(value) {
  if (!value) return "all";

  if (["all", "approved", "rejected", "unreviewed"].includes(value)) {
    return value;
  }

  throw new Error(
    `Expected --review-status to be all, approved, rejected, or unreviewed. Received "${value}".`,
  );
}

function normalizeSortOrder(value) {
  if (!value) return "oldest";

  if (["newest", "oldest"].includes(value)) {
    return value;
  }

  throw new Error(`Expected --sort to be newest or oldest. Received "${value}".`);
}

function getSourceDiversity(assets) {
  const pexelsPhotoIds = assets
    .map((asset) => asset.pexels_photo_id)
    .filter(Boolean);
  const photographerCounts = countValues(
    assets.map((asset) => asset.pexels_photographer).filter(Boolean),
  );
  const queryCounts = countValues(
    assets
      .map((asset) => asset.image_query || asset.source_query)
      .filter(Boolean),
  );

  return {
    duplicatePexelsPhotoIds: findDuplicates(pexelsPhotoIds),
    photographerCounts,
    queryCounts,
    uniquePexelsPhotoIdCount: new Set(pexelsPhotoIds).size,
    uniquePhotographerCount: Object.keys(photographerCounts).length,
    uniqueQueryCount: Object.keys(queryCounts).length,
  };
}

async function downloadAssetImage(asset) {
  const urls = [asset.thumb_url, asset.base_url].filter(Boolean);
  let lastError = null;

  for (const url of urls) {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return {
        buffer: Buffer.from(await response.arrayBuffer()),
        sourceUrl: url,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  throw new Error(lastError || "No thumbnail or base URL is available.");
}

async function buildContactSheet({
  bucketId,
  categorySlug,
  columnCount,
  contactSheetPath,
  downloads,
  expectedCount,
}) {
  const tileWidth = 180;
  const imageHeight = 225;
  const labelHeight = 70;
  const tileHeight = imageHeight + labelHeight;
  const gap = 14;
  const pad = 24;
  const titleHeight = 86;
  const rowCount = Math.max(1, Math.ceil(downloads.length / columnCount));
  const width =
    pad * 2 + columnCount * tileWidth + (columnCount - 1) * gap;
  const height = titleHeight + pad + rowCount * tileHeight + (rowCount - 1) * gap;
  const composites = [
    {
      input: Buffer.from(
        createTitleSvg({
          bucketId,
          categorySlug,
          downloadedCount: downloads.filter((download) => !download.error)
            .length,
          expectedCount,
          width,
        }),
      ),
      left: 0,
      top: 0,
    },
  ];

  for (const download of downloads) {
    const position = download.index - 1;
    const row = Math.floor(position / columnCount);
    const column = position % columnCount;
    const left = pad + column * (tileWidth + gap);
    const top = titleHeight + row * (tileHeight + gap);

    composites.push({
      input: Buffer.from(createTileBackgroundSvg(tileWidth, tileHeight)),
      left,
      top,
    });

    if (download.filePath) {
      composites.push({
        input: await sharp(download.filePath)
          .resize({
            width: tileWidth,
            height: imageHeight,
            fit: "cover",
            position: "attention",
          })
          .png()
          .toBuffer(),
        left,
        top,
      });
    } else {
      composites.push({
        input: Buffer.from(createPlaceholderSvg(tileWidth, imageHeight)),
        left,
        top,
      });
    }

    composites.push({
      input: Buffer.from(
        createCaptionSvg({
          asset: download.asset,
          error: download.error,
          index: download.index,
          width: tileWidth,
          height: labelHeight,
        }),
      ),
      left,
      top: top + imageHeight,
    });
  }

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: "#f6f4f0",
    },
  })
    .composite(composites)
    .png()
    .toFile(contactSheetPath);
}

function createTitleSvg({
  bucketId,
  categorySlug,
  downloadedCount,
  expectedCount,
  width,
}) {
  return `<svg width="${width}" height="86" viewBox="0 0 ${width} 86" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="86" fill="#f6f4f0"/>
  <text x="24" y="34" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#101828">${escapeXml(bucketId)}</text>
  <text x="24" y="60" font-family="Arial, sans-serif" font-size="13" fill="#667085">${escapeXml(categorySlug)} - ${downloadedCount}/${expectedCount} ready images - visually reject weak or off-target results before scaling</text>
</svg>`;
}

function createTileBackgroundSvg(width, height) {
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="14" fill="#ffffff" stroke="#d9d6cf"/>
</svg>`;
}

function createPlaceholderSvg(width, height) {
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="#f1eee8"/>
  <text x="${width / 2}" y="${height / 2}" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="#b42318">download failed</text>
</svg>`;
}

function createCaptionSvg({ asset, error, height, index, width }) {
  const idLabel = asset.pexels_photo_id || asset.id.slice(0, 8);
  const query = error || asset.image_query || asset.source_query || "no query";
  const photographer = asset.pexels_photographer || "unknown";
  const score =
    typeof asset.quality_score === "number"
      ? `score ${asset.quality_score.toFixed(2)}`
      : "no score";
  const color = error ? "#b42318" : "#344054";

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="#ffffff"/>
  <text x="10" y="18" font-family="Arial, sans-serif" font-size="12" font-weight="700" fill="#101828">#${index} - ${escapeXml(truncate(idLabel, 18))}</text>
  <text x="10" y="38" font-family="Arial, sans-serif" font-size="11" fill="${color}">${escapeXml(truncate(query, 27))}</text>
  <text x="10" y="57" font-family="Arial, sans-serif" font-size="10" fill="#667085">${escapeXml(truncate(`${photographer} - ${score}`, 30))}</text>
</svg>`;
}

function parseArgs(values) {
  const parsed = {};

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];

    if (!value.startsWith("--")) {
      continue;
    }

    const key = value.slice(2);
    const nextValue = values[index + 1];

    if (!nextValue || nextValue.startsWith("--")) {
      parsed[key] = "true";
      continue;
    }

    parsed[key] = nextValue;
    index += 1;
  }

  return parsed;
}

function parseList(value) {
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parsePositiveInteger(value, fallback) {
  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return parsedValue;
}

function loadEnvFile(envPath) {
  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const match = trimmedLine.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);

    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;

    if (process.env[key] === undefined) {
      process.env[key] = cleanEnvValue(rawValue);
    }
  }
}

function cleanEnvValue(rawValue) {
  const value = rawValue.trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function getRequiredEnv(...names) {
  for (const name of names) {
    const value = process.env[name]?.trim();

    if (value) {
      return value;
    }
  }

  throw new Error(`Missing ${names.join(" or ")}`);
}

function safeFileName(value) {
  return String(value)
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function isMissingMetadataValue(value) {
  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value === "string") {
    return value.trim().length === 0;
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  return false;
}

function hasNonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0;
}

function countValues(values) {
  return values.reduce((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;

    return counts;
  }, {});
}

function findDuplicates(values) {
  const seen = new Set();
  const duplicates = new Set();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
      continue;
    }

    seen.add(value);
  }

  return Array.from(duplicates);
}

function truncate(value, maxLength) {
  const text = String(value);

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 3))}...`;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
