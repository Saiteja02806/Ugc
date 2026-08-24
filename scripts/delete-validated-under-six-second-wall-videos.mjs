import { Storage } from "@google-cloud/storage";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const EXPECTED_ASSET_COUNT = 16;
const EXPECTED_STORAGE_OBJECT_COUNT = 32;
const MAXIMUM_DURATION_SECONDS = 6;
const STORAGE_PREFIX = "overlay-media/wall-text/";
const CONFIRMATION = "DELETE-VALIDATED-16-UNDER-6S-WALL-VIDEOS";
const DEFAULT_REVIEW_DIRECTORY =
  "artifacts/wall-text-under-6s-review-2026-08-24";

loadEnvFile(path.resolve(".env.local"));

const args = parseArgs(process.argv.slice(2));
const reviewDirectory = path.resolve(
  String(args.review ?? DEFAULT_REVIEW_DIRECTORY),
);
const manifestPath = path.join(reviewDirectory, "manifest.json");
const backupPath = path.join(reviewDirectory, "backend-deletion-backup.json");
const completionPath = path.join(reviewDirectory, "backend-deletion-result.json");
const deleteStorage = Boolean(args["delete-storage"]);

if (deleteStorage && args.confirmation !== CONFIRMATION) {
  throw new Error(
    `Storage deletion requires --confirmation ${CONFIRMATION}.`,
  );
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const videos = manifest.videos ?? [];
assertLockedManifest(videos, reviewDirectory);

const supabase = createClient(
  getRequiredEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
  getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { autoRefreshToken: false, persistSession: false } },
);
const assetIds = videos.map((video) => video.backendAssetId);
const snapshot = await loadDependencySnapshot(assetIds);

if (!deleteStorage) {
  assertPreDeleteSnapshot(snapshot, videos);
  writeFileSync(
    backupPath,
    `${JSON.stringify(
      {
        backedUpAt: new Date().toISOString(),
        manifestSha256: sha256File(manifestPath),
        snapshot,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  console.log(
    JSON.stringify(
      {
        action: "database_backup_and_storage_dry_run",
        assetCount: snapshot.assets.length,
        backupPath,
        creativeCount: snapshot.wallTextCreatives.length,
        generationBatchCount: snapshot.generationBatches.length,
        storageObjectCount: getStorageKeys(videos).length,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

if (snapshot.assets.length !== 0) {
  throw new Error(
    `Refusing storage deletion while ${snapshot.assets.length} target database assets still exist. Complete and verify the database transaction first.`,
  );
}

if (!existsSync(backupPath)) {
  throw new Error(`The required backend backup is missing: ${backupPath}`);
}

const storageKeys = getStorageKeys(videos);
const storage = new Storage({
  ...(process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT
    ? { projectId: process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT }
    : {}),
});
const bucketName = getRequiredEnv(
  "GCP_STORAGE_BUCKET",
  "GOOGLE_CLOUD_STORAGE_BUCKET",
);
const bucket = storage.bucket(bucketName);
const existenceBefore = await checkStorageObjects(bucket, storageKeys);
if (existenceBefore.missing.length > 0) {
  throw new Error(
    `Refusing storage deletion because ${existenceBefore.missing.length} expected object(s) are already missing.`,
  );
}

for (const key of storageKeys) {
  await bucket.file(key).delete({ ignoreNotFound: false });
}

const existenceAfter = await checkStorageObjects(bucket, storageKeys);
if (existenceAfter.present.length > 0) {
  throw new Error(
    `Storage deletion was incomplete; ${existenceAfter.present.length} object(s) remain.`,
  );
}

const result = {
  action: "storage_objects_deleted",
  completedAt: new Date().toISOString(),
  databaseAssetCount: snapshot.assets.length,
  deletedStorageObjectCount: storageKeys.length,
  manifestSha256: sha256File(manifestPath),
};
writeFileSync(completionPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ...result, completionPath }, null, 2));

async function loadDependencySnapshot(ids) {
  const assets = await loadRows(
    "overlay_media_assets",
    "id",
    ids,
    "*",
  );
  const overlayCreatives = await loadRows(
    "overlay_creatives",
    "overlay_media_asset_id",
    ids,
    "*",
  );
  const instagramTemplates = await loadRows(
    "wall_text_instagram_reel_templates",
    "overlay_media_asset_id",
    ids,
    "*",
  );
  const generationAssignments = await loadRows(
    "wall_text_generation_assignments",
    "overlay_media_asset_id",
    ids,
    "*",
  );
  const generationBatchIds = [
    ...new Set(generationAssignments.map((row) => row.batch_id)),
  ];
  const generationBatches = await loadRows(
    "wall_text_generation_batches",
    "id",
    generationBatchIds,
    "*",
  );
  const generationChunks = await loadRows(
    "wall_text_generation_chunks",
    "batch_id",
    generationBatchIds,
    "*",
  );
  const wallTextCreatives = await loadRows(
    "wall_text_creatives",
    "overlay_media_asset_id",
    ids,
    "*",
  );
  const creativeIds = wallTextCreatives.map((row) => row.id);
  const userAssignments = await loadRows(
    "user_wall_text_assignments",
    "wall_text_creative_id",
    creativeIds,
    "*",
  );
  const userAssignmentIds = userAssignments.map((row) => row.id);
  const dailyFeedSlots = await loadRows(
    "daily_trending_feed_slots",
    "wall_text_assignment_id",
    userAssignmentIds,
    "*",
  );
  const dailyFeedIds = [...new Set(dailyFeedSlots.map((row) => row.feed_id))];

  return {
    assets,
    audioSelections: await loadRows(
      "wall_text_audio_selections",
      "wall_text_creative_id",
      creativeIds,
      "*",
    ),
    contentHistory: await loadRows(
      "wall_text_content_history",
      "wall_text_creative_id",
      creativeIds,
      "*",
    ),
    creativeDecisions: await loadRows(
      "trending_creative_decisions",
      "creative_id",
      creativeIds,
      "*",
    ),
    creativeEdits: await loadRows(
      "trending_creative_edits",
      "creative_id",
      creativeIds,
      "*",
    ),
    dailyFeedSlots,
    dailyFeeds: await loadRows(
      "daily_trending_feeds",
      "id",
      dailyFeedIds,
      "*",
    ),
    generationAssignments,
    generationBatches,
    generationChunks,
    instagramTemplates,
    overlayCreatives,
    performanceObservations: await loadRows(
      "wall_text_performance_observations",
      "wall_text_creative_id",
      creativeIds,
      "*",
    ),
    userAssignments,
    wallTextCreatives,
  };
}

async function loadRows(table, column, values, columns) {
  if (values.length === 0) return [];
  const { data, error } = await supabase
    .from(table)
    .select(columns)
    .in(column, values)
    .range(0, 999);
  if (error) throw new Error(`${table}: ${error.message}`);
  return data ?? [];
}

function assertPreDeleteSnapshot(snapshot, manifestVideos) {
  if (snapshot.assets.length !== EXPECTED_ASSET_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_ASSET_COUNT} database assets, received ${snapshot.assets.length}.`,
    );
  }
  const manifestById = new Map(
    manifestVideos.map((video) => [video.backendAssetId, video]),
  );
  for (const asset of snapshot.assets) {
    const expected = manifestById.get(asset.id);
    if (
      !expected ||
      asset.source_file_sha256 !== expected.sha256 ||
      Number(asset.duration_seconds) >= MAXIMUM_DURATION_SECONDS ||
      asset.asset_type !== "video" ||
      asset.format_family !== "wall_text_overlay" ||
      asset.status !== "active"
    ) {
      throw new Error(`Backend asset no longer matches the reviewed manifest: ${asset.id}`);
    }
  }
  if (snapshot.overlayCreatives.length > 0 || snapshot.instagramTemplates.length > 0) {
    throw new Error("Unexpected overlay creative or Instagram template dependency found.");
  }
  if (snapshot.creativeEdits.length > 0) {
    throw new Error("A reviewed Wall video now has an edit. Refusing deletion.");
  }
  if (snapshot.performanceObservations.length > 0) {
    throw new Error("A reviewed Wall video now has performance history. Refusing deletion.");
  }
  if (
    snapshot.creativeDecisions.some((row) => row.decision !== "rejected") ||
    snapshot.userAssignments.some((row) => row.state === "selected")
  ) {
    throw new Error("An accepted or selected Wall creative now depends on a target video.");
  }
  if (snapshot.dailyFeedSlots.some((row) => row.state !== "decided")) {
    throw new Error("A live daily Trending feed slot now depends on a target video.");
  }
  if (
    snapshot.generationAssignments.some((row) => row.status !== "completed") ||
    snapshot.generationBatches.some((row) => row.status !== "completed")
  ) {
    throw new Error("An unfinished Wall generation depends on a target video.");
  }
}

function assertLockedManifest(rows, directory) {
  if (rows.length !== EXPECTED_ASSET_COUNT) {
    throw new Error(`Expected ${EXPECTED_ASSET_COUNT} reviewed manifest videos.`);
  }
  const ids = new Set();
  const hashes = new Set();
  for (const row of rows) {
    if (!/^[a-f0-9-]{36}$/u.test(row.backendAssetId) || ids.has(row.backendAssetId)) {
      throw new Error("The reviewed manifest contains an invalid or duplicate asset ID.");
    }
    if (!/^[a-f0-9]{64}$/u.test(row.sha256) || hashes.has(row.sha256)) {
      throw new Error("The reviewed manifest contains an invalid or duplicate SHA-256.");
    }
    const localPath = path.join(directory, row.downloadedFileName);
    if (!existsSync(localPath) || sha256File(localPath) !== row.sha256) {
      throw new Error(`The local reviewed copy is missing or changed: ${localPath}`);
    }
    ids.add(row.backendAssetId);
    hashes.add(row.sha256);
  }
  getStorageKeys(rows);
}

function getStorageKeys(rows) {
  const keys = [
    ...rows.map((row) => row.storageKey),
    ...rows.map((row) => row.thumbnailStorageKey),
  ];
  if (
    keys.length !== EXPECTED_STORAGE_OBJECT_COUNT ||
    new Set(keys).size !== EXPECTED_STORAGE_OBJECT_COUNT ||
    keys.some(
      (key) => typeof key !== "string" || !key.startsWith(STORAGE_PREFIX),
    )
  ) {
    throw new Error("The reviewed manifest storage-object set is incomplete or unsafe.");
  }
  return keys;
}

async function checkStorageObjects(bucket, keys) {
  const results = await Promise.all(
    keys.map(async (key) => ({ key, present: (await bucket.file(key).exists())[0] })),
  );
  return {
    missing: results.filter((result) => !result.present).map((result) => result.key),
    present: results.filter((result) => result.present).map((result) => result.key),
  };
}

function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function getRequiredEnv(...names) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  throw new Error(`Missing required environment variable: ${names.join(" or ")}.`);
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const rawLine of readFileSync(filePath, "utf8").split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) continue;
    const key = line.slice(0, separatorIndex).trim();
    if (!/^[A-Z_][A-Z0-9_]*$/u.test(key) || process.env[key]) continue;
    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value?.startsWith("--")) continue;
    const key = value.slice(2);
    const next = values[index + 1];
    if (next && !next.startsWith("--")) {
      parsed[key] = next;
      index += 1;
    } else {
      parsed[key] = true;
    }
  }
  return parsed;
}
