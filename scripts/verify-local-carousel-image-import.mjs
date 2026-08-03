import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  getStorageProviderName,
  isTrustedStorageUrl,
} from "../lib/storage/storage.ts";

const DEFAULT_IMPORT_ROOT = ".tmp/local-carousel-image-import";
const RESULT_FILE_NAME = "post-import-verification.json";

loadEnvFile(path.resolve(".env.local"));

const args = parseArgs(process.argv.slice(2));
const manifestPath = path.resolve(
  args.manifest || findLatestManifest(DEFAULT_IMPORT_ROOT, "import-manifest.json"),
);
const manifestDir = path.dirname(manifestPath);
const importResultPath = path.join(manifestDir, "import-result.json");
const metadataSyncResultPath = path.join(
  manifestDir,
  "metadata-sync-result.json",
);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const importResult = existsSync(importResultPath)
  ? JSON.parse(readFileSync(importResultPath, "utf8"))
  : null;
const metadataSyncResult = existsSync(metadataSyncResultPath)
  ? JSON.parse(readFileSync(metadataSyncResultPath, "utf8"))
  : null;
const assets = Array.isArray(manifest.assets) ? manifest.assets : [];
const urlSampleCount = Number.parseInt(args["url-samples"] ?? "0", 10);

assertOneRequiredEnvVar(["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]);
assertRequiredEnvVars(["SUPABASE_SERVICE_ROLE_KEY"]);

if (getStorageProviderName() !== "gcp") {
  throw new Error("Post-import verification requires STORAGE_PROVIDER=gcp.");
}

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
const errors = [];
const rows = await fetchImportedRows(assets);
const rowsByBaseKey = new Map(rows.map((row) => [row.base_s3_key, row]));

verifyImportResult();
verifyRows();

const urlChecks =
  Number.isFinite(urlSampleCount) && urlSampleCount > 0
    ? await verifyUrlSamples(urlSampleCount)
    : [];
const summary = summarizeRows(rows);
const report = {
  checkedAt: new Date().toISOString(),
  errors,
  importedRowsFound: rows.length,
  manifestAssets: assets.length,
  ok: errors.length === 0,
  summary,
  urlChecks,
};
const resultPath = path.join(manifestDir, RESULT_FILE_NAME);

writeFileSync(resultPath, `${JSON.stringify(report, null, 2)}\n`);

console.log("Local carousel image import verification");
console.log(`Manifest: ${manifestPath}`);
console.log(`Result: ${resultPath}`);
console.log(`Rows found: ${rows.length}/${assets.length}`);
console.log("");
for (const category of summary) {
  console.log(
    `${category.categorySlug}: ${category.count} imported rows; buckets ${formatObject(
      category.buckets,
    )}`,
  );
}

if (urlChecks.length > 0) {
  console.log("");
  console.log(`URL samples checked: ${urlChecks.length}`);
}

console.log("");

if (errors.length > 0) {
  console.log(`FAILED: ${errors.length} issue(s) found.`);
  for (const error of errors.slice(0, 30)) {
    console.log(`- ${error}`);
  }

  if (errors.length > 30) {
    console.log(`- ...and ${errors.length - 30} more`);
  }

  process.exit(1);
}

console.log("OK: imported production rows match the manifest.");

async function fetchImportedRows(assets) {
  const baseKeys = assets.map((asset) => asset.storage.baseKey);
  const rows = [];

  for (let index = 0; index < baseKeys.length; index += 100) {
    const chunk = baseKeys.slice(index, index + 100);
    const { data, error } = await supabase
      .from("category_image_assets")
      .select(
        [
          "id",
          "asset_scope",
          "asset_variant",
          "base_s3_key",
          "base_url",
          "broad_visual_bucket",
          "bucket_taxonomy_version",
          "category_slug",
          "content_tags",
          "face_count",
          "has_human",
          "image_subject_class",
          "max_face_area_ratio",
          "mood_tags",
          "near_duplicate_group",
          "object_tags",
          "person_count",
          "runtime_exclusion_reason",
          "source_file_sha256",
          "source_original_s3_key",
          "source_original_url",
          "source_perceptual_hash",
          "source_provider",
          "status",
          "subject_review_status",
          "thumb_s3_key",
          "thumb_url",
          "usable_profiles",
          "visual_keywords",
        ].join(","),
      )
      .in("base_s3_key", chunk);

    if (error) {
      errors.push(`Could not fetch imported rows: ${error.message}`);
      continue;
    }

    rows.push(...(data ?? []));
  }

  return rows;
}

function verifyImportResult() {
  if (!importResult) {
    if (
      metadataSyncResult?.mode === "execute" &&
      metadataSyncResult?.rowsUpdated === assets.length
    ) {
      return;
    }

    errors.push(
      "Missing a complete import-result.json or metadata-sync-result.json for this manifest.",
    );
    return;
  }

  const completedCount =
    (importResult.inserted?.length ?? 0) +
    (importResult.skippedExisting?.length ?? 0);

  if (completedCount !== assets.length) {
    errors.push(
      `Import result completed ${completedCount} assets, expected ${assets.length}.`,
    );
  }

  if (importResult.storageProvider !== "gcp") {
    errors.push(
      `Import result storage provider is ${String(importResult.storageProvider)}, expected gcp.`,
    );
  }

  if ((importResult.uploadedOnlyBeforeFailure ?? []).length > 0) {
    errors.push("Import result has uploaded-only assets after completion.");
  }
}

function verifyRows() {
  if (rows.length !== assets.length) {
    errors.push(`Found ${rows.length} imported rows, expected ${assets.length}.`);
  }

  for (const asset of assets) {
    const row = rowsByBaseKey.get(asset.storage.baseKey);

    if (!row) {
      errors.push(`${asset.assetKey}: missing production row.`);
      continue;
    }

    const checks = {
      asset_scope: asset.dbRow.asset_scope,
      asset_variant: asset.dbRow.asset_variant,
      broad_visual_bucket: asset.broadVisualBucket,
      bucket_taxonomy_version: "broad-v1",
      category_slug: asset.categorySlug,
      face_count: 0,
      has_human: false,
      image_subject_class: "object-only",
      max_face_area_ratio: 0,
      near_duplicate_group: asset.dbRow.near_duplicate_group,
      person_count: 0,
      runtime_exclusion_reason: null,
      source_file_sha256: asset.dbRow.source_file_sha256,
      source_original_s3_key: asset.storage.originalKey,
      source_perceptual_hash: asset.dbRow.source_perceptual_hash,
      source_provider: "local",
      status: "ready",
      subject_review_status: "approved",
      thumb_s3_key: asset.storage.thumbKey,
    };

    for (const [field, expected] of Object.entries(checks)) {
      if (row[field] !== expected) {
        errors.push(
          `${asset.assetKey}: expected ${field}=${String(expected)}, got ${String(
            row[field],
          )}`,
        );
      }
    }

    const arrayChecks = {
      content_tags: asset.dbRow.content_tags,
      mood_tags: asset.dbRow.mood_tags,
      object_tags: asset.dbRow.object_tags,
      usable_profiles: asset.dbRow.usable_profiles,
      visual_keywords: asset.dbRow.visual_keywords,
    };

    for (const [field, expected] of Object.entries(arrayChecks)) {
      if (!sameStringArray(row[field], expected)) {
        errors.push(
          `${asset.assetKey}: expected ${field}=${JSON.stringify(expected)}, got ${JSON.stringify(
            row[field],
          )}`,
        );
      }
    }

    if (!row.base_url?.includes(asset.storage.baseKey)) {
      errors.push(`${asset.assetKey}: base_url does not contain base key.`);
    }

    if (!row.thumb_url?.includes(asset.storage.thumbKey)) {
      errors.push(`${asset.assetKey}: thumb_url does not contain thumb key.`);
    }

    if (!row.source_original_url?.includes(asset.storage.originalKey)) {
      errors.push(`${asset.assetKey}: source_original_url does not contain original key.`);
    }

    for (const [field, url] of [
      ["base_url", row.base_url],
      ["thumb_url", row.thumb_url],
      ["source_original_url", row.source_original_url],
    ]) {
      if (!url || !isTrustedStorageUrl(url)) {
        errors.push(`${asset.assetKey}: ${field} is not a trusted GCP storage URL.`);
      }
    }
  }
}

function sameStringArray(first, second) {
  const normalize = (value) =>
    Array.isArray(value)
      ? value.map((item) => String(item)).sort()
      : [];

  return JSON.stringify(normalize(first)) === JSON.stringify(normalize(second));
}

async function verifyUrlSamples(sampleCount) {
  const samples = assets.slice(0, Math.min(sampleCount, assets.length));
  const checks = [];

  for (const asset of samples) {
    const row = rowsByBaseKey.get(asset.storage.baseKey);

    if (!row) {
      continue;
    }

    for (const [role, url] of [
      ["base", row.base_url],
      ["thumb", row.thumb_url],
      ["original", row.source_original_url],
    ]) {
      if (!url) {
        errors.push(`${asset.assetKey}: missing ${role} URL for availability check.`);
        continue;
      }

      const check = await checkUrl(url, `${asset.assetKey}:${role}`);
      checks.push(check);

      if (!check.ok) {
        errors.push(
          `${asset.assetKey}: ${role} URL check failed with status ${check.status}`,
        );
      }
    }
  }

  return checks;
}

async function checkUrl(url, assetKey) {
  try {
    const response = await fetch(url, { method: "HEAD" });

    return {
      assetKey,
      ok: response.ok,
      status: response.status,
      url,
    };
  } catch (error) {
    return {
      assetKey,
      error: error instanceof Error ? error.message : String(error),
      ok: false,
      status: null,
      url,
    };
  }
}

function summarizeRows(rows) {
  const byCategory = new Map();

  for (const row of rows) {
    const summary = byCategory.get(row.category_slug) ?? {
      buckets: new Map(),
      categorySlug: row.category_slug,
      count: 0,
    };

    summary.count += 1;
    summary.buckets.set(
      row.broad_visual_bucket,
      (summary.buckets.get(row.broad_visual_bucket) ?? 0) + 1,
    );
    byCategory.set(row.category_slug, summary);
  }

  return Array.from(byCategory.values()).map((summary) => ({
    ...summary,
    buckets: Object.fromEntries(summary.buckets.entries()),
  }));
}

function findLatestManifest(root, fileName) {
  const absoluteRoot = path.resolve(root);

  if (!existsSync(absoluteRoot)) {
    throw new Error(`Manifest root not found: ${absoluteRoot}`);
  }

  const latestDir = readdirSync(absoluteRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(absoluteRoot, entry.name))
    .sort()
    .at(-1);

  if (!latestDir) {
    throw new Error(`No manifest directories found under ${absoluteRoot}`);
  }

  const latestManifestPath = path.join(latestDir, fileName);

  if (!existsSync(latestManifestPath)) {
    throw new Error(`Latest manifest directory has no ${fileName}: ${latestDir}`);
  }

  return latestManifestPath;
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);

    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;

    if (process.env[key]) {
      continue;
    }

    process.env[key] = cleanEnvValue(rawValue);
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

function assertRequiredEnvVars(names) {
  const missing = names.filter((name) => !process.env[name]?.trim());

  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }
}

function assertOneRequiredEnvVar(names) {
  if (!names.some((name) => process.env[name]?.trim())) {
    throw new Error(`Missing required env var: ${names.join(" or ")}`);
  }
}

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

function formatObject(value) {
  return Object.entries(value)
    .map(([key, count]) => `${key}: ${count}`)
    .join(", ");
}
