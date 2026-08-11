import { getBusinessProfileForUser } from "@/lib/business-profiles/db";
import {
  getCarouselGeneration,
  getWebsiteAnalysisForCarousel,
  incrementCategoryImageAssetUsage,
  listCarouselBatchContentHistory,
  listReadyCategoryImageAssets,
  updateCarouselGeneration,
  upsertCarouselSlides,
  type CarouselSlideInsert,
  type Json,
} from "@/lib/carousel/db";
import { resolveCarouselBusinessVisualProfile } from "@/lib/carousel/business-visual-profile";
import {
  CAROUSEL_BROAD_RUNTIME_MATCHER_VERSION,
  compareBroadAndLegacySelections,
  getCarouselBroadMatcherMode,
  selectBroadRuntimeVisualAssets,
} from "@/lib/carousel/broad-runtime-visual-matcher";
import {
  CAROUSEL_RENDERER_VERSION,
  renderCarouselSlideWithDiagnostics,
} from "@/lib/carousel/render-slide";
import { selectRuntimeVisualBucketAssets } from "@/lib/carousel/runtime-visual-bucket-matcher";
import {
  DEFAULT_CAROUSEL_RENDER_STYLE,
  type CarouselRenderStyle,
} from "@/lib/carousel/render-style";
import {
  buildCarouselContentPlan,
  mergeCarouselRecentContentHistory,
  type CarouselRecentContentSummaryInput,
} from "@/lib/carousel/llm-slide-plan";
import type { PlannedCarouselSlide } from "@/lib/carousel/slide-plan";
import { uploadRenderedCarouselSlide } from "@/lib/carousel/storage";

type GenerateCarouselInput = {
  candidateCount?: number;
  candidateIndex?: number;
  carouselId: string;
  textStyle?: CarouselRenderStyle;
};

type ReadyAsset = Awaited<ReturnType<typeof listReadyCategoryImageAssets>>[number];

type AssetProfile = {
  name: string;
  settings?: string[];
  styles?: string[];
};

const ASSET_PROFILES: AssetProfile[] = [
  {
    name: "casual-creator",
    settings: ["workspace", "home-office"],
    styles: ["creator", "casual", "lifestyle"],
  },
  {
    name: "home-office",
    settings: ["home-office"],
    styles: ["casual", "lifestyle"],
  },
  {
    name: "coffee-shop",
    settings: ["coffee-shop"],
    styles: ["casual", "creator"],
  },
  {
    name: "founder-startup",
    settings: ["workspace", "office"],
    styles: ["founder", "creator"],
  },
  {
    name: "workspace-team",
    settings: ["meeting", "office", "workspace"],
    styles: ["team", "corporate"],
  },
];

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Carousel generation failed.";
}

function truncateErrorMessage(message: string) {
  return message.trim().slice(0, 900);
}

function hashString(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function stableShuffle<T extends { id?: string }>(items: T[], seed: string) {
  return items
    .map((item, index) => ({
      item,
      rank: hashString(`${seed}:${item.id ?? index}`),
    }))
    .sort((left, right) => left.rank - right.rank)
    .map(({ item }) => item);
}

function assetMatchesProfile(asset: ReadyAsset, profile: AssetProfile) {
  const style = asset.visualStyle?.toLowerCase() ?? "";
  const setting = asset.visualSetting?.toLowerCase() ?? "";

  return (
    Boolean(style && profile.styles?.includes(style)) ||
    Boolean(setting && profile.settings?.includes(setting))
  );
}

function rotateByOffset<T>(items: T[], offset: number) {
  if (items.length === 0) {
    return [];
  }

  const normalizedOffset = offset % items.length;

  return [...items.slice(normalizedOffset), ...items.slice(0, normalizedOffset)];
}

function getCandidateAssetIdentity(asset: ReadyAsset) {
  if (asset.canonicalAssetId) {
    return `canonical:${asset.canonicalAssetId}`;
  }

  if (asset.sourceFileSha256) {
    return `sha256:${asset.sourceFileSha256}`;
  }

  if (asset.sourcePerceptualHash) {
    return `phash:${asset.sourcePerceptualHash}`;
  }

  return asset.pexelsPhotoId
    ? `pexels:${asset.pexelsPhotoId}`
    : `object:${asset.baseObjectKey}`;
}

function uniqueByAssetIdentity(items: ReadyAsset[]) {
  const seen = new Set<string>();
  const uniqueItems: ReadyAsset[] = [];

  for (const item of items) {
    const assetIdentity = getCandidateAssetIdentity(item);

    if (seen.has(assetIdentity)) {
      continue;
    }

    seen.add(assetIdentity);
    uniqueItems.push(item);
  }

  return uniqueItems;
}

function getLegacySlideHeadline(slide: PlannedCarouselSlide) {
  return (
    slide.headline ??
    slide.body ??
    slide.listItems[0] ??
    slide.ctaText ??
    `Slide ${slide.slideNumber}`
  );
}

function parseContentHistorySnapshot(
  value: Json,
): CarouselRecentContentSummaryInput[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.slice(0, 10).flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return [];
    }

    const record = item as Record<string, Json | undefined>;
    return [
      {
        angle: getOptionalString(record.angle),
        contentFormatId: getOptionalString(record.contentFormatId),
        hook: getOptionalString(record.hook),
        hookFamilyId: getOptionalString(record.hookFamilyId),
        topic: getOptionalString(record.topic),
        topicId: getOptionalString(record.topicId),
      },
    ];
  });
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

function getOptionalString(value: Json | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function selectCandidateAssets(params: {
  assets: ReadyAsset[];
  candidateIndex: number;
  seed: string;
  slideCount: number;
}) {
  if (params.assets.length === 0) {
    return [];
  }

  const usedAssetIdentities = new Set<string>();
  let selectedAssets: ReadyAsset[] = [];

  for (let index = 0; index <= params.candidateIndex; index += 1) {
    const profile = ASSET_PROFILES[index % ASSET_PROFILES.length];
    const profileCycle = Math.floor(index / ASSET_PROFILES.length);
    const unusedAssets = params.assets.filter(
      (asset) => !usedAssetIdentities.has(getCandidateAssetIdentity(asset)),
    );
    const preferredAssets = unusedAssets.filter((asset) =>
      assetMatchesProfile(asset, profile),
    );
    const preferredSelection = rotateByOffset(
      stableShuffle(
        preferredAssets,
        `${params.seed}:${profile.name}:preferred:${profileCycle}`,
      ),
      profileCycle * params.slideCount,
    );
    const fallbackSelection = rotateByOffset(
      stableShuffle(unusedAssets, `${params.seed}:fallback`),
      index * params.slideCount,
    );

    selectedAssets = uniqueByAssetIdentity([
      ...preferredSelection,
      ...fallbackSelection,
    ]).slice(0, params.slideCount);

    if (selectedAssets.length < params.slideCount) {
      selectedAssets = uniqueByAssetIdentity([
        ...selectedAssets,
        ...params.assets,
      ]).slice(0, params.slideCount);
    }

    if (index < params.candidateIndex) {
      for (const asset of selectedAssets) {
        usedAssetIdentities.add(getCandidateAssetIdentity(asset));
      }
    }
  }

  return selectedAssets;
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

    const businessVisualProfile = resolveCarouselBusinessVisualProfile({
      category: businessAnalysis.category ?? websiteAnalysis.category,
      pexelsImageQueries:
        businessAnalysis.pexelsImageQueries ??
        websiteAnalysis.pexelsImageQueries,
      productSummary:
        businessAnalysis.productSummary ?? websiteAnalysis.productSummary,
      valueProps: businessAnalysis.valueProps,
      visualKeywords:
        businessAnalysis.visualKeywords ?? websiteAnalysis.visualKeywords,
    });
    const assets = await listReadyCategoryImageAssets({
      categorySlug: generation.categorySlug,
      profileId: businessVisualProfile.id,
    });

    if (assets.length === 0) {
      throw new Error(
        `Category "${generation.categorySlug}" has no approved object-only images available before carousel rendering can start.`,
      );
    }

    const batchHistory = generation.businessProfileId
      ? await listCarouselBatchContentHistory({
          businessProfileId: generation.businessProfileId,
          excludeCarouselId: generation.id,
          generationBatchId: generation.generationBatchId,
          limit: 10,
        })
      : [];
    const recentHistory = mergeCarouselRecentContentHistory(
      batchHistory,
      parseContentHistorySnapshot(generation.contentHistorySnapshot),
    );

    await updateCarouselGeneration(carouselId, {
      content_history_snapshot: recentHistory as unknown as Json,
    });

    const contentPlan = await buildCarouselContentPlan({
      analysis: businessAnalysis,
      goal: generation.goal,
      candidateIndex,
      contentFormatId: generation.contentFormatId,
      hookFamilyId: generation.hookFamilyId,
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
    const selectionSeed = [
      generation.categorySlug,
      generation.generationBatchId,
      generation.websiteAnalysisId,
      generation.slideCount,
      generation.format,
    ].join(":");
    const fallbackSelectedAssets = selectCandidateAssets({
      assets,
      candidateIndex,
      seed: selectionSeed,
      slideCount: generation.slideCount,
    });
    const legacyVisualAssetSelections = selectRuntimeVisualBucketAssets({
      assets,
      candidateIndex,
      fallbackAssets: fallbackSelectedAssets.length > 0 ? fallbackSelectedAssets : assets,
      profile: businessVisualProfile,
      seed: selectionSeed,
      slides: plannedSlides,
    });
    const broadMatcherMode = getCarouselBroadMatcherMode();
    const broadVisualAssetSelections =
      broadMatcherMode === "off"
        ? []
        : selectBroadRuntimeVisualAssets({
            assets,
            candidateIndex,
            categorySlug: generation.categorySlug,
            profile: businessVisualProfile,
            seed: selectionSeed,
            slides: plannedSlides,
          });
    const visualAssetSelections =
      broadMatcherMode === "enabled"
        ? broadVisualAssetSelections
        : legacyVisualAssetSelections;
    const visualAssetSelectionsBySlideNumber = new Map(
      visualAssetSelections.map((selection) => [selection.slideNumber, selection]),
    );

    if (broadMatcherMode !== "off") {
      console.info("Carousel broad matcher comparison completed", {
        broadMatcherMode,
        broadMatcherVersion: CAROUSEL_BROAD_RUNTIME_MATCHER_VERSION,
        carouselId,
        categorySlug: generation.categorySlug,
        comparisons: compareBroadAndLegacySelections({
          broadSelections: broadVisualAssetSelections,
          legacySelections: legacyVisualAssetSelections,
          slides: plannedSlides,
        }),
        profileId: businessVisualProfile.id,
      });
    }

    if (visualAssetSelections.length < plannedSlides.length) {
      throw new Error(
        `Category "${generation.categorySlug}" needs ${plannedSlides.length} selectable images before carousel rendering can start. Found ${visualAssetSelections.length}.`,
      );
    }

    const slideRows: CarouselSlideInsert[] = [];

    await updateCarouselGeneration(carouselId, {
      error_message: null,
      status: "processing",
    });

    for (const slide of plannedSlides) {
      const selectedAsset = visualAssetSelectionsBySlideNumber.get(slide.slideNumber);
      const asset =
        selectedAsset?.asset ??
        fallbackSelectedAssets[(slide.slideNumber - 1) % fallbackSelectedAssets.length];

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
    await incrementCategoryImageAssetUsage(
      slideRows
        .map((slide) => slide.category_image_asset_id)
        .filter((assetId): assetId is string => Boolean(assetId)),
    );
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
