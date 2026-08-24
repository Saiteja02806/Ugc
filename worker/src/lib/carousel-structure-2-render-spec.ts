import type { ReservedCarouselRoleAssetRow } from "../types.js";
import {
  isCarouselStructure2FormatId,
  type CarouselStructure2FormatId,
  type CarouselStructure2StoryRole,
} from "./carousel-structure-2-formats.js";
import type {
  CarouselStructure2ProductVisualEligibility,
  CarouselStructure2StoryPlan,
} from "./carousel-structure-2-story-plan.js";

export const CAROUSEL_STRUCTURE_2_LAYOUT_VARIANTS = [
  "story_overlay_only",
  "story_pill_overlay",
  "story_product_reveal",
] as const;

export const CAROUSEL_STRUCTURE_2_TEXT_TREATMENTS = [
  "outlined_overlay",
  "overlay",
  "pill",
] as const;

export type CarouselStructure2LayoutVariant =
  (typeof CAROUSEL_STRUCTURE_2_LAYOUT_VARIANTS)[number];
export type CarouselStructure2TextTreatment =
  (typeof CAROUSEL_STRUCTURE_2_TEXT_TREATMENTS)[number];
export type CarouselStructure2TextPosition = "center" | "lower" | "upper";
export type CarouselStructure2VisualRole =
  ReservedCarouselRoleAssetRow["asset_role"];

export type CarouselStructure2RenderSpec = {
  assetId: string;
  assetUrl: string;
  ctaText: string | null;
  layoutVariant: CarouselStructure2LayoutVariant;
  productVisualEligibility: CarouselStructure2ProductVisualEligibility;
  slideNumber: number;
  storyFormatId: CarouselStructure2FormatId;
  storyRole: CarouselStructure2StoryRole;
  storyText: string;
  textPosition: CarouselStructure2TextPosition;
  textTreatment: CarouselStructure2TextTreatment;
  visualContext: string;
  visualRole: CarouselStructure2VisualRole;
};

export function buildCarouselStructure2RenderSpecs(params: {
  assets: readonly ReservedCarouselRoleAssetRow[];
  storyPlan: CarouselStructure2StoryPlan;
}) {
  if (!isCarouselStructure2FormatId(params.storyPlan.strategy.storyFormatId)) {
    throw new Error("Structure 2 render specs require a canonical Structure 2 format id.");
  }
  if (params.storyPlan.slides.length !== 5 || params.assets.length !== 5) {
    throw new Error(
      "Structure 2 rendering requires exactly five story slides and five reserved role assets.",
    );
  }

  const assetsBySlide = new Map(
    params.assets.map((asset) => [asset.slide_number, asset]),
  );

  if (assetsBySlide.size !== 5) {
    throw new Error("Structure 2 reserved assets must use slide numbers 1 through 5 once each.");
  }

  assertCarouselStructure2VisualRatio(params.assets);

  return params.storyPlan.slides.map((slide) => {
    const asset = assetsBySlide.get(slide.slideNumber);

    if (!asset) {
      throw new Error(`Structure 2 slide ${slide.slideNumber} has no reserved visual asset.`);
    }
    if (
      asset.asset_role === "product_asset" &&
      slide.productVisualEligibility === "forbidden"
    ) {
      throw new Error(
        `Structure 2 product assets are not eligible for slide ${slide.slideNumber}.`,
      );
    }

    const presentation = resolvePresentation({
      slideNumber: slide.slideNumber,
      storyRole: slide.storyRole,
      visualRole: asset.asset_role,
    });

    return {
      assetId: asset.asset_id,
      assetUrl: asset.base_url,
      ctaText: slide.ctaText,
      layoutVariant: presentation.layoutVariant,
      productVisualEligibility: slide.productVisualEligibility,
      slideNumber: slide.slideNumber,
      storyFormatId: params.storyPlan.strategy.storyFormatId,
      storyRole: slide.storyRole,
      storyText: slide.storyText,
      textPosition: presentation.textPosition,
      textTreatment: presentation.textTreatment,
      visualContext: slide.visualContext,
      visualRole: asset.asset_role,
    } satisfies CarouselStructure2RenderSpec;
  });
}

function resolvePresentation(params: {
  slideNumber: number;
  storyRole: CarouselStructure2StoryRole;
  visualRole: CarouselStructure2VisualRole;
}): Pick<
  CarouselStructure2RenderSpec,
  "layoutVariant" | "textPosition" | "textTreatment"
> {
  if (params.storyRole === "recognition") {
    return {
      layoutVariant: "story_pill_overlay",
      textPosition: "center",
      textTreatment: "pill",
    };
  }

  if (params.visualRole === "product_asset") {
    return {
      layoutVariant: "story_product_reveal",
      textPosition: "upper",
      textTreatment: "pill",
    };
  }

  if (params.storyRole === "product_turning_point") {
    return {
      layoutVariant: "story_pill_overlay",
      textPosition: "lower",
      textTreatment: "pill",
    };
  }

  return {
    layoutVariant: "story_overlay_only",
    textPosition: params.slideNumber === 3 ? "upper" : "lower",
    textTreatment: "pill",
  };
}

export function assertCarouselStructure2VisualRatio(
  assets: readonly ReservedCarouselRoleAssetRow[],
) {
  const ordered = [...assets].sort(
    (left, right) => left.slide_number - right.slide_number,
  );
  const counts = ordered.reduce(
    (result, asset) => {
      result[asset.asset_role] += 1;
      return result;
    },
    { hook: 0, human: 0, product_asset: 0, static: 0 },
  );
  const nonHumanCount = counts.static + counts.product_asset;

  if (
    ordered.length !== 5 ||
    ordered.some((asset, index) => asset.slide_number !== index + 1) ||
    ordered[0]?.asset_role !== "hook" ||
    counts.hook !== 1 ||
    counts.human !== 2 ||
    nonHumanCount !== 2 ||
    counts.product_asset > 1
  ) {
    throw new Error(
      "Structure 2 visuals must follow 1 hook + 2 human + 2 non-human assets; one non-human slot may be a product asset.",
    );
  }

  const tailRoles = ordered.slice(1).map((asset) =>
    asset.asset_role === "human" ? "human" : "non_human",
  );

  if (tailRoles.some((role, index) => index > 0 && role === tailRoles[index - 1])) {
    throw new Error(
      "Structure 2 human and non-human visuals must alternate across slides 2 through 5.",
    );
  }
}
