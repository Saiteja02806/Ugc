import type {
  CarouselSlideInsert,
  CategoryImageAssetRow,
  Json,
} from "../types.js";
import { logger } from "../logger.js";
import type { SupabaseJobStore } from "./supabase.js";
import { resolveCarouselBusinessVisualProfile } from "./carousel-business-visual-profile.js";
import {
  CAROUSEL_BROAD_RUNTIME_MATCHER_VERSION,
  compareBroadAndLegacySelections,
  getCarouselBroadMatcherMode,
  selectBroadRuntimeVisualAssets,
} from "./carousel-broad-runtime-visual-matcher.js";
import {
  CAROUSEL_RENDERER_VERSION,
  renderCarouselSlideWithDiagnostics,
} from "./carousel-render-slide.js";
import { selectRuntimeVisualBucketAssets } from "./carousel-runtime-visual-bucket-matcher.js";
import {
  DEFAULT_CAROUSEL_RENDER_STYLE,
  type CarouselRenderStyle,
} from "./carousel-render-style.js";
import { buildCarouselContentPlan } from "./carousel-llm-slide-plan.js";
import type { PlannedCarouselSlide } from "./carousel-slide-plan.js";
import { uploadRenderedCarouselSlide } from "./carousel-storage.js";

type GenerateCarouselInput = {
  candidateIndex?: number;
  carouselId: string;
  store: SupabaseJobStore;
  textStyle?: CarouselRenderStyle;
};

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

function assetMatchesProfile(asset: CategoryImageAssetRow, profile: AssetProfile) {
  const style = asset.visual_style?.toLowerCase() ?? "";
  const setting = asset.visual_setting?.toLowerCase() ?? "";

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

function getCandidateAssetIdentity(asset: CategoryImageAssetRow) {
  if (asset.canonical_asset_id) {
    return `canonical:${asset.canonical_asset_id}`;
  }

  if (asset.source_file_sha256) {
    return `sha256:${asset.source_file_sha256}`;
  }

  if (asset.source_perceptual_hash) {
    return `phash:${asset.source_perceptual_hash}`;
  }

  return asset.pexels_photo_id
    ? `pexels:${asset.pexels_photo_id}`
    : `s3:${asset.base_s3_key}`;
}

function uniqueByAssetIdentity(items: CategoryImageAssetRow[]) {
  const seen = new Set<string>();
  const uniqueItems: CategoryImageAssetRow[] = [];

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

function selectCandidateAssets(params: {
  assets: CategoryImageAssetRow[];
  candidateIndex: number;
  seed: string;
  slideCount: number;
}) {
  if (params.assets.length === 0) {
    return [];
  }

  const usedAssetIdentities = new Set<string>();
  let selectedAssets: CategoryImageAssetRow[] = [];

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
  store,
  textStyle = DEFAULT_CAROUSEL_RENDER_STYLE,
}: GenerateCarouselInput) {
  try {
    const generation = await store.getCarouselGeneration(carouselId);

    if (!generation) {
      throw new Error("Carousel generation was not found.");
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

    if (!generation.category_slug) {
      throw new Error("Carousel generation is missing a category slug.");
    }

    const businessVisualProfile = resolveCarouselBusinessVisualProfile({
      category: websiteAnalysis.analysis_json.category ?? websiteAnalysis.category,
      pexelsImageQueries:
        websiteAnalysis.analysis_json.pexelsImageQueries ??
        websiteAnalysis.pexels_image_queries,
      productSummary:
        websiteAnalysis.analysis_json.productSummary ??
        websiteAnalysis.product_summary,
      valueProps:
        websiteAnalysis.analysis_json.valueProps ?? websiteAnalysis.value_props,
      visualKeywords:
        websiteAnalysis.analysis_json.visualKeywords ??
        websiteAnalysis.visual_keywords,
    });
    const assets = await store.listReadyCategoryImageAssets({
      categorySlug: generation.category_slug,
      profileId: businessVisualProfile.id,
    });

    if (assets.length === 0) {
      throw new Error(
        `Category "${generation.category_slug}" has no approved object-only images available before carousel rendering can start.`,
      );
    }

    const contentPlan = await buildCarouselContentPlan({
      analysis: websiteAnalysis.analysis_json,
      candidateIndex,
      goal: generation.goal,
      selectedAngle: generation.selected_angle,
      slideCount: generation.slide_count,
    });
    const plannedSlides = contentPlan.slides;

    logger.info("Carousel content planning completed", {
      broadSituations: contentPlan.broadSituations,
      carouselId,
      concept: contentPlan.concept,
      fallbackReason: contentPlan.fallbackReason,
      model: contentPlan.model,
      plannerVersion: contentPlan.plannerVersion,
      source: contentPlan.source,
      validationResult: contentPlan.validationResult,
    });
    await store.updateCarouselGeneration(carouselId, {
      content_plan_fallback_reason: contentPlan.fallbackReason,
      content_plan_normalized: contentPlan.normalizedPlan as unknown as Json,
      content_plan_raw_response: contentPlan.rawLlmResponse as unknown as Json,
      content_plan_source: contentPlan.source,
      content_plan_validation: contentPlan.validationResult as unknown as Json,
      content_planner_model: contentPlan.model,
      content_planner_version: contentPlan.plannerVersion,
      renderer_version: CAROUSEL_RENDERER_VERSION,
    });
    const selectionSeed = [
      generation.category_slug,
      generation.generation_batch_id,
      generation.website_analysis_id,
      generation.slide_count,
      generation.format,
    ].join(":");
    const fallbackSelectedAssets = selectCandidateAssets({
      assets,
      candidateIndex,
      seed: selectionSeed,
      slideCount: generation.slide_count,
    });
    const legacyVisualAssetSelections = selectRuntimeVisualBucketAssets({
      assets,
      candidateIndex,
      fallbackAssets:
        fallbackSelectedAssets.length > 0 ? fallbackSelectedAssets : assets,
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
            categorySlug: generation.category_slug,
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
      logger.info("Carousel broad matcher comparison completed", {
        broadMatcherMode,
        broadMatcherVersion: CAROUSEL_BROAD_RUNTIME_MATCHER_VERSION,
        carouselId,
        categorySlug: generation.category_slug,
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
        `Category "${generation.category_slug}" needs ${plannedSlides.length} selectable images before carousel rendering can start. Found ${visualAssetSelections.length}.`,
      );
    }

    logger.info("Carousel image matching completed", {
      broadMatcherMode,
      carouselId,
      categorySlug: generation.category_slug,
      profileId: businessVisualProfile.id,
      selections: visualAssetSelections.map((selection) => ({
        assetId: selection.asset.id,
        bucketId: selection.bucketId,
        hasHuman: selection.hasHuman,
        imageSubjectClass: selection.imageSubjectClass,
        intent: selection.intent,
        matchReason: selection.matchReason,
        mode: selection.mode,
        score: selection.score,
        slideNumber: selection.slideNumber,
      })),
    });

    const slideRows: CarouselSlideInsert[] = [];

    await store.updateCarouselGeneration(carouselId, {
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
        assetUrl: asset.base_url,
        businessName:
          websiteAnalysis.analysis_json.businessName ??
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

    await store.upsertCarouselSlides(slideRows);
    await store.incrementCategoryImageAssetUsage(
      slideRows
        .map((slide) => slide.category_image_asset_id)
        .filter((assetId): assetId is string => Boolean(assetId)),
    );
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
