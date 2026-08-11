import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
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

export const WALL_AUDIO_LIBRARY_SCHEMA_VERSION = "wall-audio-library-v2";
export const WALL_AUDIO_SOURCE_SCHEMA_VERSION = "wall-audio-sources-v2";
export const WALL_AUDIO_PREPARATION_VERSION = "wall-audio-preparation-v2";
export const NORMALIZATION_TARGET = Object.freeze({
  integratedLufs: -14,
  maximumIntegratedLufsError: 1,
  truePeakDb: -2.2,
  maximumMeasuredTruePeakDb: -1.5,
  loudnessRange: 11,
  sampleRateHz: 48_000,
  channels: 2,
  bitrate: "192k",
});

const DEFAULT_EXISTING_LIBRARY =
  "D:\\walloftext_sound\\wall_audio_library_v1";
const DEFAULT_REMAINING_SOURCE_DIR = "D:\\walloftext_sound";
const DEFAULT_OUTPUT_DIR =
  "D:\\walloftext_sound\\wall_audio_library_v2";
const NEW_SOURCE_FILE_PATTERN = /^wall_text_audio_\d+\.mp3$/i;
const NULL_OUTPUT = process.platform === "win32" ? "NUL" : "/dev/null";

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

export function parseArgs(argv) {
  const options = {
    existingLibrary: DEFAULT_EXISTING_LIBRARY,
    remainingSourceDir: DEFAULT_REMAINING_SOURCE_DIR,
    outputDir: DEFAULT_OUTPUT_DIR,
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
    } else if (argument === "--existing-library") {
      options.existingLibrary = requireValue(argv, ++index, argument);
    } else if (argument === "--remaining-source-dir") {
      options.remainingSourceDir = requireValue(argv, ++index, argument);
    } else if (argument === "--output-dir") {
      options.outputDir = requireValue(argv, ++index, argument);
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  if (options.execute && !options.confirmed) {
    throw new Error("Execution requires both --execute and --yes.");
  }

  return options;
}

export function naturalAudioNameCompare(left, right) {
  return left.localeCompare(right, "en", {
    numeric: true,
    sensitivity: "base",
  });
}

export function nextSourceId(existingIds, offset = 0) {
  const largest = existingIds.reduce((maximum, id) => {
    const match = /^audio_(\d+)$/.exec(id);
    return match ? Math.max(maximum, Number(match[1])) : maximum;
  }, 0);
  return `audio_${String(largest + offset + 1).padStart(3, "0")}`;
}

export function detectSilenceBounds(output, durationSeconds) {
  const starts = [...output.matchAll(/silence_start:\s*([0-9.]+)/g)].map(
    (match) => Number(match[1]),
  );
  const endings = [
    ...output.matchAll(
      /silence_end:\s*([0-9.]+)\s*\|\s*silence_duration:\s*([0-9.]+)/g,
    ),
  ].map((match) => ({
    end: Number(match[1]),
    duration: Number(match[2]),
  }));

  let startSeconds = 0;
  if (
    starts.length > 0 &&
    endings.length > 0 &&
    starts[0] <= 0.01 &&
    endings[0].duration >= 0.1
  ) {
    startSeconds = endings[0].end;
  }

  let endSeconds = durationSeconds;
  const lastStart = starts.at(-1);
  const lastEnding = endings.at(-1);
  if (
    lastStart !== undefined &&
    lastEnding &&
    lastEnding.duration >= 0.3 &&
    lastEnding.end >= durationSeconds - 0.15
  ) {
    endSeconds = lastStart;
  }

  if (endSeconds - startSeconds < 1) {
    return { startSeconds: 0, endSeconds: durationSeconds };
  }

  return {
    startSeconds: round(startSeconds, 3),
    endSeconds: round(endSeconds, 3),
  };
}

export function migrateExistingAsset(asset, normalizedResult) {
  return {
    id: asset.id,
    sourceAudioId: asset.sourceAudioId,
    storagePath: asset.storagePath,
    sourceStartSeconds: numberOr(asset.startTime, 0),
    sourceEndSeconds: numberOr(
      asset.endTime,
      numberOr(asset.duration, normalizedResult.durationSeconds),
    ),
    cueStartSeconds: 0,
    durationSeconds: normalizedResult.durationSeconds,
    moods: [...(asset.moods ?? [])],
    messageTypes: [...(asset.hookTypes ?? asset.messageTypes ?? [])],
    energy: asset.energy ?? null,
    loopable: asset.loopable ?? null,
    reviewStatus: "approved",
    reviewedAt: "2026-08-09",
    reviewNotes:
      "Existing V1 semantic tags retained after owner listening review.",
    status: asset.status === "active" ? "active" : asset.status,
    preparationNote: asset.preparationNote ?? "Migrated from V1.",
    normalization: normalizedResult.normalization,
    technical: {
      ...(asset.technical ?? {}),
      codec: normalizedResult.probe.codec,
      sampleRateHz: normalizedResult.probe.sampleRateHz,
      channels: normalizedResult.probe.channels,
      bitrate: normalizedResult.probe.bitrate,
    },
  };
}

export function createPendingAsset({
  sourceAudioId,
  sourceFileName,
  sourceStartSeconds,
  sourceEndSeconds,
  normalizedResult,
}) {
  const trimmedStart = sourceStartSeconds > 0;
  const trimmedEnd =
    sourceEndSeconds < normalizedResult.sourceDurationSeconds - 0.1;
  const notes = ["Normalized from remaining Wall audio batch."];
  if (trimmedStart) notes.push("Leading silence removed.");
  if (trimmedEnd) notes.push("Trailing silence or fade-out removed.");

  return {
    id: sourceAudioId,
    sourceAudioId,
    storagePath: `audio-usable/${sourceAudioId}.mp3`,
    sourceStartSeconds,
    sourceEndSeconds,
    cueStartSeconds: 0,
    durationSeconds: normalizedResult.durationSeconds,
    moods: [],
    messageTypes: [],
    energy: null,
    loopable: null,
    reviewStatus: "pending",
    reviewedAt: null,
    reviewNotes: `Listen to ${sourceFileName} and approve mood, message type, energy, loopability, and whether a long track needs segmentation.`,
    status: "pending_review",
    preparationNote: notes.join(" "),
    normalization: normalizedResult.normalization,
    technical: {
      codec: normalizedResult.probe.codec,
      sampleRateHz: normalizedResult.probe.sampleRateHz,
      channels: normalizedResult.probe.channels,
      bitrate: normalizedResult.probe.bitrate,
    },
  };
}

export function toReviewCsv(assets, sourceNameById) {
  const headers = [
    "id",
    "sourceAudioId",
    "originalUploadName",
    "durationSeconds",
    "moods",
    "messageTypes",
    "energy",
    "loopable",
    "reviewStatus",
    "status",
    "reviewNotes",
  ];
  const rows = assets.map((asset) => [
    asset.id,
    asset.sourceAudioId,
    sourceNameById.get(asset.sourceAudioId) ?? "",
    asset.durationSeconds,
    asset.moods.join("|"),
    asset.messageTypes.join("|"),
    asset.energy ?? "",
    asset.loopable ?? "",
    asset.reviewStatus,
    asset.status,
    asset.reviewNotes,
  ]);
  return [headers, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\n")
    .concat("\n");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const inventory = await buildInventory(options);

  printInventory(inventory, options);
  if (!options.execute) {
    console.log("Dry run complete. No files were written.");
    return;
  }

  prepareLibrary(inventory, options);
}

async function buildInventory(options) {
  const existingMetadataDir = path.join(options.existingLibrary, "metadata");
  const existingSources = unwrapRows(
    readJson(path.join(existingMetadataDir, "audio_sources.json")),
    "sources",
  );
  const existingAssets = unwrapRows(
    readJson(path.join(existingMetadataDir, "wall_audio_assets.json")),
    "assets",
  );
  const previousDuplicateReport = readJson(
    path.join(existingMetadataDir, "duplicate_report.json"),
  );

  const existingSourceRows = existingSources.map((source) => {
    const sourceAudioId = source.sourceAudioId ?? source.id;
    const originalPath = path.join(
      options.existingLibrary,
      source.originalFile ?? source.storagePath,
    );
    assertFile(originalPath);
    return {
      sourceAudioId,
      originalUploadName:
        source.originalUploadName ?? source.originalFilename,
      originalPath,
      originalRelativePath: `audio-originals/${sourceAudioId}.mp3`,
      originalDurationSeconds: probeAudio(originalPath).durationSeconds,
      fileSizeBytes: statSync(originalPath).size,
      sha256: hashFile(originalPath),
      status: source.status ?? "active",
    };
  });

  const knownHashes = new Map(
    existingSourceRows.map((source) => [source.sha256, source]),
  );
  const remainingFiles = readdirSync(options.remainingSourceDir, {
    withFileTypes: true,
  })
    .filter(
      (entry) => entry.isFile() && NEW_SOURCE_FILE_PATTERN.test(entry.name),
    )
    .map((entry) => entry.name)
    .sort(naturalAudioNameCompare);

  const remainingSources = [];
  const newlyFoundDuplicates = [];
  const assignedHashes = new Map(knownHashes);
  for (const fileName of remainingFiles) {
    const sourcePath = path.join(options.remainingSourceDir, fileName);
    const sha256 = hashFile(sourcePath);
    const duplicate = assignedHashes.get(sha256);
    if (duplicate) {
      newlyFoundDuplicates.push({
        removedFile: fileName,
        duplicateOf: duplicate.originalUploadName,
        sha256,
        matchType: "exact SHA-256 duplicate",
      });
      continue;
    }

    const sourceAudioId = nextSourceId(
      existingSourceRows.map((source) => source.sourceAudioId),
      remainingSources.length,
    );
    const probe = probeAudio(sourcePath);
    const source = {
      sourceAudioId,
      originalUploadName: fileName,
      originalPath: sourcePath,
      originalRelativePath: `audio-originals/${sourceAudioId}.mp3`,
      originalDurationSeconds: probe.durationSeconds,
      fileSizeBytes: statSync(sourcePath).size,
      sha256,
      status: "active",
      probe,
    };
    remainingSources.push(source);
    assignedHashes.set(sha256, source);
  }

  const existingAssetRows = existingAssets.map((asset) => ({
    metadata: asset,
    inputPath: path.join(options.existingLibrary, asset.storagePath),
  }));
  existingAssetRows.forEach((asset) => assertFile(asset.inputPath));

  return {
    existingSourceRows,
    existingAssetRows,
    remainingSources,
    previousDuplicateReport,
    newlyFoundDuplicates,
    rawUploadCount:
      numberOr(previousDuplicateReport.uploadedCount, existingSourceRows.length) +
      remainingFiles.length,
  };
}

function printInventory(inventory, options) {
  console.log("Wall audio V2 preparation plan");
  console.log(`Mode: ${options.execute ? "execute" : "dry-run"}`);
  console.log(`Existing V1 sources: ${inventory.existingSourceRows.length}`);
  console.log(`Existing V1 usable assets: ${inventory.existingAssetRows.length}`);
  console.log(`Remaining unique sources: ${inventory.remainingSources.length}`);
  console.log(`Raw upload count: ${inventory.rawUploadCount}`);
  console.log(
    `Expected unique source count: ${
      inventory.existingSourceRows.length + inventory.remainingSources.length
    }`,
  );
  console.log(
    `Expected initial usable asset count: ${
      inventory.existingAssetRows.length + inventory.remainingSources.length
    }`,
  );
  console.log(
    `New cross-batch exact duplicates: ${inventory.newlyFoundDuplicates.length}`,
  );
  console.log(`Output: ${options.outputDir}`);
}

function prepareLibrary(inventory, options) {
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

  const originalsDir = path.join(partialDir, "audio-originals");
  const usableDir = path.join(partialDir, "audio-usable");
  const metadataDir = path.join(partialDir, "metadata");
  mkdirSync(originalsDir, { recursive: true });
  mkdirSync(usableDir, { recursive: true });
  mkdirSync(metadataDir, { recursive: true });

  const sources = [];
  const assets = [];
  try {
    for (const source of inventory.existingSourceRows) {
      const destination = path.join(partialDir, source.originalRelativePath);
      copyFileSync(source.originalPath, destination);
      sources.push(createSourceMetadata(source, probeAudio(destination)));
    }

    for (const entry of inventory.existingAssetRows) {
      console.log(`Normalizing existing ${entry.metadata.id}...`);
      const destination = path.join(partialDir, entry.metadata.storagePath);
      const normalizedResult = normalizeAudio({
        inputPath: entry.inputPath,
        outputPath: destination,
        startSeconds: 0,
        endSeconds: null,
      });
      assets.push(migrateExistingAsset(entry.metadata, normalizedResult));
    }

    for (const source of inventory.remainingSources) {
      const originalDestination = path.join(
        partialDir,
        source.originalRelativePath,
      );
      copyFileSync(source.originalPath, originalDestination);
      sources.push(createSourceMetadata(source, probeAudio(originalDestination)));

      const silenceOutput = detectSilence(source.originalPath);
      const bounds = detectSilenceBounds(
        silenceOutput,
        source.originalDurationSeconds,
      );
      console.log(
        `Normalizing new ${source.sourceAudioId} (${source.originalUploadName})...`,
      );
      const usablePath = path.join(
        usableDir,
        `${source.sourceAudioId}.mp3`,
      );
      const normalizedResult = normalizeAudio({
        inputPath: source.originalPath,
        outputPath: usablePath,
        startSeconds: bounds.startSeconds,
        endSeconds: bounds.endSeconds,
      });
      normalizedResult.sourceDurationSeconds = source.originalDurationSeconds;
      assets.push(
        createPendingAsset({
          sourceAudioId: source.sourceAudioId,
          sourceFileName: source.originalUploadName,
          sourceStartSeconds: bounds.startSeconds,
          sourceEndSeconds: bounds.endSeconds,
          normalizedResult,
        }),
      );
    }

    validatePreparedLibrary(sources, assets, partialDir);
    writeMetadata({
      sources,
      assets,
      inventory,
      partialDir,
      metadataDir,
    });
    renameSync(partialDir, outputDir);
    console.log(`Wall audio V2 library created: ${outputDir}`);
  } catch (error) {
    rmSync(partialDir, { recursive: true, force: true });
    throw error;
  }
}

function createSourceMetadata(source, probe) {
  return {
    sourceAudioId: source.sourceAudioId,
    originalUploadName: source.originalUploadName,
    originalFile: source.originalRelativePath,
    originalDurationSeconds: probe.durationSeconds,
    sha256: hashFile(source.originalPath),
    fileSizeBytes: statSync(source.originalPath).size,
    codec: probe.codec,
    sampleRateHz: probe.sampleRateHz,
    channels: probe.channels,
    status: source.status,
  };
}

export function normalizeAudio({
  inputPath,
  outputPath,
  startSeconds,
  endSeconds,
}) {
  mkdirSync(path.dirname(outputPath), { recursive: true });
  const trimFilter = createTrimFilter(startSeconds, endSeconds);
  const firstPass = measureLoudness(inputPath, trimFilter);
  const loudnorm = [
    `loudnorm=I=${NORMALIZATION_TARGET.integratedLufs}`,
    `TP=${NORMALIZATION_TARGET.truePeakDb}`,
    `LRA=${NORMALIZATION_TARGET.loudnessRange}`,
    `measured_I=${firstPass.input_i}`,
    `measured_TP=${firstPass.input_tp}`,
    `measured_LRA=${firstPass.input_lra}`,
    `measured_thresh=${firstPass.input_thresh}`,
    `offset=${firstPass.target_offset}`,
    "linear=true",
    "print_format=summary",
  ].join(":");
  const filters = [trimFilter, loudnorm, "aresample=48000"]
    .filter(Boolean)
    .join(",");
  const temporaryOutput = `${outputPath}.tmp.mp3`;

  run(ffmpegStatic, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-nostdin",
    "-i",
    inputPath,
    "-vn",
    "-af",
    filters,
    "-ar",
    String(NORMALIZATION_TARGET.sampleRateHz),
    "-ac",
    String(NORMALIZATION_TARGET.channels),
    "-c:a",
    "libmp3lame",
    "-b:a",
    NORMALIZATION_TARGET.bitrate,
    temporaryOutput,
  ]);
  renameSync(temporaryOutput, outputPath);

  const outputProbe = probeAudio(outputPath);
  const outputLoudness = measureLoudness(outputPath, "");
  return {
    durationSeconds: outputProbe.durationSeconds,
    probe: outputProbe,
    normalization: {
      targetIntegratedLufs: NORMALIZATION_TARGET.integratedLufs,
      targetTruePeakDb: NORMALIZATION_TARGET.truePeakDb,
      sourceIntegratedLufs: Number(firstPass.input_i),
      sourceTruePeakDb: Number(firstPass.input_tp),
      measuredIntegratedLufs: Number(outputLoudness.input_i),
      measuredTruePeakDb: Number(outputLoudness.input_tp),
    },
  };
}

function createTrimFilter(startSeconds, endSeconds) {
  const filters = [];
  if (startSeconds > 0 || endSeconds !== null) {
    const options = [];
    if (startSeconds > 0) options.push(`start=${startSeconds}`);
    if (endSeconds !== null) options.push(`end=${endSeconds}`);
    filters.push(`atrim=${options.join(":")}`, "asetpts=PTS-STARTPTS");
  }
  return filters.join(",");
}

function measureLoudness(inputPath, prefixFilter) {
  const loudnorm = [
    `loudnorm=I=${NORMALIZATION_TARGET.integratedLufs}`,
    `TP=${NORMALIZATION_TARGET.truePeakDb}`,
    `LRA=${NORMALIZATION_TARGET.loudnessRange}`,
    "print_format=json",
  ].join(":");
  const filters = [prefixFilter, loudnorm].filter(Boolean).join(",");
  const result = run(ffmpegStatic, [
    "-hide_banner",
    "-nostats",
    "-nostdin",
    "-i",
    inputPath,
    "-vn",
    "-af",
    filters,
    "-f",
    "null",
    NULL_OUTPUT,
  ]);
  const matches = result.stderr.match(/\{\s*"input_i"[\s\S]*?\}/g);
  if (!matches?.length) {
    throw new Error(`Could not read loudness data for ${inputPath}`);
  }
  return JSON.parse(matches.at(-1));
}

function detectSilence(inputPath) {
  return run(ffmpegStatic, [
    "-hide_banner",
    "-nostats",
    "-nostdin",
    "-i",
    inputPath,
    "-vn",
    "-af",
    "silencedetect=noise=-45dB:d=0.15",
    "-f",
    "null",
    NULL_OUTPUT,
  ]).stderr;
}

function probeAudio(filePath) {
  const result = run(ffprobeStatic.path, [
    "-v",
    "error",
    "-show_entries",
    "format=duration:stream=codec_name,sample_rate,channels,bit_rate",
    "-of",
    "json",
    filePath,
  ]);
  const parsed = JSON.parse(result.stdout);
  const stream = parsed.streams?.[0];
  if (!stream || !parsed.format?.duration) {
    throw new Error(`No readable audio stream: ${filePath}`);
  }
  return {
    durationSeconds: round(Number(parsed.format.duration), 3),
    codec: stream.codec_name,
    sampleRateHz: Number(stream.sample_rate),
    channels: Number(stream.channels),
    bitrate: Number(stream.bit_rate ?? 0),
  };
}

function validatePreparedLibrary(sources, assets, outputDir) {
  assertUnique(sources.map((source) => source.sourceAudioId), "source ID");
  assertUnique(sources.map((source) => source.sha256), "source hash");
  assertUnique(assets.map((asset) => asset.id), "asset ID");
  const sourceIds = new Set(sources.map((source) => source.sourceAudioId));

  for (const source of sources) {
    assertFile(path.join(outputDir, source.originalFile));
    if (!/^[a-f0-9]{64}$/.test(source.sha256)) {
      throw new Error(`Invalid SHA-256 for ${source.sourceAudioId}`);
    }
  }

  for (const asset of assets) {
    if (!sourceIds.has(asset.sourceAudioId)) {
      throw new Error(`Missing source for ${asset.id}`);
    }
    assertFile(path.join(outputDir, asset.storagePath));
    if (asset.durationSeconds <= 0) {
      throw new Error(`Invalid duration for ${asset.id}`);
    }
    if (asset.reviewStatus === "approved") {
      validateApprovedTags(asset);
    }
    const loudnessDifference = Math.abs(
      asset.normalization.measuredIntegratedLufs -
        NORMALIZATION_TARGET.integratedLufs,
    );
    if (
      loudnessDifference >
      NORMALIZATION_TARGET.maximumIntegratedLufsError
    ) {
      throw new Error(
        `${asset.id} misses loudness target by ${round(loudnessDifference, 2)} dB`,
      );
    }
    if (
      asset.normalization.measuredTruePeakDb >
      NORMALIZATION_TARGET.maximumMeasuredTruePeakDb
    ) {
      throw new Error(`${asset.id} exceeds the true-peak target.`);
    }
  }
}

function validateApprovedTags(asset) {
  if (!asset.moods.length || !asset.messageTypes.length || !asset.energy) {
    throw new Error(`Approved asset ${asset.id} has incomplete semantic tags.`);
  }
  for (const mood of asset.moods) {
    if (!CONTROLLED_VOCABULARY.moods.includes(mood)) {
      throw new Error(`Unknown mood ${mood} on ${asset.id}`);
    }
  }
  for (const messageType of asset.messageTypes) {
    if (!CONTROLLED_VOCABULARY.messageTypes.includes(messageType)) {
      throw new Error(`Unknown message type ${messageType} on ${asset.id}`);
    }
  }
  if (!CONTROLLED_VOCABULARY.energy.includes(asset.energy)) {
    throw new Error(`Unknown energy ${asset.energy} on ${asset.id}`);
  }
  if (typeof asset.loopable !== "boolean") {
    throw new Error(`Approved asset ${asset.id} needs a loopability decision.`);
  }
}

function writeMetadata({
  sources,
  assets,
  inventory,
  partialDir,
  metadataDir,
}) {
  const generatedAt = new Date().toISOString();
  const approvedCount = assets.filter(
    (asset) => asset.reviewStatus === "approved",
  ).length;
  const pendingCount = assets.filter(
    (asset) => asset.reviewStatus === "pending",
  ).length;
  const sourceDocument = {
    schemaVersion: WALL_AUDIO_SOURCE_SCHEMA_VERSION,
    preparationVersion: WALL_AUDIO_PREPARATION_VERSION,
    generatedAt,
    sources,
  };
  const assetDocument = {
    schemaVersion: WALL_AUDIO_LIBRARY_SCHEMA_VERSION,
    preparationVersion: WALL_AUDIO_PREPARATION_VERSION,
    generatedAt,
    normalizationTarget: NORMALIZATION_TARGET,
    controlledVocabulary: CONTROLLED_VOCABULARY,
    summary: {
      rawUploadCount: inventory.rawUploadCount,
      uniqueSourceCount: sources.length,
      usableAssetCount: assets.length,
      approvedAssetCount: approvedCount,
      pendingReviewAssetCount: pendingCount,
    },
    assets,
  };
  const duplicateDocument = {
    schemaVersion: "wall-audio-duplicate-report-v2",
    generatedAt,
    rawUploadCount: inventory.rawUploadCount,
    uniqueSourceCount: sources.length,
    removedDuplicates: [
      ...(inventory.previousDuplicateReport.removedDuplicates ?? []),
      ...inventory.newlyFoundDuplicates,
    ],
    newCrossBatchDuplicatesFound: inventory.newlyFoundDuplicates.length,
  };
  const sourceNameById = new Map(
    sources.map((source) => [source.sourceAudioId, source.originalUploadName]),
  );

  writeJson(path.join(metadataDir, "audio_sources.json"), sourceDocument);
  writeJson(
    path.join(metadataDir, "wall_audio_assets.json"),
    assetDocument,
  );
  writeJson(
    path.join(metadataDir, "duplicate_report.json"),
    duplicateDocument,
  );
  writeFileSync(
    path.join(metadataDir, "wall_audio_assets_review.csv"),
    toReviewCsv(assets, sourceNameById),
    "utf8",
  );
  writeFileSync(
    path.join(partialDir, "README.md"),
    createReadme(assetDocument.summary),
    "utf8",
  );
}

function createReadme(summary) {
  return `# Wall Audio Library V2\n\n` +
    `- Raw uploads audited: ${summary.rawUploadCount}\n` +
    `- Unique protected sources: ${summary.uniqueSourceCount}\n` +
    `- Initial normalized usable assets: ${summary.usableAssetCount}\n` +
    `- Approved assets carried from V1: ${summary.approvedAssetCount}\n` +
    `- New assets awaiting listening review: ${summary.pendingReviewAssetCount}\n` +
    `- Loudness target: ${NORMALIZATION_TARGET.integratedLufs} LUFS integrated\n` +
    `- Maximum loudness difference: ±${NORMALIZATION_TARGET.maximumIntegratedLufsError} LUFS\n` +
    `- Encoder true-peak target: ${NORMALIZATION_TARGET.truePeakDb} dBTP\n` +
    `- Maximum measured output true peak: ${NORMALIZATION_TARGET.maximumMeasuredTruePeakDb} dBTP\n` +
    `- Output format: MP3, ${NORMALIZATION_TARGET.sampleRateHz} Hz, stereo, ${NORMALIZATION_TARGET.bitrate}\n\n` +
    `New assets remain pending until mood, message type, energy, loopability, and long-track segmentation are reviewed.\n`;
}

function run(executable, args) {
  const result = spawnSync(executable, args, {
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${path.basename(executable)} failed (${result.status}):\n${result.stderr}`,
    );
  }
  return result;
}

function hashFile(filePath) {
  const hash = createHash("sha256");
  const data = readFileSync(filePath);
  hash.update(data);
  return hash.digest("hex");
}

function readJson(filePath) {
  assertFile(filePath);
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function unwrapRows(value, key) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.[key])) return value[key];
  throw new Error(`Expected an array or ${key} array.`);
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function assertFile(filePath) {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    throw new Error(`Required file not found: ${filePath}`);
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

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function numberOr(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function round(value, places) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
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
