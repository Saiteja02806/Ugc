import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createJiti } from "jiti";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "..");
const jiti = createJiti(import.meta.url, { alias: { "@": workspaceRoot } });

loadEnvFile(path.resolve(workspaceRoot, ".env.local"));

const args = parseArgs(process.argv.slice(2));
const candidateCount = parsePositiveInteger(
  args.candidates || args.candidateCount,
  1,
);

const { getCarouselBusinessVisualProfile } = await jiti.import(
  "../lib/carousel/business-visual-profile.ts",
);
const {
  CAROUSEL_BROAD_RUNTIME_MATCHER_VERSION,
  compareBroadAndLegacySelections,
  selectBroadRuntimeVisualAssets,
} = await jiti.import("../lib/carousel/broad-runtime-visual-matcher.ts");
const {
  CAROUSEL_BROAD_BUCKET_TAXONOMY_VERSION,
  getBroadBucketFallbacksForProfile,
  getBroadBucketRequirementsForProfile,
} = await jiti.import("../lib/carousel/broad-visual-bucket-taxonomy.ts");
const { listReadyCategoryImageAssets } = await jiti.import(
  "../lib/carousel/db.ts",
);
const {
  CAROUSEL_RUNTIME_MATCHER_VERSION,
  selectRuntimeVisualBucketAssets,
} = await jiti.import("../lib/carousel/runtime-visual-bucket-matcher.ts");

const profileId = args.profile || args.profileId || "marketing-saas";
const scenario = args.scenario || "default";
const profile = getCarouselBusinessVisualProfile(profileId);

if (!profile) {
  throw new Error(`Carousel profile "${profileId}" is missing.`);
}

const categorySlug = args.category || args.categorySlug || profile.categorySlug;
const assets = await listReadyCategoryImageAssets({
  categorySlug,
  profileId: profile.id,
});
const slides = getAuditSlides(profile.id, scenario);
const seed = `${profile.id}:${scenario}:broad-matcher:live-audit-v1`;
const legacySelections = selectRuntimeVisualBucketAssets({
  assets,
  candidateIndex: 0,
  fallbackAssets: assets,
  profile,
  seed,
  slides,
});
const broadSelectionsByCandidate = Array.from(
  { length: candidateCount },
  (_, candidateIndex) => ({
    candidateIndex,
    selections: selectBroadRuntimeVisualAssets({
      assets,
      candidateIndex,
      categorySlug,
      profile,
      seed,
      slides,
    }),
  }),
);
const broadSelections = broadSelectionsByCandidate[0]?.selections ?? [];
const comparisons = compareBroadAndLegacySelections({
  broadSelections,
  legacySelections,
  slides,
});
const broadBucketCounts = countBy(assets, (asset) => asset.broadVisualBucket);
const legacyBucketCounts = countBy(assets, (asset) => asset.visualBucket);
const approvedBroadV1AssetCount = assets.filter(
  (asset) =>
    asset.bucketTaxonomyVersion === CAROUSEL_BROAD_BUCKET_TAXONOMY_VERSION &&
    Boolean(asset.broadVisualBucket),
).length;
const report = {
  assetLibrary: {
    approvedBroadV1AssetCount,
    broadBucketCounts,
    legacyBucketCounts,
    safeApprovedAssetCount: assets.length,
    sourceCategoryCounts: countBy(assets, (asset) => asset.categorySlug),
    sourceProviderCounts: countBy(assets, (asset) => asset.sourceProvider),
  },
  broadMatcherVersion: CAROUSEL_BROAD_RUNTIME_MATCHER_VERSION,
  categorySlug,
  comparisons,
  diversity: buildDiversityReport(broadSelectionsByCandidate),
  fallbackBuckets: getBroadBucketFallbacksForProfile(profile.id),
  generatedAt: new Date().toISOString(),
  legacyMatcherVersion: CAROUSEL_RUNTIME_MATCHER_VERSION,
  profileId: profile.id,
  scenario,
  requiredBuckets: getBroadBucketRequirementsForProfile(profile.id),
  selections: broadSelections.map((selection) => ({
    assetId: selection.asset.id,
    assetUrl: selection.asset.baseUrl,
    broadBucketId: selection.broadBucketId,
    duplicatePenaltyApplied: selection.duplicatePenaltyApplied,
    fallbackReason: selection.fallbackReason,
    matchedTags: selection.matchedTags,
    nearDuplicateAvoided: selection.nearDuplicateAvoided,
    nearDuplicateGroup: selection.nearDuplicateGroup,
    pexelsPhotoId: selection.asset.pexelsPhotoId,
    score: selection.score,
    slideNumber: selection.slideNumber,
    sourceCategorySlug: selection.asset.categorySlug,
    sourceProvider: selection.asset.sourceProvider,
    sourceQuery: selection.asset.sourceQuery,
    targetBroadBucketId: selection.targetBroadBucketId,
  })),
  summary: {
    broadSelectionCount: broadSelections.length,
    duplicateReuseCount: broadSelections.filter(
      (selection) => selection.fallbackReason === "duplicate_safe_reuse",
    ).length,
    exactOrPartialCount: broadSelections.filter((selection) =>
      ["exact_match", "partial_tag_match"].includes(selection.fallbackReason),
    ).length,
    legacySelectionCount: legacySelections.length,
    localSelectionCount: broadSelections.filter(
      (selection) => selection.asset.sourceProvider === "local",
    ).length,
    missingBroadSelectionCount: slides.length - broadSelections.length,
    profileFallbackCount: broadSelections.filter(
      (selection) => selection.fallbackReason === "profile_fallback",
    ).length,
    sameAssetCount: comparisons.filter((comparison) => comparison.sameAsset).length,
    slideCount: slides.length,
  },
  taxonomyVersion: CAROUSEL_BROAD_BUCKET_TAXONOMY_VERSION,
};
const outputDirectory = path.resolve(
  workspaceRoot,
  ".tmp",
  "carousel-broad-matcher",
);
const outputPath = path.join(
  outputDirectory,
  `${profile.id}${scenario === "default" ? "" : `-${scenario}`}-dry-run.json`,
);

mkdirSync(outputDirectory, { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ...report, outputPath }, null, 2));

if (report.summary.missingBroadSelectionCount > 0) {
  process.exitCode = 1;
}

function countBy(items, getKey) {
  return Object.fromEntries(
    Object.entries(
      items.reduce((counts, item) => {
        const key = getKey(item) || "unmapped";
        counts[key] = (counts[key] ?? 0) + 1;
        return counts;
      }, {}),
    ).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function buildDiversityReport(candidateRuns) {
  const selections = candidateRuns.flatMap((candidate) =>
    candidate.selections.map((selection) => ({
      assetId: selection.asset.id,
      broadBucketId: selection.broadBucketId,
      candidateIndex: candidate.candidateIndex,
      fallbackReason: selection.fallbackReason,
      pexelsPhotoId: selection.asset.pexelsPhotoId,
      slideNumber: selection.slideNumber,
      sourceProvider: selection.asset.sourceProvider,
    })),
  );
  const assetCounts = countBy(selections, (selection) => selection.assetId);
  const topRepeatedAssets = Object.entries(assetCounts)
    .map(([assetId, count]) => {
      const firstSelection = selections.find(
        (selection) => selection.assetId === assetId,
      );

      return {
        assetId,
        broadBucketId: firstSelection?.broadBucketId ?? null,
        count,
        pexelsPhotoId: firstSelection?.pexelsPhotoId ?? null,
      };
    })
    .sort(
      (left, right) =>
        right.count - left.count || left.assetId.localeCompare(right.assetId),
    );
  const localSelections = Object.entries(
    selections
      .filter((selection) => selection.sourceProvider === "local")
      .reduce((counts, selection) => {
        counts[selection.assetId] = (counts[selection.assetId] ?? 0) + 1;
        return counts;
      }, {}),
  )
    .map(([assetId, count]) => ({
      assetId,
      count,
    }))
    .sort(
      (left, right) =>
        right.count - left.count || left.assetId.localeCompare(right.assetId),
    );

  return {
    candidateCount: candidateRuns.length,
    duplicateSafeReuseCount: selections.filter(
      (selection) => selection.fallbackReason === "duplicate_safe_reuse",
    ).length,
    localSelectionCount: selections.filter(
      (selection) => selection.sourceProvider === "local",
    ).length,
    localSelections,
    sourceProviderCounts: countBy(
      selections,
      (selection) => selection.sourceProvider,
    ),
    topRepeatedAssetCount: topRepeatedAssets[0]?.count ?? 0,
    topRepeatedAssets: topRepeatedAssets.slice(0, 12),
    totalSelectionCount: selections.length,
    uniqueAssetCount: Object.keys(assetCounts).length,
  };
}

function parsePositiveInteger(value, fallbackValue) {
  if (value === undefined || value === null) {
    return fallbackValue;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`Expected a positive integer, received "${value}".`);
  }

  return Math.trunc(parsed);
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

function getAuditSlides(selectedProfileId, selectedScenario) {
  if (selectedScenario === "social-platforms") {
    return getSocialPlatformAuditSlides();
  }

  if (selectedScenario === "physical-productivity") {
    return getPhysicalProductivityAuditSlides();
  }

  switch (selectedProfileId) {
    case "fitness-health":
      return getFitnessHealthAuditSlides();
    case "productivity-saas":
      return getProductivitySaasAuditSlides();
    default:
      return getMarketingSaasAuditSlides();
  }
}

function getSocialPlatformAuditSlides() {
  return [
    mockSlide(1, "hook", "Your YouTube content should drive measurable growth", "Review video marketing performance on the YouTube screen."),
    mockSlide(2, "problem", "TikTok ideas disappear without a repeatable system", "Keep the next short-form video visible on your phone."),
    mockSlide(3, "problem", "Instagram engagement drops when posting gets inconsistent", "Plan social media content around the Instagram screen."),
    mockSlide(4, "solution", "Build one workflow for every social platform", "Coordinate YouTube, TikTok, and Instagram content."),
    mockSlide(5, "benefit", "See which video content earns attention", "Use social media screens to review content performance."),
    mockSlide(6, "cta", "Start your next video marketing campaign", "Create a clear social media publishing routine."),
  ];
}

function getPhysicalProductivityAuditSlides() {
  return [
    mockSlide(1, "hook", "A focused desk makes the next task easier", "Keep the laptop, notebook, and plan in one workspace."),
    mockSlide(2, "problem", "Notes get lost when project planning stays scattered", "Bring the notebook, calendar, and deadlines together."),
    mockSlide(3, "problem", "Coding work slows down in a cluttered workspace", "Use one laptop and notebook for the next development task."),
    mockSlide(4, "solution", "Make the project plan visible on the whiteboard", "Keep every task and deadline easy to review."),
    mockSlide(5, "benefit", "A clean creator desk keeps the workflow moving", "Use the monitor and workspace to focus on the next action."),
    mockSlide(6, "cta", "Build a calmer productivity workspace", "Start with one clear desk, plan, and task list."),
  ];
}

function getMarketingSaasAuditSlides() {
  return [
    mockSlide(1, "hook", "Campaign analytics should explain growth", "See every dashboard metric clearly."),
    mockSlide(2, "problem", "Your content calendar is impossible to manage", "Deadlines and schedules keep moving."),
    mockSlide(3, "problem", "Manual spreadsheet reporting wastes the afternoon", "Campaign data stays scattered."),
    mockSlide(4, "solution", "Automate the workflow behind every campaign", "Use one software system for the repeated work."),
    mockSlide(5, "benefit", "Review notifications before leads go cold", "Keep the next action visible on your phone."),
    mockSlide(6, "cta", "Start with one cleaner campaign process", "Try a calmer way to plan the next launch."),
  ];
}

function getProductivitySaasAuditSlides() {
  return [
    mockSlide(1, "hook", "Your workflow should not need five tabs", "Bring the repeated work into one workspace."),
    mockSlide(2, "problem", "Project planning breaks when every deadline moves", "Calendars and notes get scattered."),
    mockSlide(3, "problem", "Manual status reporting steals the afternoon", "Dashboard data and updates stay disconnected."),
    mockSlide(4, "solution", "Automate the handoff behind every task", "Use one software system for routine follow-up."),
    mockSlide(5, "benefit", "Keep the next action visible before work stalls", "Notifications and reminders stay close."),
    mockSlide(6, "cta", "Start with one cleaner productivity loop", "Make the next workflow easier to repeat."),
  ];
}

function getFitnessHealthAuditSlides() {
  return [
    mockSlide(1, "hook", "Healthy tracking should not feel like homework", "See every meal and fitness habit clearly."),
    mockSlide(2, "problem", "Lunch choices get harder when nutrition stays invisible", "Food and calorie details are easy to forget."),
    mockSlide(3, "problem", "Workout plans stall without a simple routine", "Gym, recovery, and hydration habits drift apart."),
    mockSlide(4, "solution", "Log every meal and workout in one app", "Keep nutrition and fitness progress together."),
    mockSlide(5, "benefit", "Build a calmer hydration and recovery habit", "Keep water and wellness reminders close."),
    mockSlide(6, "cta", "Start with one healthier daily routine", "Try a simpler way to track food and fitness."),
  ];
}

function mockSlide(slideNumber, slideType, headline, body) {
  return {
    body,
    ctaText: slideType === "cta" ? "Start now" : null,
    headline,
    imageDirection: null,
    layoutPreset: slideType === "hook" ? "top-hook" : "bottom-message",
    listItems: [],
    slideNumber,
    slideType,
    subtext: null,
    textMode: "headline_body",
    textPosition: slideType === "hook" ? "top" : "bottom",
  };
}

function loadEnvFile(envPath) {
  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);

    if (!match || process.env[match[1]] !== undefined) {
      continue;
    }

    const value = match[2].trim();
    process.env[match[1]] =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
        ? value.slice(1, -1)
        : value;
  }
}
