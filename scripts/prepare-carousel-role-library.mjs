import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { createReadStream } from "node:fs";
import {
  copyFile,
  mkdir,
  readdir,
  unlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import sharp from "sharp";

import {
  CAROUSEL_IMAGE_EXTENSIONS,
  assertCarouselRolePoolMinimums,
  classifyCarouselRoleSourcePath,
  selectExactDuplicateWinners,
  summarizeCarouselRoleAssets,
  toPosixPath,
} from "./carousel-role-library.mjs";

const DEFAULT_SOURCE_ROOT =
  "C:/Users/chund/OneDrive/Desktop/slideshows/power";
const DEFAULT_OUTPUT_ROOT = ".tmp/carousel-role-library";
const BASE_WIDTH = 1080;
const BASE_HEIGHT = 1350;
const THUMB_WIDTH = 320;
const THUMB_HEIGHT = 400;
const DEFAULT_CONCURRENCY = 6;
const execFileAsync = promisify(execFile);

const args = parseArgs(process.argv.slice(2));
const sourceRoot = path.resolve(args["source-root"] || DEFAULT_SOURCE_ROOT);
const outputRoot = path.resolve(args["out-dir"] || DEFAULT_OUTPUT_ROOT);
const generatedAt = new Date().toISOString();
const outputDir = path.join(outputRoot, generatedAt.replace(/[:.]/g, "-"));
const concurrency = parsePositiveInteger(args.concurrency, DEFAULT_CONCURRENCY);
const expectedCount = args["expected-count"]
  ? parsePositiveInteger(args["expected-count"])
  : null;
const limit = args.limit ? parsePositiveInteger(args.limit) : null;
const heifConvertPath = path.resolve(
  args["heif-convert"] ||
    process.env.HEIF_CONVERT_PATH ||
    path.join(
      os.homedir(),
      ".cache/codex-runtimes/codex-primary-runtime/dependencies/native/libheif/libheif/bin/heif-convert.exe",
    ),
);

console.log("Carousel role-library preparation");
console.log(`Source: ${sourceRoot}`);
console.log(`Output: ${outputDir}`);
console.log("Policy: top-level role bucket wins; marketing_static excluded");

const discoveredFiles = await listFiles(sourceRoot);
const candidates = [];
const exclusions = [];

for (const filePath of discoveredFiles) {
  const extension = path.extname(filePath).toLowerCase();

  if (!CAROUSEL_IMAGE_EXTENSIONS.has(extension)) {
    exclusions.push({
      reason: "unsupported-extension",
      relativePath: toPosixPath(path.relative(sourceRoot, filePath)),
    });
    continue;
  }

  const classification = classifyCarouselRoleSourcePath(sourceRoot, filePath);

  if (classification.status !== "included") {
    exclusions.push({
      ...classification,
      relativePath: toPosixPath(path.relative(sourceRoot, filePath)),
    });
    continue;
  }

  candidates.push({
    ...classification,
    extension,
    filePath,
    sourceFileSha256: await sha256File(filePath),
  });
}

const deduplicated = selectExactDuplicateWinners(candidates);
const selectedWinners = limit
  ? deduplicated.winners.slice(0, limit)
  : deduplicated.winners;
const rawSummary = summarizeCarouselRoleAssets(candidates);
const deduplicatedSummary = summarizeCarouselRoleAssets(deduplicated.winners);

assertCarouselRolePoolMinimums(deduplicatedSummary);

if (expectedCount !== null && deduplicatedSummary.total !== expectedCount) {
  throw new Error(
    `Deduplicated asset count changed: expected ${expectedCount}, found ${deduplicatedSummary.total}. Re-audit before importing.`,
  );
}

await mkdir(outputDir, { recursive: true });

const preparedAssets = [];
const errors = [];
let completed = 0;

await runWithConcurrency(selectedWinners, concurrency, async (candidate) => {
  try {
    const prepared = await prepareAsset(candidate, outputDir);
    preparedAssets.push(prepared);
  } catch (error) {
    errors.push({
      message: error instanceof Error ? error.message : String(error),
      relativePath: candidate.relativePath,
    });
  } finally {
    completed += 1;

    if (completed % 50 === 0 || completed === selectedWinners.length) {
      console.log(`Prepared ${completed}/${selectedWinners.length}`);
    }
  }
});

preparedAssets.sort((first, second) =>
  first.libraryAssetId.localeCompare(second.libraryAssetId),
);

const manifest = {
  assets: preparedAssets,
  duplicateGroups: deduplicated.duplicateGroups,
  errors,
  exclusions,
  generatedAt,
  input: {
    sourceRoot,
  },
  policy: {
    baseRendition: `${BASE_WIDTH}x${BASE_HEIGHT} WebP, cover crop, attention position`,
    duplicateArbitration:
      "Global exact-SHA-256 deduplication; role priority hook > human > static, then stable relative path.",
    license:
      "User supplied and confirmed these assets are cleared for use on 2026-08-17.",
    marketingStatic: "Excluded from V1 by user instruction.",
    roleAuthority:
      "The top-level category_role bucket is authoritative; nested folder names never override it.",
    thumbnailRendition: `${THUMB_WIDTH}x${THUMB_HEIGHT} WebP, cover crop, attention position`,
  },
  summary: {
    deduplicated: deduplicatedSummary,
    duplicateCopiesRemoved: candidates.length - deduplicated.winners.length,
    exactDuplicateGroupCount: deduplicated.duplicateGroups.length,
    excludedFileCount: exclusions.length,
    preparedAssetCount: preparedAssets.length,
    raw: rawSummary,
  },
  version: "carousel-role-library-v1",
};

const manifestPath = path.join(outputDir, "role-library-manifest.json");
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log("");
console.log(`Raw eligible images: ${rawSummary.total}`);
console.log(`Unique images: ${deduplicatedSummary.total}`);
console.log(`Exact duplicate copies removed: ${manifest.summary.duplicateCopiesRemoved}`);
console.log(`Prepared assets: ${preparedAssets.length}`);
console.log(`Errors: ${errors.length}`);
console.log(`Manifest: ${manifestPath}`);

if (errors.length > 0) {
  process.exitCode = 1;
}

async function prepareAsset(candidate, manifestDir) {
  const libraryAssetId = `${candidate.category}_${candidate.role}_${candidate.sourceFileSha256.slice(0, 20)}`;
  const originalExtension = candidate.extension;
  const baseRelative = `files/base/${candidate.category}/${candidate.role}/${libraryAssetId}.webp`;
  const thumbRelative = `files/thumb/${candidate.category}/${candidate.role}/${libraryAssetId}.webp`;
  const originalRelative = `files/original/${candidate.category}/${candidate.role}/${libraryAssetId}${originalExtension}`;
  const basePath = path.join(manifestDir, ...baseRelative.split("/"));
  const thumbPath = path.join(manifestDir, ...thumbRelative.split("/"));
  const originalPath = path.join(manifestDir, ...originalRelative.split("/"));

  await Promise.all([
    mkdir(path.dirname(basePath), { recursive: true }),
    mkdir(path.dirname(thumbPath), { recursive: true }),
    mkdir(path.dirname(originalPath), { recursive: true }),
  ]);
  const decodedHeicPath =
    candidate.extension === ".heic"
      ? path.join(manifestDir, ".decoded-heic", `${libraryAssetId}.png`)
      : null;
  let sharpInputPath = candidate.filePath;

  if (decodedHeicPath) {
    await mkdir(path.dirname(decodedHeicPath), { recursive: true });

    try {
      await execFileAsync(
        heifConvertPath,
        [candidate.filePath, decodedHeicPath],
        { maxBuffer: 10 * 1024 * 1024, windowsHide: true },
      );
    } catch (error) {
      throw new Error(
        `HEIC conversion failed for ${candidate.relativePath} with ${heifConvertPath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    sharpInputPath = decodedHeicPath;
  }

  let metadata;
  let perceptualHash;

  try {
    const sourceImage = sharp(sharpInputPath, {
      failOn: "error",
      limitInputPixels: false,
    }).rotate();
    metadata = await sourceImage.metadata();

    if (!metadata.width || !metadata.height) {
      throw new Error(`Could not determine dimensions for ${candidate.relativePath}`);
    }

    [perceptualHash] = await Promise.all([
      buildAverageHash(sourceImage.clone()),
      sourceImage
        .clone()
        .resize(BASE_WIDTH, BASE_HEIGHT, {
          fit: "cover",
          position: sharp.strategy.attention,
        })
        .webp({ effort: 4, quality: 88 })
        .toFile(basePath),
      sourceImage
        .clone()
        .resize(THUMB_WIDTH, THUMB_HEIGHT, {
          fit: "cover",
          position: sharp.strategy.attention,
        })
        .webp({ effort: 3, quality: 82 })
        .toFile(thumbPath),
      copyFile(candidate.filePath, originalPath),
    ]);
  } finally {
    if (decodedHeicPath) {
      await unlink(decodedHeicPath).catch(() => undefined);
    }
  }

  const baseKey = `category-library/v2/${candidate.category}/${candidate.role}/${libraryAssetId}/base-1080x1350.webp`;
  const thumbKey = `category-library/v2/${candidate.category}/${candidate.role}/${libraryAssetId}/thumb-320x400.webp`;
  const originalKey = `category-library/v2/${candidate.category}/${candidate.role}/${libraryAssetId}/original${originalExtension}`;
  const hasHuman = candidate.role === "human" ? true : candidate.role === "static" ? false : null;

  return {
    category: candidate.category,
    dbRow: {
      asset_role: candidate.role,
      asset_scope: "category",
      asset_variant: "canonical",
      base_s3_key: baseKey,
      base_url: "https://pending.invalid",
      best_for_slide_types: candidate.role === "hook" ? ["hook"] : ["body"],
      category_slug: candidate.category,
      content_tags: [candidate.category, candidate.role],
      face_count: candidate.role === "static" ? 0 : null,
      has_human: hasHuman,
      height: BASE_HEIGHT,
      image_query: null,
      image_subject_class: candidate.role === "static" ? "object-only" : null,
      is_active: true,
      library_asset_id: libraryAssetId,
      license_information:
        "User supplied and confirmed cleared for use on 2026-08-17.",
      mood_tags: [],
      object_tags: [],
      orientation: "portrait",
      owner_business_profile_id: null,
      person_count: candidate.role === "static" ? 0 : null,
      quality_score: Math.min(
        1,
        Math.min(metadata.width / BASE_WIDTH, metadata.height / BASE_HEIGHT),
      ),
      runtime_exclusion_reason: null,
      source_file_sha256: candidate.sourceFileSha256,
      source_filename: path.basename(candidate.filePath),
      source_folder: path.posix.dirname(candidate.relativePath),
      source_metadata: {
        originalFormat:
          candidate.extension === ".heic" ? "heif" : metadata.format ?? null,
        originalHeight: metadata.height,
        originalWidth: metadata.width,
        roleBucket: candidate.bucket,
        sourceBatch: candidate.sourceBatch,
        sourceRelativePath: candidate.relativePath,
      },
      source_original_s3_key: originalKey,
      source_original_url: "https://pending.invalid",
      source_perceptual_hash: perceptualHash,
      source_provider: "local",
      status: "ready",
      subject_review_status: "approved",
      thumb_s3_key: thumbKey,
      thumb_url: "https://pending.invalid",
      usage_count: 0,
      usable_profiles: [],
      usable_verticals: [],
      visual_keywords: [candidate.category, candidate.role],
      width: BASE_WIDTH,
    },
    files: {
      base: baseRelative,
      original: originalRelative,
      thumb: thumbRelative,
    },
    libraryAssetId,
    role: candidate.role,
    source: {
      relativePath: candidate.relativePath,
      sourceBatch: candidate.sourceBatch,
    },
    storage: {
      baseKey,
      originalKey,
      thumbKey,
    },
  };
}

async function buildAverageHash(image) {
  const buffer = await image
    .resize(8, 8, { fit: "fill" })
    .greyscale()
    .raw()
    .toBuffer();
  const average = buffer.reduce((total, value) => total + value, 0) / buffer.length;
  let bits = "";

  for (const value of buffer) {
    bits += value >= average ? "1" : "0";
  }

  return BigInt(`0b${bits}`).toString(16).padStart(16, "0");
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((first, second) =>
    first.name.localeCompare(second.name),
  )) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listFiles(entryPath)));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

async function runWithConcurrency(values, maximum, callback) {
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      await callback(values[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(maximum, values.length) }, () => worker()),
  );
}

function parsePositiveInteger(value, fallback = null) {
  const parsed = Number.parseInt(String(value ?? ""), 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    if (fallback !== null) return fallback;
    throw new Error(`Expected a positive integer, received ${String(value)}`);
  }

  return parsed;
}

function parseArgs(rawArgs) {
  const parsed = {};

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];

    if (!arg.startsWith("--")) continue;

    const key = arg.slice(2);
    const next = rawArgs[index + 1];

    if (!next || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      index += 1;
    }
  }

  return parsed;
}
