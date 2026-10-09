import { inspectCarouselStructure2SlideLayout } from "./carousel-structure-2-render-slide.js";
import type { CarouselStructure2StoryPlan, CarouselStructure2StoryValidationIssue } from "./carousel-structure-2-story-plan.js";

/** Reuse the renderer's font metrics before reserving/downloading any images.
 * The square format has the same width and the tightest supported safe height. */
export async function getCarouselStructure2MeasuredCopyIssues(plan: CarouselStructure2StoryPlan) {
  const issues: CarouselStructure2StoryValidationIssue[] = [];
  for (const slide of plan.slides) {
    try {
      await inspectCarouselStructure2SlideLayout({ format: "1:1", spec: {
        assetId: "copy-preflight", assetUrl: "https://example.invalid/no-image-download",
        ctaText: slide.ctaText, headline: slide.headline,
        layoutVariant: slide.slideNumber === 6 ? "story_product_reveal" : "story_overlay_only",
        productVisualEligibility: slide.productVisualEligibility,
        slideNumber: slide.slideNumber, storyFormatId: plan.strategy.storyFormatId,
        storyRole: slide.storyRole, storyText: slide.storyText,
        textPosition: "center", textTreatment: "overlay", visualContext: slide.visualContext,
        visualRole: slide.slideNumber === 1 ? "hook" : slide.slideNumber === 6 ? "product_asset" : "human",
      } });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/text could not fit|text groups do not fit|text does not fit the safe area|body copy requires|cannot render empty story/i.test(message)) throw error;
      issues.push({ code: "render_fit", slideNumber: slide.slideNumber,
        message: `Actual renderer font measurements rejected this slide: ${message} Keep at most two short body blocks, each within three lines at 48px; keep the cover within four lines at 84px.` });
    }
  }
  return issues;
}
