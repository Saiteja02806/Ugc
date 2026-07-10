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
  getWebsiteAnalysisForCarousel,
  listAutoCarouselGenerationsForBusinessProfile,
  updateCarouselGeneration,
  updateCarouselGenerationBatchCandidateCount,
} from "@/lib/carousel/db";
import { DEFAULT_CAROUSEL_RENDER_STYLE } from "@/lib/carousel/render-style";

export async function prepareBusinessProfileCarousels(profile: BusinessProfileRecord) {
  if (!profile.analysisId) {
    throw new Error("Business profile is missing its normalized analysis.");
  }

  const analysis = await getWebsiteAnalysisForCarousel(profile.analysisId);

  if (!analysis || analysis.userId !== profile.userId) {
    throw new Error("Business profile analysis was not found.");
  }

  const resolvedCategory = resolveCarouselCategoryProfile({
    category: analysis.analysis.category ?? analysis.category,
    pexelsImageQueries: analysis.analysis.pexelsImageQueries ?? analysis.pexelsImageQueries,
    productSummary: analysis.analysis.productSummary ?? analysis.productSummary,
    valueProps: analysis.analysis.valueProps,
    visualKeywords: analysis.analysis.visualKeywords ?? analysis.visualKeywords,
  });
  const safeAssetCount = await countReadyCategoryImageAssetsForCarousel(
    resolvedCategory.categorySlug,
    resolvedCategory.businessVisualProfile.id,
  );

  if (safeAssetCount === 0) {
    throw new Error("No approved safe carousel assets are available for this business profile.");
  }

  const candidateAngles = getCarouselCandidateAngles({
    candidateCount: AUTOMATIC_CAROUSEL_CANDIDATE_COUNT,
    websiteAnalysis: analysis,
  });
  let existing = await listAutoCarouselGenerationsForBusinessProfile({
    businessProfileId: profile.id,
    profileVersion: profile.profileVersion,
  });
  const generationBatchId = existing[0]?.generationBatchId ?? randomUUID();

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
      existing = await listAutoCarouselGenerationsForBusinessProfile({
        businessProfileId: profile.id,
        profileVersion: profile.profileVersion,
      });
      if (!existing.some((generation) => generation.candidateIndex === candidateIndex)) {
        throw error;
      }
    }
  }

  existing = await listAutoCarouselGenerationsForBusinessProfile({
    businessProfileId: profile.id,
    profileVersion: profile.profileVersion,
  });

  await updateCarouselGenerationBatchCandidateCount({
    candidateCount: AUTOMATIC_CAROUSEL_CANDIDATE_COUNT,
    generationBatchId,
  });

  let activeCandidates = 0;

  for (const generation of existing) {
    if (generation.status !== "processing") {
      continue;
    }

    if (generation.triggerRunId) {
      activeCandidates += 1;
      continue;
    }

    try {
      const jobId = await enqueueCarouselGenerationJob({
        candidateCount: generation.candidateCount,
        candidateIndex: generation.candidateIndex,
        carouselId: generation.id,
        projectId: profile.projectId,
        textStyle: DEFAULT_CAROUSEL_RENDER_STYLE,
        userId: profile.userId,
      });
      await updateCarouselGeneration(generation.id, { trigger_run_id: jobId });
      activeCandidates += 1;
    } catch {
      // enqueueCarouselGenerationJob persists the candidate failure before it throws.
    }
  }

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

export async function prepareBusinessProfileForUser(userId: string) {
  const profile = await getBusinessProfileForUser(userId);
  if (!profile) throw new Error("Business profile was not found.");
  return prepareBusinessProfileCarousels(profile);
}
