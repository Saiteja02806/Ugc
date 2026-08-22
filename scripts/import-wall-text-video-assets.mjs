import { createClient } from "@supabase/supabase-js";
import ffmpegPath from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import {
  buildPublicStorageUrl as buildStoragePublicUrl,
  getMissingStorageEnvVars,
  getStorageProviderName,
  headStorageObject,
  uploadBufferToStorage,
} from "../lib/storage/storage.ts";

const DEFAULT_FOLDER =
  "C:\\Users\\chund\\OneDrive\\Desktop\\videos_real";
const DEFAULT_MANIFEST =
  "scripts/data/wall-text-videos-real-2026-07-28.json";
const RESULT_ROOT = ".tmp/wall-text-video-import";
const CACHE_CONTROL = "public, max-age=31536000, immutable";
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const WALL_TEXT_PLACEMENT_ZONES = new Set([
  "upper-middle",
  "middle",
  "lower-middle",
]);

loadEnvFile(path.resolve(".env.local"));

const args = parseArgs(process.argv.slice(2));
const execute = Boolean(args.execute);
const dryRun = !execute || Boolean(args.dryRun);
const folder = path.resolve(String(args.folder || DEFAULT_FOLDER));
const manifestPath = path.resolve(String(args.manifest || DEFAULT_MANIFEST));

if (execute && !args.yes) {
  throw new Error(
    "Refusing to upload without --yes. Run the dry-run first, then use --execute --yes.",
  );
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const plan = buildImportPlan({ folder, manifest });

printPlan({ dryRun, folder, manifestPath, plan });

if (dryRun) {
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
    auth: { autoRefreshToken: false, persistSession: false },
  },
);
const result = {
  completedAt: null,
  imported: [],
  manifestPath,
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

    if (existing?.status === "active") {
      assertExistingRowMatches(existing, item);
      await verifyStoredObjects(item);
      result.skippedExisting.push({
        catalogName: item.asset.catalogName,
        id: existing.id,
      });
      continue;
    }

    const rowId = existing
      ? existing.id
      : await createPendingAssetRow(item);

    if (existing) {
      assertExistingRowMatches(existing, item);
      result.resumed.push({
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

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("overlay_media_assets")
      .update({
        analysis_error: null,
        analysis_model: "manual-reviewed-wall-text-v1",
        analysis_status: "succeeded",
        analyzed_at: now,
        duration_seconds: item.metadata.durationSeconds,
        preview_url: item.previewUrl,
        status: "active",
        thumbnail_url: item.thumbnailUrl,
        updated_at: now,
      })
      .eq("id", rowId)
      .eq("source_file_sha256", item.asset.sha256)
      .select(
        "id,source_file_sha256,source_batch,status,visual_group",
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
      visualGroup: item.asset.visualGroup,
    });
  }

  result.completedAt = new Date().toISOString();
  writeResult(manifest.sourceBatch, result);
  console.log(
    `Import complete: ${result.imported.length} activated, ${result.resumed.length} resumed, ${result.skippedExisting.length} already active.`,
  );
} catch (error) {
  writeResult(manifest.sourceBatch, {
    ...result,
    failedAt: new Date().toISOString(),
    failure: error instanceof Error ? error.message : String(error),
  });
  throw error;
}

async function assertRemoteSchemaReady() {
  const { error } = await supabase
    .from("overlay_media_assets")
    .select(
      [
        "id",
        "source_file_sha256",
        "source_batch",
        "visual_group",
        "s3_key",
        "thumbnail_s3_key",
        "duration_seconds",
        "status",
        "wall_text_source_kind",
      ].join(","),
    )
    .limit(1);

  if (error) {
    throw new Error(
      `Remote Wall-of-text schema is not ready: ${error.message}`,
    );
  }
}

async function loadExistingRows(items) {
  const hashes = items.map((item) => item.asset.sha256);
  const existingByHash = new Map();

  for (const chunk of chunkValues(hashes, 100)) {
    const { data, error } = await supabase
      .from("overlay_media_assets")
      .select(
        "id,s3_key,source_batch,source_file_sha256,status,thumbnail_s3_key,visual_group,wall_text_source_kind",
      )
      .in("source_file_sha256", chunk);

    if (error) {
      throw new Error(
        `Could not check existing Wall-of-text videos: ${error.message}`,
      );
    }

    for (const row of data ?? []) {
      existingByHash.set(row.source_file_sha256, row);
    }
  }

  return existingByHash;
}

async function createPendingAssetRow(item) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("overlay_media_assets")
    .insert({
      analysis_status: "pending",
      aspect_ratio: "9:16",
      asset_type: "video",
      content_type: "video/mp4",
      duration_seconds: item.metadata.durationSeconds,
      file_size_bytes: item.sizeBytes,
      format_family: "wall_text_overlay",
      generic_profiles: [],
      metadata_schema_version: "overlay_asset_metadata_v1",
      preview_url: null,
      primary_profiles: [],
      s3_key: item.videoKey,
      source_batch: manifest.sourceBatch,
      source_file_name: item.asset.fileName,
      source_file_sha256: item.asset.sha256,
      source_type: "owned",
      status: "inactive",
      thumbnail_s3_key: item.thumbnailKey,
      thumbnail_url: null,
      updated_at: now,
      use_case_tags: [],
      vision_metadata: {
        catalogName: item.asset.catalogName,
        playbackMode: manifest.playback.mode,
        reviewedAt: manifest.reviewedAt,
        reviewMethod: "manual-contact-sheet-and-file-validation",
        textVisibility: manifest.playback.textVisibility,
      },
      visual_group: item.asset.visualGroup,
      wall_text_source_kind: "ugcpilot",
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      `Could not create pending row for ${item.asset.catalogName}: ${error?.message ?? "no row returned"}`,
    );
  }

  return data.id;
}

function buildImportPlan({ folder, manifest }) {
  assertManifest(manifest);

  if (!existsSync(folder)) {
    throw new Error(`Wall-of-text source folder does not exist: ${folder}`);
  }

  const actualFileNames = readdirSync(folder, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() && path.extname(entry.name).toLowerCase() === ".mp4",
    )
    .map((entry) => entry.name)
    .sort((first, second) => first.localeCompare(second));
  const reviewedFileNames = [
    ...manifest.assets.map((asset) => asset.fileName),
    ...manifest.rejectedDuplicates.map((asset) => asset.fileName),
  ].sort((first, second) => first.localeCompare(second));

  if (
    actualFileNames.length !== reviewedFileNames.length ||
    actualFileNames.some(
      (fileName, index) => fileName !== reviewedFileNames[index],
    )
  ) {
    const reviewed = new Set(reviewedFileNames);
    const actual = new Set(actualFileNames);
    const unreviewed = actualFileNames.filter(
      (fileName) => !reviewed.has(fileName),
    );
    const missing = reviewedFileNames.filter(
      (fileName) => !actual.has(fileName),
    );

    throw new Error(
      `Source folder no longer matches the reviewed manifest. Unreviewed: ${unreviewed.join(", ") || "none"}. Missing: ${missing.join(", ") || "none"}.`,
    );
  }

  const acceptedByName = new Map();
  const items = manifest.assets.map((asset) => {
    const filePath = path.join(folder, asset.fileName);
    const stats = statSync(filePath);
    const actualHash = getFileSha256(filePath);

    if (actualHash !== asset.sha256) {
      throw new Error(`SHA-256 changed for ${asset.fileName}.`);
    }

    if (stats.size <= 0 || stats.size > MAX_VIDEO_BYTES) {
      throw new Error(`Invalid video size for ${asset.fileName}.`);
    }

    const metadata = probeVideo(filePath);

    if (metadata.width * 16 !== metadata.height * 9) {
      throw new Error(
        `${asset.fileName} is ${metadata.width}x${metadata.height}, not 9:16.`,
      );
    }

    const keyRoot = `overlay-media/wall-text/${manifest.sourceBatch}`;
    const item = {
      asset,
      filePath,
      metadata,
      previewUrl: buildStoragePublicUrl(
        `${keyRoot}/videos/${asset.visualGroup}/${asset.catalogName}-${asset.sha256.slice(0, 12)}.mp4`,
      ),
      sizeBytes: stats.size,
      thumbnailKey: `${keyRoot}/thumbnails/${asset.visualGroup}/${asset.catalogName}-${asset.sha256.slice(0, 12)}.webp`,
      videoKey: `${keyRoot}/videos/${asset.visualGroup}/${asset.catalogName}-${asset.sha256.slice(0, 12)}.mp4`,
    };

    item.thumbnailUrl = buildStoragePublicUrl(item.thumbnailKey);
    acceptedByName.set(asset.fileName, item);
    return item;
  });

  for (const duplicate of manifest.rejectedDuplicates) {
    const accepted = acceptedByName.get(duplicate.duplicateOf);

    if (!accepted) {
      throw new Error(
        `${duplicate.fileName} points to unknown duplicate ${duplicate.duplicateOf}.`,
      );
    }

    const duplicateHash = getFileSha256(
      path.join(folder, duplicate.fileName),
    );

    if (duplicateHash !== accepted.asset.sha256) {
      throw new Error(
        `${duplicate.fileName} is not an exact duplicate of ${duplicate.duplicateOf}.`,
      );
    }
  }

  return {
    groupCounts: countBy(items, (item) => item.asset.visualGroup),
    items,
    rejectedDuplicateCount: manifest.rejectedDuplicates.length,
  };
}

function assertManifest(manifest) {
  if (
    manifest.schemaVersion !== "wall-text-video-manifest-v1" ||
    !manifest.sourceBatch?.trim() ||
    manifest.playback?.mode !== "once" ||
    manifest.playback?.textVisibility !== "full-duration" ||
    !Array.isArray(manifest.assets) ||
    !Array.isArray(manifest.rejectedDuplicates)
  ) {
    throw new Error("The Wall-of-text video manifest is invalid.");
  }

  const groups = new Set(Object.keys(manifest.visualGroups ?? {}));
  const catalogNames = new Set();
  const fileNames = new Set();
  const hashes = new Set();

  for (const asset of manifest.assets) {
    if (
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(asset.catalogName) ||
      !asset.fileName?.toLowerCase().endsWith(".mp4") ||
      !/^[0-9a-f]{64}$/u.test(asset.sha256) ||
      !groups.has(asset.visualGroup) ||
      (asset.approvedPlacementZone !== undefined &&
        !WALL_TEXT_PLACEMENT_ZONES.has(asset.approvedPlacementZone))
    ) {
      throw new Error(`Invalid manifest asset: ${asset.fileName ?? "unknown"}.`);
    }

    if (
      catalogNames.has(asset.catalogName) ||
      fileNames.has(asset.fileName) ||
      hashes.has(asset.sha256)
    ) {
      throw new Error(`Duplicate approved manifest entry: ${asset.fileName}.`);
    }

    catalogNames.add(asset.catalogName);
    fileNames.add(asset.fileName);
    hashes.add(asset.sha256);
  }

  for (const duplicate of manifest.rejectedDuplicates) {
    if (
      !duplicate.fileName ||
      !duplicate.duplicateOf ||
      fileNames.has(duplicate.fileName)
    ) {
      throw new Error("Invalid rejected duplicate entry in the manifest.");
    }

    fileNames.add(duplicate.fileName);
  }
}

function probeVideo(filePath) {
  let output;

  try {
    output = execFileSync(
      ffprobeStatic.path,
      [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height:format=duration",
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
  const durationSeconds = Number(parsed.format?.duration);
  const width = Number(parsed.streams?.[0]?.width);
  const height = Number(parsed.streams?.[0]?.height);

  if (
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
    durationSeconds: Math.round(durationSeconds * 1000) / 1000,
    height,
    width,
  };
}

function createThumbnail(item) {
  const outputDir = path.resolve(RESULT_ROOT, manifest.sourceBatch, "thumbnails");
  const outputPath = path.join(outputDir, `${item.asset.catalogName}.webp`);
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
      "scale=360:640:force_original_aspect_ratio=decrease,pad=360:640:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1",
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
}

function assertExistingRowMatches(row, item) {
  if (
    row.s3_key !== item.videoKey ||
    row.thumbnail_s3_key !== item.thumbnailKey ||
    row.source_batch !== manifest.sourceBatch ||
    row.visual_group !== item.asset.visualGroup ||
    row.wall_text_source_kind !== "ugcpilot"
  ) {
    throw new Error(
      `Existing row metadata conflicts with ${item.asset.catalogName}.`,
    );
  }
}

function assertRuntimeReady() {
  if (getStorageProviderName() !== "gcp") {
    throw new Error(
      `Wall-of-text import requires STORAGE_PROVIDER=gcp; current provider is ${getStorageProviderName()}.`,
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
    throw new Error(`Missing import configuration: ${missing.join(", ")}.`);
  }
}

function getFileSha256(filePath) {
  return createHash("sha256")
    .update(readFileSync(filePath))
    .digest("hex");
}

function printPlan({ dryRun, folder, manifestPath, plan }) {
  console.log("Wall-of-text video import plan");
  console.log(`Mode: ${dryRun ? "dry-run" : "execute"}`);
  console.log(`Folder: ${folder}`);
  console.log(`Manifest: ${manifestPath}`);
  console.log(`Approved unique videos: ${plan.items.length}`);
  console.log(`Rejected exact duplicates: ${plan.rejectedDuplicateCount}`);
  console.log(
    `Visual groups: ${Object.entries(plan.groupCounts)
      .map(([group, count]) => `${group}=${count}`)
      .join(", ")}`,
  );
  console.log(
    `Native durations: ${Math.min(...plan.items.map((item) => item.metadata.durationSeconds))}s–${Math.max(...plan.items.map((item) => item.metadata.durationSeconds))}s`,
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

function writeResult(sourceBatch, value) {
  const resultDir = path.resolve(RESULT_ROOT, sourceBatch);
  const resultPath = path.join(resultDir, "import-result.json");

  mkdirSync(resultDir, { recursive: true });
  writeFileSync(resultPath, `${JSON.stringify(value, null, 2)}\n`);
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
