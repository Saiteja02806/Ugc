import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const workspaceRoot = path.resolve(".");
const PHASE_ORDER = ["zero-count", "low-count", "production-top-up"];
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
const planPath = path.resolve(
  workspaceRoot,
  args.plan || "scripts/data/marketing-saas-refill-plan-2026-07-06.json",
);
const strictCounts = args["strict-counts"] === "true";
const jsonOutput = args.json === "true";
const plan = readJson(planPath);
const failures = [];
const warnings = [];

validatePlanShape(plan);
validatePhaseOrder(plan);
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
  if (!refillPlan.categorySlug || typeof refillPlan.categorySlug !== "string") {
    failures.push("Plan must include categorySlug.");
  }

  if (!refillPlan.profileId || typeof refillPlan.profileId !== "string") {
    failures.push("Plan must include profileId.");
  }

  if (!Array.isArray(refillPlan.buckets) || refillPlan.buckets.length === 0) {
    failures.push("Plan must include a non-empty buckets array.");
    return;
  }

  const duplicateBucketIds = findDuplicates(
    refillPlan.buckets.map((bucket) => bucket.bucketId),
  );

  if (duplicateBucketIds.length > 0) {
    failures.push(`Duplicate buckets: ${duplicateBucketIds.join(", ")}.`);
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

  const selectableRequirements =
    refillPlan.reviewPolicy?.selectableAssetRequirements ?? {};
  const expectedRequirements = {
    face_count: 0,
    has_human: false,
    image_subject_class: "object-only",
    person_count: 0,
    status: "ready",
    subject_review_status: "approved",
  };

  for (const [key, expectedValue] of Object.entries(expectedRequirements)) {
    if (selectableRequirements[key] !== expectedValue) {
      failures.push(
        `reviewPolicy.selectableAssetRequirements.${key} must be ${JSON.stringify(
          expectedValue,
        )}.`,
      );
    }
  }
}

function validatePhaseOrder(refillPlan) {
  let lastPhaseIndex = -1;

  for (const bucket of refillPlan.buckets ?? []) {
    const phaseIndex = PHASE_ORDER.indexOf(bucket.phase);

    if (phaseIndex === -1) {
      failures.push(
        `${bucket.bucketId} has unknown phase "${bucket.phase}". Expected: ${PHASE_ORDER.join(
          ", ",
        )}.`,
      );
      continue;
    }

    if (phaseIndex < lastPhaseIndex) {
      failures.push(
        `${bucket.bucketId} appears after a later phase. Buckets must be ordered zero-count, low-count, production-top-up.`,
      );
    }

    lastPhaseIndex = Math.max(lastPhaseIndex, phaseIndex);

    if (!Number.isInteger(bucket.priority) || bucket.priority < 1) {
      failures.push(`${bucket.bucketId} needs a positive integer priority.`);
    }

    if (bucket.phase === "zero-count" && bucket.selectableCount !== 0) {
      failures.push(`${bucket.bucketId} is zero-count phase but selectableCount is not 0.`);
    }

    if (bucket.phase === "low-count" && !(bucket.selectableCount > 0)) {
      failures.push(`${bucket.bucketId} is low-count phase but selectableCount is not positive.`);
    }

    if (
      bucket.phase === "production-top-up" &&
      !(bucket.selectableCount > 0 && bucket.selectableCount < bucket.targetCount)
    ) {
      failures.push(
        `${bucket.bucketId} is production-top-up but does not look like a partially ready bucket.`,
      );
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

    const duplicateQueries = findDuplicates(bucket.seedQueries);

    if (duplicateQueries.length > 0) {
      failures.push(
        `${bucket.bucketId} has duplicate seed queries: ${duplicateQueries.join(
          ", ",
        )}.`,
      );
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
  const inventory = report.inventory?.find(
    (profile) => profile.profileId === refillPlan.profileId,
  );

  if (!inventory) {
    warnings.push(`Latest audit report does not include ${refillPlan.profileId}.`);
    return;
  }

  const reportsByBucket = new Map(
    inventory.bucketReports.map((bucket) => [bucket.bucketId, bucket]),
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
  const commands = [];

  for (const phase of PHASE_ORDER) {
    const phaseBuckets = (refillPlan.buckets ?? [])
      .filter((bucket) => bucket.phase === phase)
      .map((bucket) => bucket.bucketId);
    const bucketBatch = phaseBuckets.slice(0, 4);
    const maxBucketSuffix = phaseBuckets.length > 4 ? " --max-buckets 4" : "";

    if (phaseBuckets.length === 0) {
      continue;
    }

    commands.push({
      phase,
      bucketCount: phaseBuckets.length,
      dryRun: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types scripts\\seed-carousel-profile-buckets.mjs --refill-plan ${planArg} --phase ${phase}${maxBucketSuffix}`,
      executeAfterApproval: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types scripts\\seed-carousel-profile-buckets.mjs --refill-plan ${planArg} --phase ${phase}${maxBucketSuffix} --execute --yes`,
      contactSheet: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types scripts\\audit-carousel-bucket-images.mjs --category ${refillPlan.categorySlug} --buckets ${bucketBatch.join(
        ",",
      )} --review-status unreviewed --limit 40 --out-dir .tmp\\carousel-visual-qa-${refillPlan.categorySlug}-refill-${phase}`,
      firstBatchBuckets: bucketBatch,
      repeatNote:
        phaseBuckets.length > 4
          ? "Repeat with --buckets for the next reviewed batch after approval."
          : null,
    });
  }

  commands.push({
    phase: "stage-a",
    dryRun: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types scripts\\audit-carousel-readiness-scale.mjs --profile ${refillPlan.profileId} --users 100`,
  });

  return commands;
}

function getBlockedQueryTerms(query) {
  const words = new Set(query.toLowerCase().match(/[a-z]+/g) ?? []);

  return PROHIBITED_QUERY_TERMS.filter((term) => words.has(term));
}

function printHumanSummary(result) {
  console.log(`Carousel refill plan: ${result.ok ? "OK" : "FAILED"}`);
  console.log(`Plan: ${result.planPath}`);
  console.log(`Profile: ${result.profileId}`);
  console.log(`Category: ${result.categorySlug}`);
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

function findDuplicates(values) {
  const seen = new Set();
  const duplicates = new Set();

  for (const value of values) {
    const normalized = String(value).trim().toLowerCase();

    if (seen.has(normalized)) {
      duplicates.add(normalized);
    }

    seen.add(normalized);
  }

  return [...duplicates];
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
