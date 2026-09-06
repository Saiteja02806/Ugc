import type { CarouselSlideInsert, CarouselSlideStatus } from "../types.js";
import type { CarouselStructure2RenderSpec } from "./carousel-structure-2-render-spec.js";

export type CarouselStructure2RenderedSlide = {
  renderedS3Key: string | null;
  renderedUrl: string | null;
  slideNumber: number;
  status?: CarouselSlideStatus;
};

export function createCarouselStructure2SlideInserts(params: {
  carouselGenerationId: string;
  renderSpecs: readonly CarouselStructure2RenderSpec[];
  renderedSlides?: readonly CarouselStructure2RenderedSlide[];
  structureVersion: number;
}) {
  if (!params.carouselGenerationId.trim()) {
    throw new Error("Structure 2 persistence requires a carousel generation id.");
  }
  if (!Number.isInteger(params.structureVersion) || params.structureVersion < 1) {
    throw new Error("Structure 2 persistence requires a positive structure version.");
  }
  if (
    params.renderSpecs.length !== 6 ||
    params.renderSpecs.some((spec, index) => spec.slideNumber !== index + 1)
  ) {
    throw new Error(
      "Structure 2 persistence requires six ordered render specs for slides 1 through 6.",
    );
  }

  const renderedBySlide = new Map(
    (params.renderedSlides ?? []).map((slide) => [slide.slideNumber, slide]),
  );

  if (renderedBySlide.size !== (params.renderedSlides ?? []).length) {
    throw new Error("Structure 2 rendered slide numbers must be unique.");
  }

  return params.renderSpecs.map((spec) => {
    const rendered = renderedBySlide.get(spec.slideNumber);

    return {
      carousel_generation_id: params.carouselGenerationId,
      category_image_asset_id: spec.assetId,
      cta_text: spec.ctaText,
      headline: spec.storyText,
      image_direction: spec.visualContext,
      layout_preset: spec.layoutVariant,
      product_visual_eligibility: spec.productVisualEligibility,
      rendered_s3_key: rendered?.renderedS3Key ?? null,
      rendered_url: rendered?.renderedUrl ?? null,
      slide_number: spec.slideNumber,
      slide_type: spec.storyRole,
      status: rendered?.status ?? (rendered ? "ready" : "processing"),
      story_format_id: spec.storyFormatId,
      story_layout_variant: spec.layoutVariant,
      story_role: spec.storyRole,
      story_text_treatment: spec.textTreatment,
      structure_id: "structure_2",
      structure_version: params.structureVersion,
      subtext: null,
      text_position: spec.textPosition,
      visual_role: spec.visualRole,
    } satisfies CarouselSlideInsert;
  });
}
