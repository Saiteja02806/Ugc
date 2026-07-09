import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

loadEnvFile(path.resolve(".env.local"));

const args = parseArgs(process.argv.slice(2));
const execute = args.execute === "true";
const reportPath = args.report ? path.resolve(args.report) : null;
const selectUnreviewed = args.unreviewed === "true";
const refs = parseList(args.refs || args.ref || "");

if (!reportPath) throw new Error("Pass --report with a QA report path.");
if (!selectUnreviewed && refs.length === 0) {
  throw new Error("Pass --unreviewed or explicit --refs bucket:index values.");
}
if (execute && args.yes !== "true") {
  throw new Error("Pass --yes with --execute to approve assets.");
}

const report = readJson(reportPath);
const reportAssets = report.buckets.flatMap((bucket) =>
  bucket.assets.map((asset) => ({ ...asset, bucketId: bucket.bucketId })),
);
const selected = selectUnreviewed
  ? reportAssets.filter((asset) => asset.subjectReviewStatus === "unreviewed")
  : resolveRefs(reportAssets, refs);

if (selected.length === 0) {
  throw new Error("The QA report contains no matching assets to approve.");
}

const supabase = createClient(
  getRequiredEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
  getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { autoRefreshToken: false, persistSession: false } },
);
const assetIds = selected.map((asset) => asset.id);
const databaseAssets = [];

for (const idChunk of chunkArray(assetIds, 80)) {
  const { data, error } = await supabase
    .from("category_image_assets")
    .select("id,category_slug,face_count,has_human,image_subject_class,person_count,status,subject_review_status,visual_bucket")
    .in("id", idChunk);

  if (error) throw new Error(`Could not validate QA assets: ${error.message}`);
  databaseAssets.push(...(data || []));
}

const databaseAssetsById = new Map(databaseAssets.map((asset) => [asset.id, asset]));

for (const selectedAsset of selected) {
  const asset = databaseAssetsById.get(selectedAsset.id);

  if (!asset) throw new Error(`Asset ${selectedAsset.id} is missing from Supabase.`);
  if (asset.category_slug !== report.categorySlug) {
    throw new Error(`Asset ${asset.id} has unexpected category ${asset.category_slug}.`);
  }
  if (asset.visual_bucket !== selectedAsset.bucketId) {
    throw new Error(`Asset ${asset.id} has unexpected bucket ${asset.visual_bucket}.`);
  }
  if (asset.status !== "ready") {
    throw new Error(`Asset ${asset.id} is ${asset.status}, expected ready.`);
  }
  if (asset.image_subject_class === "clear-face") {
    throw new Error(
      `Refusing to approve asset ${asset.id} because it is classified as clear-face.`,
    );
  }
  if (asset.has_human === true || asset.face_count > 0 || asset.person_count > 0) {
    throw new Error(
      `Refusing to approve asset ${asset.id} because its metadata indicates human presence.`,
    );
  }
}

if (execute) {
  for (const idChunk of chunkArray(assetIds, 80)) {
    const { error } = await supabase
      .from("category_image_assets")
      .update({
        face_count: 0,
        has_human: false,
        image_subject_class: "object-only",
        person_count: 0,
        subject_review_status: "approved",
        updated_at: new Date().toISOString(),
      })
      .in("id", idChunk)
      .eq("status", "ready");

    if (error) throw new Error(`Could not approve QA assets: ${error.message}`);
  }
}

console.log(
  JSON.stringify(
    {
      approvedCount: execute ? selected.length : 0,
      categorySlug: report.categorySlug,
      dryRun: !execute,
      reportPath,
      selectedCount: selected.length,
      selected: selected.map((asset) => ({
        bucketId: asset.bucketId,
        id: asset.id,
        index: asset.index,
        imageSubjectClass: asset.imageSubjectClass,
        pexelsPhotoId: asset.pexelsPhotoId,
      })),
    },
    null,
    2,
  ),
);

function resolveRefs(assets, selectedRefs) {
  const byRef = new Map(
    assets.map((asset) => [`${asset.bucketId}:${asset.index}`, asset]),
  );

  return selectedRefs.map((ref) => {
    const asset = byRef.get(ref);
    if (!asset) throw new Error(`Could not find QA asset ref ${ref}.`);
    return asset;
  });
}

function readJson(filePath) {
  if (!existsSync(filePath)) throw new Error(`File does not exist: ${filePath}`);
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    const next = values[index + 1];
    if (!next || next.startsWith("--")) parsed[key] = "true";
    else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function parseList(value) {
  return String(value).split(",").map((item) => item.trim()).filter(Boolean);
}

function loadEnvFile(envPath) {
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    const value = match[2].trim();
    process.env[match[1]] =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
        ? value.slice(1, -1)
        : value;
  }
}

function getRequiredEnv(...names) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  throw new Error(`Missing ${names.join(" or ")}`);
}
