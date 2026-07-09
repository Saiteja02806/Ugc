import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const DEFAULT_CATEGORY_SLUG = "marketing-saas";
const MAX_LOOKUP_SIZE = 100;

loadEnvFile(path.resolve(".env.local"));

const args = parseArgs(process.argv.slice(2));
const execute = args.execute === "true";
const dryRun = !execute;
const categorySlug =
  args.category || args.categorySlug || args["category-slug"] || DEFAULT_CATEGORY_SLUG;
const reportPath = args.report ? path.resolve(args.report) : null;
const rejectRefs = parseList(args.reject || args.refs || args.ref || "");
const assetIds = parseList(
  args.assetIds || args["asset-ids"] || args.assetId || args["asset-id"] || "",
);
const pexelsPhotoIds = parseList(
  args.pexelsIds ||
    args["pexels-ids"] ||
    args.pexelsPhotoIds ||
    args["pexels-photo-ids"] ||
    "",
);
const reason = cleanString(args.reason || "visual QA rejection");

if (execute && args.yes !== "true") {
  throw new Error("Pass --yes with --execute to archive assets.");
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

const reportSelections = reportPath
  ? resolveReportSelections({ refs: rejectRefs, reportPath })
  : [];
const selectedAssetIds = unique([
  ...assetIds,
  ...reportSelections.map((item) => item.id),
]);
const selectedPexelsPhotoIds = unique(pexelsPhotoIds);

if (selectedAssetIds.length === 0 && selectedPexelsPhotoIds.length === 0) {
  throw new Error(
    "Pass at least one --reject bucket:index, --asset-ids, or --pexels-ids value.",
  );
}

const assetsById = selectedAssetIds.length
  ? await listAssetsByIds(selectedAssetIds)
  : [];
const assetsByPexelsId = selectedPexelsPhotoIds.length
  ? await listAssetsByPexelsPhotoIds(selectedPexelsPhotoIds)
  : [];
const targets = dedupeAssets([...assetsById, ...assetsByPexelsId]);
const readyTargets = targets.filter((asset) => asset.status === "ready");
const skippedTargets = targets.filter((asset) => asset.status !== "ready");
const missingAssetIds = selectedAssetIds.filter(
  (assetId) => !targets.some((asset) => asset.id === assetId),
);
const missingPexelsPhotoIds = selectedPexelsPhotoIds.filter(
  (photoId) => !targets.some((asset) => asset.pexels_photo_id === photoId),
);

const archived = [];

if (execute) {
  for (const target of readyTargets) {
    const { data, error } = await supabase
      .from("category_image_assets")
      .update({
        status: "archived",
        updated_at: new Date().toISOString(),
      })
      .eq("id", target.id)
      .eq("status", "ready")
      .select("id")
      .single();

    if (error) {
      throw new Error(`Could not archive ${target.id}: ${error.message}`);
    }

    if (data?.id) {
      archived.push(data.id);
    }
  }
}

console.log(
  JSON.stringify(
    {
      archivedCount: archived.length,
      categorySlug,
      dryRun,
      missingAssetIds,
      missingPexelsPhotoIds,
      reason,
      selectedCount: targets.length,
      skippedCount: skippedTargets.length,
      skippedTargets: skippedTargets.map(summarizeAsset),
      targets: targets.map(summarizeAsset),
      wouldArchiveCount: readyTargets.length,
    },
    null,
    2,
  ),
);

if (missingAssetIds.length > 0 || missingPexelsPhotoIds.length > 0) {
  process.exitCode = 1;
}

function resolveReportSelections({ refs, reportPath }) {
  if (refs.length === 0) {
    return [];
  }

  if (!existsSync(reportPath)) {
    throw new Error(`Report file does not exist: ${reportPath}`);
  }

  const report = JSON.parse(readFileSync(reportPath, "utf8"));
  const assetMap = new Map();

  for (const bucket of report.buckets ?? []) {
    for (const asset of bucket.assets ?? []) {
      assetMap.set(`${bucket.bucketId}:${asset.index}`, asset);

      if (asset.pexelsPhotoId) {
        assetMap.set(`${bucket.bucketId}:${asset.pexelsPhotoId}`, asset);
      }
    }
  }

  return refs.map((ref) => {
    const normalizedRef = ref.trim();
    const asset = assetMap.get(normalizedRef);

    if (!asset) {
      throw new Error(`Could not find report asset ref "${normalizedRef}".`);
    }

    return asset;
  });
}

async function listAssetsByIds(ids) {
  const assets = [];

  for (const chunk of chunkArray(ids, MAX_LOOKUP_SIZE)) {
    const { data, error } = await supabase
      .from("category_image_assets")
      .select(assetSelectFields())
      .eq("category_slug", categorySlug)
      .in("id", chunk);

    if (error) {
      throw new Error(`Could not list assets by id: ${error.message}`);
    }

    assets.push(...(data ?? []));
  }

  return assets;
}

async function listAssetsByPexelsPhotoIds(photoIds) {
  const assets = [];

  for (const chunk of chunkArray(photoIds, MAX_LOOKUP_SIZE)) {
    const { data, error } = await supabase
      .from("category_image_assets")
      .select(assetSelectFields())
      .eq("category_slug", categorySlug)
      .in("pexels_photo_id", chunk);

    if (error) {
      throw new Error(`Could not list assets by Pexels photo id: ${error.message}`);
    }

    assets.push(...(data ?? []));
  }

  return assets;
}

function summarizeAsset(asset) {
  return {
    bucket: asset.visual_bucket,
    createdAt: asset.created_at,
    id: asset.id,
    imageQuery: asset.image_query,
    pexelsPhotoId: asset.pexels_photo_id,
    pexelsPhotoUrl: asset.pexels_photo_url,
    sourceQuery: asset.source_query,
    status: asset.status,
  };
}

function assetSelectFields() {
  return [
    "created_at",
    "id",
    "image_query",
    "pexels_photo_id",
    "pexels_photo_url",
    "source_query",
    "status",
    "visual_bucket",
  ].join(",");
}

function dedupeAssets(assets) {
  const seenIds = new Set();
  const uniqueAssets = [];

  for (const asset of assets) {
    if (seenIds.has(asset.id)) {
      continue;
    }

    seenIds.add(asset.id);
    uniqueAssets.push(asset);
  }

  return uniqueAssets;
}

function chunkArray(items, size) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function unique(items) {
  return Array.from(new Set(items.filter(Boolean)));
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

function cleanString(value) {
  return String(value).trim().replace(/\s+/g, " ");
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

  throw new Error(`Missing required env var: ${names.join(" or ")}`);
}
