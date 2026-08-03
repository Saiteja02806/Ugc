import { createClient } from "@supabase/supabase-js";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import sharp from "sharp";

import { renderCarouselSlide } from "../lib/carousel/render-slide.ts";

const DEFAULT_IMPORT_ROOT = ".tmp/local-carousel-image-import";
const OUTPUT_ROOT = ".tmp/local-carousel-render-canary";
const TARGET_GROUPS = [
  ["productivity-saas", "notes-and-planning"],
  ["productivity-saas", "workspace-objects"],
  ["productivity-saas", "phone-and-devices"],
  ["fitness-health", "food-and-table"],
  ["fitness-health", "fitness-wellness-objects"],
  ["shared", "home-lifestyle"],
];

loadEnvFile(path.resolve(".env.local"));

const args = parseArgs(process.argv.slice(2));
const manifestPath = path.resolve(
  args.manifest ??
    findLatestManifest(DEFAULT_IMPORT_ROOT, "import-manifest.json"),
);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const assets = Array.isArray(manifest.assets) ? manifest.assets : [];
const outputDir = path.join(
  path.resolve(args["out-dir"] ?? OUTPUT_ROOT),
  new Date().toISOString().replace(/[:.]/g, "-"),
);

assertOneRequiredEnvVar(["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]);
assertRequiredEnvVars(["SUPABASE_SERVICE_ROLE_KEY"]);
mkdirSync(outputDir, { recursive: true });

const selectedAssets = TARGET_GROUPS.map(([categorySlug, broadVisualBucket]) => {
  const asset = assets.find(
    (candidate) =>
      candidate.categorySlug === categorySlug &&
      candidate.broadVisualBucket === broadVisualBucket,
  );

  if (!asset) {
    throw new Error(
      `Manifest has no canary asset for ${categorySlug}/${broadVisualBucket}.`,
    );
  }

  return asset;
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
const { data: rows, error } = await supabase
  .from("category_image_assets")
  .select(
    "id,base_s3_key,base_url,broad_visual_bucket,category_slug,source_filename,source_provider",
  )
  .in(
    "base_s3_key",
    selectedAssets.map((asset) => asset.storage.baseKey),
  );

if (error) {
  throw new Error(`Could not read imported canary rows: ${error.message}`);
}

const rowsByBaseKey = new Map(
  (rows ?? []).map((row) => [row.base_s3_key, row]),
);
const outputs = [];
const reportItems = [];

for (const [index, asset] of selectedAssets.entries()) {
  const row = rowsByBaseKey.get(asset.storage.baseKey);

  if (!row?.base_url) {
    throw new Error(`${asset.assetKey}: production base URL is missing.`);
  }

  const slide = buildCanarySlide(asset, index + 1);
  const rendered = await renderCarouselSlide({
    assetUrl: row.base_url,
    format: "4:5",
    slide,
    textStyle: "highlight",
  });
  const outputPath = path.join(
    outputDir,
    `${index + 1}-${asset.categorySlug}-${asset.broadVisualBucket}.webp`,
  );
  writeFileSync(outputPath, rendered);
  const metadata = await sharp(rendered).metadata();

  if (metadata.width !== 1080 || metadata.height !== 1350) {
    throw new Error(
      `${asset.assetKey}: rendered ${metadata.width}x${metadata.height}; expected 1080x1350.`,
    );
  }

  outputs.push(outputPath);
  reportItems.push({
    assetId: row.id,
    assetKey: asset.assetKey,
    baseUrl: row.base_url,
    broadVisualBucket: asset.broadVisualBucket,
    categorySlug: asset.categorySlug,
    outputPath,
    sourceFileName: row.source_filename,
    sourceProvider: row.source_provider,
  });
}

const contactSheetPath = path.join(outputDir, "contact-sheet.webp");
await writeContactSheet(outputs, contactSheetPath);
const report = {
  contactSheetPath,
  generatedAt: new Date().toISOString(),
  manifestPath,
  ok: true,
  renderedSlides: reportItems,
};
const reportPath = path.join(outputDir, "report.json");
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

console.log("Local Carousel GCP render canary complete");
console.log(`Rendered slides: ${reportItems.length}`);
console.log(`Contact sheet: ${contactSheetPath}`);
console.log(`Report: ${reportPath}`);

function buildCanarySlide(asset, slideNumber) {
  const copyByBucket = {
    "notes-and-planning": {
      body: "Keep plans, notes, and deadlines together in one calmer workflow.",
      headline: "make the next task obvious",
    },
    "workspace-objects": {
      body: "A focused workspace makes repeated work easier to finish.",
      headline: "less tab switching",
    },
    "phone-and-devices": {
      body: "Keep the next reminder close without losing the larger plan.",
      headline: "your workflow, in reach",
    },
    "food-and-table": {
      body: "See the meal clearly, then log what matters without guessing.",
      headline: "simpler food tracking",
    },
    "fitness-wellness-objects": {
      body: "Build a routine around movement, hydration, and recovery.",
      headline: "healthy habits that stick",
    },
    "home-lifestyle": {
      body: "Create a calmer rhythm for work, wellness, and the time between.",
      headline: "make space for the routine",
    },
  };
  const copy = copyByBucket[asset.broadVisualBucket];

  return {
    body: copy.body,
    ctaText: null,
    headline: copy.headline,
    imageDirection: `Object-only ${asset.broadVisualBucket} scene with readable text space.`,
    layoutPreset: "middle-statement",
    listItems: [],
    slideNumber,
    slideType: slideNumber === 1 ? "hook" : "solution",
    subtext: copy.body,
    textMode: "headline_body",
    textPosition: "center",
  };
}

async function writeContactSheet(outputs, outputPath) {
  const tileWidth = 324;
  const tileHeight = 405;
  const gap = 22;
  const columns = 3;
  const rows = Math.ceil(outputs.length / columns);
  const width = columns * tileWidth + (columns + 1) * gap;
  const height = rows * tileHeight + (rows + 1) * gap;
  const composites = [];

  for (const [index, output] of outputs.entries()) {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const image = await sharp(output)
      .resize(tileWidth, tileHeight, { fit: "cover" })
      .webp({ quality: 88 })
      .toBuffer();

    composites.push({
      input: image,
      left: gap + column * (tileWidth + gap),
      top: gap + row * (tileHeight + gap),
    });
  }

  await sharp({
    create: {
      background: "#e9e6df",
      channels: 4,
      height,
      width,
    },
  })
    .composite(composites)
    .webp({ quality: 92 })
    .toFile(outputPath);
}

function findLatestManifest(root, fileName) {
  const absoluteRoot = path.resolve(root);
  const latestDir = readdirSync(absoluteRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(absoluteRoot, entry.name))
    .sort()
    .at(-1);
  const latestManifestPath = latestDir
    ? path.join(latestDir, fileName)
    : null;

  if (!latestManifestPath || !existsSync(latestManifestPath)) {
    throw new Error(`Could not find ${fileName} under ${absoluteRoot}.`);
  }

  return latestManifestPath;
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);

    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;

    if (!process.env[key]) {
      process.env[key] = cleanEnvValue(rawValue);
    }
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

function getRequiredEnv(...names) {
  for (const name of names) {
    const value = process.env[name]?.trim();

    if (value) {
      return value;
    }
  }

  throw new Error(`Missing ${names.join(" or ")}`);
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

function parseArgs(rawArgs) {
  const parsed = {};

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];

    if (!arg.startsWith("--")) {
      continue;
    }

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
