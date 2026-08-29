import { createClient } from "@supabase/supabase-js";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createJiti } from "jiti";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "..");
const jiti = createJiti(import.meta.url, {
  alias: {
    "@": workspaceRoot,
  },
});
const OUTPUT_DIR = path.resolve(".tmp", "carousel-broad-bucket-backfill");
const MAPPING_PATH = path.resolve(
  "scripts",
  "data",
  "carousel-broad-bucket-mapping.json",
);
const MAX_CONTENT_TAGS = 30;
const MAX_OBJECT_TAGS = 30;
const MAX_MOOD_TAGS = 20;

const {
  CAROUSEL_BUSINESS_VISUAL_PROFILES,
} = await jiti.import("../lib/carousel/business-visual-profile.ts");
const {
  BROAD_BUCKET_REQUIREMENTS_BY_PROFILE,
  CAROUSEL_BROAD_BUCKET_TAXONOMY_VERSION,
  getBroadVisualBucket,
  isBroadVisualBucketId,
} = await jiti.import("../lib/carousel/broad-visual-bucket-taxonomy.ts");

loadEnvFile(path.resolve(".env.local"));

const args = parseArgs(process.argv.slice(2));
const shouldExecute = args.execute === "true";
const selectedProfiles = getSelectedProfiles(args);
const selectedCategorySlugs = getSelectedCategorySlugs(args, selectedProfiles);
const mapping = readMapping();

if (shouldExecute && args.yes !== "true") {
  throw new Error("Refusing to execute without --yes. Dry-run is the default.");
}

mkdirSync(OUTPUT_DIR, { recursive: true });

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

if (shouldExecute) {
  await assertBroadBucketColumnsExist();
}

const rows = await listCategoryImageAssets(selectedCategorySlugs);
const plannedRows = rows.map((row) => planRowUpdate(row, mapping));
const actionableRows = plannedRows.filter((row) => row.status === "mapped");
const rowsNeedingUpdate = actionableRows.filter((row) => !row.isAlreadyCurrent);
const unmappedRows = plannedRows.filter((row) => row.status === "unmapped");

let updatedCount = 0;

if (shouldExecute) {
  for (const plannedRow of rowsNeedingUpdate) {
    const { error } = await supabase
      .from("category_image_assets")
      .update(plannedRow.update)
      .eq("id", plannedRow.id);

    if (error) {
      throw new Error(
        `Could not update asset ${plannedRow.id}: ${error.message}`,
      );
    }

    updatedCount += 1;
  }
}

const report = buildReport({
  actionableRows,
  mapping,
  mode: shouldExecute ? "execute" : "dry-run",
  plannedRows,
  rows,
  rowsNeedingUpdate,
  selectedCategorySlugs,
  selectedProfiles,
  unmappedRows,
  updatedCount,
});
const reportPath = path.join(
  OUTPUT_DIR,
  `report-${slugifyReportName(selectedCategorySlugs)}-${shouldExecute ? "execute" : "dry-run"}.json`,
);

writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

printSummary(report, reportPath);

if (report.summary.unmappedAssetCount > 0) {
  process.exitCode = 1;
}

async function assertBroadBucketColumnsExist() {
  const { error } = await supabase
    .from("category_image_assets")
    .select("id,broad_visual_bucket,bucket_taxonomy_version,object_tags")
    .limit(1);

  if (error) {
    throw new Error(
      [
        "Broad bucket columns are not queryable yet.",
        "Apply supabase/migration_archive/pre_baseline_20260829/canonical_history/20260706145805_add_carousel_broad_bucket_metadata.sql first.",
        `Supabase returned: ${error.message}`,
      ].join(" "),
    );
  }
}

async function listCategoryImageAssets(categorySlugs) {
  const pageSize = 1000;
  const rows = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("category_image_assets")
      .select("*")
      .in("category_slug", categorySlugs)
      .order("category_slug", { ascending: true })
      .order("visual_bucket", { ascending: true })
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`Could not list carousel assets: ${error.message}`);
    }

    rows.push(...(data ?? []));

    if (!data || data.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return rows;
}

function planRowUpdate(row, mapping) {
  const visualBucket = cleanString(row.visual_bucket);
  const mappingEntry = mapping[visualBucket];

  if (!visualBucket || !mappingEntry) {
    return {
      categorySlug: row.category_slug,
      id: row.id,
      status: "unmapped",
      visualBucket: visualBucket || null,
    };
  }

  const broadVisualBucket = mappingEntry.broadVisualBucket;

  if (!isBroadVisualBucketId(broadVisualBucket)) {
    throw new Error(
      `Mapping for "${visualBucket}" points to unknown broad bucket "${broadVisualBucket}".`,
    );
  }

  const queryTags = extractTagsFromText(
    [row.source_query, row.image_query].filter(Boolean).join(" "),
  );
  const contentTags = normalizeTags([
    ...arrayFromJson(row.content_tags),
    ...mappingEntry.contentTags,
    ...queryTags.contentTags,
    ...getBroadVisualBucket(broadVisualBucket).defaultTags,
  ]).slice(0, MAX_CONTENT_TAGS);
  const objectTags = normalizeTags([
    ...arrayFromJson(row.object_tags),
    ...mappingEntry.objectTags,
    ...queryTags.objectTags,
  ]).slice(0, MAX_OBJECT_TAGS);
  const moodTags = normalizeTags([
    ...arrayFromJson(row.mood_tags),
    ...mappingEntry.moodTags,
    ...queryTags.moodTags,
  ]).slice(0, MAX_MOOD_TAGS);
  const update = {
    broad_visual_bucket: broadVisualBucket,
    bucket_taxonomy_version: CAROUSEL_BROAD_BUCKET_TAXONOMY_VERSION,
    content_tags: contentTags,
    object_tags: objectTags,
    mood_tags: moodTags,
  };

  return {
    broadVisualBucket,
    categorySlug: row.category_slug,
    existingBroadVisualBucket: row.broad_visual_bucket ?? null,
    id: row.id,
    isAlreadyCurrent:
      row.broad_visual_bucket === broadVisualBucket &&
      row.bucket_taxonomy_version === CAROUSEL_BROAD_BUCKET_TAXONOMY_VERSION &&
      sameStringArray(row.content_tags, contentTags) &&
      sameStringArray(row.object_tags, objectTags) &&
      sameStringArray(row.mood_tags, moodTags),
    safety: {
      faceCount: row.face_count ?? null,
      hasHuman: row.has_human ?? null,
      imageSubjectClass: row.image_subject_class ?? null,
      personCount: row.person_count ?? null,
      status: row.status ?? null,
      subjectReviewStatus: row.subject_review_status ?? null,
    },
    sourceQuery: row.source_query || row.image_query || null,
    status: "mapped",
    tags: {
      contentTags,
      moodTags,
      objectTags,
    },
    update,
    visualBucket,
  };
}

function buildReport({
  actionableRows,
  mapping,
  mode,
  plannedRows,
  rows,
  rowsNeedingUpdate,
  selectedCategorySlugs,
  selectedProfiles,
  unmappedRows,
  updatedCount,
}) {
  const mappedRowsByBroadBucket = groupBy(
    actionableRows,
    (row) => row.broadVisualBucket,
  );
  const broadBucketReports = Array.from(mappedRowsByBroadBucket.entries())
    .map(([broadVisualBucket, bucketRows]) =>
      buildBroadBucketReport(broadVisualBucket, bucketRows),
    )
    .sort((left, right) =>
      left.broadVisualBucket.localeCompare(right.broadVisualBucket),
    );
  const profileBroadReadiness = selectedProfiles.map((profile) =>
    buildProfileBroadReadiness(profile, actionableRows),
  );
  const unchangedCount = actionableRows.filter((row) => row.isAlreadyCurrent)
    .length;

  return {
    createdAt: new Date().toISOString(),
    mode,
    scope: {
      categorySlugs: selectedCategorySlugs,
      profileIds: selectedProfiles.map((profile) => profile.id),
      taxonomyVersion: CAROUSEL_BROAD_BUCKET_TAXONOMY_VERSION,
    },
    summary: {
      actionNeededCount: rowsNeedingUpdate.length,
      broadBucketCount: broadBucketReports.length,
      mappedAssetCount: actionableRows.length,
      totalAssetRows: rows.length,
      unchangedCount,
      unmappedAssetCount: unmappedRows.length,
      updatedCount,
    },
    profileBroadReadiness,
    broadBuckets: broadBucketReports,
    unmappedBuckets: summarizeUnmappedRows(unmappedRows),
    mappingCoverage: {
      mappedVisualBuckets: Object.keys(mapping).sort(),
      missingVisualBucketsInMapping: Array.from(
        new Set(
          rows
            .map((row) => cleanString(row.visual_bucket))
            .filter((bucket) => bucket && !mapping[bucket]),
        ),
      ).sort(),
    },
    sampleUpdates: actionableRows.slice(0, 20).map((row) => ({
      broadVisualBucket: row.broadVisualBucket,
      categorySlug: row.categorySlug,
      contentTags: row.tags.contentTags,
      id: row.id,
      moodTags: row.tags.moodTags,
      objectTags: row.tags.objectTags,
      sourceQuery: row.sourceQuery,
      visualBucket: row.visualBucket,
    })),
    warnings: buildWarnings({
      plannedRows,
      profileBroadReadiness,
      unmappedRows,
    }),
  };
}

function buildBroadBucketReport(broadVisualBucket, rows) {
  const approvedObjectOnlyRows = rows.filter(isStrictApprovedObjectOnly);
  const readyUnreviewedRows = rows.filter(
    (row) =>
      row.safety.status === "ready" &&
      row.safety.subjectReviewStatus === "unreviewed",
  );
  const rejectedRows = rows.filter(
    (row) => row.safety.subjectReviewStatus === "rejected",
  );
  const humanPositiveRows = rows.filter(hasHumanSignal);
  const contentTagCounts = countTags(rows.flatMap((row) => row.tags.contentTags));
  const objectTagCounts = countTags(rows.flatMap((row) => row.tags.objectTags));
  const moodTagCounts = countTags(rows.flatMap((row) => row.tags.moodTags));

  return {
    approvedObjectOnlyCount: approvedObjectOnlyRows.length,
    broadVisualBucket,
    categoryCounts: countValues(rows.map((row) => row.categorySlug)),
    humanPositiveCount: humanPositiveRows.length,
    rejectedCount: rejectedRows.length,
    tagCoverage: {
      contentTagCount: contentTagCounts.size,
      moodTagCount: moodTagCounts.size,
      objectTagCount: objectTagCounts.size,
      topContentTags: topCounts(contentTagCounts, 12),
      topMoodTags: topCounts(moodTagCounts, 12),
      topObjectTags: topCounts(objectTagCounts, 12),
    },
    totalCount: rows.length,
    unreviewedReadyCount: readyUnreviewedRows.length,
    visualBucketCounts: countValues(rows.map((row) => row.visualBucket)),
  };
}

function buildProfileBroadReadiness(profile, rows) {
  const broadBucketReports = Array.from(
    groupBy(
      rows.filter((row) => row.categorySlug === profile.categorySlug),
      (row) => row.broadVisualBucket,
    ).entries(),
  ).map(([broadVisualBucket, bucketRows]) =>
    buildBroadBucketReport(broadVisualBucket, bucketRows),
  );
  const reportByBucket = new Map(
    broadBucketReports.map((report) => [report.broadVisualBucket, report]),
  );
  const requiredBroadBuckets = BROAD_BUCKET_REQUIREMENTS_BY_PROFILE[profile.id];
  const buckets = requiredBroadBuckets.map((broadVisualBucket) => {
    const report = reportByBucket.get(broadVisualBucket) ?? null;
    const approvedObjectOnlyCount = report?.approvedObjectOnlyCount ?? 0;

    return {
      approvedObjectOnlyCount,
      broadVisualBucket,
      isTestingReady: approvedObjectOnlyCount >= 10,
      status:
        approvedObjectOnlyCount >= 10
          ? "testing-ready"
          : approvedObjectOnlyCount > 0
            ? "low"
            : "missing",
      totalCount: report?.totalCount ?? 0,
      unreviewedReadyCount: report?.unreviewedReadyCount ?? 0,
    };
  });

  return {
    buckets,
    categorySlug: profile.categorySlug,
    profileId: profile.id,
    readyTestingBucketCount: buckets.filter((bucket) => bucket.isTestingReady)
      .length,
    requiredBroadBucketCount: buckets.length,
  };
}

function buildWarnings({ plannedRows, profileBroadReadiness, unmappedRows }) {
  const warnings = [];
  const staleRows = plannedRows.filter(
    (row) =>
      row.status === "mapped" &&
      row.existingBroadVisualBucket &&
      row.existingBroadVisualBucket !== row.broadVisualBucket,
  );

  if (unmappedRows.length > 0) {
    warnings.push(
      `${unmappedRows.length} assets have visual_bucket values that are not in the broad mapping.`,
    );
  }

  if (staleRows.length > 0) {
    warnings.push(
      `${staleRows.length} assets already have a different broad_visual_bucket and would be overwritten on execute.`,
    );
  }

  for (const profile of profileBroadReadiness) {
    const missingBuckets = profile.buckets
      .filter((bucket) => bucket.status === "missing")
      .map((bucket) => bucket.broadVisualBucket);

    if (missingBuckets.length > 0) {
      warnings.push(
        `${profile.profileId} has no mapped assets in broad buckets: ${missingBuckets.join(", ")}.`,
      );
    }
  }

  return warnings;
}

function isStrictApprovedObjectOnly(row) {
  return (
    row.safety.status === "ready" &&
    row.safety.subjectReviewStatus === "approved" &&
    row.safety.imageSubjectClass === "object-only" &&
    row.safety.hasHuman === false &&
    row.safety.faceCount === 0 &&
    row.safety.personCount === 0
  );
}

function hasHumanSignal(row) {
  return (
    row.safety.hasHuman === true ||
    (row.safety.faceCount ?? 0) > 0 ||
    (row.safety.personCount ?? 0) > 0 ||
    row.safety.imageSubjectClass === "clear-face" ||
    row.safety.imageSubjectClass === "faceless-human"
  );
}

function summarizeUnmappedRows(rows) {
  return Array.from(groupBy(rows, (row) => row.visualBucket ?? "missing").entries())
    .map(([visualBucket, bucketRows]) => ({
      count: bucketRows.length,
      sampleIds: bucketRows.slice(0, 10).map((row) => row.id),
      visualBucket,
    }))
    .sort((left, right) => right.count - left.count || left.visualBucket.localeCompare(right.visualBucket));
}

function extractTagsFromText(value) {
  const normalized = value.toLowerCase();
  const contentTags = [];
  const objectTags = [];
  const moodTags = [];

  addIfMatches(normalized, contentTags, "analytics", /\banalytics?\b|dashboard|metric|chart/);
  addIfMatches(normalized, contentTags, "calendar", /calendar|schedule|planner|deadline/);
  addIfMatches(normalized, contentTags, "coffee", /coffee|cafe/);
  addIfMatches(normalized, contentTags, "food", /meal|food|snack|grocery|kitchen|nutrition|portion/);
  addIfMatches(normalized, contentTags, "phone", /phone|smartphone|mobile|notification/);
  addIfMatches(normalized, contentTags, "workspace", /laptop|desk|workspace|office|computer|monitor/);
  addIfMatches(normalized, objectTags, "calendar", /calendar|planner/);
  addIfMatches(normalized, objectTags, "coffee-cup", /coffee|cup|mug/);
  addIfMatches(normalized, objectTags, "laptop", /laptop|computer/);
  addIfMatches(normalized, objectTags, "monitor", /monitor|screen/);
  addIfMatches(normalized, objectTags, "notebook", /notebook|notes|paper|planner/);
  addIfMatches(normalized, objectTags, "phone", /phone|smartphone|mobile/);
  addIfMatches(normalized, objectTags, "plate", /meal|plate|food/);
  addIfMatches(normalized, moodTags, "busy", /busy|overload|chaos|deadline/);
  addIfMatches(normalized, moodTags, "clean", /clean|minimal|negative space/);
  addIfMatches(normalized, moodTags, "focused", /focus|work|productivity/);

  return { contentTags, moodTags, objectTags };
}

function addIfMatches(value, tags, tag, pattern) {
  if (pattern.test(value)) {
    tags.push(tag);
  }
}

function normalizeTags(values) {
  const blockedTags = new Set([
    "close",
    "image",
    "no",
    "people",
    "person",
    "photo",
    "realistic",
    "stock",
    "up",
  ]);
  const normalized = [];
  const seen = new Set();

  for (const value of values) {
    const tag = cleanTag(value);

    if (!tag || blockedTags.has(tag) || seen.has(tag)) {
      continue;
    }

    normalized.push(tag);
    seen.add(tag);
  }

  return normalized;
}

function cleanTag(value) {
  return cleanString(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function arrayFromJson(value) {
  return Array.isArray(value)
    ? value.map((item) => cleanString(item)).filter(Boolean)
    : [];
}

function sameStringArray(left, right) {
  const leftValues = arrayFromJson(left);

  return (
    leftValues.length === right.length &&
    leftValues.every((value, index) => value === right[index])
  );
}

function groupBy(values, getKey) {
  const grouped = new Map();

  for (const value of values) {
    const key = getKey(value);
    const group = grouped.get(key) ?? [];

    group.push(value);
    grouped.set(key, group);
  }

  return grouped;
}

function countValues(values) {
  return Object.fromEntries(topCounts(countTags(values), Number.POSITIVE_INFINITY));
}

function countTags(values) {
  const counts = new Map();

  for (const value of values) {
    if (!value) {
      continue;
    }

    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return counts;
}

function topCounts(counts, limit) {
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([value, count]) => ({ count, value }));
}

function readMapping() {
  const mapping = JSON.parse(readFileSync(MAPPING_PATH, "utf8"));

  for (const [visualBucket, entry] of Object.entries(mapping)) {
    if (!entry || typeof entry !== "object") {
      throw new Error(`Invalid mapping entry for "${visualBucket}".`);
    }

    if (!isBroadVisualBucketId(entry.broadVisualBucket)) {
      throw new Error(
        `Invalid broad bucket "${entry.broadVisualBucket}" for "${visualBucket}".`,
      );
    }
  }

  return mapping;
}

function getSelectedProfiles(args) {
  const profileIds = parseCsv(args.profiles || args.profile);

  if (profileIds.length === 0 && (args.category || args.categories)) {
    return [];
  }

  const requestedIds = profileIds.length > 0 ? profileIds : ["marketing-saas"];
  const selectedProfiles = requestedIds.map((profileId) => {
    const profile = CAROUSEL_BUSINESS_VISUAL_PROFILES.find(
      (candidate) => candidate.id === profileId,
    );

    if (!profile) {
      throw new Error(`Unknown profile "${profileId}".`);
    }

    return profile;
  });

  return selectedProfiles;
}

function getSelectedCategorySlugs(args, selectedProfiles) {
  const requestedCategories = parseCsv(args.categories || args.category);
  const categorySlugs =
    requestedCategories.length > 0
      ? requestedCategories
      : selectedProfiles.map((profile) => profile.categorySlug);
  const uniqueCategorySlugs = Array.from(new Set(categorySlugs));

  if (uniqueCategorySlugs.length === 0) {
    throw new Error("At least one --profile or --category is required.");
  }

  return uniqueCategorySlugs;
}

function parseCsv(value) {
  if (!value) {
    return [];
  }

  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function printSummary(report, reportPath) {
  console.log(
    JSON.stringify(
      {
        actionNeededCount: report.summary.actionNeededCount,
        broadBucketCount: report.summary.broadBucketCount,
        categorySlugs: report.scope.categorySlugs,
        mode: report.mode,
        mappedAssetCount: report.summary.mappedAssetCount,
        reportPath,
        totalAssetRows: report.summary.totalAssetRows,
        unmappedAssetCount: report.summary.unmappedAssetCount,
        updatedCount: report.summary.updatedCount,
        warnings: report.warnings,
      },
      null,
      2,
    ),
  );
}

function slugifyReportName(values) {
  return values
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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

function loadEnvFile(envPath) {
  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const match = trimmedLine.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);

    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;

    if (process.env[key] === undefined) {
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

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}
