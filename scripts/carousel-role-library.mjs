import { readFileSync } from "node:fs";
import path from "node:path";

const retirementPolicy = JSON.parse(
  readFileSync(new URL("./carousel-role-library-retirements.json", import.meta.url), "utf8"),
);

if (
  retirementPolicy.version !== "carousel-role-library-retirements-v1" ||
  !Array.isArray(retirementPolicy.retirements)
) {
  throw new Error("Invalid Carousel role-library retirement policy.");
}

const sourceRetirements = retirementPolicy.retirements.map((retirement) => {
  if (
    !retirement.retiredAt ||
    !retirement.reason ||
    !Array.isArray(retirement.sourceFileSha256s) ||
    retirement.sourceFileSha256s.some((hash) => !/^[a-f0-9]{64}$/.test(hash)) ||
    !Array.isArray(retirement.exactSourcePaths) ||
    !Array.isArray(retirement.sourcePathPrefixes)
  ) {
    throw new Error("Invalid Carousel source retirement entry.");
  }
  return {
    ...retirement,
    hashes: new Set(retirement.sourceFileSha256s),
    exactPaths: new Set(retirement.exactSourcePaths.map(normalizeRetirementPath)),
    prefixes: retirement.sourcePathPrefixes.map(normalizeRetirementPath),
  };
});

export const CAROUSEL_RETIRED_SOURCE_SHA256S = Object.freeze([
  ...new Set(sourceRetirements.flatMap((retirement) => retirement.sourceFileSha256s)),
]);

export function getCarouselRoleSourceRetirement({ relativePath, sourceFileSha256 }) {
  const normalizedPath = normalizeRetirementPath(relativePath ?? "");
  const normalizedHash = (sourceFileSha256 ?? "").trim().toLowerCase();

  for (const retirement of sourceRetirements) {
    const hashMatch = retirement.hashes.has(normalizedHash);
    const pathMatch = retirement.exactPaths.has(normalizedPath) ||
      retirement.prefixes.some((prefix) =>
        normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`),
      );
    if (hashMatch || pathMatch) {
      return {
        reason: "user-retired-carousel-source",
        detail: retirement.reason,
        retiredAt: retirement.retiredAt,
        matchedBy: hashMatch ? "sha256" : "source-path",
      };
    }
  }
  return null;
}

export function assertCarouselRoleManifestHasNoRetiredSources(assets) {
  for (const asset of assets) {
    const sourceFileSha256 = asset.dbRow?.source_file_sha256;
    const sourcePaths = [
      asset.source?.relativePath,
      asset.dbRow?.source_metadata?.sourceRelativePath,
      asset.dbRow?.source_folder && asset.dbRow?.source_filename
        ? `${asset.dbRow.source_folder}/${asset.dbRow.source_filename}`
        : undefined,
    ];
    for (const relativePath of sourcePaths) {
      const retirement = getCarouselRoleSourceRetirement({ relativePath, sourceFileSha256 });
      if (retirement) {
        throw new Error(
          `Manifest contains retired Carousel source ${asset.libraryAssetId ?? relativePath ?? sourceFileSha256} (${retirement.matchedBy}, retired ${retirement.retiredAt}): ${retirement.detail}. Prepare a new manifest before importing or reconciling.`,
        );
      }
    }
  }
}

export function isPreservedCarouselRoleAssetRetirement(asset) {
  return asset.source_metadata?.retirement?.preserveHistoricalRenders === true ||
    getCarouselRoleSourceRetirement({
      sourceFileSha256: asset.source_file_sha256,
      relativePath: asset.source_metadata?.sourceRelativePath ||
        [asset.source_folder, asset.source_filename].filter(Boolean).join("/"),
    }) !== null;
}

function normalizeRetirementPath(value) {
  return path.posix.normalize(value.replaceAll("\\", "/").trim())
    .replace(/\/$/, "")
    .toLowerCase();
}

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
  const nestedHumanHook = resolveNestedHumanHookSource(
    segments.map(normalizeFolderName),
  );

  if (nestedHumanHook) {
    return {
      bucket: `${nestedHumanHook.category}_hook`,
      category: nestedHumanHook.category,
      relativePath: toPosixPath(relativePath),
      role: "hook",
      sourceBatch: "part-2",
      status: "included",
    };
  }

  const isStagingFolder = firstNormalized === "not_been";
  const isPartFolder = /^part_\d+(?:\.\d+)*$/.test(firstNormalized);
  const bucketSegment = isStagingFolder || isPartFolder ? segments[1] : segments[0];

  if (!bucketSegment) {
    return { reason: "missing-role-bucket", status: "excluded" };
  }

  const bucket = normalizeRoleBucketName(bucketSegment);

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
    sourceBatch: isStagingFolder
      ? "not been"
      : isPartFolder
        ? firstNormalized.replaceAll("_", "-")
        : "power",
    status: "included",
  };
}

function resolveNestedHumanHookSource(segments) {
  if (
    segments[0] === "gym_part2" &&
    segments[1] === "human_hook" &&
    segments.length >= 3
  ) {
    return { category: "gym" };
  }

  if (
    /^productivity_humanhookpart_?2$/.test(segments[0] ?? "") &&
    segments[1] === "human" &&
    segments.length >= 3
  ) {
    return { category: "productivity" };
  }

  return null;
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

function normalizeRoleBucketName(value) {
  return normalizeFolderName(value).replace(/_\d+(?:\.\d+)*$/, "");
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
