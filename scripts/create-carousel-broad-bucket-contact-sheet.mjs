import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

loadEnvFile(path.resolve(".env.local"));

const args = parseArgs(process.argv.slice(2));
const categorySlug = args.category || "marketing-saas";
const broadBucket = args.bucket;
const reviewStatus = normalizeReviewStatus(
  args.reviewStatus || args["review-status"],
);
const sortOrder = normalizeSortOrder(args.sort);

if (!broadBucket) {
  throw new Error("Missing --bucket <broad-visual-bucket>.");
}

const outputDirectory = path.resolve(
  args.output || ".tmp/carousel-broad-matcher/broad-bucket-contact-sheets",
  categorySlug,
  broadBucket,
);
const supabase = createClient(
  getRequiredEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
  getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { autoRefreshToken: false, persistSession: false } },
);
const dataQuery = supabase
  .from("category_image_assets")
  .select(
    "id,pexels_photo_id,base_url,thumb_url,source_query,content_tags,object_tags,mood_tags,visual_bucket,broad_visual_bucket,bucket_taxonomy_version,subject_review_status,image_subject_class,has_human,face_count,person_count,runtime_exclusion_reason,usage_count,created_at",
  )
  .eq("category_slug", categorySlug)
  .eq("broad_visual_bucket", broadBucket)
  .eq("bucket_taxonomy_version", "broad-v1")
  .eq("status", "ready");
const reviewQuery =
  reviewStatus === "all"
    ? dataQuery
    : dataQuery.eq("subject_review_status", reviewStatus);
const safeQuery =
  reviewStatus === "approved"
    ? reviewQuery
        .eq("image_subject_class", "object-only")
        .eq("has_human", false)
        .eq("face_count", 0)
        .eq("person_count", 0)
        .is("runtime_exclusion_reason", null)
    : reviewQuery;
const { data, error } = await safeQuery
  .order("usage_count", { ascending: true })
  .order("created_at", { ascending: sortOrder === "oldest" });

if (error) {
  throw new Error(`Could not load broad bucket assets: ${error.message}`);
}

const assets = data ?? [];
const columns = 4;
const rowsPerPage = 5;
const cellWidth = 250;
const imageHeight = 292;
const labelHeight = 68;
const pageSize = columns * rowsPerPage;
const pages = [];

mkdirSync(outputDirectory, { recursive: true });

for (let pageIndex = 0; pageIndex * pageSize < assets.length; pageIndex += 1) {
  const pageAssets = assets.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
  const pageRows = Math.ceil(pageAssets.length / columns);
  const width = columns * cellWidth;
  const height = 52 + pageRows * (imageHeight + labelHeight);
  const canvas = sharp({
    create: { width, height, channels: 3, background: "#f6f6f4" },
  });
  const composites = [
    {
      input: Buffer.from(
        `<svg width="${width}" height="52" xmlns="http://www.w3.org/2000/svg"><rect width="${width}" height="52" fill="#f6f6f4"/><text x="18" y="33" font-family="Arial" font-size="22" font-weight="700" fill="#111827">${escapeXml(categorySlug)} / ${escapeXml(broadBucket)} / ${escapeXml(reviewStatus)} / page ${pageIndex + 1}</text></svg>`,
      ),
      left: 0,
      top: 0,
    },
  ];

  for (let localIndex = 0; localIndex < pageAssets.length; localIndex += 1) {
    const asset = pageAssets[localIndex];
    const globalIndex = pageIndex * pageSize + localIndex + 1;
    const column = localIndex % columns;
    const row = Math.floor(localIndex / columns);
    const left = column * cellWidth + 8;
    const top = 52 + row * (imageHeight + labelHeight);
    const response = await fetch(asset.thumb_url || asset.base_url);

    if (!response.ok) {
      throw new Error(`Could not download asset ${asset.id}: ${response.status}`);
    }

    const image = await sharp(Buffer.from(await response.arrayBuffer()))
      .resize(cellWidth - 16, imageHeight, { fit: "cover" })
      .png()
      .toBuffer();
    const label = Buffer.from(
      `<svg width="${cellWidth - 16}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#ffffff"/><text x="8" y="18" font-family="Arial" font-size="15" font-weight="700" fill="#111827">${globalIndex}. Pexels ${escapeXml(asset.pexels_photo_id || "unknown")}</text><text x="8" y="38" font-family="Arial" font-size="11" fill="#4b5563">legacy ${escapeXml(asset.visual_bucket || "none")} / uses ${asset.usage_count}</text><text x="8" y="57" font-family="Arial" font-size="11" fill="#667085">${escapeXml(truncate(asset.source_query || "no query", 34))}</text></svg>`,
    );

    composites.push({ input: image, left, top });
    composites.push({ input: label, left, top: top + imageHeight });
  }

  const outputPath = path.join(outputDirectory, `contact-sheet-${pageIndex + 1}.png`);
  await canvas.composite(composites).png().toFile(outputPath);
  pages.push(outputPath);
}

const manifestPath = path.join(outputDirectory, "manifest.json");
const manifestAssets = assets.map((asset, index) => ({
  index: index + 1,
  ...asset,
}));
writeFileSync(
  manifestPath,
  `${JSON.stringify(
    {
      assets: manifestAssets,
      broadBucket,
      buckets: [
        {
          assets: manifestAssets,
          broadBucket,
          bucketId: broadBucket,
          bucketKind: "broad",
          contactSheetPages: pages,
          expectedCount: assets.length,
        },
      ],
      categorySlug,
      generatedAt: new Date().toISOString(),
      pages,
      reviewStatus,
      sortOrder,
    },
    null,
    2,
  )}\n`,
  "utf8",
);
console.log(JSON.stringify({ assetCount: assets.length, manifestPath, pages }, null, 2));

function parseArgs(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 1) {
    if (!values[index].startsWith("--")) continue;
    result[values[index].slice(2)] = values[index + 1] ?? "true";
    index += 1;
  }
  return result;
}

function normalizeReviewStatus(value) {
  if (!value) return "approved";

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

function truncate(value, maxLength) {
  const text = String(value);

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 3))}...`;
}

function getRequiredEnv(...names) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  throw new Error(`Missing ${names.join(" or ")}.`);
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function loadEnvFile(envPath) {
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    const value = match[2].trim();
    process.env[match[1]] =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
        ? value.slice(1, -1)
        : value;
  }
}
