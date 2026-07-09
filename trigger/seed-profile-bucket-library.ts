import { logger, task } from "@trigger.dev/sdk";
import { z } from "zod";

import type { CarouselBusinessVisualProfileId } from "@/lib/carousel/business-visual-profile";
import {
  CAROUSEL_PROFILE_BUCKET_SEED_SCOPES,
  seedCarouselProfileBucketLibrary,
} from "@/lib/carousel/profile-bucket-seeding-runner";

const SeedProfileBucketLibraryPayloadSchema = z.object({
  batchSize: z.number().int().min(1).max(20).optional(),
  candidateFetchLimit: z.number().int().min(1).max(120).optional(),
  categorySlug: z.string().min(1).max(80).optional(),
  dryRun: z.boolean().optional(),
  maxBuckets: z.number().int().min(1).max(20).optional(),
  maxSeededPerBucket: z.number().int().min(1).max(120).optional(),
  maxSourceAttempts: z.number().int().min(1).max(12).optional(),
  profileId: z.string().min(1).max(80),
  scope: z.enum(CAROUSEL_PROFILE_BUCKET_SEED_SCOPES).optional(),
  targetCount: z.number().int().min(1).max(250).optional(),
});

export const seedProfileBucketLibraryTask = task({
  id: "seed-profile-bucket-library",
  queue: { concurrencyLimit: 1 },
  machine: { preset: "medium-1x" },
  maxDuration: 7_200,
  retry: {
    maxAttempts: 1,
  },
  run: async (rawPayload: unknown) => {
    const payload = SeedProfileBucketLibraryPayloadSchema.parse(rawPayload);

    logger.info("Profile bucket library seed started", {
      batchSize: payload.batchSize,
      candidateFetchLimit:
        payload.candidateFetchLimit ?? payload.maxSeededPerBucket,
      categorySlug: payload.categorySlug,
      dryRun: payload.dryRun,
      maxBuckets: payload.maxBuckets,
      maxSourceAttempts: payload.maxSourceAttempts,
      profileId: payload.profileId,
      scope: payload.scope,
      targetCount: payload.targetCount,
    });

    const result = await seedCarouselProfileBucketLibrary({
      batchSize: payload.batchSize,
      candidateFetchLimit:
        payload.candidateFetchLimit ?? payload.maxSeededPerBucket,
      categorySlug: payload.categorySlug,
      dryRun: payload.dryRun,
      maxBuckets: payload.maxBuckets,
      maxSourceAttempts: payload.maxSourceAttempts,
      profileId: payload.profileId as CarouselBusinessVisualProfileId,
      scope: payload.scope,
      targetCount: payload.targetCount,
    });

    logger.info("Profile bucket library seed finished", {
      categorySlug: result.plan.categorySlug,
      failedBucketCount: result.failedBucketCount,
      ok: result.ok,
      profileId: result.plan.profileId,
      scope: result.plan.scope,
      seededCount: result.seededCount,
      selectedBucketCount: result.plan.selectedBucketCount,
    });

    return result;
  },
});
