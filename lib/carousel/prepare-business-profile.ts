import "server-only";

import { randomUUID } from "node:crypto";

import {
  getBusinessProfileForUser,
  updateBusinessProfilePreparation,
  type BusinessProfileRecord,
} from "@/lib/business-profiles/db";
import { enqueueCarouselGenerationJob } from "@/lib/carousel/generation-jobs";
import {
  AUTOMATIC_CAROUSEL_CANDIDATE_COUNT,
  AUTOMATIC_CAROUSEL_SLIDE_COUNT,
} from "@/lib/carousel/automatic-candidate-count";
import { buildCarouselBusinessContentContext } from "@/lib/carousel/business-content-context";
import {
  selectCarouselContentAssignments,
  type CarouselContentAssignment,
} from "@/lib/carousel/content-selector";
import { resolveCarouselCategoryProfile } from "@/lib/carousel/category-profile-resolver";
import {
  countReadyCategoryImageAssetsForCarousel,
  createCarouselGeneration,
  getCarouselGenerationsByBatchId,
  getWebsiteAnalysisForCarousel,
  listAutoCarouselGenerationsForBusinessProfile,
  listRecentCarouselContentHistory,
  reserveCarouselContentAssignment,
  updateCarouselGeneration,
  updateCarouselGenerationBatchCandidateCount,
} from "@/lib/carousel/db";
import { DEFAULT_CAROUSEL_RENDER_STYLE } from "@/lib/carousel/render-style";
import { getMissingDailyCarouselCandidateIndexes } from "@/lib/trending/daily-replenishment-logic";

export async function prepareBusinessProfileCarousels(profile: BusinessProfileRecord) {
  const { analysis, businessContext, resolvedCategory } =
    await getPreparationContext(profile);
  let existing = (
    await listAutoCarouselGenerationsForBusinessProfile({
      businessProfileId: profile.id,
      profileVersion: profile.profileVersion,
    })
  ).filter((generation) => generation.originDailyFeedId === null);
  let generationBatchId = existing[0]?.generationBatchId ?? randomUUID();
  let contentAssignments = await buildContentAssignments({
    businessContext,
    businessProfileId: profile.id,
    candidateCount: AUTOMATIC_CAROUSEL_CANDIDATE_COUNT,
    existing,
    generationBatchId,
  });

  for (
    let candidateIndex = 0;
    candidateIndex < AUTOMATIC_CAROUSEL_CANDIDATE_COUNT;
    candidateIndex += 1
  ) {
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
        contentAssignment: contentAssignments[candidateIndex],
        format: "4:5",
        generationBatchId,
        generationSource: "auto_generated",
        projectId: profile.projectId,
        selectedAngle: null,
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
      const concurrentBatchId = existing[0]?.generationBatchId;

      if (concurrentBatchId && concurrentBatchId !== generationBatchId) {
        generationBatchId = concurrentBatchId;
        contentAssignments = await buildContentAssignments({
          businessContext,
          businessProfileId: profile.id,
          candidateCount: AUTOMATIC_CAROUSEL_CANDIDATE_COUNT,
          existing,
          generationBatchId,
        });
      }
    }
  }

  existing = (
    await listAutoCarouselGenerationsForBusinessProfile({
      businessProfileId: profile.id,
      profileVersion: profile.profileVersion,
    })
  ).filter((generation) => generation.originDailyFeedId === null);

  await reserveMissingContentAssignments(existing, contentAssignments);

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

  const { analysis, businessContext, resolvedCategory } =
    await getPreparationContext(params.profile);
  let existingBatch = await getCarouselGenerationsByBatchId(
    params.generationBatchId,
  );

  assertDailyBatchOwnership({
    existingBatch,
    originDailyFeedId: params.originDailyFeedId,
    profile: params.profile,
  });
  const contentAssignments = await buildContentAssignments({
    businessContext,
    businessProfileId: params.profile.id,
    candidateCount: targetCandidateCount,
    existing: existingBatch,
    generationBatchId: params.generationBatchId,
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
        contentAssignment: contentAssignments[candidateIndex],
        format: "4:5",
        generationBatchId: params.generationBatchId,
        generationSource: "auto_generated",
        originDailyFeedId: params.originDailyFeedId,
        projectId: params.profile.projectId,
        selectedAngle: null,
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

  await reserveMissingContentAssignments(existingBatch, contentAssignments);

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

async function buildContentAssignments(params: {
  businessContext: BusinessProfileRecord["context"];
  businessProfileId: string;
  candidateCount: number;
  existing: Awaited<ReturnType<typeof getCarouselGenerationsByBatchId>>;
  generationBatchId: string;
}) {
  const history = await listRecentCarouselContentHistory({
    businessProfileId: params.businessProfileId,
    excludeGenerationBatchId: params.generationBatchId,
    limit: 10,
  });
  const reserved = new Map<number, Partial<CarouselContentAssignment>>();

  for (const generation of params.existing) {
    if (generation.contentFormatId && generation.hookFamilyId) {
      reserved.set(generation.candidateIndex, {
        contentFormatId: generation.contentFormatId,
        hookFamilyId: generation.hookFamilyId,
      });
    }
  }

  const contentContext = buildCarouselBusinessContentContext(
    params.businessContext,
  );

  return selectCarouselContentAssignments({
    candidateCount: params.candidateCount,
    history,
    reserved,
    seed: `${params.businessProfileId}:${params.generationBatchId}`,
    topicOptionCount: contentContext.topics.length,
  });
}

async function reserveMissingContentAssignments(
  generations: Awaited<ReturnType<typeof getCarouselGenerationsByBatchId>>,
  assignments: readonly CarouselContentAssignment[],
) {
  await Promise.all(
    generations.map(async (generation) => {
      if (generation.contentFormatId && generation.hookFamilyId) {
        return;
      }

      const assignment = assignments[generation.candidateIndex];

      if (!assignment) {
        throw new Error(
          `Carousel candidate ${generation.candidateIndex} is missing a content assignment.`,
        );
      }

      await reserveCarouselContentAssignment({
        assignment,
        carouselId: generation.id,
      });
    }),
  );
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
    category: profile.context.category ?? analysis.category,
    pexelsImageQueries:
      profile.context.pexelsImageQueries ?? analysis.pexelsImageQueries,
    productSummary:
      profile.context.productSummary ?? analysis.productSummary,
    valueProps: profile.context.valueProps,
    visualKeywords:
      profile.context.visualKeywords ?? analysis.visualKeywords,
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

  return {
    analysis,
    businessContext: profile.context,
    resolvedCategory,
  };
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
