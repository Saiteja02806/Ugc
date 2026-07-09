import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const workspaceRoot = path.resolve(".");
const DEFAULT_PLAN_PATH =
  "scripts/data/marketing-saas-refill-plan-2026-07-06.json";
const EXPECTED_CATEGORY_SLUG = "marketing-saas";
const EXPECTED_PROFILE_ID = "marketing-saas";
const EXPECTED_BUCKET_ORDER = [
  "phone-in-hand",
  "clean-still-life",
  "abstract-data",
  "spreadsheet-chaos",
  "calendar-overload",
  "laptop-work",
  "desk-chaos",
  "night-routine",
  "phone-notification",
  "team-meeting",
  "tired-couch",
  "laptop-desk",
];
const ZERO_COUNT_BUCKETS = [
  "phone-in-hand",
  "clean-still-life",
  "abstract-data",
  "spreadsheet-chaos",
];
const LOW_COUNT_BUCKETS = [
  "calendar-overload",
  "laptop-work",
  "desk-chaos",
  "night-routine",
  "phone-notification",
  "team-meeting",
  "tired-couch",
];
const PROHIBITED_QUERY_TERMS = [
  "body",
  "bodies",
  "boy",
  "face",
  "faces",
  "female",
  "girl",
  "hand",
  "hands",
  "human",
  "humans",
  "male",
  "man",
  "men",
  "model",
  "people",
  "person",
  "portrait",
  "selfie",
  "silhouette",
  "silhouettes",
  "woman",
  "women",
];

const args = parseArgs(process.argv.slice(2));
const planPath = path.resolve(workspaceRoot, args.plan || DEFAULT_PLAN_PATH);
const strictCounts = args["strict-counts"] === "true";
const jsonOutput = args.json === "true";
const plan = readJson(planPath);
const failures = [];
const warnings = [];

validatePlanShape(plan);
validateBucketOrder(plan);
validateSeedBatch(plan);
validateQueries(plan);
compareAgainstLatestAudit(plan);

const result = {
  ok: failures.length === 0,
  planId: plan.planId,
  planPath,
  categorySlug: plan.categorySlug,
  profileId: plan.profileId,
  bucketCount: plan.buckets?.length ?? 0,
  phases: summarizePhases(plan),
  failures,
  warnings,
  commands: buildCommands(plan),
};

if (jsonOutput) {
  console.log(JSON.stringify(result, null, 2));
} else {
  printHumanSummary(result);
}

if (!result.ok) {
  process.exitCode = 1;
}

function validatePlanShape(refillPlan) {
  if (refillPlan.categorySlug !== EXPECTED_CATEGORY_SLUG) {
    failures.push(
      `Expected categorySlug ${EXPECTED_CATEGORY_SLUG}, received ${refillPlan.categorySlug}.`,
    );
  }

  if (refillPlan.profileId !== EXPECTED_PROFILE_ID) {
    failures.push(
      `Expected profileId ${EXPECTED_PROFILE_ID}, received ${refillPlan.profileId}.`,
    );
  }

  if (!Array.isArray(refillPlan.buckets)) {
    failures.push("Plan must include a buckets array.");
    return;
  }

  if (refillPlan.reviewPolicy?.approvalRequired !== true) {
    failures.push("Plan must require manual approval before assets are selectable.");
  }

  if (refillPlan.reviewPolicy?.doNotAutoApproveSeededAssets !== true) {
    failures.push("Plan must not auto-approve seeded assets.");
  }

  if (refillPlan.reviewPolicy?.seededAssetReviewStatus !== "unreviewed") {
    failures.push("Seeded assets must enter review as unreviewed.");
  }
}

function validateBucketOrder(refillPlan) {
  const bucketIds = refillPlan.buckets?.map((bucket) => bucket.bucketId) ?? [];
  const missingBuckets = EXPECTED_BUCKET_ORDER.filter(
    (bucketId) => !bucketIds.includes(bucketId),
  );
  const extraBuckets = bucketIds.filter(
    (bucketId) => !EXPECTED_BUCKET_ORDER.includes(bucketId),
  );

  if (missingBuckets.length > 0) {
    failures.push(`Missing buckets: ${missingBuckets.join(", ")}.`);
  }

  if (extraBuckets.length > 0) {
    failures.push(`Unexpected buckets: ${extraBuckets.join(", ")}.`);
  }

  if (JSON.stringify(bucketIds) !== JSON.stringify(EXPECTED_BUCKET_ORDER)) {
    failures.push(
      `Bucket order must prioritize zero-count, then low-count, then top-up. Received: ${bucketIds.join(
        ", ",
      )}.`,
    );
  }

  for (const bucket of refillPlan.buckets ?? []) {
    if (ZERO_COUNT_BUCKETS.includes(bucket.bucketId) && bucket.phase !== "zero-count") {
      failures.push(`${bucket.bucketId} must be in phase zero-count.`);
    }

    if (LOW_COUNT_BUCKETS.includes(bucket.bucketId) && bucket.phase !== "low-count") {
      failures.push(`${bucket.bucketId} must be in phase low-count.`);
    }

    if (bucket.bucketId === "laptop-desk" && bucket.phase !== "production-top-up") {
      failures.push("laptop-desk must be in phase production-top-up.");
    }
  }
}

function validateSeedBatch(refillPlan) {
  const batchSize = refillPlan.seedBatch?.batchSize;
  const candidateFetchLimit =
    refillPlan.seedBatch?.candidateFetchLimit ??
    refillPlan.seedBatch?.maxSeededPerBucket;

  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 20) {
    failures.push("seedBatch.batchSize must be an integer from 1 to 20.");
  }

  if (
    !Number.isInteger(candidateFetchLimit) ||
    candidateFetchLimit < 80 ||
    candidateFetchLimit > 120
  ) {
    failures.push(
      "seedBatch.candidateFetchLimit must be an integer from 80 to 120.",
    );
  }

  if (refillPlan.seedBatch?.subjectAnalysisMode !== "manual") {
    failures.push("subjectAnalysisMode must stay manual for this no-Vision workflow.");
  }
}

function validateQueries(refillPlan) {
  for (const bucket of refillPlan.buckets ?? []) {
    if (!Array.isArray(bucket.seedQueries) || bucket.seedQueries.length < 4) {
      failures.push(`${bucket.bucketId} needs at least 4 object-only seed queries.`);
      continue;
    }

    for (const query of bucket.seedQueries) {
      const blockedTerms = getBlockedQueryTerms(query);

      if (blockedTerms.length > 0) {
        failures.push(
          `${bucket.bucketId} query "${query}" contains blocked terms: ${blockedTerms.join(
            ", ",
          )}.`,
        );
      }
    }
  }
}

function compareAgainstLatestAudit(refillPlan) {
  const reportPath = path.resolve(workspaceRoot, refillPlan.readinessSource ?? "");

  if (!existsSync(reportPath)) {
    warnings.push(`Latest audit report not found: ${reportPath}.`);
    return;
  }

  const report = readJson(reportPath);
  const marketingInventory = report.inventory?.find(
    (profile) => profile.profileId === EXPECTED_PROFILE_ID,
  );

  if (!marketingInventory) {
    warnings.push("Latest audit report does not include marketing-saas inventory.");
    return;
  }

  const reportsByBucket = new Map(
    marketingInventory.bucketReports.map((bucket) => [bucket.bucketId, bucket]),
  );

  for (const bucket of refillPlan.buckets ?? []) {
    const reportBucket = reportsByBucket.get(bucket.bucketId);

    if (!reportBucket) {
      warnings.push(`Latest audit report is missing ${bucket.bucketId}.`);
      continue;
    }

    const mismatches = [
      ["selectableCount", bucket.selectableCount, reportBucket.selectableCount],
      ["targetCount", bucket.targetCount, reportBucket.targetCount],
      ["unreviewedCount", bucket.unreviewedCount, reportBucket.unreviewedCount],
      ["humanPositiveCount", bucket.humanPositiveCount, reportBucket.humanPositiveCount],
    ].filter(([, planValue, reportValue]) => planValue !== reportValue);

    if (mismatches.length === 0) {
      continue;
    }

    const message = `${bucket.bucketId} counts differ from latest audit: ${mismatches
      .map(([field, planValue, reportValue]) => `${field} plan=${planValue} audit=${reportValue}`)
      .join("; ")}.`;

    if (strictCounts) {
      failures.push(message);
    } else {
      warnings.push(message);
    }
  }
}

function summarizePhases(refillPlan) {
  const phases = new Map();

  for (const bucket of refillPlan.buckets ?? []) {
    const summary = phases.get(bucket.phase) ?? {
      bucketCount: 0,
      buckets: [],
    };

    summary.bucketCount += 1;
    summary.buckets.push(bucket.bucketId);
    phases.set(bucket.phase, summary);
  }

  return Object.fromEntries(phases);
}

function buildCommands(refillPlan) {
  const planArg = path.relative(workspaceRoot, planPath).replaceAll(path.sep, "\\");
  const phases = ["zero-count", "low-count", "production-top-up"];
  const commands = [];

  for (const phase of phases) {
    const buckets = (refillPlan.buckets ?? [])
      .filter((bucket) => bucket.phase === phase)
      .map((bucket) => bucket.bucketId);

    if (buckets.length === 0) {
      continue;
    }

    commands.push({
      phase,
      dryRun: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types scripts\\seed-carousel-profile-buckets.mjs --refill-plan ${planArg} --phase ${phase}`,
      executeAfterApproval: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types scripts\\seed-carousel-profile-buckets.mjs --refill-plan ${planArg} --phase ${phase} --execute --yes`,
      contactSheet: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types scripts\\audit-carousel-bucket-images.mjs --category marketing-saas --buckets ${buckets.join(
        ",",
      )} --review-status unreviewed --limit 40 --out-dir .tmp\\carousel-visual-qa-marketing-refill-${phase}`,
    });
  }

  commands.push({
    phase: "stage-a",
    dryRun: "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types scripts\\audit-carousel-readiness-scale.mjs --profile marketing-saas --users 100",
  });

  return commands;
}

function getBlockedQueryTerms(query) {
  const queryWords = query.toLowerCase().match(/[a-z]+/g) ?? [];
  const words = new Set(queryWords);

  return PROHIBITED_QUERY_TERMS.filter((term) => words.has(term));
}

function printHumanSummary(result) {
  console.log(`Marketing SaaS refill plan: ${result.ok ? "OK" : "FAILED"}`);
  console.log(`Plan: ${result.planPath}`);
  console.log(`Buckets: ${result.bucketCount}`);
  console.log("");

  for (const [phase, summary] of Object.entries(result.phases)) {
    console.log(`${phase}: ${summary.bucketCount} buckets`);
    console.log(`  ${summary.buckets.join(", ")}`);
  }

  if (result.warnings.length > 0) {
    console.log("");
    console.log("Warnings:");
    for (const warning of result.warnings) {
      console.log(`- ${warning}`);
    }
  }

  if (result.failures.length > 0) {
    console.log("");
    console.log("Failures:");
    for (const failure of result.failures) {
      console.log(`- ${failure}`);
    }
  }

  console.log("");
  console.log("Next commands:");
  for (const command of result.commands) {
    console.log(`[${command.phase}] ${command.dryRun}`);
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

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}
