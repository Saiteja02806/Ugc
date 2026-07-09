import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createJiti } from "jiti";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "..");
const outputDir = path.join(workspaceRoot, ".tmp", "carousel-readiness-scale-audit");
const jiti = createJiti(import.meta.url, {
  alias: {
    "@": workspaceRoot,
  },
});

const {
  CAROUSEL_BUSINESS_VISUAL_PROFILES,
  getCarouselBusinessProfileBucketTargetCount,
  resolveCarouselBusinessVisualProfile,
} = await jiti.import("../lib/carousel/business-visual-profile.ts");
const { buildCarouselSlidePlan } = await jiti.import(
  "../lib/carousel/slide-plan.ts",
);
const {
  CAROUSEL_IMAGE_SAFETY_POLICY_VERSION,
  CAROUSEL_RUNTIME_MATCHER_VERSION,
  selectRuntimeVisualBucketAssets,
} = await jiti.import("../lib/carousel/runtime-visual-bucket-matcher.ts");
const { getVisualBucket } = await jiti.import(
  "../lib/carousel/visual-bucket-taxonomy.ts",
);
const { CAROUSEL_RENDERER_VERSION } = await jiti.import(
  "../worker/src/lib/carousel-render-slide.ts",
);

loadEnvFile(path.resolve(".env.local"));

const args = parseArgs(process.argv.slice(2));
const userCount = parsePositiveInteger(args.users, 100);
const slideCount = parsePositiveInteger(args.slides || args.slideCount, 5);
const profileFilter = parseProfileFilter(args.profiles || args.profile);
const selectedProfiles = CAROUSEL_BUSINESS_VISUAL_PROFILES.filter((profile) =>
  profileFilter ? profileFilter.has(profile.id) : true,
);

if (selectedProfiles.length === 0) {
  throw new Error(
    `No carousel profiles matched "${args.profiles || args.profile}".`,
  );
}

mkdirSync(outputDir, { recursive: true });

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

const categorySlugs = Array.from(
  new Set(selectedProfiles.map((profile) => profile.categorySlug)),
);
const assetRows = await listCategoryImageAssets(categorySlugs);
const rowsByCategory = groupBy(assetRows, (row) => row.category_slug);
const safeAssetsByCategory = new Map(
  categorySlugs.map((categorySlug) => [
    categorySlug,
    (rowsByCategory.get(categorySlug) ?? [])
      .filter(isSelectableAsset)
      .map(mapReadyAsset),
  ]),
);
const inventory = selectedProfiles.map((profile) =>
  buildProfileInventory(profile, rowsByCategory.get(profile.categorySlug) ?? []),
);
const simulation = runDryRunSimulation({
  inventory,
  profiles: selectedProfiles,
  safeAssetsByCategory,
  slideCount,
  userCount,
});
const report = buildReport({
  assetRows,
  inventory,
  selectedProfiles,
  simulation,
  slideCount,
  userCount,
});
const jsonPath = path.join(outputDir, "report.json");
const markdownPath = path.join(outputDir, "report.md");

writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(markdownPath, buildMarkdownReport(report));

console.log(
  JSON.stringify(
    {
      readyForBeta: report.summary.readyForBeta,
      readyProfiles: report.summary.readyProfiles,
      reportJson: jsonPath,
      reportMarkdown: markdownPath,
      safetyViolations: report.dryRun.safetyViolationCount,
      usersSimulated: report.dryRun.userCount,
    },
    null,
    2,
  ),
);

if (!report.summary.readyForBeta || args["fail-on-not-ready"] === "true") {
  process.exitCode = report.summary.readyForBeta ? 0 : 1;
}

async function listCategoryImageAssets(categorySlugs) {
  const pageSize = 1000;
  const rows = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("category_image_assets")
      .select(
        [
          "id",
          "base_s3_key",
          "base_url",
          "best_for_slide_types",
          "bucket_type",
          "category_slug",
          "content_tags",
          "created_at",
          "face_count",
          "has_human",
          "image_query",
          "image_subject_class",
          "mood_tags",
          "person_count",
          "pexels_photographer",
          "primary_vertical",
          "source_query",
          "status",
          "subject_analysis",
          "subject_review_status",
          "usage_count",
          "usable_verticals",
          "visual_bucket",
          "visual_setting",
          "visual_style",
        ].join(","),
      )
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

function buildProfileInventory(profile, rows) {
  const bucketReports = profile.requiredBucketIds.map((bucketId) => {
    const bucket = getVisualBucket(bucketId);
    const bucketRows = rows.filter((row) => row.visual_bucket === bucketId);
    const selectableCount = bucketRows.filter(isSelectableAsset).length;
    const targetCount = getCarouselBusinessProfileBucketTargetCount(
      profile,
      bucketId,
    );
    const rejectedRows = bucketRows.filter(
      (row) => row.subject_review_status === "rejected",
    );
    const humanPositiveCount = bucketRows.filter(hasHumanSignal).length;
    const unreviewedCount = bucketRows.filter(
      (row) => row.subject_review_status === "unreviewed",
    ).length;
    const rejectedCount = rejectedRows.length;
    const rejectedHumanCount = rejectedRows.filter(hasHumanRejectSignal).length;
    const rejectedFaceCount = rejectedRows.filter(hasFaceRejectSignal).length;
    const rejectedHandCount = rejectedRows.filter(hasHandRejectSignal).length;
    const unavailableCount = bucketRows.filter(
      (row) => row.status !== "ready",
    ).length;
    const surplusApprovedCount = Math.max(selectableCount - targetCount, 0);
    const readinessStatus =
      selectableCount >= targetCount
        ? "ready"
        : unreviewedCount > 0
          ? "awaiting-review"
          : "needs-refill";

    return {
      approvedObjectOnlyCount: selectableCount,
      bucketId,
      bucketLabel: bucket?.label ?? bucketId,
      bucketType: bucket?.bucketType ?? null,
      isReady: selectableCount >= targetCount,
      isTestingReady: selectableCount >= 10,
      minimumApprovedTarget: targetCount,
      rawCandidateCount: bucketRows.length,
      rejectedCount,
      rejectedDuplicateCount: null,
      rejectedFaceCount,
      rejectedHandCount,
      rejectedHumanCount,
      readinessStatus,
      selectableCount,
      surplusApprovedCount,
      targetCount,
      totalCount: bucketRows.length,
      unavailableCount,
      unreviewedCount,
      humanPositiveCount,
    };
  });
  const selectableTotal = bucketReports.reduce(
    (sum, bucket) => sum + bucket.selectableCount,
    0,
  );
  const weakestBucketCount = Math.min(
    ...bucketReports.map((bucket) => bucket.selectableCount),
  );
  const readyBucketCount = bucketReports.filter((bucket) => bucket.isReady).length;
  const testingReadyBucketCount = bucketReports.filter(
    (bucket) => bucket.isTestingReady,
  ).length;

  return {
    bucketReports,
    capacity: estimateCapacity({
      bucketReports,
      selectableTotal,
      slideCount,
      userCount,
      weakestBucketCount,
    }),
    categorySlug: profile.categorySlug,
    knownGaps: profile.knownGaps ?? [],
    label: profile.label,
    profileId: profile.id,
    readyBucketCount,
    requiredBucketCount: bucketReports.length,
    selectableTotal,
    testingReadyBucketCount,
    weakestBucketCount,
  };
}

function estimateCapacity({
  bucketReports,
  selectableTotal,
  slideCount,
  userCount,
  weakestBucketCount,
}) {
  const expectedSelections = userCount * slideCount;
  const averageUsesPerAsset =
    selectableTotal > 0
      ? Number((expectedSelections / selectableTotal).toFixed(2))
      : null;
  const estimatedRepeatRate =
    expectedSelections > 0
      ? Number(
          (
            Math.max(0, expectedSelections - selectableTotal) /
            expectedSelections
          ).toFixed(4),
        )
      : 0;
  const missingBucketCount = bucketReports.filter(
    (bucket) => bucket.selectableCount === 0,
  ).length;
  const belowTestingCount = bucketReports.filter(
    (bucket) => bucket.selectableCount < 10,
  ).length;
  const belowTargetCount = bucketReports.filter(
    (bucket) => bucket.selectableCount < bucket.targetCount,
  ).length;
  const repeatRisk =
    missingBucketCount > 0 || belowTestingCount > 0 || selectableTotal < slideCount
      ? "high"
      : averageUsesPerAsset !== null && averageUsesPerAsset <= 3
        ? "low"
        : averageUsesPerAsset !== null && averageUsesPerAsset <= 5
          ? "medium"
          : "high";

  return {
    averageUsesPerAsset,
    belowTargetCount,
    belowTestingCount,
    estimatedCarouselCapacityByTotalAssets: Math.floor(
      selectableTotal / slideCount,
    ),
    estimatedRepeatRate,
    expectedSelections,
    missingBucketCount,
    repeatRisk,
    weakestBucketLimitedCapacity: Number.isFinite(weakestBucketCount)
      ? weakestBucketCount
      : 0,
  };
}

function runDryRunSimulation({
  inventory,
  profiles,
  safeAssetsByCategory,
  slideCount,
  userCount,
}) {
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const inventoryByProfileId = new Map(
    inventory.map((item) => [item.profileId, item]),
  );
  const users = buildFakeUsers(userCount, profiles);
  const runs = [];
  const globalAssetUse = new Map();
  const globalHeadlineUse = new Map();
  const globalBodyUse = new Map();
  const globalConceptUse = new Map();
  const failures = [];

  for (const user of users) {
    const resolvedProfile = resolveCarouselBusinessVisualProfile(user.analysis);
    const profile =
      profileById.get(resolvedProfile.id) ??
      profileById.get(user.expectedProfileId) ??
      profiles[0];
    const inventoryForProfile = inventoryByProfileId.get(profile.id);
    const assets = safeAssetsByCategory.get(profile.categorySlug) ?? [];
    const slides = buildCarouselSlidePlan({
      analysis: user.analysis,
      candidateIndex: user.candidateIndex,
      goal: user.analysis.mainPromise,
      selectedAngle: user.analysis.carouselAngles[0] ?? null,
      slideCount,
    });
    const selections = selectRuntimeVisualBucketAssets({
      assets,
      candidateIndex: user.candidateIndex,
      fallbackAssets: assets,
      profile,
      seed: `${user.userId}:${user.projectId}:${user.analysis.businessName}`,
      slides,
    });
    const selectedAssetIds = selections.map((selection) => selection.asset.id);
    const duplicateAssetIdsInsideCarousel = findDuplicates(selectedAssetIds);
    const safetyViolations = selections
      .filter((selection) => !isSelectableMappedAsset(selection.asset))
      .map((selection) => selection.asset.id);
    const slideTexts = slides.map((slide) => ({
      body: slide.body ?? slide.subtext ?? "",
      headline: slide.headline ?? "",
    }));

    for (const assetId of selectedAssetIds) {
      incrementCount(globalAssetUse, assetId);
    }

    for (const slide of slideTexts) {
      if (slide.headline) {
        incrementCount(globalHeadlineUse, normalizeForDuplicateCheck(slide.headline));
      }

      if (slide.body) {
        incrementCount(globalBodyUse, normalizeForDuplicateCheck(slide.body));
      }
    }

    incrementCount(
      globalConceptUse,
      normalizeForDuplicateCheck(user.analysis.carouselAngles[0] ?? ""),
    );

    const runFailures = [];

    if (!inventoryForProfile) {
      runFailures.push("missing profile inventory");
    }

    if (resolvedProfile.id !== user.expectedProfileId) {
      runFailures.push(
        `profile resolver returned ${resolvedProfile.id}, expected ${user.expectedProfileId}`,
      );
    }

    if (slides.length !== slideCount) {
      runFailures.push(`planned ${slides.length}/${slideCount} slides`);
    }

    if (selections.length !== slideCount) {
      runFailures.push(`selected ${selections.length}/${slideCount} assets`);
    }

    if (duplicateAssetIdsInsideCarousel.length > 0) {
      runFailures.push(
        `duplicate assets inside carousel: ${duplicateAssetIdsInsideCarousel.join(", ")}`,
      );
    }

    if (safetyViolations.length > 0) {
      runFailures.push(
        `unsafe selected assets: ${safetyViolations.join(", ")}`,
      );
    }

    if (
      inventoryForProfile &&
      inventoryForProfile.capacity.missingBucketCount > 0
    ) {
      runFailures.push("profile has required buckets with zero selectable assets");
    }

    if (runFailures.length > 0) {
      failures.push({
        businessName: user.analysis.businessName,
        failures: runFailures,
        profileId: profile.id,
        projectId: user.projectId,
        userId: user.userId,
      });
    }

    runs.push({
      businessName: user.analysis.businessName,
      duplicateAssetIdsInsideCarousel,
      expectedProfileId: user.expectedProfileId,
      profileId: profile.id,
      projectId: user.projectId,
      selectedAssets: selections.map((selection) => ({
        assetId: selection.asset.id,
        bucketId: selection.bucketId,
        hasHuman: selection.hasHuman,
        imageSubjectClass: selection.imageSubjectClass,
        intent: selection.intent,
        mode: selection.mode,
        score: selection.score,
        slideNumber: selection.slideNumber,
      })),
      slides: slides.map((slide) => ({
        body: slide.body,
        headline: slide.headline,
        listItems: slide.listItems,
        slideNumber: slide.slideNumber,
        slideType: slide.slideType,
        textMode: slide.textMode,
      })),
      userId: user.userId,
    });
  }

  const totalSelections = runs.reduce(
    (sum, run) => sum + run.selectedAssets.length,
    0,
  );
  const uniqueSelectedAssets = globalAssetUse.size;
  const duplicateSelectionCount = Math.max(0, totalSelections - uniqueSelectedAssets);
  const safetyViolationCount = runs.reduce(
    (sum, run) =>
      sum +
      run.selectedAssets.filter(
        (asset) =>
          asset.hasHuman !== false || asset.imageSubjectClass !== "object-only",
      ).length,
    0,
  );
  const missingImageRunCount = runs.filter(
    (run) => run.selectedAssets.length !== slideCount,
  ).length;

  return {
    duplicateImageRate:
      totalSelections > 0
        ? Number((duplicateSelectionCount / totalSelections).toFixed(4))
        : 0,
    duplicateSelectionCount,
    failures,
    failureCount: failures.length,
    headlineDuplicates: topRepeated(globalHeadlineUse, 10),
    bodyDuplicates: topRepeated(globalBodyUse, 10),
    conceptDuplicates: topRepeated(globalConceptUse, 10),
    missingImageRunCount,
    runs: args.includeRuns === "true" ? runs : runs.slice(0, 10),
    safetyViolationCount,
    slideCount,
    successCount: userCount - failures.length,
    topReusedAssets: topRepeated(globalAssetUse, 20),
    totalSelections,
    uniqueSelectedAssets,
    userCount,
  };
}

function buildReport({
  assetRows,
  inventory,
  selectedProfiles,
  simulation,
  slideCount,
  userCount,
}) {
  const notReadyProfiles = inventory
    .filter(
      (profile) =>
        profile.readyBucketCount < profile.requiredBucketCount ||
        profile.capacity.missingBucketCount > 0,
    )
    .map((profile) => profile.profileId);
  const dryRunPassed =
    simulation.failureCount === 0 &&
    simulation.safetyViolationCount === 0 &&
    simulation.missingImageRunCount === 0;
  const duplicateRiskPassed =
    simulation.duplicateImageRate <= 0.15 &&
    simulation.topReusedAssets.every((item) => item.count <= 3);
  const allProfilesInventoryReady = notReadyProfiles.length === 0;
  const readyForBeta =
    allProfilesInventoryReady && dryRunPassed && duplicateRiskPassed;

  return {
    createdAt: new Date().toISOString(),
    dryRun: simulation,
    fullRender: {
      status: "not_run",
      reason:
        "This script intentionally runs Stage A only: no SQS, ECS, S3 upload, CloudFront, or frontend render test.",
      nextBatches: [10, 25, 100],
    },
    inventory,
    scope: {
      categorySlugs: Array.from(
        new Set(selectedProfiles.map((profile) => profile.categorySlug)),
      ),
      profileIds: selectedProfiles.map((profile) => profile.id),
      slideCount,
      userCount,
    },
    summary: {
      allProfilesInventoryReady,
      dryRunPassed,
      duplicateRiskPassed,
      notReadyProfiles,
      readyForBeta,
      readyProfiles: inventory
        .filter(
          (profile) =>
            profile.readyBucketCount === profile.requiredBucketCount &&
            profile.capacity.missingBucketCount === 0,
        )
        .map((profile) => profile.profileId),
      totalAssetRowsAudited: assetRows.length,
    },
    versions: {
      matcher: CAROUSEL_RUNTIME_MATCHER_VERSION,
      renderer: CAROUSEL_RENDERER_VERSION,
      safetyPolicy: CAROUSEL_IMAGE_SAFETY_POLICY_VERSION,
      workerDeployment: {
        status: "not_checked",
        reason:
          "Live ECS deployment verification requires the separate AWS deployment/check step.",
      },
    },
  };
}

function buildMarkdownReport(report) {
  const lines = [
    "# Carousel 100-User Readiness Report",
    "",
    "## 1. Summary",
    "",
    `Ready for beta: **${report.summary.readyForBeta ? "Yes" : "No"}**`,
    "",
    `Profiles checked: ${report.scope.profileIds.join(", ")}`,
    `Users simulated: ${report.scope.userCount}`,
    `Slides per carousel: ${report.scope.slideCount}`,
    `Asset rows audited: ${report.summary.totalAssetRowsAudited}`,
    "",
    "## 2. Category Inventory",
    "",
    "| Profile | Category | Required buckets | Ready buckets | Safe assets | Weakest bucket | Repeat risk |",
    "| --- | --- | ---: | ---: | ---: | ---: | --- |",
    ...report.inventory.map(
      (profile) =>
        `| ${profile.profileId} | ${profile.categorySlug} | ${profile.requiredBucketCount} | ${profile.readyBucketCount} | ${profile.selectableTotal} | ${profile.weakestBucketCount} | ${profile.capacity.repeatRisk} |`,
    ),
    "",
    "## 3. Bucket Readiness",
    "",
  ];

  for (const profile of report.inventory) {
    lines.push(`### ${profile.profileId}`);
    lines.push("");
    lines.push(
      "| Bucket | Raw candidates | Approved object-only | Min target | Surplus | Status | Unreviewed | Rejected human | Rejected face | Rejected hand | Rejected dup | Unavailable |",
    );
    lines.push("| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |");

    for (const bucket of profile.bucketReports) {
      lines.push(
        `| ${bucket.bucketId} | ${bucket.rawCandidateCount} | ${bucket.approvedObjectOnlyCount} | ${bucket.minimumApprovedTarget} | ${bucket.surplusApprovedCount} | ${bucket.readinessStatus} | ${bucket.unreviewedCount} | ${bucket.rejectedHumanCount} | ${bucket.rejectedFaceCount} | ${bucket.rejectedHandCount} | ${bucket.rejectedDuplicateCount ?? "n/a"} | ${bucket.unavailableCount} |`,
      );
    }

    lines.push("");
  }

  lines.push(
    "## 4. Capacity Estimate",
    "",
    "| Profile | Expected selections | Avg uses per safe asset | Est. repeat rate | Total-asset capacity | Weakest-bucket capacity |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    ...report.inventory.map(
      (profile) =>
        `| ${profile.profileId} | ${profile.capacity.expectedSelections} | ${profile.capacity.averageUsesPerAsset ?? "n/a"} | ${profile.capacity.estimatedRepeatRate} | ${profile.capacity.estimatedCarouselCapacityByTotalAssets} | ${profile.capacity.weakestBucketLimitedCapacity} |`,
    ),
    "",
    "## 5. 100-User Dry Run Result",
    "",
    `Success: ${report.dryRun.successCount}/${report.dryRun.userCount}`,
    `Failures: ${report.dryRun.failureCount}`,
    `Missing-image runs: ${report.dryRun.missingImageRunCount}`,
    `Safety violations: ${report.dryRun.safetyViolationCount}`,
    `Duplicate image rate: ${report.dryRun.duplicateImageRate}`,
    "",
    "## 6. Full Render Test Result",
    "",
    `Status: ${report.fullRender.status}`,
    report.fullRender.reason,
    "",
    "## 7. Image Repetition Report",
    "",
    "| Asset ID | Uses |",
    "| --- | ---: |",
    ...report.dryRun.topReusedAssets.map(
      (item) => `| ${item.value} | ${item.count} |`,
    ),
    "",
    "## 8. Text Repetition Report",
    "",
    "Repeated headlines:",
    ...formatRepeatedLines(report.dryRun.headlineDuplicates),
    "",
    "Repeated body copy:",
    ...formatRepeatedLines(report.dryRun.bodyDuplicates),
    "",
    "Repeated concepts:",
    ...formatRepeatedLines(report.dryRun.conceptDuplicates),
    "",
    "## 9. Safety Report",
    "",
    report.dryRun.safetyViolationCount === 0
      ? "No unsafe selected assets in the dry run."
      : `${report.dryRun.safetyViolationCount} unsafe selections found.`,
    "",
    "## 10. Worker/Deployment Report",
    "",
    `Matcher: ${report.versions.matcher}`,
    `Renderer: ${report.versions.renderer}`,
    `Safety policy: ${report.versions.safetyPolicy}`,
    `Live ECS worker: ${report.versions.workerDeployment.status}`,
    "",
    "## 11. Problems Found",
    "",
    ...formatProblems(report),
    "",
    "## 12. Required Fixes Before Production",
    "",
    ...formatFixes(report),
    "",
  );

  return `${lines.join("\n")}\n`;
}

function formatRepeatedLines(items) {
  if (items.length === 0) {
    return ["- None above duplicate threshold."];
  }

  return items.map((item) => `- ${item.count}x: ${item.value}`);
}

function formatProblems(report) {
  const problems = [];

  for (const profile of report.inventory) {
    const missingBuckets = profile.bucketReports.filter(
      (bucket) => bucket.selectableCount === 0,
    );
    const belowTargetBuckets = profile.bucketReports.filter(
      (bucket) => bucket.selectableCount < bucket.targetCount,
    );

    if (missingBuckets.length > 0) {
      problems.push(
        `- P0 ${profile.profileId}: zero safe assets in ${missingBuckets
          .map((bucket) => bucket.bucketId)
          .join(", ")}.`,
      );
    }

    if (belowTargetBuckets.length > 0) {
      problems.push(
        `- P1 ${profile.profileId}: below target in ${belowTargetBuckets
          .map((bucket) => `${bucket.bucketId} (${bucket.selectableCount}/${bucket.targetCount})`)
          .join(", ")}.`,
      );
    }
  }

  if (report.dryRun.failureCount > 0) {
    problems.push(`- P0 dry-run failures: ${report.dryRun.failureCount}.`);
  }

  if (report.dryRun.safetyViolationCount > 0) {
    problems.push(`- P0 safety violations: ${report.dryRun.safetyViolationCount}.`);
  }

  if (!report.summary.duplicateRiskPassed) {
    problems.push("- P1 duplicate image risk is above the configured threshold.");
  }

  if (problems.length === 0) {
    return ["- No P0/P1 issues found in Stage A dry run."];
  }

  return problems;
}

function formatFixes(report) {
  const fixes = [];

  for (const profile of report.inventory) {
    for (const bucket of profile.bucketReports) {
      if (bucket.selectableCount < bucket.targetCount) {
        fixes.push(
          `- Refill ${profile.profileId}/${bucket.bucketId} with ${
            bucket.targetCount - bucket.selectableCount
          } more approved object-only images.`,
        );
      }
    }
  }

  if (report.fullRender.status === "not_run") {
    fixes.push("- Run Stage B full render batches: 10 users, then 25, then 100.");
  }

  if (report.versions.workerDeployment.status !== "checked") {
    fixes.push("- Verify live ECS worker version before declaring production-ready.");
  }

  if (fixes.length === 0) {
    return ["- Stage A is clear. Proceed to Stage B full render batches."];
  }

  return fixes;
}

function buildFakeUsers(count, profiles) {
  const scenarios = getUserScenarios().filter((scenario) =>
    profiles.some((profile) => profile.id === scenario.profileId),
  );

  if (scenarios.length === 0) {
    throw new Error("No fake-user scenarios match the selected profile filter.");
  }

  return Array.from({ length: count }, (_, index) => {
    const scenario = scenarios[index % scenarios.length];
    const cohort = Math.floor(index / scenarios.length) + 1;
    const businessName = `${scenario.businessName} ${cohort}`;

    return {
      analysis: {
        brandTone: scenario.brandTone,
        businessName,
        carouselAngles: scenario.carouselAngles.map((angle) =>
          personalize(angle, cohort),
        ),
        category: scenario.category,
        claimsToAvoid: [],
        confidence: "high",
        confidenceReason: "Synthetic readiness simulation input.",
        ctaIdeas: scenario.ctaIdeas.map((cta) => personalize(cta, cohort)),
        differentiators: scenario.differentiators.map((item) =>
          personalize(item, cohort),
        ),
        mainProblem: personalize(scenario.mainProblem, cohort),
        mainPromise: personalize(scenario.mainPromise, cohort),
        missingInfo: [],
        painPoints: scenario.painPoints.map((item) => personalize(item, cohort)),
        pexelsImageQueries: scenario.pexelsImageQueries,
        productSummary: personalize(scenario.productSummary, cohort),
        recommendedCarouselStructure: [
          "hook",
          "problem",
          "solution",
          "benefit",
          "cta",
        ],
        targetAudience: scenario.targetAudience.map((item) =>
          personalize(item, cohort),
        ),
        valueProps: scenario.valueProps.map((item) => personalize(item, cohort)),
        visualKeywords: scenario.visualKeywords,
      },
      candidateIndex: index,
      expectedProfileId: scenario.profileId,
      projectId: `scale-project-${String(index + 1).padStart(3, "0")}`,
      userId: `scale-user-${String(index + 1).padStart(3, "0")}`,
    };
  });
}

function personalize(value, cohort) {
  if (cohort <= 1) {
    return value;
  }

  return value.replace(/\.$/, "") + ` for cohort ${cohort}`;
}

function getUserScenarios() {
  return [
    scenario({
      brandTone: "direct and practical",
      businessName: "CaloriePilot",
      carouselAngles: ["Why food tracking collapses after the first busy week"],
      category: "calorie tracker nutrition health app",
      ctaIdeas: ["Start a lighter food log"],
      differentiators: ["Built around imperfect meals and busy routines"],
      mainProblem: "People forget meals, guess portions, and lose trust in their log",
      mainPromise: "Make calorie tracking feel consistent without homework",
      painPoints: ["Late dinners get forgotten", "Weekend meals are hard to log"],
      pexelsImageQueries: ["meal tracking desk no people", "food scale kitchen"],
      productSummary: "A calorie tracker that reduces logging friction",
      profileId: "fitness-health",
      targetAudience: ["busy adults tracking nutrition"],
      valueProps: ["Fast meal capture", "Portion confidence without overthinking"],
      visualKeywords: ["calorie", "meal", "nutrition", "health"],
    }),
    scenario({
      brandTone: "energetic but grounded",
      businessName: "CoachLoop",
      carouselAngles: ["The client check-in system most fitness coaches need"],
      category: "fitness coach workout health",
      ctaIdeas: ["Build the next client check-in"],
      differentiators: ["Turns workout notes into simple follow-ups"],
      mainProblem: "Fitness clients miss updates when check-ins live across apps",
      mainPromise: "Keep training follow-ups moving without manual chasing",
      painPoints: ["Workout notes get scattered", "Progress reminders arrive late"],
      pexelsImageQueries: ["gym phone no people", "post workout bottle"],
      productSummary: "Client workflow software for fitness coaches",
      profileId: "fitness-health",
      targetAudience: ["online fitness coaches"],
      valueProps: ["Cleaner client check-ins", "Less manual follow-up"],
      visualKeywords: ["fitness", "gym", "workout", "coach"],
    }),
    scenario({
      brandTone: "calm and supportive",
      businessName: "MealMap",
      carouselAngles: ["Why meal planning fails when life changes midweek"],
      category: "meal planner nutrition wellness",
      ctaIdeas: ["Plan one realistic meal week"],
      differentiators: ["Adapts plans around real grocery and dinner habits"],
      mainProblem: "Meal plans break when grocery choices and schedules change",
      mainPromise: "Make meal planning flexible enough for real life",
      painPoints: ["Grocery decisions pile up", "Prep plans become too rigid"],
      pexelsImageQueries: ["meal prep kitchen no people", "grocery aisle food"],
      productSummary: "A meal planning app for realistic weekly routines",
      profileId: "fitness-health",
      targetAudience: ["busy people planning food"],
      valueProps: ["Flexible food planning", "Simpler grocery decisions"],
      visualKeywords: ["meal", "grocery", "nutrition", "food"],
    }),
    scenario({
      brandTone: "sharp and useful",
      businessName: "CampaignFlow",
      carouselAngles: ["The campaign calendar that stops slipping"],
      category: "marketing SaaS campaign automation",
      ctaIdeas: ["Generate a campaign workflow"],
      differentiators: ["Connects planning, reminders, and reporting"],
      mainProblem: "Campaign work slips when calendars and tasks are disconnected",
      mainPromise: "Keep every campaign step visible and moving",
      painPoints: ["Launch dates keep shifting", "Follow-ups get buried"],
      pexelsImageQueries: ["marketing calendar laptop no people"],
      productSummary: "Marketing workflow software for campaign teams",
      profileId: "marketing-saas",
      targetAudience: ["lean marketing teams"],
      valueProps: ["Cleaner campaign planning", "Automated follow-up reminders"],
      visualKeywords: ["marketing", "campaign", "calendar", "growth"],
    }),
    scenario({
      brandTone: "confident and concise",
      businessName: "LeadPulse",
      carouselAngles: ["Why good leads disappear before sales replies"],
      category: "CRM tool sales marketing SaaS",
      ctaIdeas: ["Create the lead follow-up flow"],
      differentiators: ["Ranks leads and alerts teams before context is lost"],
      mainProblem: "Sales teams lose warm leads inside notifications and spreadsheets",
      mainPromise: "Turn every new lead into a clear next action",
      painPoints: ["Phone alerts bury follow-ups", "Manual lead sheets go stale"],
      pexelsImageQueries: ["phone notification work desk no people"],
      productSummary: "CRM follow-up automation for growth teams",
      profileId: "marketing-saas",
      targetAudience: ["sales and growth teams"],
      valueProps: ["Faster lead routing", "Cleaner handoffs from marketing to sales"],
      visualKeywords: ["crm", "lead", "sales", "notification"],
    }),
    scenario({
      brandTone: "clear and strategic",
      businessName: "AdSignal",
      carouselAngles: ["The reporting problem hiding inside every ad account"],
      category: "ad analytics marketing SaaS",
      ctaIdeas: ["Build the reporting view"],
      differentiators: ["Combines ad data into one readable summary"],
      mainProblem: "Marketers waste time cleaning reports before they can act",
      mainPromise: "Make ad reporting feel like a next-step system",
      painPoints: ["Spreadsheets slow down decisions", "Dashboards show too much noise"],
      pexelsImageQueries: ["analytics dashboard laptop no people"],
      productSummary: "Ad analytics and reporting software",
      profileId: "marketing-saas",
      targetAudience: ["paid media teams"],
      valueProps: ["Clearer reporting", "Less spreadsheet cleanup"],
      visualKeywords: ["ads", "analytics", "dashboard", "marketing"],
    }),
    scenario({
      brandTone: "quiet and capable",
      businessName: "AgentDesk",
      carouselAngles: ["How manual operations quietly steal the day"],
      category: "AI agent productivity SaaS",
      ctaIdeas: ["Build an AI workflow"],
      differentiators: ["Turns repeat tasks into monitored agent workflows"],
      mainProblem: "Teams keep repeating small tasks across too many tools",
      mainPromise: "Give routine work to AI agents without losing control",
      painPoints: ["Task handoffs are scattered", "Manual checks drain focus"],
      pexelsImageQueries: ["laptop workspace AI workflow no people"],
      productSummary: "AI agent workspace for operations teams",
      profileId: "productivity-saas",
      targetAudience: ["operations teams"],
      valueProps: ["Automated routine work", "One workspace for task status"],
      visualKeywords: ["ai", "agent", "workflow", "productivity"],
    }),
    scenario({
      brandTone: "minimal and focused",
      businessName: "WriteStack",
      carouselAngles: ["Why AI writing still creates messy review loops"],
      category: "AI writing tool productivity SaaS",
      ctaIdeas: ["Draft the review workflow"],
      differentiators: ["Keeps drafts, comments, and approvals in one place"],
      mainProblem: "AI drafts create new chaos when review happens elsewhere",
      mainPromise: "Turn writing output into an organized publishing workflow",
      painPoints: ["Drafts live in too many tabs", "Approvals happen too late"],
      pexelsImageQueries: ["laptop writing desk no people"],
      productSummary: "AI writing workflow software for teams",
      profileId: "productivity-saas",
      targetAudience: ["content and ops teams"],
      valueProps: ["Cleaner draft review", "Fewer scattered approval threads"],
      visualKeywords: ["ai", "writing", "workflow", "workspace"],
    }),
    scenario({
      brandTone: "practical and organized",
      businessName: "ProjectLane",
      carouselAngles: ["The project tracker that stops status meetings"],
      category: "project management productivity SaaS",
      ctaIdeas: ["Create a project workspace"],
      differentiators: ["Turns project updates into visible next steps"],
      mainProblem: "Teams hold status meetings because project signals are hidden",
      mainPromise: "Make project progress visible without another meeting",
      painPoints: ["Updates get buried", "Deadlines are hard to trust"],
      pexelsImageQueries: ["project planning desk no people"],
      productSummary: "Project management software for lean teams",
      profileId: "productivity-saas",
      targetAudience: ["project teams"],
      valueProps: ["Clearer project status", "Fewer manual updates"],
      visualKeywords: ["project", "team", "workflow", "dashboard"],
    }),
    scenario({
      brandTone: "soft and practical",
      businessName: "HabitNest",
      carouselAngles: ["Why habit apps fail after three normal days"],
      category: "habit tracker wellness app",
      ctaIdeas: ["Start a softer habit reset"],
      differentiators: ["Uses small resets instead of perfect streak pressure"],
      mainProblem: "People abandon habits when one missed day feels like failure",
      mainPromise: "Make habit tracking gentle enough to continue",
      painPoints: ["Streak pressure feels punishing", "Night routines get forgotten"],
      pexelsImageQueries: ["water glass night routine no people"],
      productSummary: "A habit tracker built around realistic routines",
      profileId: "wellness",
      targetAudience: ["people rebuilding habits"],
      valueProps: ["Gentler streaks", "Small daily reset prompts"],
      visualKeywords: ["habit", "wellness", "routine", "sleep"],
    }),
    scenario({
      brandTone: "calming and direct",
      businessName: "SleepCue",
      carouselAngles: ["The bedtime routine problem no reminder fixes alone"],
      category: "sleep wellness routine app",
      ctaIdeas: ["Create a bedtime reset"],
      differentiators: ["Combines evening cues with low-pressure tracking"],
      mainProblem: "Bedtime routines fall apart when phones and tasks stay active",
      mainPromise: "Make evenings feel easier to wind down",
      painPoints: ["Phone checks stretch too late", "Evening tasks stay unfinished"],
      pexelsImageQueries: ["bedside table phone night no people"],
      productSummary: "A sleep routine app for calmer evenings",
      profileId: "wellness",
      targetAudience: ["busy adults improving sleep"],
      valueProps: ["Softer evening prompts", "Clearer wind-down cues"],
      visualKeywords: ["sleep", "wellness", "night", "habit"],
    }),
    scenario({
      brandTone: "clean and premium",
      businessName: "GlowShelf",
      carouselAngles: ["Why skincare routines become cluttered so fast"],
      category: "skincare beauty routine",
      ctaIdeas: ["Build a simpler skincare plan"],
      differentiators: ["Organizes products around realistic morning and night use"],
      mainProblem: "Skincare routines get confusing when products pile up",
      mainPromise: "Make skincare feel simple and repeatable",
      painPoints: ["Too many products create decision fatigue", "Night routines are inconsistent"],
      pexelsImageQueries: ["skincare product still life no people"],
      productSummary: "A skincare routine planner for everyday consistency",
      profileId: "beauty-skincare",
      targetAudience: ["people simplifying skincare"],
      valueProps: ["Cleaner product routines", "Simpler morning and night steps"],
      visualKeywords: ["skincare", "beauty", "routine", "glow"],
    }),
    scenario({
      brandTone: "professional and simple",
      businessName: "FinanceClear",
      carouselAngles: ["Why personal finance tracking gets ignored"],
      category: "finance tracker business app",
      ctaIdeas: ["Create a weekly money review"],
      differentiators: ["Turns messy spending data into one weekly action"],
      mainProblem: "People avoid finance tracking when the data feels messy",
      mainPromise: "Make money reviews feel clear enough to repeat",
      painPoints: ["Spending data is scattered", "Reports feel too complex"],
      pexelsImageQueries: ["finance spreadsheet laptop no people"],
      productSummary: "A personal finance tracker for weekly clarity",
      profileId: "generic-business",
      targetAudience: ["busy professionals tracking money"],
      valueProps: ["Simpler money review", "Clearer spending categories"],
      visualKeywords: ["finance", "tracker", "spreadsheet", "dashboard"],
    }),
    scenario({
      brandTone: "local and practical",
      businessName: "TableRush",
      carouselAngles: ["The restaurant booking workflow that breaks at rush hour"],
      category: "local restaurant business booking tool",
      ctaIdeas: ["Create the booking workflow"],
      differentiators: ["Keeps bookings, waitlists, and messages in one view"],
      mainProblem: "Restaurants lose bookings when phone calls and messages collide",
      mainPromise: "Make restaurant bookings easier to manage in busy hours",
      painPoints: ["Messages get missed", "Waitlists change too quickly"],
      pexelsImageQueries: ["restaurant table reservation no people"],
      productSummary: "A booking workflow tool for local restaurants",
      profileId: "generic-business",
      targetAudience: ["small restaurant operators"],
      valueProps: ["Cleaner reservations", "Faster guest follow-up"],
      visualKeywords: ["restaurant", "booking", "business", "messages"],
    }),
    scenario({
      brandTone: "clear and commercial",
      businessName: "CourseCraft",
      carouselAngles: ["Why course platforms lose students after signup"],
      category: "course platform education business",
      ctaIdeas: ["Create a student onboarding flow"],
      differentiators: ["Connects lessons, reminders, and student progress"],
      mainProblem: "Students stop showing up when onboarding is fragmented",
      mainPromise: "Turn course signup into a guided learning path",
      painPoints: ["Lesson reminders get missed", "Progress is hard to see"],
      pexelsImageQueries: ["online course laptop no people"],
      productSummary: "A course platform for guided student progress",
      profileId: "generic-business",
      targetAudience: ["online course creators"],
      valueProps: ["Cleaner student onboarding", "Better lesson follow-through"],
      visualKeywords: ["course", "education", "laptop", "progress"],
    }),
  ];
}

function scenario(value) {
  return value;
}

function mapReadyAsset(row) {
  return {
    baseS3Key: row.base_s3_key,
    baseUrl: row.base_url,
    bestForSlideTypes: row.best_for_slide_types,
    bucketType: row.bucket_type,
    contentTags: row.content_tags,
    faceCount: row.face_count,
    hasHuman: row.has_human,
    id: row.id,
    imageSubjectClass: row.image_subject_class,
    imageQuery: row.image_query,
    moodTags: row.mood_tags,
    pexelsPhotographer: row.pexels_photographer,
    personCount: row.person_count,
    primaryVertical: row.primary_vertical,
    sourceQuery: row.source_query,
    usageCount: row.usage_count ?? 0,
    usableVerticals: row.usable_verticals,
    visualBucket: row.visual_bucket,
    visualSetting: row.visual_setting,
    visualStyle: row.visual_style,
  };
}

function isSelectableAsset(row) {
  return (
    row.status === "ready" &&
    row.subject_review_status === "approved" &&
    row.image_subject_class === "object-only" &&
    row.has_human === false &&
    row.face_count === 0 &&
    row.person_count === 0
  );
}

function isSelectableMappedAsset(asset) {
  return (
    asset.imageSubjectClass === "object-only" &&
    asset.hasHuman === false &&
    asset.faceCount === 0 &&
    asset.personCount === 0
  );
}

function hasHumanSignal(row) {
  return (
    row.has_human === true ||
    (row.face_count ?? 0) > 0 ||
    (row.person_count ?? 0) > 0 ||
    row.image_subject_class === "clear-face" ||
    row.image_subject_class === "faceless-human"
  );
}

function getSubjectAnalysisReason(row) {
  const subjectAnalysis = row.subject_analysis;

  if (
    subjectAnalysis &&
    typeof subjectAnalysis === "object" &&
    !Array.isArray(subjectAnalysis) &&
    typeof subjectAnalysis.reason === "string"
  ) {
    return subjectAnalysis.reason;
  }

  return "";
}

function hasHumanRejectSignal(row) {
  const reason = getSubjectAnalysisReason(row);

  return (
    hasHumanSignal(row) ||
    /\b(clear[-\s]?face|face|human|person|people|hand|hands|body|bodies|silhouette|model)\b/i.test(
      reason,
    )
  );
}

function hasFaceRejectSignal(row) {
  const reason = getSubjectAnalysisReason(row);

  return (
    row.image_subject_class === "clear-face" ||
    (row.face_count ?? 0) > 0 ||
    /\b(clear[-\s]?face|face)\b/i.test(reason)
  );
}

function hasHandRejectSignal(row) {
  return /\b(hand|hands)\b/i.test(getSubjectAnalysisReason(row));
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

function findDuplicates(values) {
  const seen = new Set();
  const duplicates = new Set();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }

    seen.add(value);
  }

  return Array.from(duplicates);
}

function incrementCount(counts, value) {
  if (!value) {
    return;
  }

  counts.set(value, (counts.get(value) ?? 0) + 1);
}

function normalizeForDuplicateCheck(value) {
  return value
    .toLowerCase()
    .replace(/\bcohort\s+\d+\b/g, "cohort")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function topRepeated(counts, limit) {
  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([value, count]) => ({ count, value }))
    .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value))
    .slice(0, limit);
}

function parseProfileFilter(value) {
  if (!value) {
    return null;
  }

  return new Set(
    String(value)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
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
