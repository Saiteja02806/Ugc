import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const workspaceRoot = path.resolve(".");

loadEnvFile(path.join(workspaceRoot, ".env.local"));

const args = parseArgs(process.argv.slice(2));
const execute = args.execute === "true";
const manifestPath = path.resolve(
  workspaceRoot,
  args.manifest || "scripts/data/marketing-saas-image-review-2026-07-05.json",
);

if (execute && args.yes !== "true") {
  throw new Error("Pass --yes with --execute to apply review decisions.");
}

const manifest = readJson(manifestPath);

if (manifest.requiresManualCompletion === true) {
  throw new Error(
    `Review manifest ${manifestPath} is still marked requiresManualCompletion. Fill reject indexes and remove the flag before applying.`,
  );
}

const preserveSubjectMetadataOnApprove =
  manifest.preserveSubjectMetadataOnApprove === true;
const supabase = createClient(
  getRequiredEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
  getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { autoRefreshToken: false, persistSession: false } },
);
const decisions = resolveDecisions(manifest);
const assetIds = decisions.map((decision) => decision.assetId);
const databaseAssets = await listAssetsByIds(assetIds);
const databaseAssetsById = new Map(databaseAssets.map((asset) => [asset.id, asset]));

validateDatabaseAssets({
  databaseAssetsById,
  decisions,
  manifest,
  preserveSubjectMetadataOnApprove,
});

const rejected = decisions.filter((decision) => decision.decision === "reject");
const approved = decisions.filter((decision) => decision.decision === "approve");
const appliedAt = new Date().toISOString();

if (execute) {
  for (const decisionChunk of chunkArray(rejected, 80)) {
    const decisionsByReason = groupBy(decisionChunk, (decision) =>
      decision.reason || "manual-reject",
    );

    for (const [reason, reasonDecisions] of decisionsByReason) {
      await updateAssets(
        reasonDecisions.map((decision) => decision.assetId),
        buildRejectPatch({
          appliedAt,
          reason,
          reviewSource: manifest.reviewSource,
        }),
      );
    }
  }

  for (const decisionChunk of chunkArray(approved, 80)) {
    const approvalMetadata = {
      subject_analysis: {
        decision: "approve",
        reason: "manual-contact-sheet-review",
        reviewSource: manifest.reviewSource,
      },
      subject_analyzed_at: appliedAt,
      subject_analyzer_version: "manual-review-v1",
      subject_review_status: "approved",
      updated_at: appliedAt,
    };

    await updateAssets(
      decisionChunk.map((decision) => decision.assetId),
      preserveSubjectMetadataOnApprove
        ? approvalMetadata
        : {
            ...approvalMetadata,
            face_count: 0,
            has_human: false,
            image_subject_class: "object-only",
            person_count: 0,
          },
    );
  }
}

const result = {
  approvedCount: approved.length,
  bucketSummary: manifest.buckets.map((bucket) => ({
    approvedCount: decisions.filter(
      (decision) =>
        decision.bucketId === getReviewBucketId(bucket) &&
        decision.decision === "approve",
    ).length,
    bucketId: getReviewBucketId(bucket),
    bucketKind: bucket.bucketKind || (bucket.broadBucket || bucket.broadBucketId ? "broad" : "legacy"),
    expectedCount: bucket.expectedCount,
    rejectedCount: decisions.filter(
      (decision) =>
        decision.bucketId === getReviewBucketId(bucket) &&
        decision.decision === "reject",
    ).length,
  })),
  categorySlug: manifest.categorySlug,
  dryRun: !execute,
  manifestPath,
  preserveSubjectMetadataOnApprove,
  subjectMetadataResetAssetIds: approved
    .filter((decision) => decision.allowSubjectMetadataReset === true)
    .map((decision) => decision.assetId),
  subjectMetadataResetCount: approved.filter(
    (decision) => decision.allowSubjectMetadataReset === true,
  ).length,
  rejectedAssetIds: rejected.map((decision) => decision.assetId),
  rejectedCount: rejected.length,
  reviewedCount: decisions.length,
};
const outputDir = path.join(workspaceRoot, ".tmp", "carousel-image-review");
const outputPath = path.join(
  outputDir,
  execute ? "applied-review.json" : "review-dry-run.json",
);

await mkdir(outputDir, { recursive: true });
await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ ...result, outputPath }, null, 2));

function resolveDecisions(reviewManifest) {
  const resolved = [];

  for (const bucketReview of reviewManifest.buckets) {
    const bucketId =
      bucketReview.bucketId || bucketReview.broadBucket || bucketReview.broadBucketId;
    const bucketKind =
      bucketReview.bucketKind ||
      (bucketReview.broadBucket || bucketReview.broadBucketId ? "broad" : "legacy");

    if (!bucketId) {
      throw new Error("Each review bucket needs bucketId or broadBucket.");
    }

    const reportPath = path.resolve(workspaceRoot, bucketReview.sourceReport);
    const report = readJson(reportPath);
    const reportBucket = report.buckets?.find(
      (bucket) =>
        bucket.bucketId === bucketId ||
        bucket.broadBucket === bucketId ||
        bucket.broadBucketId === bucketId,
    );

    if (!reportBucket) {
      throw new Error(
        `Report ${reportPath} does not contain ${bucketId}.`,
      );
    }

    if (reportBucket.assets.length !== bucketReview.expectedCount) {
      throw new Error(
        `${bucketId} expected ${bucketReview.expectedCount} report assets, found ${reportBucket.assets.length}.`,
      );
    }

    const rejectedIndexes = new Set(bucketReview.rejectIndexes || []);
    const subjectMetadataResetIndexes = new Set(
      bucketReview.allowSubjectMetadataResetIndexes || [],
    );
    const rejectDecisions = new Map(
      (bucketReview.rejectDecisions || []).map((decision) => [
        decision.index,
        decision.reason,
      ]),
    );

    for (const index of rejectedIndexes) {
      if (!Number.isInteger(index) || index < 1 || index > reportBucket.assets.length) {
        throw new Error(`${bucketId} has invalid reject index ${index}.`);
      }
    }

    for (const [index, reason] of rejectDecisions) {
      if (!Number.isInteger(index) || index < 1 || index > reportBucket.assets.length) {
        throw new Error(`${bucketId} has invalid reject decision index ${index}.`);
      }

      if (typeof reason !== "string" || reason.trim().length === 0) {
        throw new Error(`${bucketId} reject decision ${index} needs a reason.`);
      }
    }

    for (const index of subjectMetadataResetIndexes) {
      if (!Number.isInteger(index) || index < 1 || index > reportBucket.assets.length) {
        throw new Error(`${bucketId} has invalid subject metadata reset index ${index}.`);
      }

      if (rejectedIndexes.has(index) || rejectDecisions.has(index)) {
        throw new Error(
          `${bucketId} cannot both reject and reset subject metadata for index ${index}.`,
        );
      }
    }

    for (const asset of reportBucket.assets) {
      const reject =
        bucketReview.rejectAll ||
        rejectedIndexes.has(asset.index) ||
        rejectDecisions.has(asset.index);
      const rejectReason =
        rejectDecisions.get(asset.index) ||
        bucketReview.rejectReason ||
        "manual-reject";

      resolved.push({
        allowSubjectMetadataReset: !reject && subjectMetadataResetIndexes.has(asset.index),
        assetId: asset.id,
        bucketId,
        bucketKind,
        decision: reject ? "reject" : "approve",
        index: asset.index,
        pexelsPhotoId: asset.pexelsPhotoId,
        reason: reject ? rejectReason : "manual-contact-sheet-review",
      });
    }
  }

  const uniqueIds = new Set(resolved.map((decision) => decision.assetId));

  if (uniqueIds.size !== resolved.length) {
    throw new Error("Review manifest resolves the same asset more than once.");
  }

  return resolved;
}

function getReviewBucketId(bucketReview) {
  return bucketReview.bucketId || bucketReview.broadBucket || bucketReview.broadBucketId;
}

async function listAssetsByIds(ids) {
  const assets = [];

  for (const idChunk of chunkArray(ids, 80)) {
    const { data, error } = await supabase
      .from("category_image_assets")
      .select("id,broad_visual_bucket,category_slug,face_count,has_human,image_subject_class,person_count,status,subject_review_status,visual_bucket")
      .in("id", idChunk);

    if (error) throw new Error(`Could not load review assets: ${error.message}`);
    assets.push(...(data || []));
  }

  return assets;
}

function validateDatabaseAssets({
  databaseAssetsById,
  decisions: items,
  manifest: reviewManifest,
  preserveSubjectMetadataOnApprove: preserveMetadata,
}) {
  for (const decision of items) {
    const asset = databaseAssetsById.get(decision.assetId);

    if (!asset) throw new Error(`Asset ${decision.assetId} is missing from Supabase.`);
    if (asset.category_slug !== reviewManifest.categorySlug) {
      throw new Error(`Asset ${decision.assetId} has category ${asset.category_slug}.`);
    }
    if (
      decision.bucketKind === "broad" &&
      asset.broad_visual_bucket !== decision.bucketId
    ) {
      throw new Error(
        `Asset ${decision.assetId} has broad bucket ${asset.broad_visual_bucket}.`,
      );
    }
    if (
      decision.bucketKind !== "broad" &&
      asset.visual_bucket !== decision.bucketId
    ) {
      throw new Error(`Asset ${decision.assetId} has bucket ${asset.visual_bucket}.`);
    }
    if (asset.status !== "ready") {
      throw new Error(`Asset ${decision.assetId} is ${asset.status}, expected ready.`);
    }
    if (
      decision.decision === "approve" &&
      !preserveMetadata &&
      asset.image_subject_class === "clear-face"
    ) {
      throw new Error(
        `Refusing to approve asset ${decision.assetId} because it is classified as clear-face.`,
      );
    }
    if (
      decision.decision === "approve" &&
      !preserveMetadata &&
      (asset.has_human === true || asset.face_count > 0 || asset.person_count > 0)
    ) {
      if (
        decision.allowSubjectMetadataReset === true &&
        asset.image_subject_class !== "clear-face" &&
        asset.face_count === 0
      ) {
        continue;
      }

      throw new Error(
        `Refusing to approve asset ${decision.assetId} because its metadata indicates human presence.`,
      );
    }
  }
}

async function updateAssets(ids, patch) {
  const { error } = await supabase
    .from("category_image_assets")
    .update(patch)
    .in("id", ids)
    .eq("status", "ready");

  if (error) throw new Error(`Could not apply review decision: ${error.message}`);
}

function buildRejectPatch({ appliedAt, reason, reviewSource }) {
  const unsafeHumanReason = isHumanRejectReason(reason);
  const clearFaceReason = /\b(clear[-\s]?face|face)\b/i.test(reason);

  return {
    ...(unsafeHumanReason
      ? {
          face_count: clearFaceReason ? 1 : 0,
          has_human: true,
          image_subject_class: clearFaceReason ? "clear-face" : "faceless-human",
          person_count: 1,
        }
      : {}),
    status: "archived",
    subject_analysis: {
      decision: "reject",
      reason,
      reviewSource,
    },
    subject_analyzed_at: appliedAt,
    subject_analyzer_version: "manual-review-v1",
    subject_review_status: "rejected",
    updated_at: appliedAt,
  };
}

function isHumanRejectReason(reason) {
  return /\b(clear[-\s]?face|face|human|person|people|hand|hands|body|bodies|silhouette|model)\b/i.test(
    reason,
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

function readJson(filePath) {
  if (!existsSync(filePath)) throw new Error(`File does not exist: ${filePath}`);
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    const next = values[index + 1];
    if (!next || next.startsWith("--")) parsed[key] = "true";
    else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function loadEnvFile(envPath) {
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    const value = match[2].trim();
    process.env[match[1]] =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
        ? value.slice(1, -1)
        : value;
  }
}

function getRequiredEnv(...names) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  throw new Error(`Missing ${names.join(" or ")}`);
}
