import ffprobeStatic from "ffprobe-static";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import {
  getMissingStorageEnvVars,
  getStorageProviderName,
  getStorageObject,
  headStorageObject,
  uploadBufferToStorage,
} from "../lib/storage/storage.ts";

const DEFAULT_SOURCE_DIRECTORY =
  "C:/Users/chund/OneDrive/Desktop/HOOk/videos (10)";
const DEFAULT_WALL_TEXT_SOURCE_DIRECTORY = "D:/walloftext";
const DEFAULT_PREVIEW_SOURCE_FILE =
  "C:/Users/chund/OneDrive/Desktop/UGC/landing_page/Explore.mp4";
const STORAGE_PREFIX = "explore/hook-videos/2026-08-29";
const WALL_TEXT_STORAGE_PREFIX = "explore/wall-text-videos/2026-09-03";
const PREVIEW_STORAGE_PREFIX = "explore/landing-preview/2026-08-29";
const CACHE_CONTROL = "public, max-age=31536000, immutable";
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

loadEnvFile(path.resolve(".env.local"));

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  printHelp();
  process.exit(0);
}

const execute = Boolean(args.execute);
const preview = Boolean(args.preview);
const wallText = Boolean(args["wall-text"]);
if (preview && wallText) {
  throw new Error("The Explore landing preview cannot be imported as Wall of Text.");
}
if (execute && !args.yes) {
  throw new Error(
    "Refusing to write to GCP without --yes. Run the dry-run first, then use --execute --yes.",
  );
}
if (!execute && args.yes) {
  throw new Error("--yes is only valid together with --execute.");
}

const sourcePath = path.resolve(
  typeof args.source === "string"
    ? args.source
    : preview
      ? DEFAULT_PREVIEW_SOURCE_FILE
      : wallText
        ? DEFAULT_WALL_TEXT_SOURCE_DIRECTORY
        : DEFAULT_SOURCE_DIRECTORY,
);
const plan = buildImportPlan(sourcePath, { preview, wallText });
printPlan({ execute, plan, preview, sourcePath, wallText });

if (!execute) {
  console.log("Dry run complete. No GCP object was changed.");
  process.exit(0);
}

assertRuntimeReady();

for (const [index, item] of plan.items.entries()) {
  console.log(`[${index + 1}/${plan.items.length}] ${item.id}`);
  const existing = await readStoredObjectHash(item.storageKey);

  if (existing === item.sha256) {
    console.log("  already uploaded and verified");
    continue;
  }

  if (existing) {
    throw new Error(
      `Refusing to overwrite a different GCP object at ${item.storageKey}.`,
    );
  }

  await uploadBufferToStorage({
    buffer: readFileSync(item.filePath),
    cacheControl: CACHE_CONTROL,
    contentType: "video/mp4",
    key: item.storageKey,
  });

  const storedHash = await readStoredObjectHash(item.storageKey);
  if (storedHash !== item.sha256) {
    throw new Error(`GCP verification failed for ${item.id}.`);
  }
}

console.log(
  preview
    ? `Import complete: the Explore landing preview is present in gs://${process.env.GCP_STORAGE_BUCKET}/${PREVIEW_STORAGE_PREFIX}/.`
    : `Import complete: ${plan.items.length} Explore ${wallText ? "Wall of Text" : "Hook"} video(s) are present in gs://${process.env.GCP_STORAGE_BUCKET}/${getStoragePrefix({ wallText })}/.`,
);

function buildImportPlan(sourcePath, { preview: isPreview, wallText: isWallText }) {
  if (!existsSync(sourcePath)) {
    throw new Error(`Explore source does not exist: ${sourcePath}`);
  }

  const sourceStats = statSync(sourcePath);
  const fileNames = isPreview
    ? sourceStats.isFile() && sourcePath.toLowerCase().endsWith(".mp4")
      ? [path.basename(sourcePath)]
      : []
    : sourceStats.isDirectory()
      ? readdirSync(sourcePath)
          .filter((fileName) => fileName.toLowerCase().endsWith(".mp4"))
          .sort()
      : [];

  if (fileNames.length === 0) {
    throw new Error(
      isPreview
        ? `Explore preview source must be a .mp4 file: ${sourcePath}`
        : `No .mp4 files were found in ${sourcePath}.`,
    );
  }

  const sourceHashes = new Set();
  const storageKeys = new Set();
  const items = fileNames.map((fileName, index) => {
    const filePath = isPreview ? sourcePath : path.join(sourcePath, fileName);
    const stats = statSync(filePath);

    if (!stats.isFile() || stats.size < 1 || stats.size > MAX_VIDEO_BYTES) {
      throw new Error(`Invalid Explore video size: ${fileName}`);
    }

    const metadata = probeVideo(filePath);
    if (
      (!isPreview && !isWallText && metadata.audioStreamCount !== 0) ||
      metadata.codec !== "h264" ||
      metadata.width * 16 !== metadata.height * 9
    ) {
      throw new Error(
        isPreview
          ? `Explore landing preview must be a 9:16 H.264 MP4: ${fileName}`
          : `Explore ${isWallText ? "Wall of Text" : "Hook"} video must be a ${
              isWallText ? "9:16" : "silent 9:16"
            } H.264 MP4: ${fileName}`,
      );
    }

    const sha256 = getFileSha256(filePath);
    const storageKey = `${
      isPreview ? PREVIEW_STORAGE_PREFIX : getStoragePrefix({ wallText: isWallText })
    }/${sha256}.mp4`;
    if (sourceHashes.has(sha256) || storageKeys.has(storageKey)) {
      throw new Error(
        `Duplicate Explore ${isWallText ? "Wall of Text" : "Hook"} source bytes: ${fileName}`,
      );
    }
    sourceHashes.add(sha256);
    storageKeys.add(storageKey);

    return {
      fileName,
      filePath,
      id: isPreview
        ? "explore-landing-preview"
        : `explore-${isWallText ? "wall-text" : "hook"}-${String(index + 1).padStart(2, "0")}`,
      metadata,
      sha256,
      sizeBytes: stats.size,
      storageKey,
    };
  });

  return {
    items,
    totalBytes: items.reduce((total, item) => total + item.sizeBytes, 0),
  };
}

function getStoragePrefix({ wallText: isWallText }) {
  return isWallText ? WALL_TEXT_STORAGE_PREFIX : STORAGE_PREFIX;
}

function probeVideo(filePath) {
  let output;
  try {
    output = execFileSync(
      ffprobeStatic.path,
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
      `Could not inspect ${path.basename(filePath)}: ${getErrorMessage(error)}`,
    );
  }

  const parsed = JSON.parse(output);
  const streams = Array.isArray(parsed.streams) ? parsed.streams : [];
  const video = streams.find((stream) => stream.codec_type === "video");
  const durationSeconds = Number(parsed.format?.duration);
  const width = Number(video?.width);
  const height = Number(video?.height);

  if (
    !video ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0 ||
    !Number.isInteger(width) ||
    width <= 0 ||
    !Number.isInteger(height) ||
    height <= 0
  ) {
    throw new Error(`Invalid video metadata for ${path.basename(filePath)}.`);
  }

  return {
    audioStreamCount: streams.filter((stream) => stream.codec_type === "audio").length,
    codec: video.codec_name,
    durationSeconds: Math.round(durationSeconds * 1_000) / 1_000,
    height,
    width,
  };
}

async function readStoredObjectHash(storageKey) {
  try {
    const head = await headStorageObject({ key: storageKey });
    if (head.ContentType !== "video/mp4") {
      throw new Error(`Stored Explore object has an unexpected content type: ${storageKey}`);
    }

    const object = await getStorageObject({ key: storageKey });
    if (!object.Body) {
      throw new Error(`Stored Explore object has no body: ${storageKey}`);
    }

    const body = Buffer.from(
      await new Response(object.Body.transformToWebStream()).arrayBuffer(),
    );
    return createHash("sha256").update(body).digest("hex");
  } catch (error) {
    if (isMissingObjectError(error)) return null;
    throw error;
  }
}

function assertRuntimeReady() {
  const missing = getMissingStorageEnvVars();
  if (missing.length > 0) {
    throw new Error(`Missing GCP storage configuration: ${missing.join(", ")}`);
  }
  if (getStorageProviderName() !== "gcp") {
    throw new Error("Explore videos must be imported to GCP storage.");
  }
}

function getFileSha256(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function isMissingObjectError(error) {
  return (
    typeof error === "object" &&
    error !== null &&
    (("code" in error && error.code === "NoSuchKey") ||
      ("Code" in error && error.Code === "NoSuchKey"))
  );
}

function printPlan({ execute: shouldExecute, plan: currentPlan, preview: isPreview, sourcePath, wallText: isWallText }) {
  console.log(
    isPreview
      ? "Explore landing preview import"
      : `Explore ${isWallText ? "Wall of Text" : "Hook"} video import`,
  );
  console.log(`Mode: ${shouldExecute ? "EXECUTE" : "DRY RUN"}`);
  console.log(
    `Storage prefix: ${isPreview ? PREVIEW_STORAGE_PREFIX : getStoragePrefix({ wallText: isWallText })}`,
  );
  console.log(`Source: ${sourcePath}`);
  console.log(`Video count: ${currentPlan.items.length}`);
  console.log(`Total bytes: ${currentPlan.totalBytes}`);

  for (const item of currentPlan.items) {
    console.log(
      `  ${item.id} ${item.metadata.width}x${item.metadata.height} ${item.metadata.durationSeconds}s ${item.sha256}`,
    );
  }
}

function parseArgs(rawArgs) {
  const parsed = {};
  const booleanFlags = new Set(["execute", "help", "preview", "wall-text", "yes"]);
  const valueFlags = new Set(["source"]);

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected positional argument: ${arg}`);
    }

    const key = arg.slice(2);
    if (booleanFlags.has(key)) {
      parsed[key] = true;
      continue;
    }
    if (!valueFlags.has(key)) {
      throw new Error(`Unknown option: --${key}`);
    }

    const next = rawArgs[index + 1];
    if (!next || next.startsWith("--")) {
      throw new Error(`Missing value for --${key}.`);
    }
    parsed[key] = next;
    index += 1;
  }

  return parsed;
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;

  for (const rawLine of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator < 1) continue;

    const key = line.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || process.env[key]) continue;

    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function printHelp() {
  console.log(`Usage:
  npm run explore:hook-videos:import
  npm run explore:hook-videos:import -- --source <directory>
  npm run explore:hook-videos:import -- --execute --yes
  npm run explore:wall-text-videos:import
  npm run explore:wall-text-videos:import -- --source <directory>
  npm run explore:wall-text-videos:import -- --execute --yes
  npm run explore:preview-video:import
  npm run explore:preview-video:import -- --execute --yes

The default command is a read-only dry run. It validates each direct Explore
Hook clip is a silent, vertical H.264 MP4 and calculates a content hash. The
Wall-of-Text catalog retains supplied audio but the application plays reference
cards muted. The execute command uploads each file to its immutable GCP object
key, verifies the stored bytes, and never touches Trending or Supabase tables.
The landing preview uses the supplied vertical H.264 video exactly as provided;
it may retain audio because the application always autoplays it muted.`);
}
