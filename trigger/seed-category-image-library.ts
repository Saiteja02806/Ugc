import { logger, task } from "@trigger.dev/sdk";
import { z } from "zod";

import { seedCategoryImageLibrary } from "@/lib/carousel/seed-category-image-library";

const SeedCategoryImageLibraryPayloadSchema = z.object({
  batchSize: z.number().int().min(1).max(20).optional(),
  candidateFetchLimit: z.number().int().min(1).max(120).optional(),
  categorySlug: z.string().min(1).max(80),
  maxSourceAttempts: z.number().int().min(1).max(12).optional(),
  maxSeededCount: z.number().int().min(1).max(120).optional(),
  minimumApprovedTarget: z.number().int().min(1).max(250).optional(),
  queries: z.array(z.string().min(1).max(120)).min(1).max(20).optional(),
  subjectAnalysisMode: z.enum(["auto", "manual"]).optional(),
  targetCount: z.number().int().min(1).max(250).optional(),
  visualBucketId: z.string().min(1).max(80).optional(),
  visualKeywords: z.array(z.string().min(1).max(80)).max(12).optional(),
});

export const seedCategoryImageLibraryTask = task({
  id: "seed-category-image-library",
  queue: { concurrencyLimit: 1 },
  machine: { preset: "medium-1x" },
  maxDuration: 1_800,
  retry: {
    maxAttempts: 2,
    factor: 1.8,
    minTimeoutInMs: 2_000,
    maxTimeoutInMs: 60_000,
    randomize: true,
  },
  run: async (rawPayload: unknown) => {
    const payload = SeedCategoryImageLibraryPayloadSchema.parse(rawPayload);

    logger.info("Category image library seed started", {
      batchSize: payload.batchSize,
      candidateFetchLimit:
        payload.candidateFetchLimit ?? payload.maxSeededCount,
      categorySlug: payload.categorySlug,
      maxSourceAttempts: payload.maxSourceAttempts,
      minimumApprovedTarget:
        payload.minimumApprovedTarget ?? payload.targetCount,
      queryCount: payload.queries?.length ?? 0,
      subjectAnalysisMode: payload.subjectAnalysisMode ?? "manual",
      targetCount: payload.targetCount,
      visualBucketId: payload.visualBucketId,
    });

    const result = await seedCategoryImageLibrary(payload);

    logger.info("Category image library seed finished", {
      batchSize: result.batchSize,
      batchesProcessed: result.batchesProcessed,
      bucketType: result.bucketType,
      approvedObjectOnlyCountAfter: result.approvedObjectOnlyCountAfter,
      approvedObjectOnlyCountBefore: result.approvedObjectOnlyCountBefore,
      awaitingManualReview: result.awaitingManualReview,
      candidateFetchLimit: result.candidateFetchLimit,
      categorySlug: result.categorySlug,
      isReady: result.isReady,
      minimumApprovedTarget: result.minimumApprovedTarget,
      rawCandidateCountAfter: result.rawCandidateCountAfter,
      rawCandidateCountBefore: result.rawCandidateCountBefore,
      readyCountAfter: result.readyCountAfter,
      readyCountBefore: result.readyCountBefore,
      rejectedCountAfter: result.rejectedCountAfter,
      rejectedCountBefore: result.rejectedCountBefore,
      reviewCandidateCountAfter: result.reviewCandidateCountAfter,
      reviewCandidateCountBefore: result.reviewCandidateCountBefore,
      seededCount: result.seededCount,
      sourceAttemptLimit: result.sourceAttemptLimit,
      surplusApprovedCount: result.surplusApprovedCount,
      skippedDuplicateCount: result.skippedDuplicateCount,
      skippedHumanCount: result.skippedHumanCount,
      subjectAnalysisMode: result.subjectAnalysisMode,
      targetCount: result.targetCount,
      unreviewedCountAfter: result.unreviewedCountAfter,
      unreviewedCountBefore: result.unreviewedCountBefore,
      visualBucketId: result.visualBucketId,
    });

    return result;
  },
});
