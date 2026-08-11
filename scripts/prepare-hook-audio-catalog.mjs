import ffprobeStatic from "ffprobe-static";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const DEFAULT_ROOTS = {
  raw: "D:\\hook sound\\hook_audio_tagging_package_v1\\hook_audio_tagging_package_v1",
  tagged1To20:
    "D:\\hook sound\\hook_audio_tagged_batch_v1\\hook_audio_tagged_batch_v1",
  tagged21To28:
    "D:\\hook sound\\hook_audio_tagged_batch_21_28_v1\\hook_audio_tagged_batch_21_28_v1",
};
const OUTPUT_PATH = path.resolve(
  "scripts/data/hook-audio-catalog-v1.json",
);
const ADDITIONAL_TAGS_PATH = path.resolve(
  "scripts/data/hook-audio-additional-tags-v1.json",
);
const SCHEMA_VERSION = "hook-audio-library-v1";
const MOODS = new Set([
  "curious",
  "uplifting",
  "serious",
  "calm",
  "urgent",
  "playful",
]);
const HOOK_TYPES = new Set([
  "curiosity",
  "problem",
  "warning",
  "transformation",
  "benefit",
  "story",
  "authority",
]);
const ENERGY_LEVELS = new Set(["low", "medium", "high"]);

const args = parseArgs(process.argv.slice(2));
const packages = [
  {
    id: "hook_audio_tagging_package_v1",
    kind: "raw",
    root: path.resolve(String(args.raw || DEFAULT_ROOTS.raw)),
  },
  {
    id: "hook_audio_tagged_batch_v1",
    kind: "tagged",
    root: path.resolve(
      String(args["tagged-1-20"] || DEFAULT_ROOTS.tagged1To20),
    ),
  },
  {
    id: "hook_audio_tagged_batch_21_28_v1",
    kind: "tagged",
    root: path.resolve(
      String(args["tagged-21-28"] || DEFAULT_ROOTS.tagged21To28),
    ),
  },
];

const additionalTags = readAdditionalTags(ADDITIONAL_TAGS_PATH);
const catalog = buildCatalog(packages, additionalTags);
const serialized = `${JSON.stringify(catalog, null, 2)}\n`;

if (args.check) {
  if (!existsSync(OUTPUT_PATH)) {
    throw new Error(`Canonical Hook audio catalog is missing: ${OUTPUT_PATH}`);
  }
  if (readFileSync(OUTPUT_PATH, "utf8") !== serialized) {
    throw new Error(
      "Canonical Hook audio catalog is stale. Run hook-audio:catalog:prepare.",
    );
  }
  console.log(
    `Hook audio catalog is current: ${catalog.summary.uniqueAssets} unique assets, ${catalog.summary.duplicatesExcluded} duplicate excluded.`,
  );
  process.exit(0);
}

mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, serialized);
console.log(`Wrote ${OUTPUT_PATH}`);
console.log(
  `Combined ${catalog.summary.physicalAudioFiles} files into ${catalog.summary.uniqueAssets} unique pending/inactive assets.`,
);

function buildCatalog(sourcePackages, supplementalTags) {
  const packageRows = sourcePackages.map((sourcePackage) => ({
    ...sourcePackage,
    rows: readPackageRows(sourcePackage),
  }));
  const taggedRows = packageRows.flatMap((sourcePackage) =>
    sourcePackage.kind === "tagged"
      ? sourcePackage.rows.map((row) => ({ row, sourcePackage }))
      : [],
  );
  const rawRows = packageRows.flatMap((sourcePackage) =>
    sourcePackage.kind === "raw"
      ? sourcePackage.rows.map((row) => ({ row, sourcePackage }))
      : [],
  );
  taggedRows.sort((left, right) =>
    String(left.row.id).localeCompare(String(right.row.id)),
  );
  rawRows.sort((left, right) =>
    String(left.row.fileName).localeCompare(String(right.row.fileName)),
  );

  const assets = [];
  const duplicates = [];
  const assetByHash = new Map();
  const supplementalByHash = new Map(
    supplementalTags.assets.map((row) => [row.sha256, row]),
  );

  for (const item of taggedRows) {
    validateTaggedRow(item.row);
    const asset = buildAsset({
      id: item.row.id,
      row: item.row,
      sourcePackage: item.sourcePackage,
      tagged: true,
    });
    addUniqueAsset({ asset, assetByHash, assets });
  }

  let nextRawId = 29;
  for (const item of rawRows) {
    validateRawRow(item.row);
    const existing = assetByHash.get(item.row.sha256);

    if (item.row.reviewStatus === "rejected") {
      if (!existing) {
        throw new Error(
          `Rejected source ${item.row.fileName} does not duplicate a canonical asset.`,
        );
      }
      assertSourceBytes(item.sourcePackage.root, item.row);
      duplicates.push({
        canonicalAssetId: existing.id,
        reason: item.row.reviewNotes,
        reviewStatus: "rejected",
        sha256: item.row.sha256,
        sourceFileName: item.row.fileName,
        sourcePackage: item.sourcePackage.id,
      });
      continue;
    }

    if (existing) {
      throw new Error(
        `Unexpected duplicate ${item.row.fileName}; only explicitly rejected duplicates may be excluded.`,
      );
    }

    const id = `hook_audio_${String(nextRawId).padStart(3, "0")}`;
    nextRawId += 1;
    const supplemental = supplementalByHash.get(item.row.sha256);
    if (!supplemental) {
      throw new Error(
        `Missing supplemental semantic tags for ${item.row.fileName}.`,
      );
    }
    if (
      supplemental.id !== id ||
      supplemental.sourceFileName !== item.row.fileName
    ) {
      throw new Error(
        `Supplemental tag identity mismatch for ${item.row.fileName}.`,
      );
    }
    const supplementedRow = {
      ...item.row,
      ...supplemental,
      reviewNotes: [
        String(item.row.reviewNotes || "").trim(),
        "AI-assisted acoustic-profile semantic tags; listening approval is still required before activation.",
      ]
        .filter(Boolean)
        .join(" "),
      reviewStatus: "pending",
      taggingVersion: supplementalTags.schemaVersion,
    };
    validateTaggedRow(supplementedRow);
    const asset = buildAsset({
      id,
      row: supplementedRow,
      sourcePackage: item.sourcePackage,
      tagged: true,
    });
    addUniqueAsset({ asset, assetByHash, assets });
    supplementalByHash.delete(item.row.sha256);
  }

  if (supplementalByHash.size > 0) {
    throw new Error(
      `Supplemental tag manifest contains ${supplementalByHash.size} unused asset(s).`,
    );
  }

  assets.sort((left, right) => left.id.localeCompare(right.id));
  validateCatalog(assets, duplicates);

  return {
    schemaVersion: SCHEMA_VERSION,
    policy: {
      importReviewStatus: "pending",
      importStatus: "inactive",
      productionEligibility: "reviewStatus=approved and status=active",
      loopPolicy: "never-loop",
      supportedAudioModes: ["dynamic", "locked"],
    },
    sourcePackages: sourcePackages.map((sourcePackage) => ({
      id: sourcePackage.id,
      kind: sourcePackage.kind,
    })),
    summary: {
      duplicatesExcluded: duplicates.length,
      physicalAudioFiles: assets.length + duplicates.length,
      taggedAssets: assets.filter((asset) => asset.tagsComplete).length,
      untaggedAssets: assets.filter((asset) => !asset.tagsComplete).length,
      uniqueAssets: assets.length,
    },
    assets,
    duplicates,
  };
}

function readPackageRows(sourcePackage) {
  const metadataPath = path.join(
    sourcePackage.root,
    "metadata",
    "hook_audio_assets_review.json",
  );
  if (!existsSync(metadataPath)) {
    throw new Error(`Missing package metadata: ${metadataPath}`);
  }
  const rows = JSON.parse(readFileSync(metadataPath, "utf8"));
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`Package metadata is empty: ${metadataPath}`);
  }
  return rows;
}

function readAdditionalTags(manifestPath) {
  if (!existsSync(manifestPath)) {
    throw new Error(`Missing supplemental Hook tags: ${manifestPath}`);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (
    manifest.schemaVersion !== "hook-audio-additional-tags-v1" ||
    manifest.policy?.reviewStatus !== "pending" ||
    manifest.policy?.approvalRequirement !== "listening-review-required" ||
    !Array.isArray(manifest.assets) ||
    manifest.assets.length !== 24
  ) {
    throw new Error("Supplemental Hook tag manifest is invalid.");
  }
  if (
    new Set(manifest.assets.map((row) => row.id)).size !==
      manifest.assets.length ||
    new Set(manifest.assets.map((row) => row.sha256)).size !==
      manifest.assets.length ||
    new Set(manifest.assets.map((row) => row.sourceFileName)).size !==
      manifest.assets.length
  ) {
    throw new Error("Supplemental Hook tag manifest contains duplicates.");
  }
  for (const row of manifest.assets) {
    if (!/^([a-f0-9]{64})$/u.test(String(row.sha256))) {
      throw new Error(`Invalid supplemental SHA-256 for ${row.sourceFileName}.`);
    }
    validateTaggedRow({ ...row, reviewStatus: "pending" });
  }
  return manifest;
}

function buildAsset({ id, row, sourcePackage, tagged }) {
  const source = assertSourceBytes(sourcePackage.root, row);
  const probe = probeAudio(source.filePath);
  if (Math.abs(probe.durationSeconds - Number(row.durationSeconds)) > 0.08) {
    throw new Error(`Duration mismatch for ${row.fileName}.`);
  }

  const moods = tagged ? parseTags(row.moods) : [];
  const hookTypes = tagged ? parseTags(row.hookTypes) : [];
  const energy = tagged ? String(row.energy) : null;
  const impactAtSeconds = tagged
    ? parseOptionalNumber(row.impactAtSeconds)
    : null;

  return {
    id,
    sourcePackage: sourcePackage.id,
    sourceFileName: row.fileName,
    sourcePath: `audio/${row.fileName}`,
    durationSeconds: probe.durationSeconds,
    codec: probe.codec,
    sampleRateHz: probe.sampleRateHz,
    channels: probe.channels,
    bitRateBps: probe.bitRateBps,
    moods,
    hookTypes,
    energy,
    impactAtSeconds,
    loopable: false,
    sha256: source.sha256,
    fileSizeBytes: source.fileSizeBytes,
    reviewStatus: "pending",
    reviewedAt: null,
    reviewNotes: String(row.reviewNotes || ""),
    status: "inactive",
    tagsComplete: tagged,
    taggingVersion: tagged
      ? String(row.taggingVersion || "hook-audio-tagging-v1")
      : "hook-audio-untagged-v1",
  };
}

function assertSourceBytes(root, row) {
  const filePath = path.resolve(root, "audio", row.fileName);
  assertPathWithin(root, filePath);
  if (!existsSync(filePath) || path.extname(filePath).toLowerCase() !== ".mp3") {
    throw new Error(`Missing MP3 source: ${filePath}`);
  }
  const bytes = readFileSync(filePath);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (sha256 !== row.sha256) {
    throw new Error(`SHA-256 mismatch for ${row.fileName}.`);
  }
  return { filePath, fileSizeBytes: statSync(filePath).size, sha256 };
}

function probeAudio(filePath) {
  const stdout = execFileSync(
    ffprobeStatic.path,
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration:stream=codec_name,sample_rate,channels,bit_rate",
      "-of",
      "json",
      filePath,
    ],
    { encoding: "utf8", windowsHide: true },
  );
  const parsed = JSON.parse(stdout);
  const stream = parsed.streams?.find((value) => value.codec_name);
  const durationSeconds = round(Number(parsed.format?.duration), 3);
  if (!stream || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error(`No readable audio stream: ${filePath}`);
  }
  return {
    bitRateBps: positiveNumberOrNull(stream.bit_rate),
    channels: positiveNumberOrNull(stream.channels),
    codec: String(stream.codec_name),
    durationSeconds,
    sampleRateHz: positiveNumberOrNull(stream.sample_rate),
  };
}

function validateTaggedRow(row) {
  if (!/^hook_audio_[0-9]{3}$/u.test(String(row.id))) {
    throw new Error(`Invalid tagged Hook audio ID: ${row.id}.`);
  }
  if (row.reviewStatus !== "pending") {
    throw new Error(`${row.id} must remain pending until human review.`);
  }
  const moods = parseTags(row.moods);
  const hookTypes = parseTags(row.hookTypes);
  if (
    moods.length < 1 ||
    moods.length > 2 ||
    !moods.every((value) => MOODS.has(value)) ||
    hookTypes.length < 2 ||
    hookTypes.length > 4 ||
    !hookTypes.every((value) => HOOK_TYPES.has(value)) ||
    !ENERGY_LEVELS.has(String(row.energy))
  ) {
    throw new Error(`Invalid semantic tags for ${row.id}.`);
  }
  const impact = parseOptionalNumber(row.impactAtSeconds);
  if (
    impact !== null &&
    (impact < 0 || impact >= Number(row.durationSeconds))
  ) {
    throw new Error(`Invalid impact timing for ${row.id}.`);
  }
}

function validateRawRow(row) {
  if (!/^([a-f0-9]{64})$/u.test(String(row.sha256))) {
    throw new Error(`Invalid raw SHA-256 for ${row.fileName}.`);
  }
  if (!["pending", "rejected"].includes(row.reviewStatus)) {
    throw new Error(`Unexpected raw review status for ${row.fileName}.`);
  }
  if (row.moods || row.hookTypes || row.energy || row.impactAtSeconds) {
    throw new Error(
      `Raw source ${row.fileName} contains unreviewed semantic tags.`,
    );
  }
}

function validateCatalog(assets, duplicates) {
  if (new Set(assets.map((asset) => asset.id)).size !== assets.length) {
    throw new Error("Hook audio catalog contains duplicate IDs.");
  }
  if (new Set(assets.map((asset) => asset.sha256)).size !== assets.length) {
    throw new Error("Hook audio catalog contains duplicate file hashes.");
  }
  for (const asset of assets) {
    if (
      asset.reviewStatus !== "pending" ||
      asset.reviewedAt !== null ||
      asset.status !== "inactive" ||
      asset.loopable !== false
    ) {
      throw new Error(`${asset.id} violates the safe import policy.`);
    }
  }
  if (
    duplicates.some(
      (duplicate) =>
        duplicate.reviewStatus !== "rejected" ||
        !assets.some((asset) => asset.id === duplicate.canonicalAssetId),
    )
  ) {
    throw new Error("Hook audio duplicate report is invalid.");
  }
}

function addUniqueAsset({ asset, assetByHash, assets }) {
  if (assetByHash.has(asset.sha256)) {
    throw new Error(`Duplicate Hook audio hash for ${asset.id}.`);
  }
  if (assets.some((value) => value.id === asset.id)) {
    throw new Error(`Duplicate Hook audio ID: ${asset.id}.`);
  }
  assets.push(asset);
  assetByHash.set(asset.sha256, asset);
}

function parseTags(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  return String(value || "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseOptionalNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid number: ${value}`);
  return parsed;
}

function positiveNumberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function assertPathWithin(root, target) {
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Source path escapes its package: ${target}`);
  }
}

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
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
      continue;
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}
