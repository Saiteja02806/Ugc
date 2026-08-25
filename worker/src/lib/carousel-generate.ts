import type {
  CarouselGenerationRow,
  CarouselSlideInsert,
  Json,
  WebsiteBusinessAnalysis,
} from "../types.js";
import { logger } from "../logger.js";
import type { SupabaseJobStore } from "./supabase.js";
import {
  CAROUSEL_RENDERER_VERSION,
  renderCarouselSlideWithDiagnostics,
} from "./carousel-render-slide.js";
import {
  DEFAULT_CAROUSEL_RENDER_STYLE,
  type CarouselRenderStyle,
} from "./carousel-render-style.js";
import {
  buildCarouselContentPlanBatch,
  buildCarouselContentPlan,
  type CarouselBatchContentPlanItem,
  type CarouselContentPlan,
} from "./carousel-llm-slide-plan.js";
import { getCarouselContentFormat } from "./carousel-content-grammar.js";
import { getPersistedCarouselSlideCopy } from "./carousel-slide-persistence.js";
import { uploadRenderedCarouselSlide } from "./carousel-storage.js";
import { resolveCarouselImageLibraryCategory } from "./carousel-image-library-category.js";
import { buildCarouselSlideImagePlan } from "./carousel-image-library-relevance.js";
import { assertCarouselStructureRuntimeReady } from "./carousel-structure.js";
import { generateCarouselStructure2Batch } from "./carousel-structure-2-generate.js";

type GenerateCarouselInput = {
  candidateIndex?: number;
  carouselId: string;
  contentPlan?: CarouselContentPlan;
  store: SupabaseJobStore;
  textStyle?: CarouselRenderStyle;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Carousel generation failed.";
}

function truncateErrorMessage(message: string) {
  return message.trim().slice(0, 900);
}

export async function generateCarouselBatch(params: {
  carouselIds: readonly string[];
  experimentBatchId: string;
  store: SupabaseJobStore;
  textStyle?: CarouselRenderStyle;
}) {
  if (params.carouselIds.length !== 5 || new Set(params.carouselIds).size !== 5) {
    throw new Error("A Carousel generation batch requires exactly five unique IDs.");
  }

  const generations = await Promise.all(
    params.carouselIds.map((carouselId) => params.store.getCarouselGeneration(carouselId)),
  );
  if (generations.some((generation) => !generation)) {
    throw new Error("One or more Carousel batch generations were not found.");
  }
  const rows = generations as CarouselGenerationRow[];
  const first = rows[0]!;
  const ownershipMismatch = rows.some(
    (generation) =>
      generation.carousel_experiment_batch_id !== params.experimentBatchId ||
      generation.business_profile_id !== first.business_profile_id ||
      generation.business_profile_version !== first.business_profile_version ||
      generation.generation_batch_id !== first.generation_batch_id ||
      generation.project_id !== first.project_id ||
      generation.structure_id !== first.structure_id ||
      generation.structure_version !== first.structure_version ||
      generation.user_id !== first.user_id ||
      generation.website_analysis_id !== first.website_analysis_id,
  );
  if (ownershipMismatch) {
    throw new Error("Carousel experiment batch ownership does not match.");
  }
  assertCarouselStructureRuntimeReady(first.structure_id);
  if (!first.website_analysis_id) {
    throw new Error("Carousel experiment batch is missing its website analysis.");
  }

  const websiteAnalysis = await params.store.getWebsiteAnalysisForCarousel(
    first.website_analysis_id,
  );
  if (!websiteAnalysis) {
    throw new Error("Website analysis was not found for the Carousel experiment batch.");
  }
  const businessAnalysis = await getBusinessAnalysisForGeneration({
    generation: first,
    store: params.store,
    websiteAnalysis,
  });
  if (!first.business_profile_id) {
    throw new Error("Carousel content-plan generation requires a business profile.");
  }
  const [creativeBriefs, recentHistory] = await Promise.all([
    Promise.all(rows.map((generation) => params.store.getCarouselCreativeBrief(generation))),
    params.store.listRecentAcceptedCarouselCopy({
      businessProfileId: first.business_profile_id,
      excludeGenerationBatchId: first.generation_batch_id,
      limit: 10,
      userId: first.user_id,
    }),
  ]);
  const businessDescription = creativeBriefs[0]?.businessDescription;
  if (
    !businessDescription ||
    creativeBriefs.some(
      (brief) =>
        brief.businessDescription !== businessDescription ||
        brief.contentPlanId !== creativeBriefs[0]?.contentPlanId,
    )
  ) {
    throw new Error("Carousel batch creative briefs do not belong to one content plan.");
  }
  await Promise.all(
    rows.map((generation) =>
      params.store.updateCarouselGeneration(generation.id, {
        content_history_snapshot: recentHistory as unknown as Json,
      }),
    ),
  );

  if (first.structure_id === "structure_2") {
    return generateCarouselStructure2Batch({
      businessAnalysis,
      businessDescription,
      creativeBriefs,
      experimentBatchId: params.experimentBatchId,
      generations: rows,
      recentHistory,
      store: params.store,
      websiteAnalysis,
    });
  }

  await params.store.updateCarouselExperimentBatch(params.experimentBatchId, {
    status: "processing",
  });
  const experimentBatch = await params.store.getCarouselExperimentBatch(
    params.experimentBatchId,
  );
  if (!experimentBatch) {
    throw new Error("Carousel experiment batch was not found.");
  }
  if (
    experimentBatch.requested_structure_id !== "structure_1" ||
    experimentBatch.structure_id !== "structure_1" ||
    experimentBatch.structure_resolution_mode !== "requested"
  ) {
    throw new Error("Carousel Structure 1 batch resolution metadata is invalid.");
  }

  const plannerInput = {
    analysis: businessAnalysis,
    businessDescription,
    items: rows.map((generation, slotIndex) => ({
      candidateIndex: generation.candidate_index,
      contentFormatId: generation.content_format_id ?? "",
      creativeSeed: creativeBriefs[slotIndex]!.creativeSeed,
      emotion: creativeBriefs[slotIndex]!.emotion,
      hookFamilyId: generation.hook_family_id ?? "",
      planningBrief: creativeBriefs[slotIndex]!.planningBrief,
      slotIndex,
    })),
    recentHistory,
  };
  let planningAttemptCount = experimentBatch.structure_planning_attempt_count;
  let planningFailure: Error | null = null;
  let plannedItems: CarouselBatchContentPlanItem[] | null = null;

  while (planningAttemptCount < 2 && !plannedItems) {
    planningAttemptCount += 1;
    try {
      plannedItems = await buildCarouselContentPlanBatch(plannerInput);
      await params.store.updateCarouselExperimentBatch(params.experimentBatchId, {
        structure_planning_attempt_count: planningAttemptCount,
      });
    } catch (error) {
      planningFailure = error instanceof Error ? error : new Error(String(error));
      logger.warn("Carousel Structure 1 batch planning attempt failed", {
        experimentBatchId: params.experimentBatchId,
        planningAttemptCount,
        reason: truncateErrorMessage(planningFailure.message),
      });

      if (planningAttemptCount < 2) {
        await params.store.updateCarouselExperimentBatch(
          params.experimentBatchId,
          { structure_planning_attempt_count: planningAttemptCount },
        );
      }
    }
  }

  if (!plannedItems) {
    const failureReason = truncateErrorMessage(
      planningFailure?.message ??
        "Carousel Structure 1 planning attempts were exhausted before worker replay.",
    );
    const planAwareAutomaticRecovery =
      experimentBatch.structure_mode_snapshot === "rotate" &&
      experimentBatch.structure_selection_mode === "rotation" &&
      rows.every(
        (generation) =>
          generation.content_plan_id &&
          generation.content_plan_item_id &&
          generation.content_plan_reservation_id,
      );

    if (!planAwareAutomaticRecovery) {
      throw new Error(
        `Carousel Structure 1 planning failed after two attempts: ${failureReason}`,
        { cause: planningFailure ?? undefined },
      );
    }

    await params.store.takeOverCarouselExperimentBatchWithStructure2({
      experimentBatchId: params.experimentBatchId,
      failureReason,
      planningAttemptCount: 2,
    });
    const resolvedGenerations = await Promise.all(
      params.carouselIds.map((carouselId) =>
        params.store.getCarouselGeneration(carouselId),
      ),
    );
    if (
      resolvedGenerations.some(
        (generation) =>
          !generation ||
          generation.carousel_experiment_batch_id !== params.experimentBatchId ||
          generation.structure_id !== "structure_2",
      )
    ) {
      throw new Error(
        "Carousel batch did not resolve completely to Structure 2.",
      );
    }

    logger.warn("Carousel batch resolved from Structure 1 to Structure 2", {
      experimentBatchId: params.experimentBatchId,
      planningAttemptCount: 2,
      reason: failureReason,
    });
    return generateCarouselStructure2Batch({
      businessAnalysis,
      businessDescription,
      creativeBriefs,
      experimentBatchId: params.experimentBatchId,
      generations: resolvedGenerations as CarouselGenerationRow[],
      recentHistory,
      store: params.store,
      websiteAnalysis,
    });
  }
  const results: Array<Awaited<ReturnType<typeof generateCarousel>>> = [];
  const failures: Error[] = [];

  for (const plannedItem of plannedItems) {
    const generation = rows[plannedItem.slotIndex];
    if (!generation?.carousel_experiment_assignment_id) {
      failures.push(
        new Error(`Carousel batch slot ${plannedItem.slotIndex} is missing its assignment.`),
      );
      continue;
    }

    try {
      await persistActualBatchAssignment({
        generation,
        plannedItem,
        store: params.store,
      });
      const result = await generateCarousel({
        candidateIndex: generation.candidate_index,
        carouselId: generation.id,
        contentPlan: plannedItem.plan,
        store: params.store,
        textStyle: params.textStyle,
      });
      results.push(result);
      await params.store.updateCarouselExperimentAssignment(
        generation.carousel_experiment_assignment_id,
        { status: "completed" },
      );
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      failures.push(failure);
      await params.store
        .updateCarouselExperimentAssignment(
          generation.carousel_experiment_assignment_id,
          { status: "failed" },
        )
        .catch(() => undefined);
    }
  }

  await params.store.updateCarouselExperimentBatch(params.experimentBatchId, {
    status:
      failures.length === 0
        ? "completed"
        : results.length === 0
          ? "failed"
          : "partial",
  });
  if (failures.length > 0) {
    throw new AggregateError(failures, "One or more Carousels failed in the batch.");
  }

  return {
    carouselIds: results.map((result) => result.carouselId),
    ok: true,
    renderedSlideCount: results.reduce(
      (total, result) => total + result.renderedSlideCount,
      0,
    ),
  };
}

async function persistActualBatchAssignment(params: {
  generation: CarouselGenerationRow;
  plannedItem: CarouselBatchContentPlanItem;
  store: SupabaseJobStore;
}) {
  const assignmentId = params.generation.carousel_experiment_assignment_id;
  if (!assignmentId) throw new Error("Carousel experiment assignment is missing.");
  const format = getCarouselContentFormat(
    params.plannedItem.actualContentFormatId,
  );

  await params.store.updateCarouselGeneration(params.generation.id, {
    content_format_id: params.plannedItem.actualContentFormatId,
    content_format_version: format.version,
    hook_family_id: params.plannedItem.actualHookFamilyId,
  });
  await params.store.updateCarouselExperimentAssignment(assignmentId, {
    actual_format_id: params.plannedItem.actualContentFormatId,
    format_version: format.version,
    hook_family_id: params.plannedItem.actualHookFamilyId,
    replacement_for_format_id: params.plannedItem.replacementForFormatId,
    status: "processing",
  });
}

async function getBusinessAnalysisForGeneration(params: {
  generation: CarouselGenerationRow;
  store: SupabaseJobStore;
  websiteAnalysis: { analysis_json: WebsiteBusinessAnalysis };
}) {
  if (!params.generation.business_profile_id) {
    return params.websiteAnalysis.analysis_json;
  }

  if (params.generation.business_profile_version === null) {
    throw new Error(
      "Carousel generation is missing its business profile version.",
    );
  }

  const profile = await params.store.getBusinessProfileForCarousel({
    businessProfileId: params.generation.business_profile_id,
    businessProfileVersion: params.generation.business_profile_version,
    userId: params.generation.user_id,
  });

  if (!profile) {
    throw new Error(
      "Carousel generation belongs to a stale or unavailable business profile version.",
    );
  }

  return profile.context_json;
}

async function assertBusinessProfileVersionIsCurrent(params: {
  generation: CarouselGenerationRow;
  store: SupabaseJobStore;
}) {
  if (!params.generation.business_profile_id) {
    return;
  }

  if (params.generation.business_profile_version === null) {
    throw new Error(
      "Carousel generation is missing its business profile version.",
    );
  }

  const profile = await params.store.getBusinessProfileForCarousel({
    businessProfileId: params.generation.business_profile_id,
    businessProfileVersion: params.generation.business_profile_version,
    userId: params.generation.user_id,
  });

  if (!profile) {
    throw new Error(
      "Business profile changed before Carousel generation completed.",
    );
  }
}

export async function generateCarousel({
  candidateIndex = 0,
  carouselId,
  contentPlan: suppliedContentPlan,
  store,
  textStyle = DEFAULT_CAROUSEL_RENDER_STYLE,
}: GenerateCarouselInput) {
  try {
    const generation = await store.getCarouselGeneration(carouselId);

    if (!generation) {
      throw new Error("Carousel generation was not found.");
    }

    assertCarouselStructureRuntimeReady(generation.structure_id);

    if (generation.structure_id !== "structure_1") {
      throw new Error("carousel_structure_2_requires_batch_runtime");
    }

    if (!generation.website_analysis_id) {
      throw new Error("Carousel generation is missing a website analysis.");
    }

    const websiteAnalysis = await store.getWebsiteAnalysisForCarousel(
      generation.website_analysis_id,
    );

    if (!websiteAnalysis) {
      throw new Error("Website analysis was not found for this carousel.");
    }

    const businessAnalysis = await getBusinessAnalysisForGeneration({
      generation,
      store,
      websiteAnalysis,
    });

    if (!generation.category_slug) {
      throw new Error("Carousel generation is missing a category slug.");
    }

    if (!generation.business_profile_id) {
      throw new Error("Carousel role-image rotation requires a business profile.");
    }

    const imageLibraryCategory = resolveCarouselImageLibraryCategory({
      category: businessAnalysis.category ?? websiteAnalysis.category,
      categorySlug: generation.category_slug,
      productSummary:
        businessAnalysis.productSummary ?? websiteAnalysis.product_summary,
      valueProps:
        businessAnalysis.valueProps ?? websiteAnalysis.value_props,
      visualKeywords:
        businessAnalysis.visualKeywords ?? websiteAnalysis.visual_keywords,
    });

    const [creativeBrief, recentHistory] = await Promise.all([
      store.getCarouselCreativeBrief(generation),
      store.listRecentAcceptedCarouselCopy({
        businessProfileId: generation.business_profile_id,
        excludeGenerationBatchId: generation.generation_batch_id,
        limit: 10,
        userId: generation.user_id,
      }),
    ]);

    await store.updateCarouselGeneration(carouselId, {
      content_history_snapshot: recentHistory as unknown as Json,
    });

    const contentPlan =
      suppliedContentPlan ??
      (await buildCarouselContentPlan({
        analysis: businessAnalysis,
        businessDescription: creativeBrief.businessDescription,
        candidateIndex,
        contentFormatId: generation.content_format_id,
        creativeSeed: creativeBrief.creativeSeed,
        emotion: creativeBrief.emotion,
        goal: generation.goal,
        hookFamilyId: generation.hook_family_id,
        planningBrief: creativeBrief.planningBrief,
        recentHistory,
        selectedAngle: generation.selected_angle,
        slideCount: generation.slide_count,
      }));
    const plannedSlides = contentPlan.slides;

    logger.info("Carousel content planning completed", {
      broadSituations: contentPlan.broadSituations,
      carouselId,
      concept: contentPlan.concept,
      contentStrategy: contentPlan.contentStrategy,
      fallbackReason: contentPlan.fallbackReason,
      model: contentPlan.model,
      plannerVersion: contentPlan.plannerVersion,
      source: contentPlan.source,
      validationResult: contentPlan.validationResult,
    });
    await store.updateCarouselGeneration(carouselId, {
      content_plan_fallback_reason: contentPlan.fallbackReason,
      content_angle: contentPlan.contentStrategy?.angle ?? null,
      content_audience_id: contentPlan.contentStrategy?.audienceId ?? null,
      content_goal_id: contentPlan.contentStrategy?.customerGoalId ?? null,
      content_plan_normalized: contentPlan.normalizedPlan as unknown as Json,
      content_plan_raw_response: contentPlan.rawLlmResponse as unknown as Json,
      content_plan_source: contentPlan.source,
      content_plan_validation: contentPlan.validationResult as unknown as Json,
      content_planner_model: contentPlan.model,
      content_planner_version: contentPlan.plannerVersion,
      content_problem_id: contentPlan.contentStrategy?.problemId ?? null,
      content_topic: contentPlan.contentStrategy?.topic ?? null,
      content_topic_id: contentPlan.contentStrategy?.topicId ?? null,
      renderer_version: CAROUSEL_RENDERER_VERSION,
    });
    await assertBusinessProfileVersionIsCurrent({ generation, store });
    const slideImagePlan = buildCarouselSlideImagePlan({
      carouselId,
      primaryCategory: imageLibraryCategory,
      slides: plannedSlides.map((slide) => ({
        slideNumber: slide.slideNumber,
        supportingText: [slide.imageDirection],
        visibleText: [
          slide.headline,
          slide.body,
          slide.listItems,
          slide.subtext,
          slide.ctaText,
        ],
      })),
    });
    const reservedAssets = await store.reserveCarouselRoleAssets({
      businessProfileId: generation.business_profile_id,
      carouselId,
      primaryCategorySlug: imageLibraryCategory,
      slidePlan: slideImagePlan,
    });
    const reservedAssetsBySlideNumber = new Map(
      reservedAssets.map((asset) => [asset.slide_number, asset]),
    );

    if (plannedSlides.length !== 5 || reservedAssets.length !== 5) {
      throw new Error(
        `Carousel role-image reservation requires five slides and five assets; received ${plannedSlides.length} slides and ${reservedAssets.length} assets.`,
      );
    }

    logger.info("Carousel 1:2:2 role-image reservation completed", {
      carouselId,
      categorySlug: imageLibraryCategory,
      selections: reservedAssets.map((asset) => ({
        assetId: asset.asset_id,
        assetRole: asset.asset_role,
        categorySlug: asset.category_slug,
        cycleNumber: asset.cycle_number,
        relevanceLevel: asset.relevance_level,
        selectionType: asset.selection_type,
        slideNumber: asset.slide_number,
      })),
    });

    const slideRows: CarouselSlideInsert[] = [];

    await store.updateCarouselGeneration(carouselId, {
      error_message: null,
      status: "processing",
    });

    for (const slide of plannedSlides) {
      const asset = reservedAssetsBySlideNumber.get(slide.slideNumber);

      if (!asset) {
        throw new Error(`No image asset was available for slide ${slide.slideNumber}.`);
      }

      const renderedSlide = await renderCarouselSlideWithDiagnostics({
        assetUrl: asset.base_url,
        businessName:
          businessAnalysis.businessName ??
          websiteAnalysis.business_name,
        format: generation.format,
        slide,
        textStyle,
      });
      logger.info("Carousel slide text containment validated", {
        carouselId,
        diagnostics: renderedSlide.diagnostics,
        rendererVersion: CAROUSEL_RENDERER_VERSION,
        slideNumber: slide.slideNumber,
      });
      const uploadedSlide = await uploadRenderedCarouselSlide({
        buffer: renderedSlide.buffer,
        carouselId,
        format: generation.format,
        projectId: generation.project_id,
        rendererVersion: CAROUSEL_RENDERER_VERSION,
        slideNumber: slide.slideNumber,
        userId: generation.user_id,
      });
      const persistedCopy = getPersistedCarouselSlideCopy(slide);

      slideRows.push({
        carousel_generation_id: carouselId,
        category_image_asset_id: asset.asset_id,
        cta_text: slide.ctaText,
        headline: persistedCopy.headline,
        image_direction: slide.imageDirection,
        layout_preset: slide.layoutPreset,
        rendered_s3_key: uploadedSlide.key,
        rendered_url: uploadedSlide.url,
        slide_number: slide.slideNumber,
        slide_type: slide.slideType,
        status: "ready",
        subtext: persistedCopy.subtext,
        text_position: slide.textPosition,
      });
    }

    await assertBusinessProfileVersionIsCurrent({ generation, store });
    await store.upsertCarouselSlides(slideRows);
    await store.updateCarouselGeneration(carouselId, {
      error_message: null,
      status: "completed",
    });

    return {
      broadSituations: contentPlan.broadSituations,
      ok: true,
      carouselId,
      concept: contentPlan.concept,
      contentPlanner: {
        fallbackReason: contentPlan.fallbackReason,
        model: contentPlan.model,
        source: contentPlan.source,
        validationResult: contentPlan.validationResult,
        version: contentPlan.plannerVersion,
      },
      rendererVersion: CAROUSEL_RENDERER_VERSION,
      renderedSlideCount: slideRows.length,
      slideUrls: slideRows
        .map((slide) => slide.rendered_url)
        .filter((url): url is string => Boolean(url)),
    };
  } catch (error) {
    const message = truncateErrorMessage(getErrorMessage(error));

    await store
      .updateCarouselGeneration(carouselId, {
        error_message: message,
        status: "failed",
      })
      .catch((updateError) => {
        console.error("Failed to mark carousel generation failed:", updateError);
      });

    throw error;
  }
}
