import { createClient } from "@supabase/supabase-js";
import ffmpegPath from "ffmpeg-static";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const DEFAULT_FOLDER =
  "C:\\Users\\chund\\OneDrive\\Desktop\\videos_real";
const DEFAULT_MANIFEST =
  "scripts/data/wall-text-videos-real-2026-07-28.json";
const DEFAULT_REPORT =
  ".tmp/wall-text-placement/wall-text-placement-analysis.json";
const FACE_DETECTOR_SCRIPT = path.resolve(
  "scripts/detect-wall-text-video-faces.py",
);
const ANALYZER_VERSION = "wall-text-placement-v2";
const ZONES = {
  "upper-middle": {
    height: 480 / 1920,
    width: 660 / 1080,
    x: 210 / 1080,
    y: 560 / 1920,
  },
  middle: {
    height: 480 / 1920,
    width: 660 / 1080,
    x: 210 / 1080,
    y: 660 / 1920,
  },
  "lower-middle": {
    height: 480 / 1920,
    width: 660 / 1080,
    x: 210 / 1080,
    y: 800 / 1920,
  },
};

loadEnvFile(path.resolve(".env.local"));

const args = parseArgs(process.argv.slice(2));
const execute = Boolean(args.execute);
const folder = path.resolve(String(args.folder || DEFAULT_FOLDER));
const manifestPath = path.resolve(String(args.manifest || DEFAULT_MANIFEST));
const reportPath = path.resolve(String(args.report || DEFAULT_REPORT));

if (execute && !args.yes) {
  throw new Error(
    "Refusing to update placement metadata without --yes. Run the dry analysis first.",
  );
}

if (!ffmpegPath) {
  throw new Error("ffmpeg-static is unavailable.");
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const pythonPath = getRequiredEnv("WALL_TEXT_PLACEMENT_PYTHON");
const results = [];

for (const [index, asset] of manifest.assets.entries()) {
  const filePath = path.join(folder, asset.fileName);
  console.log(`[${index + 1}/${manifest.assets.length}] ${asset.catalogName}`);
  const frame = extractRepresentativeFrame(filePath);
  const analysis = await analyzeFrame(frame, filePath);

  results.push({
    catalogName: asset.catalogName,
    fileName: asset.fileName,
    placementAnalysis: analysis,
    sha256: asset.sha256,
    visualGroup: asset.visualGroup,
  });
}

const report = {
  analyzedAt: new Date().toISOString(),
  analyzerVersion: ANALYZER_VERSION,
  assetCount: results.length,
  assets: results,
  invalidCount: results.filter(
    (result) => result.placementAnalysis === null,
  ).length,
  sourceBatch: manifest.sourceBatch,
  zoneCounts: countBy(
    results.filter((result) => result.placementAnalysis),
    (result) => result.placementAnalysis.selectedZone,
  ),
};

writeReport(reportPath, report);
console.log(JSON.stringify(report, null, 2));

if (!execute) {
  console.log(
    `Dry analysis complete. Report written to ${reportPath}; Supabase was not changed.`,
  );
  process.exit(0);
}

const supabase = createClient(
  getRequiredEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
  getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { autoRefreshToken: false, persistSession: false } },
);

for (const result of results) {
  const { data, error } = await supabase
    .from("overlay_media_assets")
    .update({ placement_analysis: result.placementAnalysis })
    .eq("format_family", "wall_text_overlay")
    .eq("source_file_sha256", result.sha256)
    .select("id");

  if (error) {
    throw new Error(
      `Could not save placement for ${result.catalogName}: ${error.message}`,
    );
  }

  if (data.length !== 1) {
    throw new Error(
      `Expected one Wall asset for ${result.catalogName}; found ${data.length}.`,
    );
  }
}

console.log(
  `Saved v2 face-aware placement metadata for ${report.assetCount - report.invalidCount} videos. Cleared stale placement metadata for ${report.invalidCount} rejected videos so they remain stored but ineligible.`,
);

async function analyzeFrame(frame, filePath) {
  const [localDetection, metadata] = await Promise.all([
    detectFacesLocally(filePath),
    sharp(frame).metadata(),
  ]);
  const faceBoxes = localDetection.faceBoxes;
  const protectedLandmarks = localDetection.protectedLandmarks;
  const faceLandmarkGroups = groupFaceLandmarks(protectedLandmarks);
  const importantRegions = faceBoxes.map((face) =>
    clampBox({
      height: face.height * 4.2,
      width: face.width * 2.4,
      x: face.x - face.width * 0.7,
      y: face.y - face.height * 0.15,
    }),
  );
  const candidates = await Promise.all(
    Object.entries(ZONES).map(async ([zone, box]) => {
      const faceOverlap = maximumOverlap(faceBoxes, box);
      const coversBothEyes = faceLandmarkGroups.some(
        ([leftEye, rightEye]) =>
          pointIsInside(leftEye, box) && pointIsInside(rightEye, box),
      );
      const coversMouth = faceLandmarkGroups.some(([, , mouth]) =>
        pointIsInside(mouth, box),
      );
      const importantOverlap = maximumOverlap(importantRegions, box);
      const contrastScore = await measureWhiteTextContrast(
        frame,
        metadata,
        box,
      );

      return {
        box,
        contrastScore,
        coversBothEyes,
        coversMouth,
        faceOverlap,
        importantOverlap,
        score:
          contrastScore -
          importantOverlap * 0.25 -
          faceOverlap * 0.4 -
          (coversMouth ? 0.08 : 0) +
          (zone === "middle" ? 0.06 : 0),
        zone,
      };
    }),
  );
  const valid = candidates
    .filter((candidate) => !candidate.coversBothEyes)
    .sort(
      (first, second) =>
        second.score - first.score ||
        first.faceOverlap - second.faceOverlap ||
        first.zone.localeCompare(second.zone),
    );
  const selected = valid[0];

  if (!selected) {
    return null;
  }

  return {
    contrastScore: round(selected.contrastScore),
    faceBoxes: faceBoxes.map(roundBox),
    faceOverlap: round(selected.faceOverlap),
    importantRegions: importantRegions.map(roundBox),
    selectedZone: selected.zone,
    version: ANALYZER_VERSION,
  };
}

function detectFacesLocally(filePath) {
  const output = execFileSync(
    pythonPath,
    [FACE_DETECTOR_SCRIPT, filePath, "2"],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        PYTHONPATH: process.env.WALL_TEXT_PLACEMENT_PYTHONPATH?.trim(),
      },
      maxBuffer: 2 * 1024 * 1024,
    },
  );
  const parsed = JSON.parse(output);

  if (
    !Array.isArray(parsed.faceBoxes) ||
    !Array.isArray(parsed.protectedLandmarks)
  ) {
    throw new Error(`Local face detector returned invalid data for ${filePath}.`);
  }

  return parsed;
}

function extractRepresentativeFrame(filePath) {
  return execFileSync(
    ffmpegPath,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-ss",
      "2",
      "-i",
      filePath,
      "-frames:v",
      "1",
      "-vf",
      "scale=720:-2",
      "-f",
      "image2pipe",
      "-vcodec",
      "png",
      "pipe:1",
    ],
    { maxBuffer: 20 * 1024 * 1024 },
  );
}

async function measureWhiteTextContrast(frame, metadata, box) {
  if (!metadata.width || !metadata.height) {
    throw new Error("Could not read the representative frame dimensions.");
  }

  const left = Math.max(0, Math.round(box.x * metadata.width));
  const top = Math.max(0, Math.round(box.y * metadata.height));
  const width = Math.min(
    metadata.width - left,
    Math.max(1, Math.round(box.width * metadata.width)),
  );
  const height = Math.min(
    metadata.height - top,
    Math.max(1, Math.round(box.height * metadata.height)),
  );
  const stats = await sharp(frame)
    .extract({ height, left, top, width })
    .greyscale()
    .stats();
  const channel = stats.channels[0];
  const darkness = 1 - channel.mean / 255;
  const calmness = 1 - Math.min(channel.stdev / 96, 1);
  return darkness * 0.78 + calmness * 0.22;
}

function clampBox(box) {
  const x = clamp(box.x);
  const y = clamp(box.y);
  return {
    height: Math.min(clamp(box.height), 1 - y),
    width: Math.min(clamp(box.width), 1 - x),
    x,
    y,
  };
}

function maximumOverlap(regions, box) {
  return Math.max(
    0,
    ...regions.map((region) => overlapAgainstRegion(region, box)),
  );
}

function overlapAgainstRegion(region, box) {
  const left = Math.max(region.x, box.x);
  const top = Math.max(region.y, box.y);
  const right = Math.min(region.x + region.width, box.x + box.width);
  const bottom = Math.min(region.y + region.height, box.y + box.height);
  const intersection =
    Math.max(0, right - left) * Math.max(0, bottom - top);
  const regionArea = region.width * region.height;
  return regionArea > 0 ? intersection / regionArea : 0;
}

function pointIsInside(point, box) {
  return (
    point.x >= box.x &&
    point.x <= box.x + box.width &&
    point.y >= box.y &&
    point.y <= box.y + box.height
  );
}

function groupFaceLandmarks(landmarks) {
  const groups = [];

  for (let index = 0; index < landmarks.length; index += 3) {
    const group = landmarks.slice(index, index + 3);

    if (group.length === 3) {
      groups.push(group);
    }
  }

  return groups;
}

function roundBox(box) {
  return {
    height: round(box.height),
    width: round(box.width),
    x: round(box.x),
    y: round(box.y),
  };
}

function round(value) {
  return Math.round(value * 10_000) / 10_000;
}

function clamp(value) {
  return Math.max(0, Math.min(1, Number(value)));
}

function countBy(items, selector) {
  return Object.fromEntries(
    [...items.reduce((counts, item) => {
      const key = selector(item);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      return counts;
    }, new Map())].sort(([first], [second]) =>
      String(first).localeCompare(String(second)),
    ),
  );
}

function writeReport(filePath, value) {
  const directory = path.dirname(filePath);
  mkdirSync(directory, { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function parseArgs(values) {
  const parsed = {};

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];

    if (!value.startsWith("--")) {
      continue;
    }

    const key = value.slice(2);
    const next = values[index + 1];

    if (!next || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      index += 1;
    }
  }

  return parsed;
}

function loadEnvFile(filePath) {
  const source = readFileSync(filePath, "utf8");

  for (const line of source.split(/\r?\n/u)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");

    if (separator <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function getRequiredEnv(...names) {
  for (const name of names) {
    const value = process.env[name]?.trim();

    if (value) {
      return value;
    }
  }

  throw new Error(`Missing required environment value: ${names.join(" or ")}`);
}
