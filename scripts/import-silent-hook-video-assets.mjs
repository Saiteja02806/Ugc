import { createClient } from "@supabase/supabase-js";
import ffmpegPath from "ffmpeg-static";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import {
  buildPublicStorageUrl as buildStoragePublicUrl,
  deleteStorageObject,
  getMissingStorageEnvVars,
  getStorageObject,
  getStorageProviderName,
  headStorageObject,
  uploadBufferToStorage,
} from "../lib/storage/storage.ts";

const DEFAULT_MANIFEST =
  "scripts/data/hook-silent-videos-2026-07-29.json";
const RESULT_ROOT = ".tmp/hook-silent-video-import";
const CACHE_CONTROL = "public, max-age=31536000, immutable";
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const DURATION_TOLERANCE_SECONDS = 0.05;
const THUMBNAIL_WIDTH = 360;
const THUMBNAIL_HEIGHT = 640;

loadEnvFile(path.resolve(".env.local"));

const args = parseArgs(process.argv.slice(2));
const execute = Boolean(args.execute);
const verifyOnly = Boolean(args.verify);
const rollback = Boolean(args.rollback);
const manifestPath = path.resolve(
  String(args.manifest || DEFAULT_MANIFEST),
);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const fullPlan = buildImportPlan({ manifest });
const canaryCount = args.canary
  ? getPositiveInteger(args.canary, "--canary")
  : null;
const selectedItems = canaryCount
  ? selectDiverseCanary(fullPlan.items, canaryCount)
  : fullPlan.items;
const plan = {
  ...fullPlan,
  items: selectedItems,
  mode: canaryCount ? `canary-${selectedItems.length}` : "full-batch",
};

if (
  [execute, verifyOnly, rollback].filter(Boolean).length > 1
) {
  throw new Error(
    "Choose only one remote mode: --execute, --verify, or --rollback.",
  );
}

if ((execute || rollback) && !args.yes) {
  throw new Error(
    "Refusing to change GCP or Supabase without --yes. Run the dry-run first.",
  );
}

printPlan({
  manifestPath,
  operation: rollback
    ? "rollback"
    : verifyOnly
      ? "verify"
      : execute
        ? "execute"
        : "dry-run",
  plan,
});

if (!execute && !verifyOnly && !rollback) {
  console.log(
    "Dry run complete. No GCP object or Supabase row was changed.",
  );
  process.exit(0);
}

assertRuntimeReady();

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

if (rollback) {
  await rollbackBatch();
  process.exit(0);
}

if (verifyOnly) {
  const verification = await verifyReadyItems(plan.items);
  writeRunResult(manifest.sourceBatch, "verify", verification);
  console.log(`Verified ${verification.verified.length} ready Hook videos.`);
  process.exit(0);
}

const result = {
  completedAt: null,
  createdRows: [],
  imported: [],
  manifestPath,
  mode: plan.mode,
  resumed: [],
  skippedExisting: [],
  sourceBatch: manifest.sourceBatch,
  startedAt: new Date().toISOString(),
  storageProvider: getStorageProviderName(),
};

try {
  await assertRemoteSchemaReady();
  const existingByHash = await loadExistingRows(plan.items);

  for (const [index, item] of plan.items.entries()) {
    console.log(
      `[${index + 1}/${plan.items.length}] ${item.asset.catalogName}`,
    );

    const existing = existingByHash.get(item.asset.sha256);

    if (existing?.status === "ready") {
      assertExistingRowMatches(existing, item);
      await verifyStoredObjects(item);
      result.skippedExisting.push({
        catalogName: item.asset.catalogName,
        id: existing.id,
      });
      continue;
    }

    if (existing?.status === "disabled") {
      throw new Error(
        `Refusing to re-enable disabled Hook asset ${item.asset.catalogName}.`,
      );
    }

    const rowId = existing
      ? existing.id
      : await createProcessingAssetRow(item);

    if (existing) {
      assertExistingRowMatches(existing, item);
      result.resumed.push({
        catalogName: item.asset.catalogName,
        id: rowId,
      });
    } else {
      result.createdRows.push({
        catalogName: item.asset.catalogName,
        id: rowId,
      });
    }

    const thumbnail = createThumbnail(item);

    await uploadBufferToStorage({
      buffer: readFileSync(item.filePath),
      cacheControl: CACHE_CONTROL,
      contentType: "video/mp4",
      key: item.videoKey,
    });
    await uploadBufferToStorage({
      buffer: thumbnail,
      cacheControl: CACHE_CONTROL,
      contentType: "image/webp",
      key: item.thumbnailKey,
    });
    await verifyStoredObjects(item);

    const { data, error } = await supabase
      .from("avatar_assets")
      .update({
        status: "ready",
        thumbnail_url: item.thumbnailUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", rowId)
      .eq("source_file_sha256", item.asset.sha256)
      .select(
        "id,source_file_sha256,source_batch,status,influencer_key,visual_group,has_audio",
      )
      .single();

    if (error || !data) {
      throw new Error(
        `Could not activate ${item.asset.catalogName}: ${error?.message ?? "no row returned"}`,
      );
    }

    result.imported.push({
      catalogName: item.asset.catalogName,
      id: data.id,
      influencerKey: data.influencer_key,
      visualGroup: data.visual_group,
    });
  }

  const verification = await verifyReadyItems(plan.items);
  result.completedAt = new Date().toISOString();
  result.verification = verification;
  writeRunResult(manifest.sourceBatch, plan.mode, result);

  console.log(
    `Import complete: ${result.imported.length} activated, ${result.resumed.length} resumed, ${result.skippedExisting.length} already ready.`,
  );
} catch (error) {
  writeRunResult(manifest.sourceBatch, plan.mode, {
    ...result,
    failedAt: new Date().toISOString(),
    failure: error instanceof Error ? error.message : String(error),
  });
  throw error;
}

async function assertRemoteSchemaReady() {
  const { error } = await supabase
    .from("avatar_assets")
    .select(
      [
        "id",
        "source_file_sha256",
        "source_batch",
        "influencer_key",
        "visual_group",
        "has_audio",
        "source_s3_key",
        "source_video_url",
        "status",
      ].join(","),
    )
    .limit(1);

  if (error) {
    throw new Error(
      `Remote Hook catalog schema is not ready: ${error.message}`,
    );
  }
}

async function loadExistingRows(items) {
  const existingByHash = new Map();

  for (const hashes of chunkValues(
    items.map((item) => item.asset.sha256),
    100,
  )) {
    const { data, error } = await supabase
      .from("avatar_assets")
      .select(
        "id,name,duration_seconds,width,height,ratio,status,source_s3_key,source_video_url,thumbnail_url,source_file_sha256,source_batch,influencer_key,visual_group,has_audio,sort_order,metadata,deleted_at",
      )
      .in("source_file_sha256", hashes)
      .is("deleted_at", null);

    if (error) {
      throw new Error(
        `Could not check existing Hook videos: ${error.message}`,
      );
    }

    for (const row of data ?? []) {
      existingByHash.set(row.source_file_sha256, row);
    }
  }

  return existingByHash;
}

async function createProcessingAssetRow(item) {
  const { data, error } = await supabase
    .from("avatar_assets")
    .insert({
      avatar_type: "global",
      description: item.description,
      duration_seconds: item.metadata.durationSeconds,
      has_audio: false,
      height: item.metadata.height,
      influencer_key: item.asset.influencerKey,
      metadata: item.catalogMetadata,
      name: item.name,
      ratio: "9:16",
      sort_order: item.sortOrder,
      source_batch: manifest.sourceBatch,
      source_file_sha256: item.asset.sha256,
      source_s3_key: item.videoKey,
      source_video_url: item.videoUrl,
      status: "processing",
      thumbnail_url: null,
      updated_at: new Date().toISOString(),
      visual_group: item.asset.visualGroup,
      width: item.metadata.width,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      `Could not create processing row for ${item.asset.catalogName}: ${error?.message ?? "no row returned"}`,
    );
  }

  return data.id;
}

function buildImportPlan({ manifest }) {
  assertManifest(manifest);

  const reactionTotals = countBy(
    manifest.assets,
    (asset) => `${asset.influencerKey}:${asset.reactionType}`,
  );
  const reactionOrdinals = {};
  const items = manifest.assets.map((asset, sortOrder) => {
    const sourceFolder = manifest.sourceFolders[asset.sourceFolderKey];
    const filePath = path.join(sourceFolder, asset.originalFileName);

    if (!existsSync(filePath)) {
      throw new Error(`Reviewed Hook video is missing: ${filePath}`);
    }

    const stats = statSync(filePath);

    if (!stats.isFile() || stats.size <= 0 || stats.size > MAX_VIDEO_BYTES) {
      throw new Error(
        `Invalid Hook video size for ${asset.originalFileName}.`,
      );
    }

    if (stats.size !== asset.fileSizeBytes) {
      throw new Error(
        `File size changed for ${asset.originalFileName}.`,
      );
    }

    const actualHash = getFileSha256(filePath);

    if (actualHash !== asset.sha256) {
      throw new Error(
        `SHA-256 changed for ${asset.originalFileName}.`,
      );
    }

    const metadata = probeVideo(filePath);

    if (metadata.audioStreamCount !== 0 || asset.hasAudio !== false) {
      throw new Error(
        `${asset.originalFileName} is not a silent Hook source.`,
      );
    }

    if (
      metadata.width !== asset.width ||
      metadata.height !== asset.height ||
      metadata.width * 16 !== metadata.height * 9
    ) {
      throw new Error(
        `Dimensions changed for ${asset.originalFileName}.`,
      );
    }

    if (
      Math.abs(metadata.durationSeconds - asset.durationSeconds) >
      DURATION_TOLERANCE_SECONDS
    ) {
      throw new Error(
        `Duration changed for ${asset.originalFileName}.`,
      );
    }

    const keyRoot = `avatars/global/${manifest.sourceBatch}/${asset.influencerKey}`;
    const thumbnailRoot = `avatars/thumbnails/${manifest.sourceBatch}/${asset.influencerKey}`;
    const objectName = `${asset.catalogName}-${asset.sha256.slice(0, 12)}`;
    const videoKey = `${keyRoot}/${objectName}.mp4`;
    const thumbnailKey = `${thumbnailRoot}/${objectName}.webp`;
    const influencer = manifest.influencers[asset.influencerKey];
    const reactionKey = `${asset.influencerKey}:${asset.reactionType}`;
    const reactionOrdinal =
      (reactionOrdinals[reactionKey] =
        (reactionOrdinals[reactionKey] ?? 0) + 1);
    const reactionLabel = toTitleCase(asset.reactionType);
    const nameSuffix =
      reactionTotals[reactionKey] > 1 ? ` ${reactionOrdinal}` : "";
    const name = `${influencer.displayName} - ${reactionLabel}${nameSuffix}`;

    return {
      asset,
      catalogMetadata: {
        avatar: asset.influencerKey,
        catalogName: asset.catalogName,
        hasAudio: false,
        identityConfidence: influencer.identityConfidence,
        importSchemaVersion: "hook-silent-catalog-import-v1",
        reactionType: asset.reactionType,
        reviewReason: asset.reviewReason,
        reviewedAt: manifest.reviewedAt,
        sourceFileName: asset.originalFileName,
        sourceFolderKey: asset.sourceFolderKey,
        sourceSha256: asset.sha256,
        thumbnailStorageKey: thumbnailKey,
        uploadSource: "reviewed-admin-manifest",
        visualGroup: asset.visualGroup,
      },
      description: `${influencer.displayName} ${reactionLabel.toLowerCase()} Hook clip.`,
      filePath,
      metadata,
      name,
      sizeBytes: stats.size,
      sortOrder,
      thumbnailKey,
      thumbnailUrl: buildStoragePublicUrl(thumbnailKey),
      videoKey,
      videoUrl: buildStoragePublicUrl(videoKey),
    };
  });

  return {
    groupCounts: countBy(
      items,
      (item) => item.asset.visualGroup,
    ),
    influencerCounts: countBy(
      items,
      (item) => item.asset.influencerKey,
    ),
    items,
    totalBytes: items.reduce(
      (total, item) => total + item.sizeBytes,
      0,
    ),
  };
}

function assertManifest(manifest) {
  if (
    manifest.schemaVersion !== "hook-silent-video-manifest-v1" ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(manifest.sourceBatch ?? "") ||
    !Array.isArray(manifest.assets) ||
    manifest.assets.length !== manifest.summary?.approvedCount ||
    manifest.summary?.approvedCount !== 78 ||
    manifest.summary?.rejectedCount !== 0
  ) {
    throw new Error("The reviewed silent Hook manifest is invalid.");
  }

  const sourceFolderKeys = new Set(
    Object.keys(manifest.sourceFolders ?? {}),
  );
  const influencerKeys = new Set(
    Object.keys(manifest.influencers ?? {}),
  );
  const visualGroups = new Set(
    Object.keys(manifest.visualGroups ?? {}),
  );
  const reactionTypes = new Set(
    Object.keys(manifest.reactionTypes ?? {}),
  );
  const assetKeys = new Set();
  const catalogNames = new Set();
  const sourcePaths = new Set();
  const hashes = new Set();

  for (const asset of manifest.assets) {
    const sourcePath = `${asset.sourceFolderKey}:${asset.originalFileName}`;

    if (
      asset.reviewStatus !== "approved" ||
      asset.hasAudio !== false ||
      asset.ratio !== "9:16" ||
      asset.videoCodec !== "h264" ||
      !/^hook-silent:[0-9a-f]{64}$/u.test(asset.assetKey ?? "") ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(asset.catalogName ?? "") ||
      !/^[0-9a-f]{64}$/u.test(asset.sha256 ?? "") ||
      !sourceFolderKeys.has(asset.sourceFolderKey) ||
      !influencerKeys.has(asset.influencerKey) ||
      !visualGroups.has(asset.visualGroup) ||
      !reactionTypes.has(asset.reactionType)
    ) {
      throw new Error(
        `Invalid reviewed Hook asset: ${asset.originalFileName ?? "unknown"}.`,
      );
    }

    if (
      assetKeys.has(asset.assetKey) ||
      catalogNames.has(asset.catalogName) ||
      sourcePaths.has(sourcePath) ||
      hashes.has(asset.sha256)
    ) {
      throw new Error(
        `Duplicate reviewed Hook asset: ${asset.originalFileName}.`,
      );
    }

    assetKeys.add(asset.assetKey);
    catalogNames.add(asset.catalogName);
    sourcePaths.add(sourcePath);
    hashes.add(asset.sha256);
  }
}

function probeVideo(filePath) {
  let output;

  try {
    output = execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "stream=codec_type,codec_name,width,height:format=duration",
        "-of",
        "json",
        filePath,
      ],
      { encoding: "utf8" },
    );
  } catch (error) {
    throw new Error(
      `Could not inspect ${path.basename(filePath)}: ${error.message}`,
    );
  }

  const parsed = JSON.parse(output);
  const streams = Array.isArray(parsed.streams) ? parsed.streams : [];
  const videoStreams = streams.filter(
    (stream) => stream.codec_type === "video",
  );
  const audioStreams = streams.filter(
    (stream) => stream.codec_type === "audio",
  );
  const video = videoStreams[0];
  const durationSeconds = Number(parsed.format?.duration);
  const width = Number(video?.width);
  const height = Number(video?.height);

  if (
    videoStreams.length !== 1 ||
    video?.codec_name !== "h264" ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0 ||
    !Number.isInteger(width) ||
    width <= 0 ||
    !Number.isInteger(height) ||
    height <= 0
  ) {
    throw new Error(
      `ffprobe returned invalid metadata for ${path.basename(filePath)}.`,
    );
  }

  return {
    audioStreamCount: audioStreams.length,
    durationSeconds: Math.round(durationSeconds * 1000) / 1000,
    height,
    videoCodec: video.codec_name,
    width,
  };
}

function createThumbnail(item) {
  const outputDir = path.resolve(
    RESULT_ROOT,
    manifest.sourceBatch,
    "thumbnails",
  );
  const outputPath = path.join(
    outputDir,
    `${item.asset.catalogName}.webp`,
  );
  const seekSeconds = Math.min(
    1.5,
    Math.max(0.25, item.metadata.durationSeconds * 0.3),
  );

  mkdirSync(outputDir, { recursive: true });
  execFileSync(
    ffmpegPath || "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-ss",
      String(seekSeconds),
      "-i",
      item.filePath,
      "-frames:v",
      "1",
      "-vf",
      `scale=${THUMBNAIL_WIDTH}:${THUMBNAIL_HEIGHT}:force_original_aspect_ratio=decrease,pad=${THUMBNAIL_WIDTH}:${THUMBNAIL_HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1`,
      "-c:v",
      "libwebp",
      "-quality",
      "82",
      "-preset",
      "picture",
      "-y",
      outputPath,
    ],
    { stdio: "pipe" },
  );

  return readFileSync(outputPath);
}

async function verifyStoredObjects(item) {
  const [videoHead, thumbnailHead] = await Promise.all([
    headStorageObject({ key: item.videoKey }),
    headStorageObject({ key: item.thumbnailKey }),
  ]);

  if (
    videoHead.ContentLength !== item.sizeBytes ||
    videoHead.ContentType !== "video/mp4"
  ) {
    throw new Error(
      `Stored video verification failed for ${item.asset.catalogName}.`,
    );
  }

  if (
    !thumbnailHead.ContentLength ||
    thumbnailHead.ContentType !== "image/webp"
  ) {
    throw new Error(
      `Stored thumbnail verification failed for ${item.asset.catalogName}.`,
    );
  }

  const storedSha256 = await getStoredObjectSha256(item.videoKey);

  if (storedSha256 !== item.asset.sha256) {
    throw new Error(
      `Stored video hash verification failed for ${item.asset.catalogName}.`,
    );
  }
}

async function getStoredObjectSha256(key) {
  const object = await getStorageObject({ key });
  const reader = object.Body.transformToWebStream().getReader();
  const hash = createHash("sha256");

  for (;;) {
    const { done, value } = await reader.read();

    if (done) {
      return hash.digest("hex");
    }

    hash.update(value);
  }
}

async function verifyReadyItems(items) {
  await assertRemoteSchemaReady();
  const rowsByHash = await loadExistingRows(items);
  const verified = [];

  for (const [index, item] of items.entries()) {
    const row = rowsByHash.get(item.asset.sha256);

    if (!row || row.status !== "ready") {
      throw new Error(
        `${item.asset.catalogName} does not have a ready Hook catalog row.`,
      );
    }

    assertExistingRowMatches(row, item);
    console.log(
      `[verify ${index + 1}/${items.length}] ${item.asset.catalogName}`,
    );
    await verifyStoredObjects(item);
    verified.push({
      catalogName: item.asset.catalogName,
      id: row.id,
    });
  }

  return {
    completedAt: new Date().toISOString(),
    sourceBatch: manifest.sourceBatch,
    verified,
  };
}

function assertExistingRowMatches(row, item) {
  const metadata =
    row.metadata &&
    typeof row.metadata === "object" &&
    !Array.isArray(row.metadata)
      ? row.metadata
      : {};

  if (
    row.source_s3_key !== item.videoKey ||
    row.source_video_url !== item.videoUrl ||
    row.source_batch !== manifest.sourceBatch ||
    row.influencer_key !== item.asset.influencerKey ||
    row.visual_group !== item.asset.visualGroup ||
    row.has_audio !== false ||
    row.ratio !== "9:16" ||
    row.width !== item.metadata.width ||
    row.height !== item.metadata.height ||
    row.sort_order !== item.sortOrder ||
    Math.abs(
      Number(row.duration_seconds) - item.metadata.durationSeconds,
    ) > DURATION_TOLERANCE_SECONDS ||
    metadata.thumbnailStorageKey !== item.thumbnailKey
  ) {
    throw new Error(
      `Existing Hook row conflicts with ${item.asset.catalogName}.`,
    );
  }

  if (
    row.status === "ready" &&
    row.thumbnail_url !== item.thumbnailUrl
  ) {
    throw new Error(
      `Ready Hook thumbnail URL conflicts with ${item.asset.catalogName}.`,
    );
  }
}

async function rollbackBatch() {
  await assertRemoteSchemaReady();
  const { data: rows, error } = await supabase
    .from("avatar_assets")
    .select("id,source_s3_key,metadata,source_batch")
    .eq("source_batch", manifest.sourceBatch)
    .is("deleted_at", null);

  if (error) {
    throw new Error(
      `Could not load the Hook batch for rollback: ${error.message}`,
    );
  }

  const rowIds = (rows ?? []).map((row) => row.id);
  await assertNoBatchReferences(rowIds);

  const allowedVideoPrefix =
    `avatars/global/${manifest.sourceBatch}/`;
  const allowedThumbnailPrefix =
    `avatars/thumbnails/${manifest.sourceBatch}/`;
  const objectKeys = [];

  for (const row of rows ?? []) {
    const metadata =
      row.metadata &&
      typeof row.metadata === "object" &&
      !Array.isArray(row.metadata)
        ? row.metadata
        : {};
    const thumbnailKey = metadata.thumbnailStorageKey;

    if (
      !row.source_s3_key.startsWith(allowedVideoPrefix) ||
      typeof thumbnailKey !== "string" ||
      !thumbnailKey.startsWith(allowedThumbnailPrefix)
    ) {
      throw new Error(
        `Refusing rollback: row ${row.id} contains an object outside this batch.`,
      );
    }

    objectKeys.push(row.source_s3_key, thumbnailKey);
  }

  if (rowIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("avatar_assets")
      .delete()
      .in("id", rowIds);

    if (deleteError) {
      throw new Error(
        `Could not delete Hook batch rows: ${deleteError.message}`,
      );
    }
  }

  for (const key of objectKeys) {
    await deleteStorageObject({ key });
  }

  const rollbackResult = {
    completedAt: new Date().toISOString(),
    deletedObjectKeys: objectKeys,
    deletedRowIds: rowIds,
    sourceBatch: manifest.sourceBatch,
  };

  writeRunResult(manifest.sourceBatch, "rollback", rollbackResult);
  console.log(
    `Rollback complete: ${rowIds.length} rows and ${objectKeys.length} GCP objects removed.`,
  );
}

async function assertNoBatchReferences(rowIds) {
  if (rowIds.length === 0) {
    return;
  }

  const [preferences, suggestions, drafts] = await Promise.all([
    supabase
      .from("user_avatar_preferences")
      .select("id", { count: "exact", head: true })
      .in("avatar_asset_id", rowIds),
    supabase
      .from("hook_video_suggestions")
      .select("id", { count: "exact", head: true })
      .eq("influencer_source", "catalog")
      .in("influencer_video_id", rowIds),
    supabase
      .from("hook_video_drafts")
      .select("id", { count: "exact", head: true })
      .eq("influencer_source", "catalog")
      .in("influencer_video_id", rowIds),
  ]);

  for (const result of [preferences, suggestions, drafts]) {
    if (result.error) {
      throw new Error(
        `Could not prove Hook rollback safety: ${result.error.message}`,
      );
    }
  }

  const referenceCount =
    (preferences.count ?? 0) +
    (suggestions.count ?? 0) +
    (drafts.count ?? 0);

  if (referenceCount > 0) {
    throw new Error(
      `Refusing rollback: ${referenceCount} user or Trending record(s) reference this Hook batch.`,
    );
  }
}

function selectDiverseCanary(items, requestedCount) {
  const count = Math.min(requestedCount, items.length);
  const remaining = [...items];
  const selected = [];
  const seenInfluencers = new Set();
  const seenGroups = new Set();

  while (selected.length < count) {
    let bestIndex = 0;
    let bestScore = -1;

    for (const [index, item] of remaining.entries()) {
      const score =
        (seenInfluencers.has(item.asset.influencerKey) ? 0 : 2) +
        (seenGroups.has(item.asset.visualGroup) ? 0 : 1);

      if (score > bestScore) {
        bestIndex = index;
        bestScore = score;
      }
    }

    const [item] = remaining.splice(bestIndex, 1);
    selected.push(item);
    seenInfluencers.add(item.asset.influencerKey);
    seenGroups.add(item.asset.visualGroup);
  }

  return selected;
}

function assertRuntimeReady() {
  if (getStorageProviderName() !== "gcp") {
    throw new Error(
      `Silent Hook import requires STORAGE_PROVIDER=gcp; current provider is ${getStorageProviderName()}.`,
    );
  }

  const missing = [
    ...getMissingStorageEnvVars(),
    ...(!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
      ? ["SUPABASE_SERVICE_ROLE_KEY"]
      : []),
    ...(!(
      process.env.SUPABASE_URL?.trim() ||
      process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    )
      ? ["SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL"]
      : []),
  ];

  if (missing.length > 0) {
    throw new Error(
      `Missing Hook import configuration: ${missing.join(", ")}.`,
    );
  }
}

function getFileSha256(filePath) {
  return createHash("sha256")
    .update(readFileSync(filePath))
    .digest("hex");
}

function printPlan({ manifestPath, operation, plan }) {
  console.log("Silent Hook video import plan");
  console.log(`Operation: ${operation}`);
  console.log(`Mode: ${plan.mode}`);
  console.log(`Manifest: ${manifestPath}`);
  console.log(`Source batch: ${manifest.sourceBatch}`);
  console.log(
    `Selected: ${plan.items.length} of ${manifest.assets.length} reviewed videos`,
  );
  console.log(`Selected bytes: ${formatBytes(
    plan.items.reduce((total, item) => total + item.sizeBytes, 0),
  )}`);
  console.log(
    `Influencers: ${Object.entries(
      countBy(plan.items, (item) => item.asset.influencerKey),
    )
      .map(([key, count]) => `${key}=${count}`)
      .join(", ")}`,
  );
  console.log(
    `Visual groups: ${Object.entries(
      countBy(plan.items, (item) => item.asset.visualGroup),
    )
      .map(([key, count]) => `${key}=${count}`)
      .join(", ")}`,
  );
}

function countBy(items, selector) {
  const counts = {};

  for (const item of items) {
    const key = selector(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return counts;
}

function chunkValues(values, size) {
  const chunks = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

function toTitleCase(value) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatBytes(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function writeRunResult(sourceBatch, mode, value) {
  const resultDir = path.resolve(RESULT_ROOT, sourceBatch);
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/gu, "-");
  const resultPath = path.join(
    resultDir,
    `${timestamp}-${mode}-result.json`,
  );

  mkdirSync(resultDir, { recursive: true });
  writeFileSync(resultPath, `${JSON.stringify(value, null, 2)}\n`);
  console.log(`Result: ${resultPath}`);
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/u)) {
    const match = line
      .trim()
      .match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/u);

    if (!match || process.env[match[1]]) {
      continue;
    }

    const rawValue = match[2].trim();
    process.env[match[1]] =
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"))
        ? rawValue.slice(1, -1)
        : rawValue;
  }
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

function getPositiveInteger(value, label) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }

  return parsed;
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
