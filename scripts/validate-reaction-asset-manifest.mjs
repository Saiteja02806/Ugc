import { readFileSync } from "node:fs";
import path from "node:path";

const REACTION_TYPES = new Set([
  "side_eye",
  "facepalm",
  "deadpan",
  "confusion",
  "shock",
  "relief",
  "celebration",
  "laughter",
  "disappointment",
  "regret",
  "unbothered",
  "concern",
  "focused",
  "playful",
]);
const SUBJECT_COUNTS = new Set(["one", "two", "group"]);
const COMPOSITIONS = new Set(["close_up", "bust", "full_body", "wide"]);
const FOREGROUND_ANCHORS = new Set([
  "bottom_center",
  "bottom_left",
  "bottom_right",
  "center",
]);
const ASSET_STATUSES = new Set(["pending", "active", "excluded"]);

const args = parseArgs(process.argv.slice(2));
const manifestPath = path.resolve(
  String(
    args.manifest ??
      path.join(
        process.cwd(),
        "artifacts",
        "reaction-asset-review",
        "reaction-manifest-template.json",
      ),
  ),
);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const { activeBackgroundCount, activeClipCount, issues } = validateManifest(
  manifest,
  { requireActive: args["require-active"] === true },
);

if (issues.length > 0) {
  console.error(`Reaction asset manifest failed validation (${issues.length} issue(s)):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(
  `Reaction asset manifest is valid: ${activeClipCount} clips and ${activeBackgroundCount} backgrounds are active.`,
);

function validateManifest(value, options) {
  const issues = [];
  if (!isRecord(value) || value.schemaVersion !== "reaction-asset-manifest-v2") {
    return {
      activeBackgroundCount: 0,
      activeClipCount: 0,
      issues: ["schemaVersion must be reaction-asset-manifest-v2."],
    };
  }
  if (!Array.isArray(value.videos) || !Array.isArray(value.backgrounds)) {
    return {
      activeBackgroundCount: 0,
      activeClipCount: 0,
      issues: ["videos and backgrounds must both be arrays."],
    };
  }

  const seenIds = new Set();
  const seenSourceHashes = new Set();
  for (const video of value.videos) {
    validateVideo(video, seenIds, seenSourceHashes, issues);
  }
  for (const background of value.backgrounds) {
    validateBackground(background, seenIds, seenSourceHashes, issues);
  }

  const activeClipCount = value.videos.filter(
    (asset) => isRecord(asset) && asset.status === "active",
  ).length;
  const activeBackgroundCount = value.backgrounds.filter(
    (asset) => isRecord(asset) && asset.status === "active",
  ).length;
  if (options.requireActive && (activeClipCount === 0 || activeBackgroundCount === 0)) {
    issues.push("At least one active clip and background are required before catalog import.");
  }

  return { activeBackgroundCount, activeClipCount, issues };
}

function validateVideo(asset, seenIds, seenSourceHashes, issues) {
  const label = getAssetLabel(asset, "video");
  if (!isRecord(asset)) {
    issues.push("Each video entry must be an object.");
    return;
  }

  validateTechnicalIdentity(asset, label, seenIds, seenSourceHashes, issues);
  validatePositiveInteger(asset.width, `${label} needs a positive width.`, issues);
  validatePositiveInteger(asset.height, `${label} needs a positive height.`, issues);
  if (typeof asset.codec !== "string" || !asset.codec.trim()) {
    issues.push(`${label} is missing codec metadata.`);
  }
  if (typeof asset.pixelFormat !== "string" || !asset.pixelFormat.trim()) {
    issues.push(`${label} is missing pixelFormat metadata.`);
  }
  if (typeof asset.durationSeconds !== "number" || asset.durationSeconds <= 0) {
    issues.push(`${label} needs a positive durationSeconds value.`);
  }
  if (!ASSET_STATUSES.has(asset.status)) {
    issues.push(`${label} needs status pending, active, or excluded.`);
    return;
  }
  if (asset.status !== "active") return;

  if (asset.hasAlpha !== true) {
    issues.push(`${label} is active but has no verified alpha channel.`);
  }
  if (!isReactionArray(asset.reactions)) {
    issues.push(`${label} needs one to three unique controlled reactions.`);
  }
  if (!SUBJECT_COUNTS.has(asset.subjectCount)) {
    issues.push(`${label} needs subjectCount one, two, or group.`);
  }
  if (!COMPOSITIONS.has(asset.composition)) {
    issues.push(`${label} needs composition close_up, bust, full_body, or wide.`);
  }
  if (!isRecord(asset.placement) || !FOREGROUND_ANCHORS.has(asset.placement.anchor)) {
    issues.push(`${label} needs a reviewed placement anchor.`);
  }
  if (
    !isRecord(asset.placement) ||
    typeof asset.placement.heightPercent !== "number" ||
    asset.placement.heightPercent < 0.25 ||
    asset.placement.heightPercent > 0.9
  ) {
    issues.push(`${label} needs placement heightPercent between 0.25 and 0.90.`);
  }
}

function validateBackground(asset, seenIds, seenSourceHashes, issues) {
  const label = getAssetLabel(asset, "background");
  if (!isRecord(asset)) {
    issues.push("Each background entry must be an object.");
    return;
  }

  validateTechnicalIdentity(asset, label, seenIds, seenSourceHashes, issues);
  validatePositiveInteger(asset.width, `${label} needs a positive width.`, issues);
  validatePositiveInteger(asset.height, `${label} needs a positive height.`, issues);
  if (!ASSET_STATUSES.has(asset.status)) {
    issues.push(`${label} needs status pending, active, or excluded.`);
    return;
  }
  if (asset.status !== "active") return;

  if (!isCleanTagArray(asset.contextTags)) {
    issues.push(`${label} needs one or more unique non-empty context tags.`);
  }
  if (!FOREGROUND_ANCHORS.has(asset.foregroundPlacement)) {
    issues.push(`${label} needs a reviewed foregroundPlacement.`);
  }
}

function validateTechnicalIdentity(asset, label, seenIds, seenSourceHashes, issues) {
  validateUniqueId(asset.assetId, label, seenIds, issues);
  if (typeof asset.sourceFileName !== "string" || !asset.sourceFileName.trim()) {
    issues.push(`${label} is missing sourceFileName.`);
  }
  if (typeof asset.sourceRoot !== "string" || !asset.sourceRoot.trim()) {
    issues.push(`${label} is missing sourceRoot.`);
  }
  if (typeof asset.sourceSha256 !== "string" || !/^[a-f0-9]{64}$/iu.test(asset.sourceSha256)) {
    issues.push(`${label} needs a SHA-256 source checksum.`);
  } else if (seenSourceHashes.has(asset.sourceSha256)) {
    issues.push(`${label} has a duplicate source checksum.`);
  } else {
    seenSourceHashes.add(asset.sourceSha256);
  }
}

function validatePositiveInteger(value, message, issues) {
  if (!Number.isInteger(value) || value <= 0) issues.push(message);
}

function isReactionArray(value) {
  return (
    Array.isArray(value) &&
    value.length >= 1 &&
    value.length <= 3 &&
    value.every((item) => typeof item === "string" && REACTION_TYPES.has(item)) &&
    new Set(value).size === value.length
  );
}

function validateUniqueId(value, label, seenIds, issues) {
  if (typeof value !== "string" || !value.trim()) {
    issues.push(`${label} is missing assetId.`);
    return;
  }
  if (seenIds.has(value)) issues.push(`${label} has a duplicate assetId.`);
  seenIds.add(value);
}

function getAssetLabel(asset, fallback) {
  return isRecord(asset) && typeof asset.sourceFileName === "string"
    ? asset.sourceFileName
    : fallback;
}

function isCleanTagArray(value) {
  return (
    Array.isArray(value) &&
    value.length >= 1 &&
    value.every((item) => typeof item === "string" && item.trim()) &&
    new Set(value.map((item) => item.trim().toLowerCase())).size === value.length
  );
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseArgs(rawArgs) {
  const parsed = {};
  for (let index = 0; index < rawArgs.length; index += 1) {
    const argument = rawArgs[index];
    if (!argument.startsWith("--")) continue;
    const key = argument.slice(2);
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
