import {
  copyFileSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const DEFAULT_LIBRARY_ROOT = "D:\\walloftext_sound\\wall_audio_library_v2";
const MOODS = new Set([
  "curious",
  "uplifting",
  "serious",
  "calm",
  "urgent",
  "playful",
]);
const MESSAGE_TYPES = new Set([
  "curiosity",
  "problem",
  "warning",
  "transformation",
  "benefit",
  "story",
  "authority",
]);
const ENERGY_LEVELS = new Set(["low", "medium", "high"]);
const REVIEW_STATUSES = new Set(["pending", "approved", "rejected"]);

const args = parseArgs(process.argv.slice(2));
const execute = Boolean(args.execute);
const libraryRoot = path.resolve(
  String(args.library || DEFAULT_LIBRARY_ROOT),
);
const metadataPath = path.join(
  libraryRoot,
  "metadata",
  "wall_audio_assets.json",
);
const reviewPath = path.join(
  libraryRoot,
  "metadata",
  "wall_audio_assets_review.csv",
);

if (execute && !args.yes) {
  throw new Error(
    "Refusing to update reviewed metadata without --yes. Run the dry-run first.",
  );
}

const manifest = JSON.parse(readFileSync(metadataPath, "utf8"));
if (
  manifest.schemaVersion !== "wall-audio-library-v2" ||
  !Array.isArray(manifest.assets)
) {
  throw new Error("Wall audio metadata is not a supported V2 manifest.");
}

const rows = parseCsv(readFileSync(reviewPath, "utf8"));
const rowById = new Map(rows.map((row) => [row.id, row]));
if (rowById.size !== rows.length) {
  throw new Error("The review CSV contains duplicate audio IDs.");
}

let changedCount = 0;
const nextAssets = manifest.assets.map((asset) => {
  const row = rowById.get(asset.id);
  if (!row) throw new Error(`Review row is missing for ${asset.id}.`);
  assertImmutableReviewFields(asset, row);
  const next = applyReviewRow(asset, row);
  if (JSON.stringify(next) !== JSON.stringify(asset)) changedCount += 1;
  return next;
});

if (rows.length !== manifest.assets.length) {
  throw new Error("The review CSV contains unknown or extra audio IDs.");
}

const summary = summarize(nextAssets);
console.log("Wall audio review plan");
console.log(`Manifest: ${metadataPath}`);
console.log(`Review sheet: ${reviewPath}`);
console.log(`Changed rows: ${changedCount}`);
console.log(`Approved and active: ${summary.approved}`);
console.log(`Pending review: ${summary.pending}`);
console.log(`Rejected and inactive: ${summary.rejected}`);

if (!execute) {
  console.log("Dry run complete. No metadata file was changed.");
  process.exit(0);
}

const timestamp = new Date().toISOString().replace(/[:.]/gu, "-");
const backupPath = path.join(
  path.dirname(metadataPath),
  `wall_audio_assets.before-review-${timestamp}.json`,
);
copyFileSync(metadataPath, backupPath);
writeFileSync(
  metadataPath,
  `${JSON.stringify(
    {
      ...manifest,
      assets: nextAssets,
      generatedAt: new Date().toISOString(),
      summary: {
        ...manifest.summary,
        activeCount: summary.approved,
        approvedCount: summary.approved,
        pendingCount: summary.pending,
        rejectedCount: summary.rejected,
      },
    },
    null,
    2,
  )}\n`,
);
console.log(`Review metadata updated. Backup: ${backupPath}`);

function applyReviewRow(asset, row) {
  const reviewStatus = normalize(row.reviewStatus);
  if (!REVIEW_STATUSES.has(reviewStatus)) {
    throw new Error(`Invalid reviewStatus for ${asset.id}.`);
  }

  const moods = parseTags(row.moods, MOODS, `${asset.id} moods`, 3);
  const messageTypes = parseTags(
    row.messageTypes,
    MESSAGE_TYPES,
    `${asset.id} messageTypes`,
    4,
  );
  const energy = normalize(row.energy) || null;
  const loopable = parseOptionalBoolean(row.loopable, asset.id);
  const reviewNotes = row.reviewNotes?.trim() || null;

  if (reviewStatus === "approved") {
    if (
      moods.length === 0 ||
      messageTypes.length === 0 ||
      !ENERGY_LEVELS.has(energy) ||
      typeof loopable !== "boolean"
    ) {
      throw new Error(
        `Approved row ${asset.id} needs mood, message type, energy, and loopable decisions.`,
      );
    }
    return {
      ...asset,
      energy,
      loopable,
      messageTypes,
      moods,
      reviewedAt: asset.reviewedAt ?? new Date().toISOString(),
      reviewNotes,
      reviewStatus: "approved",
      status: "active",
    };
  }

  if (reviewStatus === "rejected") {
    if (!reviewNotes) {
      throw new Error(`Rejected row ${asset.id} needs reviewNotes.`);
    }
    return {
      ...asset,
      energy,
      loopable,
      messageTypes,
      moods,
      reviewedAt: asset.reviewedAt ?? new Date().toISOString(),
      reviewNotes,
      reviewStatus: "rejected",
      status: "inactive",
    };
  }

  return {
    ...asset,
    energy,
    loopable,
    messageTypes,
    moods,
    reviewNotes,
    reviewStatus: "pending",
    status: "pending_review",
  };
}

function assertImmutableReviewFields(asset, row) {
  if (
    row.sourceAudioId !== asset.sourceAudioId ||
    Math.abs(Number(row.durationSeconds) - asset.durationSeconds) > 0.001
  ) {
    throw new Error(`Review row identity changed for ${asset.id}.`);
  }
}

function parseTags(value, allowed, label, maximum) {
  const tags = String(value ?? "")
    .split("|")
    .map(normalize)
    .filter(Boolean);
  if (
    tags.length > maximum ||
    new Set(tags).size !== tags.length ||
    tags.some((tag) => !allowed.has(tag))
  ) {
    throw new Error(`Invalid ${label}.`);
  }
  return tags;
}

function parseOptionalBoolean(value, id) {
  const normalized = normalize(value);
  if (!normalized) return null;
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  throw new Error(`Invalid loopable decision for ${id}.`);
}

function summarize(assets) {
  return {
    approved: assets.filter(
      (asset) =>
        asset.reviewStatus === "approved" && asset.status === "active",
    ).length,
    pending: assets.filter(
      (asset) =>
        asset.reviewStatus === "pending" &&
        asset.status === "pending_review",
    ).length,
    rejected: assets.filter(
      (asset) =>
        asset.reviewStatus === "rejected" && asset.status === "inactive",
    ).length,
  };
}

function parseCsv(value) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quoted) {
      if (character === '"' && value[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else field += character;
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/u, ""));
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      field = "";
    } else field += character;
  }
  if (field || row.length > 0) {
    row.push(field.replace(/\r$/u, ""));
    rows.push(row);
  }
  if (quoted || rows.length < 2) throw new Error("Review CSV is invalid.");

  const headers = rows[0];
  return rows.slice(1).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])),
  );
}

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function parseArgs(rawArgs) {
  const parsed = {};
  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = rawArgs[index + 1];
    if (!next || next.startsWith("--")) parsed[key] = true;
    else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}
