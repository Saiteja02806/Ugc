import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import ffmpegPath from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import sharp from "sharp";

const REPOSITORY_ROOT = process.cwd();
const DEFAULT_VIDEO_ROOTS = [
  "D:/green_mat/green_removed_prores4444_transparent",
  "D:/green_mat/mov/green_removed_clean",
  "D:/green_mat/ProRes4444_Q12_01-06",
  "D:/green_mat/ProRes4444_Q12_07-12",
  "D:/green_mat/ProRes4444_Q12_13-16",
  "D:/green_mat/ProRes4444_Q12_17-20",
  "D:/green_mat/ProRes4444_Q12_batch19_01-07",
  "D:/green_mat/ProRes4444_Q12_batch19_08-13",
  "D:/green_mat/ProRes4444_Q12_batch19_14-19",
];
const DEFAULT_BACKGROUND_ROOT =
  "C:/Users/chund/OneDrive/Desktop/green_images";
const DEFAULT_OUTPUT_ROOT = path.join(
  REPOSITORY_ROOT,
  "artifacts",
  "reaction-asset-review",
);
const FRAME_WIDTH = 230;
const FRAME_HEIGHT = 409;
const LABEL_HEIGHT = 70;
const CELL_HEIGHT = FRAME_HEIGHT + LABEL_HEIGHT;
const COLUMNS = 4;
const BATCH_SIZE = 12;

const args = parseArgs(process.argv.slice(2));
const outputRoot = path.resolve(String(args.output ?? DEFAULT_OUTPUT_ROOT));
const backgroundRoot = path.resolve(
  String(args["background-root"] ?? DEFAULT_BACKGROUND_ROOT),
);
const videoRoots = args["video-root"]
  ? String(args["video-root"])
      .split(",")
      .map((value) => path.resolve(value.trim()))
      .filter(Boolean)
  : DEFAULT_VIDEO_ROOTS.map((root) => path.resolve(root));

if (!ffmpegPath || !ffprobeStatic.path) {
  throw new Error("ffmpeg-static and ffprobe-static are required for reaction inspection.");
}

const framesRoot = path.join(outputRoot, "frames");
const sheetsRoot = path.join(outputRoot, "sheets");

async function main() {
  mkdirSync(framesRoot, { recursive: true });
  mkdirSync(sheetsRoot, { recursive: true });

  const videos = videoRoots.flatMap((root) =>
    listFiles(root, new Set([".mov", ".mp4", ".webm"]))
      .map((filePath) => inspectVideo(filePath, root)),
  );
  const backgrounds = await Promise.all(
    listFiles(backgroundRoot, new Set([".jpg", ".jpeg", ".png", ".webp"]))
      .map((filePath) => inspectBackground(filePath, backgroundRoot)),
  );

  const report = {
    generatedAt: new Date().toISOString(),
    schemaVersion: "reaction-asset-inspection-v1",
    source: {
      backgroundRoot,
      videoRoots,
    },
    summary: {
      alphaVideoCount: videos.filter((video) => video.hasAlpha).length,
      backgroundCount: backgrounds.length,
      videoCount: videos.length,
    },
    videos,
    backgrounds,
  };

  for (const video of videos) {
    video.framePath = await extractPreviewFrame(video);
  }
  for (const background of backgrounds) {
    background.framePath = await createBackgroundPreview(background);
  }

  const videoSheets = await buildSheets({
    items: videos,
    kind: "video",
    label: (item) => [
      item.sourceLabel,
      `${item.codec} · ${item.pixelFormat}${item.hasAlpha ? " · alpha" : ""}`,
      `${item.width}×${item.height} · ${formatSeconds(item.durationSeconds)}`,
    ],
  });
  const backgroundSheets = await buildSheets({
    items: backgrounds,
    kind: "background",
    label: (item) => [
      item.sourceLabel,
      `${item.width}×${item.height}`,
    ],
  });

  writeFileSync(
    path.join(outputRoot, "asset-report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  writeFileSync(
    path.join(outputRoot, "reaction-manifest-template.json"),
    `${JSON.stringify(buildManifestTemplate({ backgrounds, videos }), null, 2)}\n`,
  );

  console.log(
    `Inspected ${videos.length} videos (${report.summary.alphaVideoCount} with alpha) and ${backgrounds.length} backgrounds.`,
  );
  console.log(`Report: ${path.join(outputRoot, "asset-report.json")}`);
  console.log(`Manifest template: ${path.join(outputRoot, "reaction-manifest-template.json")}`);
  console.log(`Video sheets: ${videoSheets.join(", ") || "none"}`);
  console.log(`Background sheets: ${backgroundSheets.join(", ") || "none"}`);
}

function listFiles(root, extensions) {
  const files = [];

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(entryPath, extensions));
      continue;
    }

    if (entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase())) {
      files.push(entryPath);
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

function inspectVideo(filePath, sourceRoot) {
  const probe = runJson(ffprobeStatic.path, [
    "-v",
    "error",
    "-show_entries",
    "stream=codec_type,codec_name,profile,pix_fmt,width,height,avg_frame_rate:format=duration",
    "-of",
    "json",
    filePath,
  ]);
  const streams = Array.isArray(probe.streams) ? probe.streams : [];
  const video = streams.find((stream) => stream.codec_type === "video");

  if (!video || !Number.isFinite(Number(video.width)) || !Number.isFinite(Number(video.height))) {
    throw new Error(`Could not find a usable video stream in ${filePath}.`);
  }

  const pixelFormat = String(video.pix_fmt ?? "unknown");
  const sourceSha256 = sha256(filePath);
  return {
    assetId: `reaction:${sourceSha256.slice(0, 24)}`,
    codec: String(video.codec_name ?? "unknown"),
    durationSeconds: roundSeconds(Number(probe.format?.duration)),
    filePath,
    fileSizeBytes: statSync(filePath).size,
    framePath: null,
    hasAlpha: /a/u.test(pixelFormat),
    height: Number(video.height),
    pixelFormat,
    profile: typeof video.profile === "string" ? video.profile : null,
    sourceLabel: path.relative(sourceRoot, filePath).replaceAll("\\", "/"),
    sourceRoot,
    sourceSha256,
    width: Number(video.width),
  };
}

async function inspectBackground(filePath, sourceRoot) {
  const metadata = await sharp(filePath, { failOn: "error" }).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error(`Could not find image dimensions for ${filePath}.`);
  }

  const sourceSha256 = sha256(filePath);
  return {
    assetId: `background:${sourceSha256.slice(0, 24)}`,
    filePath,
    fileSizeBytes: statSync(filePath).size,
    framePath: null,
    height: metadata.height,
    sourceLabel: path.relative(sourceRoot, filePath).replaceAll("\\", "/"),
    sourceRoot,
    sourceSha256,
    width: metadata.width,
  };
}

async function extractPreviewFrame(video) {
  const outputPath = path.join(framesRoot, `${video.assetId}.png`);
  const seekSeconds = Math.max(
    0,
    Math.min(video.durationSeconds * 0.35, Math.max(video.durationSeconds - 0.05, 0)),
  );

  run(ffmpegPath, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-ss",
    String(seekSeconds),
    "-i",
    video.filePath,
    "-frames:v",
    "1",
    "-vf",
    `scale=${FRAME_WIDTH}:${FRAME_HEIGHT}:force_original_aspect_ratio=decrease,format=rgba`,
    outputPath,
  ]);

  return outputPath;
}

async function createBackgroundPreview(background) {
  const outputPath = path.join(framesRoot, `${background.assetId}.png`);
  await sharp(background.filePath)
    .resize(FRAME_WIDTH, FRAME_HEIGHT, { fit: "cover", position: "attention" })
    .png()
    .toFile(outputPath);
  return outputPath;
}

async function buildSheets({ items, kind, label }) {
  const outputPaths = [];
  for (let start = 0; start < items.length; start += BATCH_SIZE) {
    const batch = items.slice(start, start + BATCH_SIZE);
    const rows = Math.ceil(batch.length / COLUMNS);
    const sheet = sharp({
      create: {
        background: "#0c1119",
        channels: 4,
        height: rows * CELL_HEIGHT,
        width: COLUMNS * FRAME_WIDTH,
      },
    });
    const composites = [];

    for (const [index, item] of batch.entries()) {
      const left = (index % COLUMNS) * FRAME_WIDTH;
      const top = Math.floor(index / COLUMNS) * CELL_HEIGHT;
      composites.push({ input: createCheckerboard(), left, top });
      composites.push({ input: await normalizeFrame(item.framePath), left, top });
      composites.push({ input: createLabelSvg(label(item)), left, top: top + FRAME_HEIGHT });
    }

    const outputPath = path.join(
      sheetsRoot,
      `${kind}-${String(Math.floor(start / BATCH_SIZE) + 1).padStart(2, "0")}.jpg`,
    );
    await sheet.composite(composites).jpeg({ quality: 90 }).toFile(outputPath);
    outputPaths.push(outputPath);
  }

  return outputPaths;
}

function createCheckerboard() {
  const cell = 18;
  const rects = [];
  for (let y = 0; y < FRAME_HEIGHT; y += cell) {
    for (let x = 0; x < FRAME_WIDTH; x += cell) {
      rects.push(
        `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${(x / cell + y / cell) % 2 === 0 ? "#d6dae1" : "#aab1bd"}"/>`,
      );
    }
  }
  return Buffer.from(
    `<svg width="${FRAME_WIDTH}" height="${FRAME_HEIGHT}" xmlns="http://www.w3.org/2000/svg">${rects.join("")}</svg>`,
  );
}

async function normalizeFrame(framePath) {
  return sharp(framePath)
    .resize(FRAME_WIDTH, FRAME_HEIGHT, {
      background: { alpha: 0, b: 0, g: 0, r: 0 },
      fit: "contain",
    })
    .png()
    .toBuffer();
}

function createLabelSvg(lines) {
  const text = lines
    .filter(Boolean)
    .slice(0, 3)
    .map((line, index) => {
      const y = 19 + index * 18;
      const size = index === 0 ? 12 : 10;
      const fill = index === 0 ? "#f8fafc" : "#b7c0ce";
      return `<text x="10" y="${y}" fill="${fill}" font-family="Arial, sans-serif" font-size="${size}" font-weight="${index === 0 ? 700 : 400}">${escapeXml(truncate(line, 34))}</text>`;
    })
    .join("");
  return Buffer.from(
    `<svg width="${FRAME_WIDTH}" height="${LABEL_HEIGHT}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#101722"/>${text}</svg>`,
  );
}

function buildManifestTemplate({ backgrounds, videos }) {
  const uniqueBackgrounds = uniqueBySourceChecksum(backgrounds);
  const uniqueVideos = uniqueBySourceChecksum(videos);
  return {
    schemaVersion: "reaction-asset-manifest-v2",
    generatedAt: new Date().toISOString(),
    instructions: {
      backgrounds:
        "Complete contextTags and foregroundPlacement after visual review. Use short scene/context tags only; do not add mood, simplicity, caption-space, or text-treatment tags.",
      videos:
        "Complete reactions (first is primary), subjectCount, composition, and placement after visual review. Only alpha clips are eligible for direct compositing.",
    },
    tagOptions: {
      backgroundForegroundPlacement: [
        "bottom_center",
        "bottom_left",
        "bottom_right",
        "center",
      ],
      clipComposition: ["close_up", "bust", "full_body", "wide"],
      clipReactions: [
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
      ],
      clipSubjectCount: ["one", "two", "group"],
      statuses: ["pending", "active", "excluded"],
    },
    backgrounds: uniqueBackgrounds.map((background) => ({
      assetId: background.assetId,
      sourceFileName: background.sourceLabel,
      sourceRoot: background.sourceRoot,
      sourceSha256: background.sourceSha256,
      width: background.width,
      height: background.height,
      contextTags: [],
      foregroundPlacement: null,
      status: "pending",
    })),
    videos: uniqueVideos.map((video) => ({
      assetId: video.assetId,
      sourceFileName: video.sourceLabel,
      sourceRoot: video.sourceRoot,
      sourceSha256: video.sourceSha256,
      codec: video.codec,
      pixelFormat: video.pixelFormat,
      durationSeconds: video.durationSeconds,
      width: video.width,
      height: video.height,
      hasAlpha: video.hasAlpha,
      reactions: [],
      subjectCount: null,
      composition: null,
      placement: { anchor: null, heightPercent: null },
      status: video.hasAlpha ? "pending" : "excluded",
    })),
  };
}

function uniqueBySourceChecksum(assets) {
  const seen = new Set();
  return assets.filter((asset) => {
    if (seen.has(asset.sourceSha256)) return false;
    seen.add(asset.sourceSha256);
    return true;
  });
}

function runJson(command, commandArgs) {
  const output = execFileSync(command, commandArgs, { encoding: "utf8" });
  return JSON.parse(output);
}

function run(command, commandArgs) {
  try {
    execFileSync(command, commandArgs, { stdio: "pipe" });
  } catch (error) {
    const detail = error instanceof Error && "stderr" in error
      ? Buffer.from(error.stderr ?? "").toString("utf8").trim()
      : "";
    throw new Error(`Command failed: ${path.basename(command)} ${detail}`.trim());
  }
}

function sha256(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function roundSeconds(value) {
  return Number.isFinite(value) && value > 0
    ? Math.round(value * 1000) / 1000
    : 0;
}

function formatSeconds(value) {
  return Number.isFinite(value) && value > 0 ? `${value.toFixed(2)}s` : "unknown duration";
}

function truncate(value, limit) {
  return value.length > limit ? `${value.slice(0, Math.max(limit - 1, 1))}…` : value;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function parseArgs(rawArgs) {
  const parsed = {};
  for (let index = 0; index < rawArgs.length; index += 1) {
    const argument = rawArgs[index];
    if (!argument.startsWith("--")) continue;
    const key = argument.slice(2);
    const value = rawArgs[index + 1];
    if (!value || value.startsWith("--")) {
      parsed[key] = true;
      continue;
    }
    parsed[key] = value;
    index += 1;
  }
  return parsed;
}

await main();
