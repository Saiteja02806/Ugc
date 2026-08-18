import { createClient } from "@supabase/supabase-js";
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

const DEFAULT_SOURCE_BATCH = "hook-silent-2026-08-11-approved-28";
const DEFAULT_OUTPUT_ROOT = "artifacts/hook-video-backend-review";

loadEnvFile(path.resolve(".env.local"));

const args = parseArgs(process.argv.slice(2));
const execute = Boolean(args.execute);
const replace = Boolean(args.replace);
const sourceBatch = String(args.batch || DEFAULT_SOURCE_BATCH).trim();
const outputRoot = path.resolve(String(args.output || DEFAULT_OUTPUT_ROOT));
const outputDirectory = path.join(outputRoot, sourceBatch);

if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(sourceBatch)) {
  throw new Error("The Hook source batch ID is invalid.");
}

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

const { data, error } = await supabase
  .from("avatar_assets")
  .select(
    "id,name,source_batch,source_file_sha256,source_s3_key,source_video_url,duration_seconds,width,height,visual_group,influencer_key,status,metadata,created_at",
  )
  .eq("source_batch", sourceBatch)
  .is("deleted_at", null)
  .order("sort_order", { ascending: true })
  .order("created_at", { ascending: true });

if (error) {
  throw new Error(`Could not load the backend Hook batch: ${error.message}`);
}

const rows = data ?? [];

if (rows.length === 0) {
  throw new Error(`No backend Hook videos were found for ${sourceBatch}.`);
}

const duplicateHashes = findDuplicates(
  rows.map((row) => row.source_file_sha256),
);
const duplicateKeys = findDuplicates(rows.map((row) => row.source_s3_key));

if (duplicateHashes.length > 0 || duplicateKeys.length > 0) {
  throw new Error(
    `The backend Hook batch contains duplicates: hashes=${duplicateHashes.join(",") || "none"}; keys=${duplicateKeys.join(",") || "none"}.`,
  );
}

const plannedFiles = rows.map((row, index) => ({
  backendId: row.id,
  catalogName: getMetadataString(row.metadata, "catalogName") || row.name,
  destinationFileName: `${String(index + 1).padStart(2, "0")}-${sanitizeFileName(
    getMetadataString(row.metadata, "sourceFileName") || `${row.name}.mp4`,
  )}`,
  durationSeconds: Number(row.duration_seconds),
  height: row.height,
  influencerKey: row.influencer_key,
  originalFileName:
    getMetadataString(row.metadata, "sourceFileName") || null,
  reactionType: getMetadataString(row.metadata, "reactionType") || null,
  sha256: row.source_file_sha256,
  sourceBatch: row.source_batch,
  sourceS3Key: row.source_s3_key,
  sourceVideoUrl: row.source_video_url,
  status: row.status,
  visualGroup: row.visual_group,
  width: row.width,
}));

console.log("Backend Hook video review export");
console.log(`Source batch: ${sourceBatch}`);
console.log(`Backend videos: ${plannedFiles.length}`);
console.log(`Output folder: ${outputDirectory}`);
console.log("Duplicate hashes: none");
console.log("Duplicate storage keys: none");

if (!execute) {
  console.log("Dry run complete. No review folder was created.");
} else {
  await exportReviewFolder();
}

async function exportReviewFolder() {
  if (existsSync(outputDirectory)) {
    if (!replace) {
      throw new Error(
        `Review folder already exists: ${outputDirectory}. Use --replace to rebuild it.`,
      );
    }

    assertSafeOutputDirectory(outputRoot, outputDirectory, sourceBatch);
    rmSync(outputDirectory, { recursive: true, force: true });
  }

  mkdirSync(outputDirectory, { recursive: true });

  const exportedFiles = [];

  try {
    for (const [index, file] of plannedFiles.entries()) {
      console.log(
        `[${index + 1}/${plannedFiles.length}] ${file.destinationFileName}`,
      );
      const destinationPath = path.join(
        outputDirectory,
        file.destinationFileName,
      );
      await downloadFile(file.sourceVideoUrl, destinationPath);
      const downloadedSha256 = sha256File(destinationPath);

      if (!file.sha256 || downloadedSha256 !== file.sha256) {
        throw new Error(
          `Downloaded file hash does not match backend metadata: ${file.destinationFileName}.`,
        );
      }

      exportedFiles.push({
        ...file,
        downloadedSha256,
        verification: "sha256_match",
      });
    }

    const manifest = {
      exportedAt: new Date().toISOString(),
      fileCount: exportedFiles.length,
      files: exportedFiles,
      purpose: "Manual review copy of Hook videos already stored in the backend.",
      schemaVersion: "hook-video-backend-review-export-v1",
      sourceBatch,
    };
    writeFileSync(
      path.join(outputDirectory, "backend-review-manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    writeFileSync(
      path.join(outputDirectory, "README.txt"),
      [
        "HOOK VIDEO BACKEND REVIEW FOLDER",
        "",
        `Batch: ${sourceBatch}`,
        `Files: ${exportedFiles.length}`,
        "",
        "These MP4 files are exact verified copies of the Hook videos already stored in the backend.",
        "The original backend records and storage objects were not changed.",
        "See backend-review-manifest.json for backend IDs, formats, creator groups, and SHA-256 verification.",
        "",
      ].join("\r\n"),
    );
  } catch (error) {
    assertSafeOutputDirectory(outputRoot, outputDirectory, sourceBatch);
    rmSync(outputDirectory, { recursive: true, force: true });
    throw error;
  }

  console.log(
    `Export complete: ${exportedFiles.length} verified backend Hook videos copied to ${outputDirectory}.`,
  );
}

async function downloadFile(url, destinationPath) {
  const response = await fetch(url, { redirect: "follow" });

  if (!response.ok || !response.body) {
    throw new Error(
      `Could not download backend Hook video (${response.status}): ${url}`,
    );
  }

  await pipeline(
    Readable.fromWeb(response.body),
    createWriteStream(destinationPath, { flags: "wx" }),
  );
}

function assertSafeOutputDirectory(root, target, batch) {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  const relative = path.relative(resolvedRoot, resolvedTarget);

  if (
    path.basename(resolvedTarget) !== batch ||
    !relative ||
    relative.startsWith("..") ||
    path.isAbsolute(relative)
  ) {
    throw new Error(`Refusing to replace unsafe review folder: ${target}.`);
  }
}

function findDuplicates(values) {
  const seen = new Set();
  const duplicates = new Set();

  for (const value of values) {
    if (!value) continue;
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }

  return [...duplicates];
}

function getMetadataString(metadata, key) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return "";
  }

  return typeof metadata[key] === "string" ? metadata[key].trim() : "";
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

function sanitizeFileName(value) {
  const extension = ".mp4";
  const stem = path
    .basename(value, path.extname(value))
    .replace(/[<>:"/\\|?*\u0000-\u001F]/gu, "-")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 120);

  return `${stem || "hook-video"}${extension}`;
}

function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}
