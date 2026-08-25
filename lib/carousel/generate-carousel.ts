import { getBusinessProfileForUser } from "@/lib/business-profiles/db";
import {
  getCarouselGeneration,
  getWebsiteAnalysisForCarousel,
  listRecentAcceptedCarouselCopy,
  reserveCarouselRoleAssets,
  updateCarouselGeneration,
  upsertCarouselSlides,
  type CarouselSlideInsert,
  type Json,
} from "@/lib/carousel/db";
import {
  CAROUSEL_RENDERER_VERSION,
  renderCarouselSlideWithDiagnostics,
} from "@/lib/carousel/render-slide";
import {
  DEFAULT_CAROUSEL_RENDER_STYLE,
  type CarouselRenderStyle,
} from "@/lib/carousel/render-style";
import {
  buildCarouselContentPlan,
} from "@/lib/carousel/llm-slide-plan";
import { getCarouselCreativeBriefForGeneration } from "@/lib/carousel/content-plan-db";
import type { PlannedCarouselSlide } from "@/lib/carousel/slide-plan";
import { uploadRenderedCarouselSlide } from "@/lib/carousel/storage";
import { resolveCarouselImageLibraryCategory } from "@/lib/carousel/image-library-category";
import { buildCarouselSlideImagePlan } from "@/lib/carousel/image-library-relevance";
import { assertCarouselStructureRuntimeReady } from "@/lib/carousel/structure";

type GenerateCarouselInput = {
  candidateCount?: number;
  candidateIndex?: number;
  carouselId: string;
  textStyle?: CarouselRenderStyle;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Carousel generation failed.";
}

function truncateErrorMessage(message: string) {
  return message.trim().slice(0, 900);
}

function getLegacySlideHeadline(slide: PlannedCarouselSlide) {
  const headline =
    slide.headline ??
    slide.body ??
    slide.listItems[0] ??
    slide.ctaText;

  if (!headline) {
    throw new Error(
      `Carousel slide ${slide.slideNumber} has no AI-authored visible copy to persist.`,
    );
  }

  return headline;
}

async function getBusinessAnalysisForGeneration(params: {
  generation: NonNullable<Awaited<ReturnType<typeof getCarouselGeneration>>>;
  websiteAnalysis: NonNullable<
    Awaited<ReturnType<typeof getWebsiteAnalysisForCarousel>>
  >;
}) {
  if (!params.generation.businessProfileId) {
    return params.websiteAnalysis.analysis;
  }

  if (params.generation.businessProfileVersion === null) {
    throw new Error(
      "Carousel generation is missing its business profile version.",
    );
  }

  const profile = await getBusinessProfileForUser(params.generation.userId);

  if (
    !profile ||
    profile.id !== params.generation.businessProfileId ||
    profile.profileVersion !== params.generation.businessProfileVersion
  ) {
    throw new Error(
      "Carousel generation belongs to a stale or unavailable business profile version.",
    );
  }

  return profile.context;
}

async function assertBusinessProfileVersionIsCurrent(
  generation: NonNullable<Awaited<ReturnType<typeof getCarouselGeneration>>>,
) {
  if (!generation.businessProfileId) {
    return;
  }

  const profile = await getBusinessProfileForUser(generation.userId);

  if (
    generation.businessProfileVersion === null ||
    !profile ||
    profile.id !== generation.businessProfileId ||
    profile.profileVersion !== generation.businessProfileVersion
  ) {
    throw new Error(
      "Business profile changed before Carousel generation completed.",
    );
  }
}

export async function generateCarousel({
  candidateIndex = 0,
  carouselId,
  textStyle = DEFAULT_CAROUSEL_RENDER_STYLE,
}: GenerateCarouselInput) {
  try {
    const generation = await getCarouselGeneration(carouselId);

    if (!generation) {
      throw new Error("Carousel generation was not found.");
    }

    assertCarouselStructureRuntimeReady(generation.structureId);

    if (generation.structureId !== "structure_1") {
      throw new Error("carousel_structure_2_requires_batch_runtime");
    }

    if (!generation.websiteAnalysisId) {
      throw new Error("Carousel generation is missing a website analysis.");
    }

    const websiteAnalysis = await getWebsiteAnalysisForCarousel(
      generation.websiteAnalysisId,
    );

    if (!websiteAnalysis) {
      throw new Error("Website analysis was not found for this carousel.");
    }

    const businessAnalysis = await getBusinessAnalysisForGeneration({
      generation,
      websiteAnalysis,
    });

    if (!generation.categorySlug) {
      throw new Error("Carousel generation is missing a category slug.");
    }

    if (!generation.businessProfileId) {
      throw new Error("Carousel role-image rotation requires a business profile.");
    }

    const imageLibraryCategory = resolveCarouselImageLibraryCategory({
      category: businessAnalysis.category ?? websiteAnalysis.category,
      categorySlug: generation.categorySlug,
      productSummary:
        businessAnalysis.productSummary ?? websiteAnalysis.productSummary,
      valueProps: businessAnalysis.valueProps,
      visualKeywords:
        businessAnalysis.visualKeywords ?? websiteAnalysis.visualKeywords,
    });

    if (
      generation.businessProfileVersion === null ||
      !generation.contentPlanId ||
      !generation.contentPlanItemId ||
      !generation.contentPlanReservationId
    ) {
      throw new Error("Carousel generation is missing content-plan provenance.");
    }
    const [creativeBrief, recentHistory] = await Promise.all([
      getCarouselCreativeBriefForGeneration({
        businessProfileId: generation.businessProfileId,
        businessProfileVersion: generation.businessProfileVersion,
        contentPlanId: generation.contentPlanId,
        contentPlanItemId: generation.contentPlanItemId,
        contentPlanReservationId: generation.contentPlanReservationId,
        userId: generation.userId,
      }),
      listRecentAcceptedCarouselCopy({
        businessProfileId: generation.businessProfileId,
        excludeGenerationBatchId: generation.generationBatchId,
        limit: 10,
        userId: generation.userId,
      }),
    ]);

    await updateCarouselGeneration(carouselId, {
      content_history_snapshot: recentHistory as unknown as Json,
    });

    const contentPlan = await buildCarouselContentPlan({
      analysis: businessAnalysis,
      businessDescription: creativeBrief.businessDescription,
      goal: generation.goal,
      candidateIndex,
      contentFormatId: generation.contentFormatId,
      creativeSeed: creativeBrief.creativeSeed,
      emotion: creativeBrief.emotion,
      hookFamilyId: generation.hookFamilyId,
      planningBrief: creativeBrief.planningBrief,
      recentHistory,
      selectedAngle: generation.selectedAngle,
      slideCount: generation.slideCount,
    });
    const plannedSlides = contentPlan.slides;

    console.info("Carousel content planning completed", {
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
    await updateCarouselGeneration(carouselId, {
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
    await assertBusinessProfileVersionIsCurrent(generation);
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
    const reservedAssets = await reserveCarouselRoleAssets({
      businessProfileId: generation.businessProfileId,
      carouselId,
      primaryCategorySlug: imageLibraryCategory,
      slidePlan: slideImagePlan,
    });
    const reservedAssetsBySlideNumber = new Map(
      reservedAssets.map((asset) => [asset.slideNumber, asset]),
    );

    if (plannedSlides.length !== 5 || reservedAssets.length !== 5) {
      throw new Error(
        `Carousel role-image reservation requires five slides and five assets; received ${plannedSlides.length} slides and ${reservedAssets.length} assets.`,
      );
    }

    console.info("Carousel 1:2:2 role-image reservation completed", {
      carouselId,
      categorySlug: imageLibraryCategory,
      selections: reservedAssets.map((asset) => ({
        assetId: asset.id,
        assetRole: asset.assetRole,
        categorySlug: asset.categorySlug,
        cycleNumber: asset.cycleNumber,
        relevanceLevel: asset.relevanceLevel,
        selectionType: asset.selectionType,
        slideNumber: asset.slideNumber,
      })),
    });

    const slideRows: CarouselSlideInsert[] = [];

    await updateCarouselGeneration(carouselId, {
      error_message: null,
      status: "processing",
    });

    for (const slide of plannedSlides) {
      const asset = reservedAssetsBySlideNumber.get(slide.slideNumber);

      if (!asset) {
        throw new Error(`No image asset was available for slide ${slide.slideNumber}.`);
      }

      const renderedSlide = await renderCarouselSlideWithDiagnostics({
        assetUrl: asset.baseUrl,
        businessName:
          businessAnalysis.businessName ?? websiteAnalysis.businessName,
        format: generation.format,
        slide,
        textStyle,
      });
      console.info("Carousel slide text containment validated", {
        carouselId,
        diagnostics: renderedSlide.diagnostics,
        rendererVersion: CAROUSEL_RENDERER_VERSION,
        slideNumber: slide.slideNumber,
      });
      const uploadedSlide = await uploadRenderedCarouselSlide({
        buffer: renderedSlide.buffer,
        carouselId,
        format: generation.format,
        projectId: generation.projectId,
        rendererVersion: CAROUSEL_RENDERER_VERSION,
        slideNumber: slide.slideNumber,
        userId: generation.userId,
      });

      slideRows.push({
        carousel_generation_id: carouselId,
        category_image_asset_id: asset.id,
        cta_text: slide.ctaText,
        headline: getLegacySlideHeadline(slide),
        image_direction: slide.imageDirection,
        layout_preset: slide.layoutPreset,
        rendered_s3_key: uploadedSlide.key,
        rendered_url: uploadedSlide.url,
        slide_number: slide.slideNumber,
        slide_type: slide.slideType,
        status: "ready",
        subtext: slide.subtext,
        text_position: slide.textPosition,
      });
    }

    await assertBusinessProfileVersionIsCurrent(generation);
    await upsertCarouselSlides(slideRows);
    await updateCarouselGeneration(carouselId, {
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

    await updateCarouselGeneration(carouselId, {
      error_message: message,
      status: "failed",
    }).catch((updateError) => {
      console.error("Failed to mark carousel generation failed:", updateError);
    });

    throw error;
  }
}
