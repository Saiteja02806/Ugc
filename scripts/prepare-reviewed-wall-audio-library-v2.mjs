import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  NORMALIZATION_TARGET,
  WALL_AUDIO_LIBRARY_SCHEMA_VERSION,
  WALL_AUDIO_PREPARATION_VERSION,
  WALL_AUDIO_SOURCE_SCHEMA_VERSION,
  normalizeAudio,
  toReviewCsv,
} from "./prepare-wall-audio-library-v2.mjs";

const DEFAULT_LIBRARY = "D:\\walloftext_sound\\wall_audio_library_v2";
const DEFAULT_OUTPUT =
  "D:\\walloftext_sound\\wall_audio_library_v2_reviewed";
const DEFAULT_REVIEW_DIRS = [
  "D:\\walloftext_sound\\wall_text_audio_008_027_usable_21",
  "D:\\walloftext_sound\\wall_text_audio_028_048_usable_20",
  "D:\\walloftext_sound\\wall_text_audio_049_055_usable_8",
  "D:\\walloftext_sound\\wall_text_audio_041_tagged",
];
const REVIEWED_AT = "2026-08-09";
const RAW_SOURCE_PATTERN = /^wall_text_audio_(\d{3})$/i;
const REVIEW_ASSET_PATTERN =
  /^wall_text_audio_(\d{3})(?:_segment_(\d{2}))?$/i;
const REVIEW_MANIFEST_PATTERN = /^wall_audio_assets?(?:_\d+)?\.json$/i;
const CONTROLLED_VOCABULARY = Object.freeze({
  moods: ["curious", "uplifting", "serious", "calm", "urgent", "playful"],
  messageTypes: [
    "curiosity",
    "problem",
    "warning",
    "transformation",
    "benefit",
    "story",
    "authority",
  ],
  energy: ["low", "medium", "high"],
});

export function parseReviewedArgs(argv) {
  const options = {
    library: DEFAULT_LIBRARY,
    outputDir: DEFAULT_OUTPUT,
    reviewDirs: [],
    execute: false,
    confirmed: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--execute") {
      options.execute = true;
    } else if (argument === "--yes") {
      options.confirmed = true;
    } else if (argument === "--dry-run") {
      options.execute = false;
    } else if (argument === "--library") {
      options.library = requireValue(argv, ++index, argument);
    } else if (argument === "--output-dir") {
      options.outputDir = requireValue(argv, ++index, argument);
    } else if (argument === "--review-dir") {
      options.reviewDirs.push(requireValue(argv, ++index, argument));
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  if (options.reviewDirs.length === 0) {
    options.reviewDirs = [...DEFAULT_REVIEW_DIRS];
  }
  if (options.execute && !options.confirmed) {
    throw new Error("Execution requires both --execute and --yes.");
  }
  return options;
}

export function collectReviewRows(reviewDirs) {
  const rows = [];
  for (const reviewDir of reviewDirs) {
    assertDirectory(reviewDir);
    const manifests = walkFiles(reviewDir).filter((filePath) =>
      REVIEW_MANIFEST_PATTERN.test(path.basename(filePath)),
    );
    if (manifests.length !== 1) {
      throw new Error(
        `Expected one Wall audio asset manifest in ${reviewDir}; found ${manifests.length}.`,
      );
    }
    const parsed = readJson(manifests[0]);
    const manifestRows = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.assets)
        ? parsed.assets
        : [parsed];
    for (const row of manifestRows) {
      const taggedAudioPath = resolveTaggedAudioPath(reviewDir, row.storagePath);
      assertFile(taggedAudioPath);
      rows.push({
        ...row,
        reviewDirectory: reviewDir,
        reviewManifest: manifests[0],
        taggedAudioPath,
      });
    }
  }
  return rows;
}

export function buildReviewedPlan({ sources, existingAssets, reviewRows }) {
  const sourceByRawName = new Map(
    sources.map((source) => [
      path.parse(source.originalUploadName).name.toLowerCase(),
      source,
    ]),
  );
  const reviewedSourceIds = new Set();
  const reviewedAssets = reviewRows.map((row) => {
    const match = REVIEW_ASSET_PATTERN.exec(String(row.id));
    const sourceMatch = RAW_SOURCE_PATTERN.exec(String(row.sourceAudioId));
    if (!match || !sourceMatch || match[1] !== sourceMatch[1]) {
      throw new Error(`Invalid reviewed asset/source mapping: ${row.id}`);
    }
    const rawSourceName = `wall_text_audio_${sourceMatch[1]}`.toLowerCase();
    const source = sourceByRawName.get(rawSourceName);
    if (!source) {
      throw new Error(`No V2 source mapping found for ${row.sourceAudioId}.`);
    }
    reviewedSourceIds.add(source.sourceAudioId);
    return mapReviewedAsset(row, source.sourceAudioId, match[2] ?? null);
  });

  const expectedReviewedRawSources = Array.from({ length: 48 }, (_, index) =>
    `wall_text_audio_${String(index + 8).padStart(3, "0")}`,
  );
  const actualReviewedRawSources = new Set(
    reviewRows.map((row) => String(row.sourceAudioId).toLowerCase()),
  );
  const missingRawSources = expectedReviewedRawSources.filter(
    (name) => !actualReviewedRawSources.has(name),
  );
  if (missingRawSources.length > 0) {
    throw new Error(
      `Human review coverage is incomplete: ${missingRawSources.join(", ")}.`,
    );
  }

  const retainedAssets = existingAssets.filter(
    (asset) => !reviewedSourceIds.has(asset.sourceAudioId),
  );
  const pendingRetained = retainedAssets.filter(
    (asset) => asset.reviewStatus !== "approved" || asset.status !== "active",
  );
  if (pendingRetained.length > 0) {
    throw new Error(
      `Unreviewed assets remain outside the supplied review folders: ${pendingRetained.map((asset) => asset.id).join(", ")}.`,
    );
  }

  const finalAssets = [...retainedAssets, ...reviewedAssets].sort((left, right) =>
    left.id.localeCompare(right.id, "en", { numeric: true }),
  );
  validatePlanCounts({
    sources,
    reviewRows,
    reviewedSourceIds,
    reviewedAssets,
    retainedAssets,
    finalAssets,
  });
  validateAssetMetadata(sources, finalAssets);

  return {
    finalAssets,
    retainedAssets,
    reviewedAssets,
    reviewedSourceIds,
  };
}

export function mapReviewedAsset(row, sourceAudioId, segmentNumber) {
  const id = segmentNumber
    ? `${sourceAudioId}_segment_${segmentNumber}`
    : sourceAudioId;
  const sourceStartSeconds = finiteNumber(row.startTime, `${row.id} startTime`);
  const sourceEndSeconds = finiteNumber(row.endTime, `${row.id} endTime`);
  if (sourceStartSeconds < 0 || sourceEndSeconds <= sourceStartSeconds) {
    throw new Error(`Invalid reviewed segment bounds for ${row.id}.`);
  }
  const reviewedDuration = finiteNumber(row.duration, `${row.id} duration`);
  if (Math.abs(reviewedDuration - (sourceEndSeconds - sourceStartSeconds)) > 0.1) {
    throw new Error(`Reviewed duration does not match segment bounds for ${row.id}.`);
  }

  return {
    id,
    sourceAudioId,
    storagePath: `audio-usable/${id}.mp3`,
    sourceStartSeconds,
    sourceEndSeconds,
    cueStartSeconds: 0,
    durationSeconds: reviewedDuration,
    moods: normalizeTagList(row.moods),
    messageTypes: normalizeTagList(row.hookTypes ?? row.messageTypes),
    energy: String(row.energy ?? "").trim().toLowerCase(),
    loopable: row.loopable,
    reviewStatus: "approved",
    reviewedAt: REVIEWED_AT,
    reviewNotes:
      "Owner listened to this usable segment and approved its semantic tags, energy, and loopability.",
    status: "active",
    preparationNote: String(row.preparationNote ?? "Human-reviewed Wall audio."),
    normalization: null,
    technical: { ...(row.technical ?? {}) },
    reviewSource: {
      originalAssetId: row.id,
      fieldConversion: "hookTypes -> messageTypes",
      humanListeningConfirmed: true,
    },
  };
}

async function main() {
  const options = parseReviewedArgs(process.argv.slice(2));
  const sourceDocument = readJson(
    path.join(options.library, "metadata", "audio_sources.json"),
  );
  const assetDocument = readJson(
    path.join(options.library, "metadata", "wall_audio_assets.json"),
  );
  const duplicateDocument = readJson(
    path.join(options.library, "metadata", "duplicate_report.json"),
  );
  const reviewRows = collectReviewRows(options.reviewDirs);
  const plan = buildReviewedPlan({
    sources: sourceDocument.sources,
    existingAssets: assetDocument.assets,
    reviewRows,
  });

  printPlan({
    options,
    sources: sourceDocument.sources,
    reviewRows,
    plan,
  });
  if (!options.execute) {
    console.log("Dry run complete. No files were written.");
    return;
  }

  prepareReviewedLibrary({
    options,
    sourceDocument,
    assetDocument,
    duplicateDocument,
    plan,
  });
}

function prepareReviewedLibrary({
  options,
  sourceDocument,
  duplicateDocument,
  plan,
}) {
  const outputDir = path.resolve(options.outputDir);
  if (existsSync(outputDir)) {
    throw new Error(
      `Output directory already exists; refusing to overwrite it: ${outputDir}`,
    );
  }
  const partialDir = `${outputDir}.partial-${process.pid}`;
  if (existsSync(partialDir)) {
    throw new Error(`Partial directory already exists: ${partialDir}`);
  }

  const metadataDir = path.join(partialDir, "metadata");
  mkdirSync(path.join(partialDir, "audio-originals"), { recursive: true });
  mkdirSync(path.join(partialDir, "audio-usable"), { recursive: true });
  mkdirSync(metadataDir, { recursive: true });

  try {
    for (const source of sourceDocument.sources) {
      copyFileSync(
        path.join(options.library, source.originalFile),
        path.join(partialDir, source.originalFile),
      );
    }
    for (const asset of plan.retainedAssets) {
      copyFileSync(
        path.join(options.library, asset.storagePath),
        path.join(partialDir, asset.storagePath),
      );
    }

    const sourceById = new Map(
      sourceDocument.sources.map((source) => [source.sourceAudioId, source]),
    );
    const preparedReviewedAssets = [];
    for (const [index, asset] of plan.reviewedAssets.entries()) {
      const source = sourceById.get(asset.sourceAudioId);
      console.log(
        `Normalizing reviewed ${index + 1}/${plan.reviewedAssets.length}: ${asset.id}`,
      );
      const normalized = normalizeAudio({
        inputPath: path.join(options.library, source.originalFile),
        outputPath: path.join(partialDir, asset.storagePath),
        startSeconds: asset.sourceStartSeconds,
        endSeconds: asset.sourceEndSeconds,
      });
      preparedReviewedAssets.push({
        ...asset,
        durationSeconds: normalized.durationSeconds,
        normalization: normalized.normalization,
        technical: {
          ...asset.technical,
          codec: normalized.probe.codec,
          sampleRateHz: normalized.probe.sampleRateHz,
          channels: normalized.probe.channels,
          bitrate: normalized.probe.bitrate,
        },
      });
    }

    const finalAssets = [
      ...plan.retainedAssets,
      ...preparedReviewedAssets,
    ].sort((left, right) =>
      left.id.localeCompare(right.id, "en", { numeric: true }),
    );
    validateAssetMetadata(sourceDocument.sources, finalAssets);
    validateOutputFiles(partialDir, sourceDocument.sources, finalAssets);

    const generatedAt = new Date().toISOString();
    const summary = {
      rawUploadCount: duplicateDocument.rawUploadCount,
      uniqueSourceCount: sourceDocument.sources.length,
      usableAssetCount: finalAssets.length,
      approvedAssetCount: finalAssets.length,
      pendingReviewAssetCount: 0,
      humanReviewedNewSourceCount: plan.reviewedSourceIds.size,
      humanReviewedNewAssetCount: preparedReviewedAssets.length,
    };
    const finalSourceDocument = {
      ...sourceDocument,
      schemaVersion: WALL_AUDIO_SOURCE_SCHEMA_VERSION,
      preparationVersion: WALL_AUDIO_PREPARATION_VERSION,
      generatedAt,
    };
    const finalAssetDocument = {
      schemaVersion: WALL_AUDIO_LIBRARY_SCHEMA_VERSION,
      preparationVersion: WALL_AUDIO_PREPARATION_VERSION,
      generatedAt,
      normalizationTarget: NORMALIZATION_TARGET,
      controlledVocabulary: CONTROLLED_VOCABULARY,
      summary,
      assets: finalAssets,
    };
    const finalDuplicateDocument = {
      ...duplicateDocument,
      generatedAt,
      uniqueSourceCount: sourceDocument.sources.length,
    };
    const sourceNameById = new Map(
      sourceDocument.sources.map((source) => [
        source.sourceAudioId,
        source.originalUploadName,
      ]),
    );

    writeJson(path.join(metadataDir, "audio_sources.json"), finalSourceDocument);
    writeJson(
      path.join(metadataDir, "wall_audio_assets.json"),
      finalAssetDocument,
    );
    writeJson(
      path.join(metadataDir, "duplicate_report.json"),
      finalDuplicateDocument,
    );
    writeFileSync(
      path.join(metadataDir, "wall_audio_assets_review.csv"),
      toReviewCsv(finalAssets, sourceNameById),
      "utf8",
    );
    writeFileSync(
      path.join(partialDir, "README.md"),
      createReadme(summary),
      "utf8",
    );
    renameSync(partialDir, outputDir);
    console.log(`Reviewed Wall audio V2 library created: ${outputDir}`);
  } catch (error) {
    rmSync(partialDir, { recursive: true, force: true });
    throw error;
  }
}

function validatePlanCounts({
  sources,
  reviewRows,
  reviewedSourceIds,
  reviewedAssets,
  retainedAssets,
  finalAssets,
}) {
  const splitSources = new Map();
  for (const asset of reviewedAssets) {
    splitSources.set(
      asset.sourceAudioId,
      (splitSources.get(asset.sourceAudioId) ?? 0) + 1,
    );
  }
  const segmented = [...splitSources.entries()].filter(([, count]) => count > 1);
  if (
    sources.length !== 66 ||
    reviewRows.length !== 50 ||
    reviewedSourceIds.size !== 48 ||
    reviewedAssets.length !== 50 ||
    retainedAssets.length !== 28 ||
    finalAssets.length !== 78 ||
    segmented.length !== 2
  ) {
    throw new Error(
      `Unexpected reviewed-library counts: sources=${sources.length}, reviewRows=${reviewRows.length}, reviewedSources=${reviewedSourceIds.size}, reviewedAssets=${reviewedAssets.length}, retained=${retainedAssets.length}, final=${finalAssets.length}, segmentedSources=${segmented.length}.`,
    );
  }
}

function validateAssetMetadata(sources, assets) {
  assertUnique(sources.map((source) => source.sourceAudioId), "source ID");
  assertUnique(assets.map((asset) => asset.id), "asset ID");
  const sourceIds = new Set(sources.map((source) => source.sourceAudioId));
  for (const asset of assets) {
    if (!sourceIds.has(asset.sourceAudioId)) {
      throw new Error(`Missing source for ${asset.id}.`);
    }
    if (asset.reviewStatus !== "approved" || asset.status !== "active") {
      throw new Error(`${asset.id} is not approved and active.`);
    }
    if (!Number.isFinite(asset.durationSeconds) || asset.durationSeconds <= 0) {
      throw new Error(`${asset.id} has an invalid duration.`);
    }
    validateTags(asset);
    if (asset.normalization) {
      const lufsDifference = Math.abs(
        asset.normalization.measuredIntegratedLufs -
          NORMALIZATION_TARGET.integratedLufs,
      );
      if (lufsDifference > NORMALIZATION_TARGET.maximumIntegratedLufsError) {
        throw new Error(`${asset.id} misses the LUFS target.`);
      }
      if (
        asset.normalization.measuredTruePeakDb >
        NORMALIZATION_TARGET.maximumMeasuredTruePeakDb
      ) {
        throw new Error(`${asset.id} exceeds the true-peak target.`);
      }
    }
  }
}

function validateTags(asset) {
  if (
    !Array.isArray(asset.moods) ||
    asset.moods.length === 0 ||
    !asset.moods.every((value) => CONTROLLED_VOCABULARY.moods.includes(value))
  ) {
    throw new Error(`${asset.id} has invalid mood tags.`);
  }
  if (
    !Array.isArray(asset.messageTypes) ||
    asset.messageTypes.length === 0 ||
    !asset.messageTypes.every((value) =>
      CONTROLLED_VOCABULARY.messageTypes.includes(value),
    )
  ) {
    throw new Error(`${asset.id} has invalid messageTypes.`);
  }
  if (!CONTROLLED_VOCABULARY.energy.includes(asset.energy)) {
    throw new Error(`${asset.id} has invalid energy.`);
  }
  if (typeof asset.loopable !== "boolean") {
    throw new Error(`${asset.id} has no loopability decision.`);
  }
}

function validateOutputFiles(outputDir, sources, assets) {
  for (const source of sources) {
    assertFile(path.join(outputDir, source.originalFile));
  }
  for (const asset of assets) {
    assertFile(path.join(outputDir, asset.storagePath));
  }
}

function printPlan({ options, sources, reviewRows, plan }) {
  const segmentedSourceCount = new Set(
    plan.reviewedAssets
      .filter((asset) => asset.id.includes("_segment_"))
      .map((asset) => asset.sourceAudioId),
  ).size;
  console.log("Reviewed Wall audio V2 preparation plan");
  console.log(`Mode: ${options.execute ? "execute" : "dry-run"}`);
  console.log(`Protected V2 sources: ${sources.length}`);
  console.log(`Human-reviewed manifest rows: ${reviewRows.length}`);
  console.log(`Human-reviewed source files: ${plan.reviewedSourceIds.size}`);
  console.log(`Segmented source files: ${segmentedSourceCount}`);
  console.log(`Existing approved assets retained: ${plan.retainedAssets.length}`);
  console.log(`Reviewed assets to normalize: ${plan.reviewedAssets.length}`);
  console.log(`Final approved assets: ${plan.finalAssets.length}`);
  console.log("Tag conversion: hookTypes -> messageTypes (values unchanged)");
  console.log(`Output: ${options.outputDir}`);
}

function createReadme(summary) {
  return (
    "# Wall Audio Library V2 — Human Reviewed\n\n" +
    `- Raw uploads audited: ${summary.rawUploadCount}\n` +
    `- Unique protected sources: ${summary.uniqueSourceCount}\n` +
    `- Approved usable assets: ${summary.approvedAssetCount}\n` +
    `- Pending assets: ${summary.pendingReviewAssetCount}\n` +
    `- Newly human-reviewed sources: ${summary.humanReviewedNewSourceCount}\n` +
    `- Newly human-reviewed usable assets: ${summary.humanReviewedNewAssetCount}\n` +
    `- Loudness target: ${NORMALIZATION_TARGET.integratedLufs} LUFS integrated\n` +
    `- Encoder true-peak target: ${NORMALIZATION_TARGET.truePeakDb} dBTP\n` +
    `- Output: MP3, ${NORMALIZATION_TARGET.sampleRateHz} Hz, stereo, ${NORMALIZATION_TARGET.bitrate}\n\n` +
    "The owner confirmed listening review for every newly supplied usable segment. Legacy hookTypes fields were renamed to production messageTypes without changing tag values.\n"
  );
}

function resolveTaggedAudioPath(reviewDir, storagePath) {
  const relative = String(storagePath ?? "").replaceAll("/", path.sep);
  const direct = path.join(reviewDir, relative);
  if (existsSync(direct)) return direct;
  const flat = path.join(reviewDir, path.basename(relative));
  if (existsSync(flat)) return flat;
  return direct;
}

function walkFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(fullPath) : [fullPath];
  });
}

function normalizeTagList(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((tag) => String(tag).trim().toLowerCase()))];
}

function finiteNumber(value, label) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) throw new Error(`${label} must be a number.`);
  return numeric;
}

function readJson(filePath) {
  assertFile(filePath);
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function assertFile(filePath) {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    throw new Error(`Required file not found: ${filePath}`);
  }
}

function assertDirectory(directory) {
  if (!existsSync(directory) || !statSync(directory).isDirectory()) {
    throw new Error(`Required directory not found: ${directory}`);
  }
}

function assertUnique(values, label) {
  if (new Set(values).size !== values.length) {
    throw new Error(`Duplicate ${label} detected.`);
  }
}

function requireValue(argv, index, argument) {
  const value = argv[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`${argument} requires a value.`);
  }
  return value;
}

const isMain =
  process.argv[1] &&
  fileURLToPath(import.meta.url).toLowerCase() ===
    path.resolve(process.argv[1]).toLowerCase();

if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
