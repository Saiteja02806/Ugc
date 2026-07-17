import "server-only";

import { randomUUID } from "node:crypto";

import {
  getBusinessProfileForUser,
  updateBusinessProfilePreparation,
  type BusinessProfileRecord,
} from "@/lib/business-profiles/db";
import { enqueueCarouselGenerationJob } from "@/lib/carousel/aws-generation";
import {
  AUTOMATIC_CAROUSEL_CANDIDATE_COUNT,
  AUTOMATIC_CAROUSEL_SLIDE_COUNT,
} from "@/lib/carousel/automatic-candidate-count";
import { getCarouselCandidateAngles } from "@/lib/carousel/candidate-angles";
import { resolveCarouselCategoryProfile } from "@/lib/carousel/category-profile-resolver";
import {
  countReadyCategoryImageAssetsForCarousel,
  createCarouselGeneration,
  getCarouselGenerationsByBatchId,
  getWebsiteAnalysisForCarousel,
  listAutoCarouselGenerationsForBusinessProfile,
  updateCarouselGeneration,
  updateCarouselGenerationBatchCandidateCount,
} from "@/lib/carousel/db";
import { DEFAULT_CAROUSEL_RENDER_STYLE } from "@/lib/carousel/render-style";
import {
  getMissingDailyCarouselCandidateIndexes,
  rotateDailyCarouselAngles,
} from "@/lib/trending/daily-replenishment-logic";

const DAILY_ANGLE_POOL_SIZE = 20;

export async function prepareBusinessProfileCarousels(profile: BusinessProfileRecord) {
  const { analysis, resolvedCategory } = await getPreparationContext(profile);

  const candidateAngles = getCarouselCandidateAngles({
    candidateCount: AUTOMATIC_CAROUSEL_CANDIDATE_COUNT,
    websiteAnalysis: analysis,
  });
  let existing = (
    await listAutoCarouselGenerationsForBusinessProfile({
      businessProfileId: profile.id,
      profileVersion: profile.profileVersion,
    })
  ).filter((generation) => generation.originDailyFeedId === null);
  let generationBatchId = existing[0]?.generationBatchId ?? randomUUID();

  for (const [candidateIndex, angle] of candidateAngles.entries()) {
    if (existing.some((generation) => generation.candidateIndex === candidateIndex)) {
      continue;
    }

    try {
      await createCarouselGeneration({
        businessProfileId: profile.id,
        businessProfileVersion: profile.profileVersion,
        candidateCount: AUTOMATIC_CAROUSEL_CANDIDATE_COUNT,
        candidateIndex,
        categorySlug: resolvedCategory.categorySlug,
        format: "4:5",
        generationBatchId,
        generationSource: "auto_generated",
        projectId: profile.projectId,
        selectedAngle: angle,
        slideCount: AUTOMATIC_CAROUSEL_SLIDE_COUNT,
        userId: profile.userId,
        websiteAnalysisId: analysis.id,
      });
    } catch (error) {
      // A concurrent onboarding submission may have inserted this candidate first.
      existing = (
        await listAutoCarouselGenerationsForBusinessProfile({
          businessProfileId: profile.id,
          profileVersion: profile.profileVersion,
        })
      ).filter((generation) => generation.originDailyFeedId === null);
      if (!existing.some((generation) => generation.candidateIndex === candidateIndex)) {
        throw error;
      }
      generationBatchId = existing[0]?.generationBatchId ?? generationBatchId;
    }
  }

  existing = (
    await listAutoCarouselGenerationsForBusinessProfile({
      businessProfileId: profile.id,
      profileVersion: profile.profileVersion,
    })
  ).filter((generation) => generation.originDailyFeedId === null);

  await updateCarouselGenerationBatchCandidateCount({
    candidateCount: AUTOMATIC_CAROUSEL_CANDIDATE_COUNT,
    generationBatchId,
  });

  const activeCandidates = await enqueueProcessingCarouselCandidates(existing, profile);

  if (activeCandidates === 0 && !existing.some((generation) => generation.status === "completed")) {
    throw new Error("Could not start carousel preparation workers.");
  }

  await updateBusinessProfilePreparation({
    generationBatchId,
    profileId: profile.id,
    status: "preparing",
  });

  return {
    candidateCount: AUTOMATIC_CAROUSEL_CANDIDATE_COUNT,
    generationBatchId,
  };
}

export async function prepareDailyBusinessProfileCarousels(params: {
  generationBatchId: string;
  localDate: string;
  originDailyFeedId: string;
  profile: BusinessProfileRecord;
  targetCandidateCount: number;
}) {
  const targetCandidateCount = Math.min(
    Math.max(Math.trunc(params.targetCandidateCount), 0),
    50,
  );

  if (targetCandidateCount === 0) {
    return {
      candidateCount: 0,
      generationBatchId: params.generationBatchId,
    };
  }

  const { analysis, resolvedCategory } = await getPreparationContext(
    params.profile,
  );
  const anglePool = getCarouselCandidateAngles({
    candidateCount: Math.max(DAILY_ANGLE_POOL_SIZE, targetCandidateCount),
    websiteAnalysis: analysis,
  });
  const candidateAngles = rotateDailyCarouselAngles({
    angles: anglePool,
    candidateCount: targetCandidateCount,
    localDate: params.localDate,
    profileId: params.profile.id,
  });
  let existingBatch = await getCarouselGenerationsByBatchId(
    params.generationBatchId,
  );

  assertDailyBatchOwnership({
    existingBatch,
    originDailyFeedId: params.originDailyFeedId,
    profile: params.profile,
  });

  const missingCandidateIndexes = getMissingDailyCarouselCandidateIndexes({
    existingCandidateIndexes: existingBatch.map(
      (generation) => generation.candidateIndex,
    ),
    targetCandidateCount,
  });

  for (const candidateIndex of missingCandidateIndexes) {
    try {
      await createCarouselGeneration({
        availableOnLocalDate: params.localDate,
        businessProfileId: params.profile.id,
        businessProfileVersion: params.profile.profileVersion,
        candidateCount: targetCandidateCount,
        candidateIndex,
        categorySlug: resolvedCategory.categorySlug,
        format: "4:5",
        generationBatchId: params.generationBatchId,
        generationSource: "auto_generated",
        originDailyFeedId: params.originDailyFeedId,
        projectId: params.profile.projectId,
        selectedAngle: candidateAngles[candidateIndex] ?? null,
        slideCount: AUTOMATIC_CAROUSEL_SLIDE_COUNT,
        userId: params.profile.userId,
        websiteAnalysisId: analysis.id,
      });
    } catch (error) {
      existingBatch = await getCarouselGenerationsByBatchId(
        params.generationBatchId,
      );

      if (!existingBatch.some((generation) => generation.candidateIndex === candidateIndex)) {
        throw error;
      }
    }

    existingBatch = await getCarouselGenerationsByBatchId(
      params.generationBatchId,
    );
  }

  assertDailyBatchOwnership({
    existingBatch,
    originDailyFeedId: params.originDailyFeedId,
    profile: params.profile,
  });

  await updateCarouselGenerationBatchCandidateCount({
    candidateCount: targetCandidateCount,
    generationBatchId: params.generationBatchId,
  });
  await enqueueProcessingCarouselCandidates(existingBatch, params.profile, {
    throwOnFailure: true,
  });

  return {
    candidateCount: targetCandidateCount,
    generationBatchId: params.generationBatchId,
  };
}

async function getPreparationContext(profile: BusinessProfileRecord) {
  if (!profile.analysisId) {
    throw new Error("Business profile is missing its normalized analysis.");
  }

  const analysis = await getWebsiteAnalysisForCarousel(profile.analysisId);

  if (!analysis || analysis.userId !== profile.userId) {
    throw new Error("Business profile analysis was not found.");
  }

  const resolvedCategory = resolveCarouselCategoryProfile({
    category: analysis.analysis.category ?? analysis.category,
    pexelsImageQueries:
      analysis.analysis.pexelsImageQueries ?? analysis.pexelsImageQueries,
    productSummary:
      analysis.analysis.productSummary ?? analysis.productSummary,
    valueProps: analysis.analysis.valueProps,
    visualKeywords:
      analysis.analysis.visualKeywords ?? analysis.visualKeywords,
  });
  const safeAssetCount = await countReadyCategoryImageAssetsForCarousel(
    resolvedCategory.categorySlug,
    resolvedCategory.businessVisualProfile.id,
  );

  if (safeAssetCount === 0) {
    throw new Error(
      "No approved safe carousel assets are available for this business profile.",
    );
  }

  return { analysis, resolvedCategory };
}

export async function enqueueProcessingCarouselCandidates(
  generations: Awaited<ReturnType<typeof getCarouselGenerationsByBatchId>>,
  profile: BusinessProfileRecord,
  options?: { throwOnFailure?: boolean },
) {
  let activeCandidates = 0;
  let firstFailure: unknown = null;

  for (const generation of generations) {
    if (generation.status !== "processing") {
      continue;
    }

    try {
      const jobId = await enqueueCarouselGenerationJob({
        candidateCount: generation.candidateCount,
        candidateIndex: generation.candidateIndex,
        carouselId: generation.id,
        existingJobId: generation.triggerRunId,
        projectId: profile.projectId,
        textStyle: DEFAULT_CAROUSEL_RENDER_STYLE,
        userId: profile.userId,
      });
      if (generation.triggerRunId !== jobId) {
        await updateCarouselGeneration(generation.id, { trigger_run_id: jobId });
      }
      activeCandidates += 1;
    } catch (error) {
      // enqueueCarouselGenerationJob persists the candidate failure before it throws.
      firstFailure ??= error;
    }
  }

  if (firstFailure && options?.throwOnFailure) {
    throw firstFailure;
  }

  return activeCandidates;
}

function assertDailyBatchOwnership(params: {
  existingBatch: Awaited<ReturnType<typeof getCarouselGenerationsByBatchId>>;
  originDailyFeedId: string;
  profile: BusinessProfileRecord;
}) {
  const foreignGeneration = params.existingBatch.find(
    (generation) =>
      generation.userId !== params.profile.userId ||
      generation.businessProfileId !== params.profile.id ||
      generation.businessProfileVersion !== params.profile.profileVersion ||
      generation.originDailyFeedId !== params.originDailyFeedId,
  );

  if (foreignGeneration) {
    throw new Error("Daily carousel generation batch ownership does not match.");
  }
}

export async function prepareBusinessProfileForUser(userId: string) {
  const profile = await getBusinessProfileForUser(userId);
  if (!profile) throw new Error("Business profile was not found.");
  return prepareBusinessProfileCarousels(profile);
}
