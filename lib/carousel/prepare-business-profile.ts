import "server-only";

import { randomUUID } from "node:crypto";

import {
  getBusinessProfileForUser,
  updateBusinessProfilePreparation,
  type BusinessProfileRecord,
} from "@/lib/business-profiles/db";
import { enqueueCarouselExperimentBatchJob } from "@/lib/carousel/generation-jobs";
import {
  AUTOMATIC_CAROUSEL_CANDIDATE_COUNT,
  AUTOMATIC_CAROUSEL_SLIDE_COUNT,
} from "@/lib/carousel/automatic-candidate-count";
import { buildCarouselBusinessContentContext } from "@/lib/carousel/business-content-context";
import {
  CAROUSEL_EXPERIMENT_BATCH_SIZE,
  selectCarouselExperimentBatch,
  type CarouselContentAssignment,
} from "@/lib/carousel/content-selector";
import {
  getCarouselPerformanceSignals,
  getCarouselStructure2PerformanceSignals,
} from "@/lib/carousel/performance";
import { resolveCarouselCategoryProfile } from "@/lib/carousel/category-profile-resolver";
import {
  countActiveCarouselRoleAssets,
  createCarouselGeneration,
  failUnqueuedCarouselPreparation,
  getCarouselGenerationsByBatchId,
  getWebsiteAnalysisForCarousel,
  linkCarouselExperimentAssignment,
  listAutoCarouselGenerationsForBusinessProfile,
  listRecentCarouselContentHistory,
  listRecentCarouselStructure2History,
  reserveCarouselExperimentBatches,
  upsertCarouselExperimentAssignments,
  updateCarouselGeneration,
  updateCarouselGenerationBatchCandidateCount,
  updateCarouselExperimentBatch,
  type CarouselExperimentAssignmentRecord,
} from "@/lib/carousel/db";
import { resolveCarouselImageLibraryCategory } from "@/lib/carousel/image-library-category";
import { DEFAULT_CAROUSEL_RENDER_STYLE } from "@/lib/carousel/render-style";
import { assertCarouselStructureRuntimeReady } from "@/lib/carousel/structure";
import { isCarouselContentFormatId } from "@/lib/carousel/content-grammar";
import { isCarouselStructure2FormatId } from "@/lib/carousel/structure-2-formats";
import {
  selectCarouselStructure2ExperimentBatch,
  type CarouselStructure2FormatAssignment,
} from "@/lib/carousel/structure-2-selector";

export async function prepareBusinessProfileCarousels(profile: BusinessProfileRecord) {
  const { analysis, businessContext, resolvedCategory } =
    await getPreparationContext(profile);
  const existing = (
    await listAutoCarouselGenerationsForBusinessProfile({
      businessProfileId: profile.id,
      profileVersion: profile.profileVersion,
    })
  ).filter((generation) => generation.originDailyFeedId === null);
  const generationBatchId = existing[0]?.generationBatchId ?? randomUUID();
  try {
    const prepared = await prepareControlledGenerationBatch({
      analysisId: analysis.id,
      businessContext,
      candidateCount: AUTOMATIC_CAROUSEL_CANDIDATE_COUNT,
      categorySlug: resolvedCategory.categorySlug,
      generationBatchId,
      profile,
    });

    if (
      prepared.activeCandidates === 0 &&
      !prepared.generations.some((generation) => generation.status === "completed")
    ) {
      throw new Error("Could not start carousel preparation workers.");
    }

    await updateBusinessProfilePreparation({
      generationBatchId,
      profileId: profile.id,
      status: "preparing",
    });

    return {
      candidateCount: prepared.candidateCount,
      generationBatchId,
    };
  } catch (error) {
    const message = getPreparationErrorMessage(error);

    await Promise.allSettled([
      failUnqueuedCarouselPreparation({
        errorMessage: message,
        generationBatchId,
      }),
      updateBusinessProfilePreparation({
        error: message,
        generationBatchId,
        profileId: profile.id,
        status: "failed",
      }),
    ]);

    throw error;
  }
}

export async function prepareDailyBusinessProfileCarousels(params: {
  generationBatchId: string;
  localDate: string;
  originDailyFeedId: string;
  profile: BusinessProfileRecord;
  targetCandidateCount: number;
}) {
  const requestedCandidateCount = Math.min(
    Math.max(Math.trunc(params.targetCandidateCount), 0),
    50,
  );

  if (requestedCandidateCount === 0) {
    return {
      candidateCount: 0,
      generationBatchId: params.generationBatchId,
    };
  }

  const { analysis, businessContext, resolvedCategory } =
    await getPreparationContext(params.profile);
  const existingBatch = await getCarouselGenerationsByBatchId(
    params.generationBatchId,
  );

  assertDailyBatchOwnership({
    existingBatch,
    originDailyFeedId: params.originDailyFeedId,
    profile: params.profile,
  });
  const prepared = await prepareControlledGenerationBatch({
    analysisId: analysis.id,
    availableOnLocalDate: params.localDate,
    businessContext,
    candidateCount: requestedCandidateCount,
    categorySlug: resolvedCategory.categorySlug,
    generationBatchId: params.generationBatchId,
    originDailyFeedId: params.originDailyFeedId,
    profile: params.profile,
  });

  assertDailyBatchOwnership({
    existingBatch: prepared.generations,
    originDailyFeedId: params.originDailyFeedId,
    profile: params.profile,
  });

  return {
    candidateCount: prepared.candidateCount,
    generationBatchId: params.generationBatchId,
  };
}

async function prepareControlledGenerationBatch(params: {
  analysisId: string;
  availableOnLocalDate?: string | null;
  businessContext: BusinessProfileRecord["context"];
  candidateCount: number;
  categorySlug: string;
  generationBatchId: string;
  originDailyFeedId?: string | null;
  profile: BusinessProfileRecord;
}) {
  const candidateCount = Math.min(
    Math.ceil(params.candidateCount / CAROUSEL_EXPERIMENT_BATCH_SIZE) *
      CAROUSEL_EXPERIMENT_BATCH_SIZE,
    50,
  );
  const experimentBatches = await reserveCarouselExperimentBatches({
    batchCount: candidateCount / CAROUSEL_EXPERIMENT_BATCH_SIZE,
    businessProfileId: params.profile.id,
    businessProfileVersion: params.profile.profileVersion,
    generationBatchId: params.generationBatchId,
  });

  for (const experimentBatch of experimentBatches) {
    assertCarouselStructureRuntimeReady(experimentBatch.structureId);
  }

  const structureIds = Array.from(
    new Set(experimentBatches.map((batch) => batch.structureId)),
  );
  const hasStructure1 = structureIds.includes("structure_1");
  const hasStructure2 = structureIds.includes("structure_2");
  const [structure1History, structure2History] = await Promise.all([
    hasStructure1
      ? listRecentCarouselContentHistory({
          businessProfileId: params.profile.id,
          excludeGenerationBatchId: params.generationBatchId,
          limit: 10,
          structureId: "structure_1",
        })
      : Promise.resolve([]),
    hasStructure2
      ? listRecentCarouselStructure2History({
          businessProfileId: params.profile.id,
          excludeGenerationBatchId: params.generationBatchId,
          limit: 10,
        })
      : Promise.resolve([]),
  ]);
  const topicOptionCount = buildCarouselBusinessContentContext(
    params.businessContext,
  ).topics.length;
  const [structure1Performance, structure2Performance] = await Promise.all([
    hasStructure1
      ? getCarouselPerformanceSignals({
          businessProfileId: params.profile.id,
          structureId: "structure_1",
          userId: params.profile.userId,
        })
      : Promise.resolve({}),
    hasStructure2
      ? getCarouselStructure2PerformanceSignals({
          businessProfileId: params.profile.id,
          userId: params.profile.userId,
        })
      : Promise.resolve({}),
  ]);

  for (const [batchOffset, experimentBatch] of experimentBatches.entries()) {
    const assignments =
      experimentBatch.structureId === "structure_2"
        ? selectCarouselStructure2ExperimentBatch({
            batchSequence: experimentBatch.structureBatchSequence,
            history: structure2History,
            performanceSignals: structure2Performance,
            selectionKey: params.profile.id,
          })
        : selectCarouselExperimentBatch({
            batchSequence: experimentBatch.structureBatchSequence,
            history: structure1History,
            performanceSignals: structure1Performance,
            selectionKey: params.profile.id,
            topicOptionCount,
          });
    const persistedAssignments = await upsertCarouselExperimentAssignments({
      assignments,
      experimentBatchId: experimentBatch.id,
      structureId: experimentBatch.structureId,
      structureVersion: experimentBatch.structureVersion,
    });

    for (const [slotIndex, assignment] of assignments.entries()) {
      const candidateIndex =
        batchOffset * CAROUSEL_EXPERIMENT_BATCH_SIZE + slotIndex;
      let generations = await getCarouselGenerationsByBatchId(
        params.generationBatchId,
      );
      let generation = generations.find(
        (candidate) => candidate.candidateIndex === candidateIndex,
      );

      if (!generation) {
        const persistedAssignment = persistedAssignments[slotIndex];
        if (!persistedAssignment) {
          throw new Error(`Carousel experiment slot ${slotIndex} was not persisted.`);
        }
        if (
          persistedAssignment.structureId !== experimentBatch.structureId ||
          persistedAssignment.structureVersion !== experimentBatch.structureVersion
        ) {
          throw new Error(
            `Carousel experiment slot ${slotIndex} has mismatched structure metadata.`,
          );
        }

        try {
          const persistedContentAssignment =
            experimentBatch.structureId === "structure_2"
              ? buildPersistedStructure2Assignment({
                  assignment,
                  persistedAssignment,
                })
              : buildPersistedStructure1Assignment({
                  assignment,
                  persistedAssignment,
                });
          const carouselId = await createCarouselGeneration({
            availableOnLocalDate: params.availableOnLocalDate ?? null,
            businessProfileId: params.profile.id,
            businessProfileVersion: params.profile.profileVersion,
            candidateCount,
            candidateIndex,
            categorySlug: params.categorySlug,
            contentAssignment: persistedContentAssignment,
            experimentAssignmentId: persistedAssignment.id,
            experimentBatchId: experimentBatch.id,
            format: "4:5",
            generationBatchId: params.generationBatchId,
            generationSource: "auto_generated",
            originDailyFeedId: params.originDailyFeedId ?? null,
            projectId: params.profile.projectId,
            selectedAngle: null,
            slideCount: AUTOMATIC_CAROUSEL_SLIDE_COUNT,
            structureId: experimentBatch.structureId,
            structureVersion: experimentBatch.structureVersion,
            userId: params.profile.userId,
            websiteAnalysisId: params.analysisId,
          });
          await linkCarouselExperimentAssignment({
            assignmentId: persistedAssignment.id,
            carouselId,
          });
        } catch (error) {
          generations = await getCarouselGenerationsByBatchId(
            params.generationBatchId,
          );
          generation = generations.find(
            (candidate) => candidate.candidateIndex === candidateIndex,
          );
          if (!generation) throw error;
        }
      }
    }
  }

  const generations = await getCarouselGenerationsByBatchId(
    params.generationBatchId,
  );
  await updateCarouselGenerationBatchCandidateCount({
    candidateCount,
    generationBatchId: params.generationBatchId,
  });
  const activeCandidates = await enqueueProcessingCarouselCandidates(
    generations,
    params.profile,
    { throwOnFailure: Boolean(params.originDailyFeedId) },
  );

  return { activeCandidates, candidateCount, generations };
}

function buildPersistedStructure1Assignment(params: {
  assignment: CarouselContentAssignment | CarouselStructure2FormatAssignment;
  persistedAssignment: CarouselExperimentAssignmentRecord;
}): CarouselContentAssignment {
  const assignedFormatId = params.persistedAssignment.assignedFormatId;
  const actualFormatId =
    params.persistedAssignment.actualFormatId ?? assignedFormatId;
  const rotationCandidateFormatId =
    params.persistedAssignment.rotationCandidateFormatId;

  if (
    !("contentFormatId" in params.assignment) ||
    !isCarouselContentFormatId(assignedFormatId) ||
    !isCarouselContentFormatId(actualFormatId) ||
    !isCarouselContentFormatId(rotationCandidateFormatId) ||
    !params.persistedAssignment.hookFamilyId ||
    !params.persistedAssignment.hookSelectionMode ||
    params.persistedAssignment.hookSelectionMultiplier === null
  ) {
    throw new Error("Persisted Structure 1 assignment is invalid.");
  }

  return {
    ...params.assignment,
    assignedContentFormatId: assignedFormatId,
    contentFormatId: actualFormatId,
    formatSelectionMode: params.persistedAssignment.formatSelectionMode,
    formatSelectionMultiplier:
      params.persistedAssignment.formatSelectionMultiplier,
    formatVersion: params.persistedAssignment.formatVersion,
    hookFamilyId: params.persistedAssignment.hookFamilyId,
    hookSelectionMode: params.persistedAssignment.hookSelectionMode,
    hookSelectionMultiplier:
      params.persistedAssignment.hookSelectionMultiplier,
    rotationCandidateContentFormatId:
      rotationCandidateFormatId,
  };
}

function buildPersistedStructure2Assignment(params: {
  assignment: CarouselContentAssignment | CarouselStructure2FormatAssignment;
  persistedAssignment: CarouselExperimentAssignmentRecord;
}): CarouselStructure2FormatAssignment {
  const actualFormatId =
    params.persistedAssignment.actualFormatId ??
    params.persistedAssignment.assignedFormatId;

  if (
    !("storyFormatId" in params.assignment) ||
    !isCarouselStructure2FormatId(params.persistedAssignment.assignedFormatId) ||
    !isCarouselStructure2FormatId(actualFormatId) ||
    !isCarouselStructure2FormatId(
      params.persistedAssignment.rotationCandidateFormatId,
    ) ||
    params.persistedAssignment.hookFamilyId !== null ||
    params.persistedAssignment.hookSelectionMode !== null ||
    params.persistedAssignment.hookSelectionMultiplier !== null
  ) {
    throw new Error("Persisted Structure 2 assignment is invalid.");
  }

  return {
    ...params.assignment,
    assignedStoryFormatId: params.persistedAssignment.assignedFormatId,
    formatSelectionMode: params.persistedAssignment.formatSelectionMode,
    formatSelectionMultiplier:
      params.persistedAssignment.formatSelectionMultiplier,
    formatVersion: params.persistedAssignment.formatVersion,
    rotationCandidateStoryFormatId:
      params.persistedAssignment.rotationCandidateFormatId,
    storyFormatId: actualFormatId,
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
    category: profile.context.category ?? analysis.category,
    pexelsImageQueries:
      profile.context.pexelsImageQueries ?? analysis.pexelsImageQueries,
    productSummary:
      profile.context.productSummary ?? analysis.productSummary,
    valueProps: profile.context.valueProps,
    visualKeywords:
      profile.context.visualKeywords ?? analysis.visualKeywords,
  });
  const imageLibraryCategory = resolveCarouselImageLibraryCategory({
    category: profile.context.category ?? analysis.category,
    categorySlug: resolvedCategory.categorySlug,
    productSummary:
      profile.context.productSummary ?? analysis.productSummary,
    valueProps: profile.context.valueProps,
    visualKeywords:
      profile.context.visualKeywords ?? analysis.visualKeywords,
  });
  const roleCounts = await countActiveCarouselRoleAssets(imageLibraryCategory);

  if (roleCounts.hook < 1 || roleCounts.human < 2 || roleCounts.static < 2) {
    throw new Error(
      `Carousel image library "${imageLibraryCategory}" is not ready (hook=${roleCounts.hook}, human=${roleCounts.human}, static=${roleCounts.static}).`,
    );
  }

  return {
    analysis,
    businessContext: profile.context,
    resolvedCategory,
  };
}

function getPreparationErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message.slice(0, 1_000)
    : "Carousel preparation failed before queue dispatch.";
}

export async function enqueueProcessingCarouselCandidates(
  generations: Awaited<ReturnType<typeof getCarouselGenerationsByBatchId>>,
  profile: BusinessProfileRecord,
  options?: { throwOnFailure?: boolean },
) {
  let activeCandidates = 0;
  let firstFailure: unknown = null;
  const generationsByExperimentBatch = new Map<
    string,
    typeof generations
  >();

  for (const generation of generations) {
    if (!generation.carouselExperimentBatchId) {
      if (generation.status === "processing") {
        firstFailure ??= new Error(
          `Carousel ${generation.id} is missing its controlled experiment batch.`,
        );
      }
      continue;
    }

    const batch =
      generationsByExperimentBatch.get(generation.carouselExperimentBatchId) ?? [];
    batch.push(generation);
    generationsByExperimentBatch.set(generation.carouselExperimentBatchId, batch);
  }

  for (const [experimentBatchId, batch] of generationsByExperimentBatch) {
    const orderedBatch = [...batch].sort(
      (left, right) => left.candidateIndex - right.candidateIndex,
    );
    const processing = orderedBatch.filter(
      (generation) => generation.status === "processing",
    );

    if (processing.length === 0) continue;

    if (orderedBatch.length !== CAROUSEL_EXPERIMENT_BATCH_SIZE) {
      firstFailure ??= new Error(
        `Carousel experiment ${experimentBatchId} does not contain exactly five candidates.`,
      );
      continue;
    }

    try {
      const existingJobIds = Array.from(
        new Set(orderedBatch.map((generation) => generation.triggerRunId).filter(Boolean)),
      );
      if (existingJobIds.length > 1) {
        throw new Error(`Carousel experiment ${experimentBatchId} has conflicting jobs.`);
      }
      const jobId = await enqueueCarouselExperimentBatchJob({
        carouselIds: orderedBatch.map((generation) => generation.id),
        existingJobId: existingJobIds[0] ?? null,
        experimentBatchId,
        projectId: profile.projectId,
        textStyle: DEFAULT_CAROUSEL_RENDER_STYLE,
        userId: profile.userId,
      });
      await Promise.all(
        orderedBatch.map((generation) =>
          generation.triggerRunId === jobId
            ? Promise.resolve()
            : updateCarouselGeneration(generation.id, { trigger_run_id: jobId }),
        ),
      );
      await updateCarouselExperimentBatch({
        experimentBatchId,
        patch: { planner_job_id: jobId, status: "queued" },
      });
      activeCandidates += processing.length;
    } catch (error) {
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
