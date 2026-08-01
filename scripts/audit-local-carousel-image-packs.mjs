import crypto from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const SUPPORTED_IMAGE_EXTENSIONS = new Set([
  ".avif",
  ".jpeg",
  ".jpg",
  ".png",
  ".webp",
]);
const DEFAULT_OUTPUT_ROOT = ".tmp/local-carousel-image-pack-audit";
const DEFAULT_CAROUSEL_WIDTH = 1080;
const DEFAULT_CAROUSEL_HEIGHT = 1350;
const NEAR_DUPLICATE_DISTANCE = 5;
const LOW_RESOLUTION_MIN_WIDTH = 900;
const LOW_RESOLUTION_MIN_HEIGHT = 900;
const DEFAULT_SOURCE_ROOTS = [
  {
    categorySlug: "calorie_tracking",
    path: "C:/Users/chund/Downloads/calory tracking",
  },
  {
    categorySlug: "gym",
    path: "C:/Users/chund/Downloads/gym_carousel_images_pack/gym_carousel_images",
  },
  {
    categorySlug: "gym",
    path: "C:/Users/chund/Downloads/gym_carousel_images_pack/gym_carousel_images_batch2",
  },
  {
    categorySlug: "gym",
    path: "C:/Users/chund/Downloads/gym_carousel_images_pack/gym_carousel_images_batch3",
  },
  {
    categorySlug: "gym",
    path: "C:/Users/chund/Downloads/gym_carousel_images_pack/gym_carousel_images_batch4",
  },
  {
    categorySlug: "personal_finance",
    path: "C:/Users/chund/Downloads/personal_finance_carousel_images_pack/personal_finance_carousel_images",
  },
  {
    categorySlug: "personal_finance",
    path: "C:/Users/chund/Downloads/personal_finance_carousel_images_pack/personal_finance_carousel_images_batch2",
  },
  {
    categorySlug: "personal_finance",
    path: "C:/Users/chund/Downloads/personal_finance_carousel_images_pack/personal_finance_carousel_images_batch3",
  },
  {
    categorySlug: "personal_finance",
    path: "C:/Users/chund/Downloads/personal_finance_carousel_images_pack/personal_finance_carousel_images_batch4",
  },
  {
    categorySlug: "productivity",
    path: "C:/Users/chund/Downloads/productivity",
  },
];

const args = parseArgs(process.argv.slice(2));
const sourceRoots = getSourceRoots(args);
const outputRoot = path.resolve(args.outDir || args["out-dir"] || DEFAULT_OUTPUT_ROOT);
const generatedAt = new Date().toISOString();
const outputDir = path.join(outputRoot, generatedAt.replace(/[:.]/g, "-"));

await mkdir(outputDir, { recursive: true });

const roots = [];
const imageFiles = [];
const errors = [];

for (const sourceRoot of sourceRoots) {
  const rootPath = path.resolve(sourceRoot.path);
  const root = {
    categorySlug: sourceRoot.categorySlug,
    exists: existsSync(rootPath),
    path: rootPath,
  };

  if (!root.exists) {
    roots.push({
      ...root,
      counts: emptyRootCounts(),
      dimensions: [],
      sidecars: [],
      warnings: [`Missing folder: ${rootPath}`],
    });
    continue;
  }

  const files = await walkFiles(rootPath);
  const sidecars = files
    .filter((filePath) => !isSupportedImage(filePath))
    .map((filePath) => normalizePath(path.relative(rootPath, filePath)));
  const rootImages = files.filter(isSupportedImage);
  const analyzedImages = [];

  for (const filePath of rootImages) {
    try {
      const image = await analyzeImageFile({
        categorySlug: sourceRoot.categorySlug,
        filePath,
        rootPath,
      });

      analyzedImages.push(image);
      imageFiles.push(image);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      errors.push({
        categorySlug: sourceRoot.categorySlug,
        filePath,
        message,
        rootPath,
      });
    }
  }

  roots.push({
    ...root,
    counts: getRootCounts(analyzedImages),
    dimensions: summarizeDimensions(analyzedImages),
    sidecars,
    warnings: getRootWarnings(analyzedImages, sidecars),
  });
}

const originalCropPairs = findOriginalCropPairs(imageFiles);
const exactDuplicateGroups = findExactDuplicateGroups(imageFiles);
const nearDuplicateGroups = findNearDuplicateGroups(imageFiles);
const sourceSiblingGroups = findSourceSiblingGroups(imageFiles);
const recommendations = buildRecommendations({
  exactDuplicateGroups,
  imageFiles,
  originalCropPairs,
});
const categorySummaries = summarizeCategories({
  exactDuplicateGroups,
  imageFiles,
  recommendations,
});
const report = {
  generatedAt,
  input: {
    nearDuplicateDistance: NEAR_DUPLICATE_DISTANCE,
    sourceRoots,
  },
  summary: {
    categories: categorySummaries,
    corruptedFiles: errors.length,
    exactDuplicateGroups: exactDuplicateGroups.length,
    imageFiles: imageFiles.length,
    nearDuplicateGroups: nearDuplicateGroups.length,
    originalCropPairs: originalCropPairs.length,
    sourceSiblingGroups: sourceSiblingGroups.length,
    uniqueVisualFamilies: countUniqueVisualFamilies({
      exactDuplicateGroups,
      imageFiles,
      nearDuplicateGroups,
      originalCropPairs,
      sourceSiblingGroups,
    }),
  },
  roots,
  originalCropPairs,
  exactDuplicateGroups,
  nearDuplicateGroups,
  sourceSiblingGroups,
  recommendations,
  errors,
  nextStepPolicy: {
    canonicalSource:
      "Use originals as canonical assets when present. Treat carousel-cropped files as derived renditions tied to the same visual family.",
    croppedOnly:
      "Cropped-only assets can be imported as lower-resolution candidates when no original exists.",
    safety:
      "Every imported local asset starts unreviewed and must remain unselectable until manual strict object-only review approves it.",
    dedupe:
      "Use SHA-256, source URL/Pexels ID, and perceptual hash/near-duplicate family together. Different crops of the same image count as one visual family.",
  },
};
const reportPath = path.join(outputDir, "report.json");
const summaryPath = path.join(outputDir, "summary.md");
const csvPath = path.join(outputDir, "file-recommendations.csv");

await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
await writeFile(summaryPath, renderSummaryMarkdown(report));
await writeFile(csvPath, renderRecommendationCsv(recommendations));

printConsoleSummary(report, {
  csvPath,
  reportPath,
  summaryPath,
});

function getSourceRoots(parsedArgs) {
  const manifestPath = parsedArgs.manifest
    ? path.resolve(parsedArgs.manifest)
    : null;

  if (!manifestPath) {
    return DEFAULT_SOURCE_ROOTS;
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

  if (!Array.isArray(manifest.sourceRoots)) {
    throw new Error("Manifest must contain a sourceRoots array.");
  }

  return manifest.sourceRoots.map((entry) => {
    if (
      !entry ||
      typeof entry !== "object" ||
      typeof entry.categorySlug !== "string" ||
      typeof entry.path !== "string"
    ) {
      throw new Error("Each sourceRoots item must include categorySlug and path.");
    }

    return {
      categorySlug: normalizeCategorySlug(entry.categorySlug),
      path: entry.path,
    };
  });
}

async function walkFiles(rootPath) {
  const output = [];
  const entries = await readdir(rootPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(rootPath, entry.name);

    if (entry.isDirectory()) {
      output.push(...(await walkFiles(fullPath)));
      continue;
    }

    if (entry.isFile()) {
      output.push(fullPath);
    }
  }

  return output;
}

async function analyzeImageFile({ categorySlug, filePath, rootPath }) {
  const buffer = readFileSync(filePath);
  const metadata = await sharp(buffer, { failOn: "none" }).metadata();
  const relativePath = normalizePath(path.relative(rootPath, filePath));
  const topFolder = getTopFolder(relativePath);
  const fileStat = await stat(filePath);
  const sourceMetadata = readSourceMetadata(filePath, rootPath);
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (!width || !height) {
    throw new Error("Image has no readable width or height.");
  }

  return {
    aspectRatio: Number((width / height).toFixed(4)),
    averageHash: await averageHash(buffer),
    categorySlug,
    extension: path.extname(filePath).toLowerCase(),
    fileName: path.basename(filePath),
    fileSizeBytes: fileStat.size,
    format: metadata.format ?? path.extname(filePath).replace(".", ""),
    height,
    isCarouselCrop: isCarouselCropPath(relativePath, width, height),
    isLowResolution:
      width < LOW_RESOLUTION_MIN_WIDTH || height < LOW_RESOLUTION_MIN_HEIGHT,
    isOriginal: isOriginalPath(relativePath),
    isPreviewArtifact: isPreviewArtifact(relativePath),
    perceptualHash: await differenceHash(buffer),
    relativePath,
    rootPath,
    sha256Hash: crypto.createHash("sha256").update(buffer).digest("hex"),
    sourceMetadata,
    stem: normalizeStem(path.basename(filePath, path.extname(filePath))),
    textSafeAreaHint: getTextSafeAreaHint(width, height),
    topFolder,
    width,
  };
}

function readSourceMetadata(filePath, rootPath) {
  const sourceCsvPath = path.join(rootPath, "sources.csv");

  if (!existsSync(sourceCsvPath)) {
    return null;
  }

  const rows = parseSimpleCsv(readFileSync(sourceCsvPath, "utf8"));
  const fileName = path.basename(filePath).toLowerCase();
  const row = rows.find((item) =>
    Object.values(item).some(
      (value) => typeof value === "string" && value.toLowerCase() === fileName,
    ),
  );

  return row ?? null;
}

function parseSimpleCsv(content) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headers = splitCsvLine(lines[0]).map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const row = {};

    headers.forEach((header, index) => {
      row[header] = values[index]?.trim() ?? "";
    });

    return row;
  });
}

function splitCsvLine(line) {
  const values = [];
  let current = "";
  let inQuote = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuote = !inQuote;
      continue;
    }

    if (char === "," && !inQuote) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);

  return values;
}

async function averageHash(buffer) {
  const raw = await sharp(buffer)
    .resize(8, 8, { fit: "fill" })
    .greyscale()
    .raw()
    .toBuffer();
  const average = raw.reduce((total, value) => total + value, 0) / raw.length;

  return Array.from(raw, (value) => (value >= average ? "1" : "0")).join("");
}

async function differenceHash(buffer) {
  const raw = await sharp(buffer)
    .resize(9, 8, { fit: "fill" })
    .greyscale()
    .raw()
    .toBuffer();
  const bits = [];

  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      const left = raw[row * 9 + column];
      const right = raw[row * 9 + column + 1];

      bits.push(left > right ? "1" : "0");
    }
  }

  return bits.join("");
}

function findOriginalCropPairs(images) {
  const pairs = [];
  const imagesByRootAndStem = new Map();

  for (const image of images) {
    const key = `${image.rootPath}::${image.stem}`;
    const group = imagesByRootAndStem.get(key) ?? [];

    group.push(image);
    imagesByRootAndStem.set(key, group);
  }

  for (const group of imagesByRootAndStem.values()) {
    const originals = group.filter((image) => image.isOriginal);
    const crops = group.filter((image) => image.isCarouselCrop);

    for (const crop of crops) {
      const original = originals[0] ?? null;

      if (!original) {
        continue;
      }

      pairs.push({
        averageHashDistance: hammingDistance(crop.averageHash, original.averageHash),
        crop: toFileReference(crop),
        original: toFileReference(original),
        perceptualHashDistance: hammingDistance(
          crop.perceptualHash,
          original.perceptualHash,
        ),
      });
    }
  }

  return pairs.sort((first, second) =>
    first.crop.relativePath.localeCompare(second.crop.relativePath),
  );
}

function findExactDuplicateGroups(images) {
  return findGroups(
    images,
    (image) => image.sha256Hash,
    (group) => group.length > 1,
  ).map((group) => ({
    sha256Hash: group[0].sha256Hash,
    files: group.map(toFileReference),
  }));
}

function findNearDuplicateGroups(images) {
  const candidates = images.filter((image) => !image.isPreviewArtifact);
  const unionFind = createUnionFind(candidates.length);

  for (let firstIndex = 0; firstIndex < candidates.length; firstIndex += 1) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < candidates.length;
      secondIndex += 1
    ) {
      const first = candidates[firstIndex];
      const second = candidates[secondIndex];

      if (first.sha256Hash === second.sha256Hash) {
        unionFind.union(firstIndex, secondIndex);
        continue;
      }

      const perceptualDistance = hammingDistance(
        first.perceptualHash,
        second.perceptualHash,
      );
      const averageDistance = hammingDistance(first.averageHash, second.averageHash);

      if (
        perceptualDistance <= NEAR_DUPLICATE_DISTANCE ||
        averageDistance <= NEAR_DUPLICATE_DISTANCE
      ) {
        unionFind.union(firstIndex, secondIndex);
      }
    }
  }

  const groups = new Map();

  candidates.forEach((image, index) => {
    const root = unionFind.find(index);
    const group = groups.get(root) ?? [];

    group.push(image);
    groups.set(root, group);
  });

  return Array.from(groups.values())
    .filter((group) => group.length > 1)
    .map((group) => ({
      files: group.map(toFileReference),
      groupKey: createStableGroupKey(group),
    }));
}

function findSourceSiblingGroups(images) {
  const sourceGroups = findGroups(
    images.filter((image) => image.sourceMetadata),
    (image) => getSourceIdentity(image.sourceMetadata),
    (group, key) => Boolean(key) && group.length > 1,
  );

  return sourceGroups.map((group) => ({
    files: group.map(toFileReference),
    sourceIdentity: getSourceIdentity(group[0].sourceMetadata),
  }));
}

function buildRecommendations({ exactDuplicateGroups, imageFiles, originalCropPairs }) {
  const exactDuplicateFileKeys = new Set();
  const originalCropFileKeys = new Set();
  const cropPairByFileKey = new Map();

  for (const group of exactDuplicateGroups) {
    const sortedFiles = [...group.files].sort((first, second) => {
      const firstScore = recommendationPriority(first);
      const secondScore = recommendationPriority(second);

      if (firstScore !== secondScore) {
        return firstScore - secondScore;
      }

      return first.relativePath.localeCompare(second.relativePath);
    });

    for (const duplicate of sortedFiles.slice(1)) {
      exactDuplicateFileKeys.add(getFileKey(duplicate));
    }
  }

  for (const pair of originalCropPairs) {
    const fileKey = getFileKey(pair.crop);

    originalCropFileKeys.add(fileKey);
    cropPairByFileKey.set(fileKey, pair);
  }

  return imageFiles
    .map((image) => {
      const file = toFileReference(image);
      const fileKey = getFileKey(file);
      const qualityWarnings = [];
      let recommendation = "flat_candidate";
      let reason = "Flat image candidate. Requires provenance and manual review.";

      if (image.isPreviewArtifact) {
        recommendation = "exclude_preview";
        reason = "Preview or audit artifact, not a production source image.";
      } else if (exactDuplicateFileKeys.has(fileKey)) {
        recommendation = "exclude_exact_duplicate";
        reason = "Exact byte duplicate of another file in the source set.";
      } else if (image.isOriginal) {
        recommendation = "canonical_original";
        reason =
          "Full-resolution original. Use this as canonical source when approved.";
      } else if (originalCropFileKeys.has(fileKey)) {
        recommendation = "derived_crop";
        reason =
          "Carousel crop has a matching original. Store as derivative, not a separate fresh asset.";
      } else if (image.isCarouselCrop) {
        recommendation = "cropped_only_candidate";
        reason =
          "Carousel-sized image without matching original. Can be canonical only if original cannot be recovered.";
      }

      if (image.isLowResolution) {
        qualityWarnings.push("low_resolution");
      }

      if (
        image.width === DEFAULT_CAROUSEL_WIDTH &&
        image.height === DEFAULT_CAROUSEL_HEIGHT
      ) {
        qualityWarnings.push("carousel_render_size");
      }

      return {
        ...file,
        aspectRatio: image.aspectRatio,
        canonicalPair:
          cropPairByFileKey.get(fileKey)?.original.relativePath ?? null,
        fileSizeBytes: image.fileSizeBytes,
        height: image.height,
        qualityWarnings,
        reason,
        recommendation,
        reviewStatus: "unreviewed",
        sha256Hash: image.sha256Hash,
        sourceMetadata: image.sourceMetadata,
        textSafeAreaHint: image.textSafeAreaHint,
        width: image.width,
      };
    })
    .sort((first, second) => {
      const categorySort = first.categorySlug.localeCompare(second.categorySlug);

      if (categorySort !== 0) {
        return categorySort;
      }

      return first.relativePath.localeCompare(second.relativePath);
    });
}

function summarizeCategories({ exactDuplicateGroups, imageFiles, recommendations }) {
  const exactDuplicateFileKeys = new Set(
    exactDuplicateGroups.flatMap((group) =>
      group.files.slice(1).map((file) => getFileKey(file)),
    ),
  );
  const byCategory = new Map();

  for (const image of imageFiles) {
    const summary =
      byCategory.get(image.categorySlug) ??
      {
        approvedCandidates: 0,
        canonicalOriginals: 0,
        carouselCrops: 0,
        exactDuplicateFiles: 0,
        flatCandidates: 0,
        imageFiles: 0,
        lowResolutionFiles: 0,
        originals: 0,
        previewArtifacts: 0,
      };

    summary.imageFiles += 1;
    summary.originals += image.isOriginal ? 1 : 0;
    summary.carouselCrops += image.isCarouselCrop ? 1 : 0;
    summary.flatCandidates += !image.isOriginal && !image.isCarouselCrop ? 1 : 0;
    summary.lowResolutionFiles += image.isLowResolution ? 1 : 0;
    summary.previewArtifacts += image.isPreviewArtifact ? 1 : 0;
    summary.exactDuplicateFiles += exactDuplicateFileKeys.has(getFileKey(image)) ? 1 : 0;
    byCategory.set(image.categorySlug, summary);
  }

  for (const item of recommendations) {
    const summary = byCategory.get(item.categorySlug);

    if (!summary) {
      continue;
    }

    if (
      item.recommendation === "canonical_original" ||
      item.recommendation === "cropped_only_candidate" ||
      item.recommendation === "flat_candidate"
    ) {
      summary.approvedCandidates += 1;
    }

    if (item.recommendation === "canonical_original") {
      summary.canonicalOriginals += 1;
    }
  }

  return Object.fromEntries(
    Array.from(byCategory.entries()).sort(([first], [second]) =>
      first.localeCompare(second),
    ),
  );
}

function countUniqueVisualFamilies({
  exactDuplicateGroups,
  imageFiles,
  nearDuplicateGroups,
  originalCropPairs,
  sourceSiblingGroups,
}) {
  const candidates = imageFiles.filter((image) => !image.isPreviewArtifact);
  const indexByFileKey = new Map(
    candidates.map((image, index) => [getFileKey(image), index]),
  );
  const unionFind = createUnionFind(candidates.length);

  const unionFiles = (files) => {
    const indexes = files
      .map((file) => indexByFileKey.get(getFileKey(file)))
      .filter((index) => typeof index === "number");

    for (const index of indexes.slice(1)) {
      unionFind.union(indexes[0], index);
    }
  };

  for (const group of exactDuplicateGroups) {
    unionFiles(group.files);
  }

  for (const group of nearDuplicateGroups) {
    unionFiles(group.files);
  }

  for (const pair of originalCropPairs) {
    unionFiles([pair.original, pair.crop]);
  }

  for (const group of sourceSiblingGroups) {
    unionFiles(group.files);
  }

  return new Set(candidates.map((_, index) => unionFind.find(index))).size;
}

function getRootCounts(images) {
  return {
    carouselCrops: images.filter((image) => image.isCarouselCrop).length,
    flatImages: images.filter(
      (image) => !image.isOriginal && !image.isCarouselCrop,
    ).length,
    images: images.length,
    lowResolutionImages: images.filter((image) => image.isLowResolution).length,
    originals: images.filter((image) => image.isOriginal).length,
    previewArtifacts: images.filter((image) => image.isPreviewArtifact).length,
  };
}

function emptyRootCounts() {
  return {
    carouselCrops: 0,
    flatImages: 0,
    images: 0,
    lowResolutionImages: 0,
    originals: 0,
    previewArtifacts: 0,
  };
}

function summarizeDimensions(images) {
  const counts = new Map();

  for (const image of images) {
    const key = `${image.width}x${image.height}`;

    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([size, count]) => ({ count, size }))
    .sort((first, second) => second.count - first.count || first.size.localeCompare(second.size));
}

function getRootWarnings(images, sidecars) {
  const warnings = [];
  const originals = images.filter((image) => image.isOriginal);
  const crops = images.filter((image) => image.isCarouselCrop);
  const flatImages = images.filter(
    (image) => !image.isOriginal && !image.isCarouselCrop,
  );

  if (crops.length > 0 && originals.length === 0) {
    warnings.push("Carousel crops are present without originals.");
  }

  if (originals.length > 0 && crops.length > 0 && originals.length !== crops.length) {
    warnings.push("Original and carousel crop counts do not match.");
  }

  if (flatImages.length > 0 && sidecars.length === 0) {
    warnings.push("Flat image folder has no source/provenance sidecar.");
  }

  if (images.some((image) => image.isLowResolution)) {
    warnings.push("Some images are below the recommended minimum dimensions.");
  }

  return warnings;
}

function isSupportedImage(filePath) {
  return SUPPORTED_IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function isOriginalPath(relativePath) {
  return relativePath
    .split("/")
    .some((part) => part.toLowerCase() === "originals");
}

function isCarouselCropPath(relativePath, width, height) {
  const parts = relativePath.split("/").map((part) => part.toLowerCase());

  return (
    parts.some((part) => part.startsWith("carousel_")) ||
    (width === DEFAULT_CAROUSEL_WIDTH && height === DEFAULT_CAROUSEL_HEIGHT)
  );
}

function isPreviewArtifact(relativePath) {
  const fileName = path.basename(relativePath).toLowerCase();

  return (
    fileName === "preview.jpg" ||
    fileName === "preview.png" ||
    fileName.startsWith("contact-sheet") ||
    fileName.includes("audit")
  );
}

function getTopFolder(relativePath) {
  const parts = relativePath.split("/");

  return parts.length > 1 ? parts[0] : "(root)";
}

function getTextSafeAreaHint(width, height) {
  const ratio = width / height;

  if (ratio < 0.85) {
    return ["top", "bottom"];
  }

  if (ratio > 1.25) {
    return ["left", "right"];
  }

  return ["top", "upper_left", "upper_right"];
}

function findGroups(items, keyFn, filterFn) {
  const groups = new Map();

  for (const item of items) {
    const key = keyFn(item);

    if (!key) {
      continue;
    }

    const group = groups.get(key) ?? [];

    group.push(item);
    groups.set(key, group);
  }

  return Array.from(groups.entries())
    .filter(([key, group]) => filterFn(group, key))
    .map(([, group]) => group);
}

function getSourceIdentity(sourceMetadata) {
  if (!sourceMetadata) {
    return "";
  }

  const values = Object.values(sourceMetadata)
    .map((value) => String(value).trim())
    .filter(Boolean);
  const url = values.find((value) => /^https?:\/\//i.test(value));

  return url ? url.toLowerCase() : values.join("|").toLowerCase();
}

function createUnionFind(size) {
  const parents = Array.from({ length: size }, (_, index) => index);

  return {
    find(index) {
      let current = index;

      while (parents[current] !== current) {
        parents[current] = parents[parents[current]];
        current = parents[current];
      }

      return current;
    },
    union(first, second) {
      const firstRoot = this.find(first);
      const secondRoot = this.find(second);

      if (firstRoot !== secondRoot) {
        parents[secondRoot] = firstRoot;
      }
    },
  };
}

function hammingDistance(first, second) {
  const maxLength = Math.max(first.length, second.length);
  let distance = 0;

  for (let index = 0; index < maxLength; index += 1) {
    if (first[index] !== second[index]) {
      distance += 1;
    }
  }

  return distance;
}

function createStableGroupKey(group) {
  const input = group
    .map((image) => `${image.categorySlug}:${image.relativePath}`)
    .sort()
    .join("|");

  return crypto.createHash("sha1").update(input).digest("hex").slice(0, 16);
}

function toFileReference(image) {
  return {
    averageHash: image.averageHash,
    categorySlug: image.categorySlug,
    fileName: image.fileName,
    height: image.height,
    perceptualHash: image.perceptualHash,
    relativePath: image.relativePath,
    rootPath: image.rootPath,
    sha256Hash: image.sha256Hash,
    topFolder: image.topFolder,
    width: image.width,
  };
}

function getFileKey(file) {
  return `${file.rootPath}::${file.relativePath}`;
}

function recommendationPriority(file) {
  if (file.topFolder === "originals") {
    return 0;
  }

  if (file.topFolder.startsWith("carousel_")) {
    return 2;
  }

  return 1;
}

function normalizeCategorySlug(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeStem(value) {
  return value
    .toLowerCase()
    .replace(/\s+-\s+copy$/i, "")
    .replace(/\s+copy$/i, "")
    .replace(/\s*\(\d+\)\s*$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizePath(value) {
  return value.replaceAll("\\", "/");
}

function renderSummaryMarkdown(report) {
  const lines = [
    "# Local Carousel Image Pack Audit",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "## Summary",
    "",
    `- Image files scanned: ${report.summary.imageFiles}`,
    `- Corrupted/unreadable files: ${report.summary.corruptedFiles}`,
    `- Original/crop pairs: ${report.summary.originalCropPairs}`,
    `- Exact duplicate groups: ${report.summary.exactDuplicateGroups}`,
    `- Near-duplicate groups: ${report.summary.nearDuplicateGroups}`,
    `- Source sibling groups: ${report.summary.sourceSiblingGroups}`,
    `- Estimated unique visual families: ${report.summary.uniqueVisualFamilies}`,
    "",
    "## Categories",
    "",
    "| Category | Images | Originals | Crops | Flat | Candidate canonical files | Exact duplicate files | Low resolution |",
    "|---|---:|---:|---:|---:|---:|---:|---:|",
  ];

  for (const [categorySlug, summary] of Object.entries(report.summary.categories)) {
    lines.push(
      `| ${categorySlug} | ${summary.imageFiles} | ${summary.originals} | ${summary.carouselCrops} | ${summary.flatCandidates} | ${summary.approvedCandidates} | ${summary.exactDuplicateFiles} | ${summary.lowResolutionFiles} |`,
    );
  }

  lines.push(
    "",
    "## Policy",
    "",
    `- ${report.nextStepPolicy.canonicalSource}`,
    `- ${report.nextStepPolicy.croppedOnly}`,
    `- ${report.nextStepPolicy.safety}`,
    `- ${report.nextStepPolicy.dedupe}`,
    "",
    "## Root Warnings",
    "",
  );

  for (const root of report.roots) {
    if (root.warnings.length === 0) {
      continue;
    }

    lines.push(`- ${root.categorySlug}: ${root.path}`);

    for (const warning of root.warnings) {
      lines.push(`  - ${warning}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

function renderRecommendationCsv(recommendations) {
  const headers = [
    "categorySlug",
    "recommendation",
    "relativePath",
    "canonicalPair",
    "width",
    "height",
    "fileSizeBytes",
    "reviewStatus",
    "qualityWarnings",
    "reason",
  ];
  const rows = recommendations.map((item) =>
    headers.map((header) => csvValue(formatCsvField(item[header]))).join(","),
  );

  return `${headers.join(",")}\n${rows.join("\n")}\n`;
}

function formatCsvField(value) {
  if (Array.isArray(value)) {
    return value.join("|");
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function csvValue(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function printConsoleSummary(report, paths) {
  console.log("Local carousel image pack audit complete");
  console.log(`Report: ${paths.reportPath}`);
  console.log(`Summary: ${paths.summaryPath}`);
  console.log(`Recommendations: ${paths.csvPath}`);
  console.log("");
  console.log(`Images: ${report.summary.imageFiles}`);
  console.log(`Original/crop pairs: ${report.summary.originalCropPairs}`);
  console.log(`Exact duplicate groups: ${report.summary.exactDuplicateGroups}`);
  console.log(`Near-duplicate groups: ${report.summary.nearDuplicateGroups}`);
  console.log(`Estimated unique visual families: ${report.summary.uniqueVisualFamilies}`);
  console.log("");

  for (const [categorySlug, summary] of Object.entries(report.summary.categories)) {
    console.log(
      `${categorySlug}: ${summary.imageFiles} images, ${summary.approvedCandidates} canonical candidates, ${summary.exactDuplicateFiles} exact duplicate files`,
    );
  }
}

function parseArgs(values) {
  const parsed = {};

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];

    if (!value.startsWith("--")) {
      continue;
    }

    const key = value.slice(2);
    const nextValue = values[index + 1];

    if (!nextValue || nextValue.startsWith("--")) {
      parsed[key] = "true";
      continue;
    }

    parsed[key] = nextValue;
    index += 1;
  }

  return parsed;
}
