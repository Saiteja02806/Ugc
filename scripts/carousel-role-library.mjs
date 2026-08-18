import path from "node:path";

export const CAROUSEL_LIBRARY_CATEGORIES = Object.freeze([
  "dating",
  "food",
  "gym",
  "productivity",
  "skin",
  "travel",
]);

export const CAROUSEL_LIBRARY_ROLES = Object.freeze([
  "hook",
  "human",
  "static",
]);

export const CAROUSEL_IMAGE_EXTENSIONS = new Set([
  ".heic",
  ".jpeg",
  ".jpg",
  ".png",
  ".webp",
]);

const ROLE_PRIORITY = Object.freeze({
  hook: 0,
  human: 1,
  static: 2,
});

export function classifyCarouselRoleSourcePath(sourceRoot, filePath) {
  const relativePath = path.relative(sourceRoot, filePath);

  if (
    !relativePath ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    return { reason: "outside-source-root", status: "excluded" };
  }

  const segments = relativePath.split(path.sep);
  const firstSegment = segments[0]?.trim() ?? "";
  const firstNormalized = normalizeFolderName(firstSegment);
  const isStagingFolder = firstNormalized === "not_been";
  const bucketSegment = isStagingFolder ? segments[1] : segments[0];

  if (!bucketSegment) {
    return { reason: "missing-role-bucket", status: "excluded" };
  }

  const bucket = normalizeFolderName(bucketSegment);

  if (bucket === "marketing_static") {
    return { reason: "marketing-static-excluded-v1", status: "excluded" };
  }

  const match = bucket.match(
    /^(dating|food|gym|productivity|skin|travel)_(hook|human|static)$/,
  );

  if (!match) {
    return {
      bucket,
      reason: "unsupported-role-bucket",
      status: "excluded",
    };
  }

  const [, category, role] = match;

  return {
    bucket,
    category,
    relativePath: toPosixPath(relativePath),
    role,
    sourceBatch: isStagingFolder ? "not been" : "power",
    status: "included",
  };
}

export function selectExactDuplicateWinners(records) {
  const byHash = new Map();

  for (const record of records) {
    const group = byHash.get(record.sourceFileSha256) ?? [];
    group.push(record);
    byHash.set(record.sourceFileSha256, group);
  }

  const duplicateGroups = [];
  const winners = [];

  for (const [sourceFileSha256, group] of byHash.entries()) {
    const sorted = [...group].sort(compareDuplicateCandidates);
    const winner = sorted[0];
    winners.push(winner);

    if (sorted.length > 1) {
      duplicateGroups.push({
        dropped: sorted.slice(1).map(toDuplicateReference),
        sourceFileSha256,
        winner: toDuplicateReference(winner),
      });
    }
  }

  return {
    duplicateGroups: duplicateGroups.sort((first, second) =>
      first.sourceFileSha256.localeCompare(second.sourceFileSha256),
    ),
    winners: winners.sort(compareDuplicateCandidates),
  };
}

export function summarizeCarouselRoleAssets(records) {
  const byCategoryRole = Object.fromEntries(
    CAROUSEL_LIBRARY_CATEGORIES.map((category) => [
      category,
      Object.fromEntries(CAROUSEL_LIBRARY_ROLES.map((role) => [role, 0])),
    ]),
  );

  for (const record of records) {
    byCategoryRole[record.category][record.role] += 1;
  }

  const byRole = Object.fromEntries(
    CAROUSEL_LIBRARY_ROLES.map((role) => [
      role,
      CAROUSEL_LIBRARY_CATEGORIES.reduce(
        (total, category) => total + byCategoryRole[category][role],
        0,
      ),
    ]),
  );

  return {
    byCategoryRole,
    byRole,
    total: records.length,
  };
}

export function assertCarouselRolePoolMinimums(summary) {
  const failures = [];

  for (const category of CAROUSEL_LIBRARY_CATEGORIES) {
    const counts = summary.byCategoryRole[category];

    for (const [role, minimum] of [
      ["hook", 1],
      ["human", 2],
      ["static", 2],
    ]) {
      if ((counts?.[role] ?? 0) < minimum) {
        failures.push(`${category}/${role}=${counts?.[role] ?? 0}, need ${minimum}`);
      }
    }
  }

  if (failures.length > 0) {
    throw new Error(`Carousel role pools are incomplete: ${failures.join("; ")}`);
  }
}

export function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

function normalizeFolderName(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s*\(\d+\)\s*$/, "")
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function compareDuplicateCandidates(first, second) {
  return (
    ROLE_PRIORITY[first.role] - ROLE_PRIORITY[second.role] ||
    first.relativePath.localeCompare(second.relativePath, "en", {
      sensitivity: "base",
    }) ||
    first.relativePath.localeCompare(second.relativePath)
  );
}

function toDuplicateReference(record) {
  return {
    category: record.category,
    relativePath: record.relativePath,
    role: record.role,
    sourceBatch: record.sourceBatch,
  };
}
