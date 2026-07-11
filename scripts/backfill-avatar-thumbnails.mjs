import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import ffmpegPath from "ffmpeg-static";
import { execFileSync } from "node:child_process";
import {
  createWriteStream,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";

const AVATAR_THUMBNAIL_WIDTH = 450;
const AVATAR_THUMBNAIL_HEIGHT = 800;

loadEnvFile(resolve(".env.local"));

const args = parseArgs(process.argv.slice(2));
const execute = Boolean(args.execute);
const dryRun = !execute || Boolean(args.dryRun);
const force = Boolean(args.force);
const checkExisting = Boolean(args.checkExisting);
const limit = getOptionalPositiveInteger(args.limit);

if (execute && !args.yes) {
  throw new Error(
    "Refusing to backfill thumbnails without --yes. Run dry-run first, then use --execute --yes.",
  );
}

assertRequiredEnvVars([
  "AWS_REGION",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_S3_BUCKET",
  "CLOUDFRONT_DOMAIN",
  "SUPABASE_SERVICE_ROLE_KEY",
]);
assertOneRequiredEnvVar(["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]);

const s3 = new S3Client({
  credentials: {
    accessKeyId: getRequiredEnv("AWS_ACCESS_KEY_ID"),
    secretAccessKey: getRequiredEnv("AWS_SECRET_ACCESS_KEY"),
  },
  region: getRequiredEnv("AWS_REGION"),
});
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

const avatars = await listReadyAvatarAssets();
const missingThumbnailAvatars = avatars.filter(
  (avatar) => force || !avatar.thumbnail_url,
);
const selectedAvatars =
  limit === null ? missingThumbnailAvatars : missingThumbnailAvatars.slice(0, limit);

console.log("Avatar thumbnail backfill");
console.log(`Mode: ${dryRun ? "dry-run" : "execute"}`);
console.log(`Supabase project: ${getSupabaseProjectRef()}`);
console.log(`S3 bucket: ${getRequiredEnv("AWS_S3_BUCKET")}`);
console.log(`Ready avatars: ${avatars.length}`);
console.log(
  `Missing thumbnail URLs: ${
    avatars.filter((avatar) => !avatar.thumbnail_url).length
  }`,
);
console.log(`Selected for ${force ? "forced rebuild" : "backfill"}: ${selectedAvatars.length}`);

if (checkExisting) {
  await checkExistingThumbnailUrls(avatars);
}

if (dryRun) {
  for (const avatar of selectedAvatars.slice(0, 10)) {
    console.log(
      `DRY ${avatar.name}: ${avatar.source_s3_key} -> ${buildThumbnailS3Key(
        avatar.source_s3_key,
      )}`,
    );
  }

  console.log("Dry run complete. No S3 upload or Supabase write was performed.");
} else {
  let completed = 0;

  for (const avatar of selectedAvatars) {
    await backfillAvatarThumbnail(avatar);
    completed += 1;
    console.log(`Backfilled ${completed}/${selectedAvatars.length}: ${avatar.name}`);
  }

  console.log(`Backfilled ${completed} avatar thumbnails.`);
}

async function listReadyAvatarAssets() {
  const { data, error } = await supabase
    .from("avatar_assets")
    .select("id, name, source_s3_key, source_video_url, thumbnail_url")
    .eq("avatar_type", "global")
    .eq("status", "ready")
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Could not list avatar assets: ${error.message}`);
  }

  return data;
}

async function backfillAvatarThumbnail(avatar) {
  const tempDir = mkdtempSync(join(tmpdir(), "ugc-avatar-backfill-"));
  const inputPath = join(tempDir, `${avatar.id}.mp4`);
  const outputPath = join(tempDir, `${avatar.id}.webp`);
  const thumbnailS3Key = buildThumbnailS3Key(avatar.source_s3_key);
  const thumbnailUrl = buildCloudFrontUrl(thumbnailS3Key);

  try {
    await downloadS3Object(avatar.source_s3_key, inputPath);
    createThumbnailFromVideo({
      inputPath,
      label: avatar.name,
      outputPath,
    });

    await s3.send(
      new PutObjectCommand({
        Body: readFileSync(outputPath),
        Bucket: getRequiredEnv("AWS_S3_BUCKET"),
        CacheControl: "public, max-age=31536000, immutable",
        ContentType: "image/webp",
        Key: thumbnailS3Key,
      }),
    );

    const { error } = await supabase
      .from("avatar_assets")
      .update({
        thumbnail_url: thumbnailUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", avatar.id);

    if (error) {
      throw new Error(`Could not save thumbnail URL: ${error.message}`);
    }
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
}

async function downloadS3Object(key, outputPath) {
  const response = await s3.send(
    new GetObjectCommand({
      Bucket: getRequiredEnv("AWS_S3_BUCKET"),
      Key: key,
    }),
  );

  if (!response.Body) {
    throw new Error(`S3 object has no body: ${key}`);
  }

  await pipeline(response.Body, createWriteStream(outputPath));
}

function createThumbnailFromVideo({ inputPath, label, outputPath }) {
  const ffmpegExecutable = ffmpegPath || "ffmpeg";

  try {
    execFileSync(
      ffmpegExecutable,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-ss",
        "0.8",
        "-i",
        inputPath,
        "-frames:v",
        "1",
        "-vf",
        `scale=${AVATAR_THUMBNAIL_WIDTH}:${AVATAR_THUMBNAIL_HEIGHT}:force_original_aspect_ratio=decrease,pad=${AVATAR_THUMBNAIL_WIDTH}:${AVATAR_THUMBNAIL_HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1`,
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
  } catch (error) {
    throw new Error(`Could not create thumbnail for ${label}: ${error.message}`);
  }
}

async function checkExistingThumbnailUrls(avatars) {
  const avatarsWithThumbnail = avatars.filter((avatar) => avatar.thumbnail_url);
  const counts = {
    failed: 0,
    ok: 0,
    other: 0,
  };

  for (const avatar of avatarsWithThumbnail) {
    const status = await checkUrlStatus(avatar.thumbnail_url);

    if (status === 200) {
      counts.ok += 1;
    } else if (status === 403 || status === 404 || status === 0) {
      counts.failed += 1;
      console.log(`${status || "ERR"} thumbnail: ${avatar.name}`);
    } else {
      counts.other += 1;
      console.log(`${status} thumbnail: ${avatar.name}`);
    }
  }

  console.log(
    `Existing thumbnail check: ${counts.ok} OK, ${counts.failed} failed, ${counts.other} other.`,
  );
}

async function checkUrlStatus(url) {
  try {
    const response = await fetch(url, { method: "HEAD" });
    return response.status;
  } catch {
    return 0;
  }
}

function buildThumbnailS3Key(sourceS3Key) {
  const sourcePath = sourceS3Key
    .replace(/^avatars\/global\//, "")
    .replace(/\.[^/.]+$/, ".webp");

  return `avatars/thumbnails/${sourcePath}`;
}

function parseArgs(rawArgs) {
  const parsed = {
    checkExisting: false,
    dryRun: false,
    execute: false,
    force: false,
    limit: "",
    yes: false,
  };

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];

    if (arg === "--check-existing") {
      parsed.checkExisting = true;
      continue;
    }

    if (arg === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }

    if (arg === "--execute") {
      parsed.execute = true;
      continue;
    }

    if (arg === "--force") {
      parsed.force = true;
      continue;
    }

    if (arg === "--yes") {
      parsed.yes = true;
      continue;
    }

    if (arg === "--limit") {
      parsed.limit = rawArgs[index + 1] ?? "";
      index += 1;
    }
  }

  return parsed;
}

function loadEnvFile(envPath) {
  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const match = trimmedLine.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);

    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;

    process.env[key] = cleanEnvValue(rawValue);
  }
}

function cleanEnvValue(rawValue) {
  const value = rawValue.trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function assertRequiredEnvVars(names) {
  const missing = names.filter((name) => !process.env[name]?.trim());

  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }
}

function assertOneRequiredEnvVar(names) {
  if (!names.some((name) => process.env[name]?.trim())) {
    throw new Error(`Missing required env var: ${names.join(" or ")}`);
  }
}

function getRequiredEnv(...names) {
  for (const name of names) {
    const value = process.env[name]?.trim();

    if (value) {
      return value;
    }
  }

  throw new Error(`Missing required env var: ${names.join(" or ")}`);
}

function getOptionalPositiveInteger(value) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, got ${value}`);
  }

  return parsed;
}

function buildCloudFrontUrl(key) {
  const cloudFrontDomain = getRequiredEnv("CLOUDFRONT_DOMAIN");
  const domainWithScheme = /^https?:\/\//i.test(cloudFrontDomain)
    ? cloudFrontDomain
    : `https://${cloudFrontDomain}`;

  return `${domainWithScheme.replace(/\/$/, "")}/${key.replace(/^\//, "")}`;
}

function getSupabaseProjectRef() {
  try {
    return new URL(
      getRequiredEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
    ).host.split(".")[0];
  } catch {
    return "unknown";
  }
}
