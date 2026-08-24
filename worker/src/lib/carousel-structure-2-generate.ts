import type {
  CarouselGenerationRow,
  Json,
  WebsiteBusinessAnalysis,
} from "../types.js";
import type {
  CarouselCreativeBrief,
  CarouselRecentAcceptedCopy,
} from "./carousel-content-plan.js";
import { logger } from "../logger.js";
import type { SupabaseJobStore } from "./supabase.js";
import { resolveCarouselImageLibraryCategory } from "./carousel-image-library-category.js";
import { buildCarouselSlideImagePlan } from "./carousel-image-library-relevance.js";
import {
  getCarouselStructure2Format,
  resolveCarouselStructure2FormatId,
} from "./carousel-structure-2-formats.js";
import { createCarouselStructure2SlideInserts } from "./carousel-structure-2-persistence.js";
import {
  buildCarouselStructure2StoryPlanBatch,
  type CarouselStructure2StoryPlanResult,
} from "./carousel-structure-2-planner.js";
import {
  CAROUSEL_STRUCTURE_2_RENDERER_VERSION,
  renderCarouselStructure2SlideWithDiagnostics,
} from "./carousel-structure-2-render-slide.js";
import { buildCarouselStructure2RenderSpecs } from "./carousel-structure-2-render-spec.js";
import { uploadRenderedCarouselSlide } from "./carousel-storage.js";

export async function generateCarouselStructure2Batch(params: {
  businessAnalysis: WebsiteBusinessAnalysis;
  businessDescription: string;
  creativeBriefs: readonly CarouselCreativeBrief[];
  experimentBatchId: string;
  generations: readonly CarouselGenerationRow[];
  recentHistory: readonly CarouselRecentAcceptedCopy[];
  store: SupabaseJobStore;
  websiteAnalysis: {
    category: string | null;
    product_summary: string | null;
    value_props: string[];
    visual_keywords: string[];
  };
}) {
  assertStructure2Batch(params.generations);
  if (
    params.creativeBriefs.length !== params.generations.length ||
    params.creativeBriefs.some(
      (brief, index) =>
        brief.contentPlanItemId !==
        params.generations[index]?.content_plan_item_id,
    )
  ) {
    throw new Error(
      "Structure 2 creative briefs do not match their reserved content-plan items.",
    );
  }
  await params.store.updateCarouselExperimentBatch(params.experimentBatchId, {
    status: "processing",
  });

  let plannedItems: CarouselStructure2StoryPlanResult[];

  try {
    plannedItems = await buildCarouselStructure2StoryPlanBatch({
      assignments: params.generations.map((generation, slotIndex) => ({
        candidateIndex: generation.candidate_index,
        creativeSeed: params.creativeBriefs[slotIndex]!.creativeSeed,
        emotion: params.creativeBriefs[slotIndex]!.emotion,
        slotIndex,
        storyFormatId: requireStructure2FormatId(
          generation.content_format_id ?? generation.content_assigned_format_id,
        ),
      })),
      businessDescription: params.businessDescription,
      recentHistory: [...params.recentHistory],
    });
  } catch (error) {
    await failEntireBatch(params, error);
    throw error;
  }

  const successes: Array<{ carouselId: string; renderedSlideCount: number }> = [];
  const failures: Error[] = [];

  for (const plannedItem of plannedItems) {
    const generation = params.generations[plannedItem.slotIndex];

    if (!generation?.carousel_experiment_assignment_id) {
      failures.push(
        new Error(
          `Carousel Structure 2 slot ${plannedItem.slotIndex} is missing its assignment.`,
        ),
      );
      continue;
    }

    try {
      const result = await generateCarouselStructure2({
        businessAnalysis: params.businessAnalysis,
        generation,
        plannedItem,
        store: params.store,
        websiteAnalysis: params.websiteAnalysis,
      });
      successes.push(result);
      await params.store.updateCarouselExperimentAssignment(
        generation.carousel_experiment_assignment_id,
        { status: "completed" },
      );
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      failures.push(failure);
      await Promise.all([
        params.store
          .updateCarouselGeneration(generation.id, {
            error_message: truncate(failure.message),
            status: "failed",
          })
          .catch(() => undefined),
        params.store
          .updateCarouselExperimentAssignment(
            generation.carousel_experiment_assignment_id,
            { status: "failed" },
          )
          .catch(() => undefined),
      ]);
    }
  }

  await params.store.updateCarouselExperimentBatch(params.experimentBatchId, {
    status:
      failures.length === 0
        ? "completed"
        : successes.length === 0
          ? "failed"
          : "partial",
  });

  if (failures.length > 0) {
    throw new AggregateError(
      failures,
      "One or more Structure 2 Carousels failed in the batch.",
    );
  }

  return {
    carouselIds: successes.map((result) => result.carouselId),
    ok: true,
    renderedSlideCount: successes.reduce(
      (total, result) => total + result.renderedSlideCount,
      0,
    ),
  };
}

async function generateCarouselStructure2(params: {
  businessAnalysis: WebsiteBusinessAnalysis;
  generation: CarouselGenerationRow;
  plannedItem: CarouselStructure2StoryPlanResult;
  store: SupabaseJobStore;
  websiteAnalysis: {
    category: string | null;
    product_summary: string | null;
    value_props: string[];
    visual_keywords: string[];
  };
}) {
  const { generation, plannedItem, store } = params;
  const assignmentId = generation.carousel_experiment_assignment_id;
  const businessProfileId = generation.business_profile_id;

  if (!assignmentId || !businessProfileId) {
    throw new Error(
      "Structure 2 generation requires a controlled assignment and business profile.",
    );
  }

  const format = getCarouselStructure2Format(
    plannedItem.plan.strategy.storyFormatId,
  );
  await Promise.all([
    store.updateCarouselGeneration(generation.id, {
      content_angle: plannedItem.plan.strategy.angle,
      content_audience_id: null,
      content_format_id: format.id,
      content_format_version: format.version,
      content_goal_id: null,
      content_plan_fallback_reason: plannedItem.fallbackReason,
      content_plan_normalized: plannedItem.plan as unknown as Json,
      content_plan_raw_response: plannedItem.rawLlmResponse as unknown as Json,
      content_plan_source: plannedItem.source,
      content_plan_validation: plannedItem.validationResult as unknown as Json,
      content_planner_model: plannedItem.model,
      content_planner_version: plannedItem.plannerVersion,
      content_problem_id: null,
      content_topic: null,
      content_topic_id: null,
      error_message: null,
      hook_family_id: null,
      renderer_version: CAROUSEL_STRUCTURE_2_RENDERER_VERSION,
      status: "processing",
    }),
    store.updateCarouselExperimentAssignment(assignmentId, {
      actual_format_id: format.id,
      format_version: format.version,
      hook_family_id: null,
      replacement_for_format_id: null,
      status: "processing",
    }),
  ]);

  await assertBusinessProfileVersionIsCurrent(generation, store);
  const imageLibraryCategory = resolveCarouselImageLibraryCategory({
    category:
      params.businessAnalysis.category ?? params.websiteAnalysis.category,
    categorySlug: generation.category_slug,
    productSummary:
      params.businessAnalysis.productSummary ??
      params.websiteAnalysis.product_summary,
    valueProps:
      params.businessAnalysis.valueProps ?? params.websiteAnalysis.value_props,
    visualKeywords:
      params.businessAnalysis.visualKeywords ??
      params.websiteAnalysis.visual_keywords,
  });
  const assets = await store.reserveCarouselRoleAssets({
    businessProfileId,
    carouselId: generation.id,
    primaryCategorySlug: imageLibraryCategory,
    slidePlan: buildCarouselSlideImagePlan({
      carouselId: generation.id,
      primaryCategory: imageLibraryCategory,
      slides: plannedItem.plan.slides.map((slide) => ({
        slideNumber: slide.slideNumber,
        supportingText: [slide.visualContext],
        visibleText: [slide.storyText, slide.ctaText],
      })),
    }),
    useProductAsset: true,
  });
  const renderSpecs = buildCarouselStructure2RenderSpecs({
    assets,
    storyPlan: plannedItem.plan,
  });
  const renderedSlides = [];

  for (const spec of renderSpecs) {
    const rendered = await renderCarouselStructure2SlideWithDiagnostics({
      assetUrl: spec.assetUrl,
      format: generation.format,
      spec,
    });
    logger.info("Carousel Structure 2 slide containment validated", {
      carouselId: generation.id,
      diagnostics: rendered.diagnostics,
      rendererVersion: CAROUSEL_STRUCTURE_2_RENDERER_VERSION,
      slideNumber: spec.slideNumber,
    });
    const uploaded = await uploadRenderedCarouselSlide({
      buffer: rendered.buffer,
      carouselId: generation.id,
      format: generation.format,
      projectId: generation.project_id,
      rendererVersion: CAROUSEL_STRUCTURE_2_RENDERER_VERSION,
      slideNumber: spec.slideNumber,
      userId: generation.user_id,
    });
    renderedSlides.push({
      renderedS3Key: uploaded.key,
      renderedUrl: uploaded.url,
      slideNumber: spec.slideNumber,
      status: "ready" as const,
    });
  }

  await assertBusinessProfileVersionIsCurrent(generation, store);
  const slideRows = createCarouselStructure2SlideInserts({
    carouselGenerationId: generation.id,
    renderedSlides,
    renderSpecs,
    structureVersion: generation.structure_version,
  });
  await store.upsertCarouselSlides(slideRows);
  await store.updateCarouselGeneration(generation.id, {
    error_message: null,
    status: "completed",
  });

  return { carouselId: generation.id, renderedSlideCount: slideRows.length };
}

function assertStructure2Batch(generations: readonly CarouselGenerationRow[]) {
  if (
    generations.length !== 5 ||
    generations.some(
      (generation) =>
        generation.structure_id !== "structure_2" ||
        !generation.carousel_experiment_assignment_id ||
        !resolveCarouselStructure2FormatId(
          generation.content_format_id ?? generation.content_assigned_format_id,
        ),
    )
  ) {
    throw new Error(
      "Structure 2 batch requires five assigned generations using only its eight formats.",
    );
  }
}

function requireStructure2FormatId(value: unknown) {
  const formatId = resolveCarouselStructure2FormatId(value);
  if (!formatId) throw new Error("Carousel Structure 2 format id is invalid.");
  return formatId;
}

async function assertBusinessProfileVersionIsCurrent(
  generation: CarouselGenerationRow,
  store: SupabaseJobStore,
) {
  if (!generation.business_profile_id || generation.business_profile_version === null) {
    throw new Error("Structure 2 generation is missing its business profile version.");
  }

  const profile = await store.getBusinessProfileForCarousel({
    businessProfileId: generation.business_profile_id,
    businessProfileVersion: generation.business_profile_version,
    userId: generation.user_id,
  });
  if (!profile) {
    throw new Error("Business profile changed before Structure 2 completed.");
  }
}

async function failEntireBatch(
  params: {
    experimentBatchId: string;
    generations: readonly CarouselGenerationRow[];
    store: SupabaseJobStore;
  },
  error: unknown,
) {
  const message = truncate(
    error instanceof Error ? error.message : "Structure 2 planning failed.",
  );
  await Promise.allSettled([
    ...params.generations.map((generation) =>
      params.store.updateCarouselGeneration(generation.id, {
        error_message: message,
        status: "failed",
      }),
    ),
    ...params.generations.flatMap((generation) =>
      generation.carousel_experiment_assignment_id
        ? [
            params.store.updateCarouselExperimentAssignment(
              generation.carousel_experiment_assignment_id,
              { status: "failed" },
            ),
          ]
        : [],
    ),
    params.store.updateCarouselExperimentBatch(params.experimentBatchId, {
      status: "failed",
    }),
  ]);
}


function truncate(value: string) {
  return value.trim().slice(0, 900);
}
