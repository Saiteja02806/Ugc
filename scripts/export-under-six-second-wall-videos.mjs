import { createClient } from "@supabase/supabase-js";
import ffprobeStatic from "ffprobe-static";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const MINIMUM_DURATION_SECONDS = 6;
const DEFAULT_EXPECTED_COUNT = 16;
const DEFAULT_OUTPUT_DIRECTORY =
  "artifacts/wall-text-under-6s-review-2026-08-24";

loadEnvFile(path.resolve(".env.local"));

const args = parseArgs(process.argv.slice(2));
const expectedCount = Number(args["expected-count"] ?? DEFAULT_EXPECTED_COUNT);
const outputDirectory = path.resolve(
  String(args.output ?? DEFAULT_OUTPUT_DIRECTORY),
);
const replace = Boolean(args.replace);

if (!Number.isInteger(expectedCount) || expectedCount < 1) {
  throw new Error("--expected-count must be a positive integer.");
}

const supabase = createClient(
  getRequiredEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
  getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const { data, error } = await supabase
  .from("overlay_media_assets")
  .select(
    [
      "id",
      "source_file_name",
      "source_file_sha256",
      "source_batch",
      "s3_key",
      "thumbnail_s3_key",
      "preview_url",
      "duration_seconds",
      "wall_text_source_kind",
      "status",
      "analysis_status",
      "usage_count",
      "created_at",
    ].join(","),
  )
  .eq("asset_type", "video")
  .eq("format_family", "wall_text_overlay")
  .eq("status", "active")
  .eq("analysis_status", "succeeded")
  .lt("duration_seconds", MINIMUM_DURATION_SECONDS)
  .order("duration_seconds", { ascending: true })
  .order("id", { ascending: true });

if (error) {
  throw new Error(`Could not load short Wall videos: ${error.message}`);
}

const assets = data ?? [];
if (assets.length !== expectedCount) {
  throw new Error(
    `Expected ${expectedCount} short Wall videos, but the backend currently returned ${assets.length}. No folder was created.`,
  );
}

assertUniqueAssets(assets);
prepareOutputDirectory(outputDirectory, replace);

const exported = [];
try {
  for (const [index, asset] of assets.entries()) {
    const durationSeconds = Number(asset.duration_seconds);
    const fileName = buildReviewFileName(index, asset, durationSeconds);
    const destinationPath = path.join(outputDirectory, fileName);

    console.log(
      `[${index + 1}/${assets.length}] ${durationSeconds.toFixed(3)}s ${asset.source_file_name}`,
    );
    await downloadFile(asset.preview_url, destinationPath);

    const downloadedSha256 = sha256File(destinationPath);
    if (downloadedSha256 !== asset.source_file_sha256) {
      throw new Error(
        `SHA-256 mismatch for ${asset.id}: expected ${asset.source_file_sha256}, received ${downloadedSha256}.`,
      );
    }

    const measuredDurationSeconds = measureDurationSeconds(destinationPath);
    if (Math.abs(measuredDurationSeconds - durationSeconds) > 0.08) {
      throw new Error(
        `Duration mismatch for ${asset.id}: backend=${durationSeconds}, downloaded=${measuredDurationSeconds}.`,
      );
    }

    exported.push({
      backendAssetId: asset.id,
      backendDurationSeconds: durationSeconds,
      createdAt: asset.created_at,
      downloadedFileName: fileName,
      measuredDurationSeconds,
      previewUrl: asset.preview_url,
      sha256: downloadedSha256,
      sourceBatch: asset.source_batch,
      sourceFileName: asset.source_file_name,
      sourceKind: asset.wall_text_source_kind,
      storageKey: asset.s3_key,
      thumbnailStorageKey: asset.thumbnail_s3_key,
      usageCount: asset.usage_count,
    });
  }

  writeReviewArtifacts(outputDirectory, exported);
} catch (exportError) {
  rmSync(outputDirectory, { force: true, recursive: true });
  throw exportError;
}

console.log(`Exported and verified ${exported.length} videos.`);
console.log(`Review folder: ${outputDirectory}`);
console.log("No backend row or storage object was changed.");

function prepareOutputDirectory(directory, shouldReplace) {
  const workspaceRoot = path.resolve(".");
  const relative = path.relative(workspaceRoot, directory);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Review folder must remain inside the workspace: ${directory}`);
  }

  if (existsSync(directory)) {
    if (!shouldReplace) {
      throw new Error(
        `Review folder already exists: ${directory}. Use --replace to rebuild it.`,
      );
    }
    rmSync(directory, { force: true, recursive: true });
  }

  mkdirSync(directory, { recursive: true });
}

async function downloadFile(url, destinationPath) {
  if (!url || !/^https:\/\//u.test(url)) {
    throw new Error(`The backend video URL is invalid: ${url ?? "missing"}`);
  }

  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(
      `Could not download backend Wall video (${response.status}): ${url}`,
    );
  }

  await pipeline(
    Readable.fromWeb(response.body),
    createWriteStream(destinationPath, { flags: "wx" }),
  );
}

function measureDurationSeconds(filePath) {
  const output = execFileSync(
    ffprobeStatic.path,
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      filePath,
    ],
    { encoding: "utf8" },
  ).trim();
  const durationSeconds = Number(output);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error(`Could not measure downloaded video duration: ${filePath}`);
  }
  return Math.round(durationSeconds * 1_000) / 1_000;
}

function buildReviewFileName(index, asset, durationSeconds) {
  const prefix = String(index + 1).padStart(2, "0");
  const duration = durationSeconds.toFixed(3);
  const sourceName = sanitizeFileName(asset.source_file_name || asset.id);
  return `${prefix}-${duration}s-${sourceName}`;
}

function sanitizeFileName(value) {
  const stem = path
    .basename(value, path.extname(value))
    .replace(/[<>:"/\\|?*\u0000-\u001F]/gu, "-")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 140);
  return `${stem || "wall-video"}.mp4`;
}

function writeReviewArtifacts(directory, rows) {
  const generatedAt = new Date().toISOString();
  const manifest = {
    generatedAt,
    minimumAllowedDurationSeconds: MINIMUM_DURATION_SECONDS,
    purpose:
      "Human validation before deleting under-six-second Wall-of-Text source videos from the backend.",
    videoCount: rows.length,
    videos: rows,
  };
  writeFileSync(
    path.join(directory, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  const csvHeader = [
    "review_order",
    "backend_asset_id",
    "backend_duration_seconds",
    "measured_duration_seconds",
    "downloaded_file_name",
    "source_file_name",
    "source_batch",
    "sha256",
    "decision",
    "notes",
  ];
  const csvRows = rows.map((row, index) =>
    [
      index + 1,
      row.backendAssetId,
      row.backendDurationSeconds,
      row.measuredDurationSeconds,
      row.downloadedFileName,
      row.sourceFileName,
      row.sourceBatch,
      row.sha256,
      "pending",
      "",
    ]
      .map(csvValue)
      .join(","),
  );
  writeFileSync(
    path.join(directory, "review.csv"),
    `${[csvHeader.join(","), ...csvRows].join("\n")}\n`,
    "utf8",
  );

  writeFileSync(
    path.join(directory, "README.md"),
    [
      "# Under-six-second Wall video review",
      "",
      `This folder contains ${rows.length} SHA-256-verified copies of the active Wall-of-Text source videos whose backend duration is below ${MINIMUM_DURATION_SECONDS.toFixed(3)} seconds.`,
      "",
      "No backend database row or storage object was changed while producing this folder.",
      "",
      "Review every MP4, then record a decision and optional note in `review.csv`. Backend deletion must use the immutable asset IDs and hashes in `manifest.json`, never filenames alone.",
      "",
    ].join("\n"),
    "utf8",
  );
}

function csvValue(value) {
  const text = String(value ?? "");
  return /[",\r\n]/u.test(text) ? `"${text.replace(/"/gu, '""')}"` : text;
}

function assertUniqueAssets(rows) {
  for (const [label, values] of [
    ["backend IDs", rows.map((row) => row.id)],
    ["SHA-256 hashes", rows.map((row) => row.source_file_sha256)],
    ["storage keys", rows.map((row) => row.s3_key)],
  ]) {
    const unique = new Set(values);
    if (unique.size !== values.length || values.some((value) => !value)) {
      throw new Error(`Short Wall video ${label} are missing or duplicated.`);
    }
  }
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
