import assert from "node:assert/strict";
import test from "node:test";

import type { SupabaseJobStore } from "../lib/supabase.js";
import type { BackgroundJobRow } from "../types.js";
import { CAROUSEL_RENDERER_VERSION } from "../lib/carousel-render-slide.js";
import { CAROUSEL_STRUCTURE_2_RENDERER_VERSION } from "../lib/carousel-structure-2-render-slide.js";
import { runRenderTrendingCarouselEditJob } from "./render-trending-carousel-edit.js";
import type { renderCarouselSlideWithDiagnostics } from "../lib/carousel-render-slide.js";
import type { renderCarouselStructure2SlideWithDiagnostics } from "../lib/carousel-structure-2-render-slide.js";

for (const structureId of ["structure_1", "structure_2"] as const) {
  for (const replaceAll of [false, true]) {
    test(`${structureId} renders ${replaceAll ? "all six independent uploads" : "a body-slide upload and reuses the other five source images"}`, async () => {
      const originals = Array.from({ length: 6 }, (_, index) => ({ id: `slide-${index + 1}`, slide_number: index + 1,
        category_image_asset_id: `original-${index + 1}`, headline: "Original text", subtext: "", cta_text: "",
        visual_role: index === 0 ? "hook" : "human", text_position: "center", story_format_id: "wrong_belief",
        story_role: index === 0 ? "recognition" : "failure_scene", story_layout_variant: "story_overlay_only",
        product_visual_eligibility: "forbidden", rendered_url: `https://storage.test/original-${index + 1}.webp`, rendered_s3_key: `original-${index + 1}.webp` }));
      const edited = originals.map((slide, index) => {
        const replaced = replaceAll || index === 2;
        return { slideId: slide.id, slideNumber: slide.slide_number, headline: slide.headline, subtext: "", ctaText: "",
          backgroundAssetId: replaced ? `upload-${index + 1}` : slide.category_image_asset_id,
          backgroundUrl: `https://storage.test/${replaced ? "upload" : "original"}-${index + 1}.png`,
          backgroundCrop: replaced ? "centre" : undefined, textPosition: { x: .5, y: .5 }, visualRole: slide.visual_role };
      });
      const received: Array<{ number: number; url: string; crop?: string }> = [];
      let readyOutput: unknown;
      const store = {
        getTrendingCarouselEdit: async () => ({ id: "edit", creative_id: "carousel", render_job_id: "job", render_status: "queued",
          content_json: { format: "carousel", slides: edited } }),
        getCarouselGeneration: async () => ({ user_id: "owner", status: "completed", format: "4:5", structure_id: structureId, slide_count: 6, content_plan_normalized: null }),
        listCarouselSlides: async () => originals,
        markTrendingCarouselEditRendering: async () => undefined,
        markTrendingCarouselEditReady: async (params: { output: unknown }) => { readyOutput = params.output; },
      } as unknown as SupabaseJobStore;
      await runRenderTrendingCarouselEditJob({ id: "job", job_type: "render_trending_carousel_edit",
        input_json: { userId: "owner", carouselId: "carousel", editId: "edit", revision: 1 } } as unknown as BackgroundJobRow, {
        store, checkpoint: async () => undefined,
        dependencies: {
          renderCarouselSlide: async input => {
            assert.equal(structureId, "structure_1"); received.push({ number: input.slide.slideNumber, url: input.assetUrl });
            return { buffer: Buffer.from("rendered"), diagnostics: {} } as Awaited<ReturnType<typeof renderCarouselSlideWithDiagnostics>>;
          },
          renderCarouselStructure2Slide: async input => {
            assert.equal(structureId, "structure_2"); received.push({ number: input.spec.slideNumber, url: input.assetUrl, crop: input.spec.backgroundCrop });
            assert.equal(input.spec.productVisualEligibility, "forbidden");
            assert.equal(input.spec.backgroundCrop, "centre");
            return { buffer: Buffer.from("rendered"), diagnostics: {} } as Awaited<ReturnType<typeof renderCarouselStructure2SlideWithDiagnostics>>;
          },
          uploadRenderedCarouselSlide: async ({ slideNumber }) => ({ key: `edited-${slideNumber}.webp`, url: `https://storage.test/edited-${slideNumber}.webp` }),
        },
      });
      assert.deepEqual(received.map(slide => slide.number), replaceAll ? [1, 2, 3, 4, 5, 6] : [3]);
      assert.deepEqual(received.map(slide => slide.url), (replaceAll ? [1, 2, 3, 4, 5, 6] : [3]).map(number => `https://storage.test/upload-${number}.png`));
      const output = readyOutput as { slides: Array<{ slideNumber: number; renderedUrl: string }> };
      assert.equal(output.slides.length, 6);
      assert.deepEqual(output.slides.map(slide => slide.renderedUrl), originals.map((_, index) => `https://storage.test/${replaceAll || index === 2 ? "edited" : "original"}-${index + 1}.webp`));
    });
  }
}

for (const structureId of ["structure_1", "structure_2"] as const) {
  for (const changesCopy of [false, true]) {
    test(`${structureId} image replacement ${changesCopy ? "uses current typography for changed copy" : "keeps authoritative original hook typography"}`, async () => {
      const originalCopy = "Why being always available keeps draining you";
      let fontSize: number | undefined;
      let ready = false;
      const store = {
        getTrendingCarouselEdit: async () => ({ id: "edit", creative_id: "carousel", render_job_id: "job",
          render_status: "queued", content_json: { format: "carousel", slides: [{
            backgroundAssetId: "new-image", backgroundUrl: "https://example.test/new.webp",
            ctaText: "", headline: changesCopy ? "Why your daily plan keeps falling apart" : originalCopy,
            subtext: "", slideId: "slide", slideNumber: 1, visualRole: "hook",
            textPosition: { x: .5, y: .5 },
            // Deliberately invalid client metadata: the worker must derive it from the source rows.
            sourceRendererVersion: "unknown", originalHeadline: "tampered", originalSubtext: "tampered",
          }] } }),
        getCarouselGeneration: async () => ({ user_id: "owner", status: "completed", format: "4:5",
          structure_id: structureId, slide_count: 1, content_plan_normalized: null,
          renderer_version: structureId === "structure_2" ? "story-native-tiktok-text-blocks-inter-tight-v11" : "social-tiktok-text-blocks-inter-tight-v25" }),
        listCarouselSlides: async () => [{ id: "slide", slide_number: 1, category_image_asset_id: "old-image",
          headline: originalCopy, subtext: "", cta_text: "", visual_role: "hook", text_position: "center",
          story_format_id: "wrong_belief", story_role: "recognition", story_layout_variant: "story_overlay_only",
          rendered_url: "https://example.test/original.webp", rendered_s3_key: "original.webp" }],
        markTrendingCarouselEditRendering: async () => undefined,
        markTrendingCarouselEditReady: async () => { ready = true; },
      } as unknown as SupabaseJobStore;
      await runRenderTrendingCarouselEditJob({ id: "job", job_type: "render_trending_carousel_edit",
        input_json: { userId: "owner", carouselId: "carousel", editId: "edit", revision: 1 } } as unknown as BackgroundJobRow, {
        store, checkpoint: async () => undefined,
        dependencies: {
          renderCarouselSlide: async (input) => {
            fontSize = input.coverFontSize;
            return { buffer: Buffer.from("image"), diagnostics: {} } as Awaited<ReturnType<typeof renderCarouselSlideWithDiagnostics>>;
          },
          renderCarouselStructure2Slide: async (input) => {
            fontSize = input.spec.coverFontSize;
            return { buffer: Buffer.from("image"), diagnostics: {} } as Awaited<ReturnType<typeof renderCarouselStructure2SlideWithDiagnostics>>;
          },
          uploadRenderedCarouselSlide: async () => ({ key: "edited.webp", url: "https://example.test/edited.webp" }),
        },
      });
      assert.equal(fontSize, changesCopy ? 84 : 72);
      assert.equal(ready, true);
    });
  }
}

test("renders and persists a normalized immutable Carousel edit", async () => {
  let receivedPosition: { x: number; y: number } | undefined;
  let receivedSlide:
    | { body: string | null; headline: string | null; subtext: string | null }
    | undefined;
  let receivedTextStyle: string | undefined;
  let readyOutput: unknown;
  const store = {
    getCarouselGeneration: async () => ({
      content_plan_normalized: null,
      format: "4:5",
      project_id: "project-1",
      slide_count: 1,
      status: "completed",
      trigger_run_id: "generation-job-1",
      user_id: "user-1",
    }),
    getJobById: async () => ({
      input_json: { textStyle: "plain" },
      job_type: "generate_carousel",
    }),
    getTrendingCarouselEdit: async () => ({
      content_json: {
        format: "carousel",
        slides: [
          {
            backgroundUrl: "https://storage.example/background.webp",
            ctaText: "Try it",
            headline: "Edited headline",
            slideId: "slide-1",
            slideNumber: 1,
            subtext: "Edited support",
            textPosition: { x: 0.27, y: 0.73 },
          },
        ],
      },
      creative_id: "carousel-1",
      id: "edit-1",
      render_job_id: "job-1",
      render_output_json: null,
      render_status: "queued",
      revision: 3,
    }),
    listCarouselSlides: async () => [
      {
        category_image_asset_id: "asset-1",
        cta_text: null,
        headline: "Original",
        id: "slide-1",
        image_direction: null,
        layout_preset: "middle-statement",
        slide_number: 1,
        slide_type: "solution",
        subtext: "Original support",
        text_position: "center",
      },
    ],
    markTrendingCarouselEditReady: async (params: { output: unknown }) => {
      readyOutput = params.output;
    },
    markTrendingCarouselEditRendering: async () => undefined,
  } as unknown as SupabaseJobStore;
  const job = {
    id: "job-1",
    input_json: {
      carouselId: "carousel-1",
      editId: "edit-1",
      revision: 3,
      userId: "user-1",
    },
    job_type: "render_trending_carousel_edit",
  } as unknown as BackgroundJobRow;

  const result = await runRenderTrendingCarouselEditJob(job, {
    checkpoint: async () => undefined,
    dependencies: {
      renderCarouselSlide: async (input) => {
        receivedPosition = input.normalizedTextPosition;
        receivedSlide = input.slide;
        receivedTextStyle = input.textStyle;
        return {
          buffer: Buffer.from("rendered"),
          diagnostics: {
            bubbleShapeStrategy: "heading-white-svg-background",
            fontFamily: "Inter Tight, Inter, Arial, Helvetica, sans-serif",
            maxTextWidth: 700,
            whiteBackgroundGroupCount: 1,
          },
        };
      },
      uploadRenderedCarouselSlide: async () => ({
        key: "carousels/rendered/user/edit/slide.webp",
        url: "https://storage.example/edited.webp",
      }),
    },
    store,
  });

  assert.deepEqual(receivedPosition, { x: 0.27, y: 0.73 });
  assert.deepEqual(receivedSlide, {
    body: null,
    ctaText: null,
    headline: "Edited headline",
    imageDirection: "",
    layoutPreset: "middle-statement",
    listItems: [],
    slideNumber: 1,
    slideType: "hook",
    subtext: null,
    textMode: "single_statement",
    textPosition: "center",
  });
  assert.equal(receivedTextStyle, "plain");
  assert.deepEqual(readyOutput, {
    rendererVersion: `${CAROUSEL_RENDERER_VERSION}-normalized-edit-v2`,
    slides: [
      {
        renderedS3Key: "carousels/rendered/user/edit/slide.webp",
        renderedUrl: "https://storage.example/edited.webp",
        slideNumber: 1,
      },
    ],
  });
  assert.equal(result.renderedSlideCount, 1);
});

test("reuses immutable output for unchanged Carousel slides", async () => {
  const renderedSlideNumbers: number[] = [];
  const uploadedSlideNumbers: number[] = [];
  let readyOutput: unknown;
  const store = {
    getCarouselGeneration: async () => ({
      content_plan_normalized: null,
      format: "4:5",
      project_id: "project-1",
      slide_count: 2,
      status: "completed",
      trigger_run_id: null,
      user_id: "user-1",
    }),
    getJobById: async () => null,
    getTrendingCarouselEdit: async () => ({
      content_json: {
        format: "carousel",
        slides: [
          {
            backgroundAssetId: "asset-1",
            backgroundUrl: "https://storage.example/source-1.webp",
            ctaText: "",
            headline: "Original slide one",
            slideId: "slide-1",
            slideNumber: 1,
            subtext: "Original support one",
            textPosition: { x: 0.5, y: 0.5 },
            visualRole: "static",
          },
          {
            backgroundAssetId: "asset-2",
            backgroundUrl: "https://storage.example/source-2.webp",
            ctaText: "",
            headline: "Updated slide two",
            slideId: "slide-2",
            slideNumber: 2,
            subtext: "Original support two",
            textPosition: { x: 0.5, y: 0.5 },
            visualRole: "static",
          },
        ],
      },
      creative_id: "carousel-1",
      id: "edit-1",
      render_job_id: "job-1",
      render_output_json: null,
      render_status: "queued",
      revision: 4,
    }),
    listCarouselSlides: async () => [
      {
        category_image_asset_id: "asset-1",
        cta_text: null,
        headline: "Original slide one",
        id: "slide-1",
        image_direction: null,
        layout_preset: "middle-statement",
        rendered_s3_key: "carousels/original/slide-1.webp",
        rendered_url: "https://storage.example/original-1.webp",
        slide_number: 1,
        slide_type: "solution",
        subtext: "Original support one",
        text_position: "center",
        visual_role: "static",
      },
      {
        category_image_asset_id: "asset-2",
        cta_text: null,
        headline: "Original slide two",
        id: "slide-2",
        image_direction: null,
        layout_preset: "middle-statement",
        rendered_s3_key: "carousels/original/slide-2.webp",
        rendered_url: "https://storage.example/original-2.webp",
        slide_number: 2,
        slide_type: "solution",
        subtext: "Original support two",
        text_position: "center",
        visual_role: "static",
      },
    ],
    markTrendingCarouselEditReady: async (params: { output: unknown }) => {
      readyOutput = params.output;
    },
    markTrendingCarouselEditRendering: async () => undefined,
  } as unknown as SupabaseJobStore;
  const job = {
    id: "job-1",
    input_json: {
      carouselId: "carousel-1",
      editId: "edit-1",
      revision: 4,
      userId: "user-1",
    },
    job_type: "render_trending_carousel_edit",
  } as unknown as BackgroundJobRow;

  const result = await runRenderTrendingCarouselEditJob(job, {
    checkpoint: async () => undefined,
    dependencies: {
      renderCarouselSlide: async (input) => {
        renderedSlideNumbers.push(input.slide.slideNumber);
        return {
          buffer: Buffer.from("rendered"),
          diagnostics: {
            bubbleShapeStrategy: "heading-white-svg-background",
            fontFamily: "Inter Tight, Inter, Arial, Helvetica, sans-serif",
            maxTextWidth: 700,
            whiteBackgroundGroupCount: 1,
          },
        };
      },
      uploadRenderedCarouselSlide: async (input) => {
        uploadedSlideNumbers.push(input.slideNumber);
        return {
          key: "carousels/edited/slide-2.webp",
          url: "https://storage.example/edited-2.webp",
        };
      },
    },
    store,
  });

  assert.deepEqual(renderedSlideNumbers, [2]);
  assert.deepEqual(uploadedSlideNumbers, [2]);
  assert.deepEqual(readyOutput, {
    rendererVersion: `${CAROUSEL_RENDERER_VERSION}-normalized-edit-v2`,
    slides: [
      {
        renderedS3Key: "carousels/original/slide-1.webp",
        renderedUrl: "https://storage.example/original-1.webp",
        slideNumber: 1,
      },
      {
        renderedS3Key: "carousels/edited/slide-2.webp",
        renderedUrl: "https://storage.example/edited-2.webp",
        slideNumber: 2,
      },
    ],
  });
  assert.equal(result.renderedSlideCount, 2);
});

test("renders Structure 2 screenshot edits with the story-native renderer", async () => {
  const receivedSpecs: Array<Record<string, unknown>> = [];
  let readyOutput: unknown;
  const store = {
    getCarouselGeneration: async () => ({
      content_plan_normalized: null,
      format: "4:5",
      project_id: "project-1",
      slide_count: 1,
      status: "completed",
      structure_id: "structure_2",
      trigger_run_id: null,
      user_id: "user-1",
    }),
    getJobById: async () => null,
    getTrendingCarouselEdit: async () => ({
      content_json: {
        format: "carousel",
        slides: [
          {
            backgroundAssetId: "product-asset-1",
            backgroundUrl: "https://storage.example/product.webp",
            ctaText: "Try it",
            headline: "See the product in action",
            slideId: "slide-4",
            slideNumber: 4,
            subtext: "One clear workflow",
            textPosition: { x: 0.5, y: 0.25 },
            visualRole: "product_asset",
          },
        ],
      },
      creative_id: "carousel-1",
      id: "edit-1",
      render_job_id: "job-1",
      render_output_json: null,
      render_status: "queued",
      revision: 2,
    }),
    listCarouselSlides: async () => [
      {
        category_image_asset_id: "static-asset-1",
        cta_text: null,
        headline: "Original",
        id: "slide-4",
        image_direction: "Show the product interface",
        layout_preset: null,
        product_visual_eligibility: "preferred",
        slide_number: 4,
        slide_type: null,
        story_format_id: "wrong_belief",
        story_layout_variant: "story_overlay_only",
        story_role: "product_turning_point",
        story_text_treatment: "pill",
        structure_id: "structure_2",
        subtext: null,
        text_position: null,
        visual_role: "static",
      },
    ],
    markTrendingCarouselEditReady: async (params: { output: unknown }) => {
      readyOutput = params.output;
    },
    markTrendingCarouselEditRendering: async () => undefined,
  } as unknown as SupabaseJobStore;
  const job = {
    id: "job-1",
    input_json: {
      carouselId: "carousel-1",
      editId: "edit-1",
      revision: 2,
      userId: "user-1",
    },
    job_type: "render_trending_carousel_edit",
  } as unknown as BackgroundJobRow;

  await runRenderTrendingCarouselEditJob(job, {
    checkpoint: async () => undefined,
    dependencies: {
      renderCarouselSlide: async () => {
        throw new Error("Structure 1 renderer must not be used.");
      },
      renderCarouselStructure2Slide: async (input) => {
        receivedSpecs.push(input.spec);
        return {
          buffer: Buffer.from("story-rendered"),
          diagnostics: {
            bubbleShapeStrategy: "plain-white-text-with-outline",
            ctaBounds: null,
            ctaFontSize: null,
            ctaLineCount: 0,
            layoutVariant: input.spec.layoutVariant,
            rendererVersion: CAROUSEL_STRUCTURE_2_RENDERER_VERSION,
            safeAreaContained: true,
            storyBounds: { height: 100, width: 700, x: 100, y: 100 },
            storyFontSize: 60,
            storyLineCount: 2,
            textTreatment: input.spec.textTreatment,
            visualRole: input.spec.visualRole,
            whiteBackgroundGroupCount: 0,
          },
        };
      },
      uploadRenderedCarouselSlide: async () => ({
        key: "carousels/rendered/user/edit/slide-4.webp",
        url: "https://storage.example/edited-4.webp",
      }),
    },
    store,
  });

  const receivedSpec = receivedSpecs[0];
  assert.ok(receivedSpec);
  assert.equal(receivedSpec.assetId, "product-asset-1");
  assert.equal(receivedSpec.ctaText, "Try it");
  assert.equal(receivedSpec.layoutVariant, "story_product_reveal");
  assert.equal(receivedSpec.textTreatment, "overlay");
  assert.equal(receivedSpec.textPosition, "upper");
  assert.equal(receivedSpec.visualRole, "product_asset");
  assert.deepEqual(readyOutput, {
    rendererVersion: `${CAROUSEL_STRUCTURE_2_RENDERER_VERSION}-normalized-edit-v3`,
    slides: [
      {
        renderedS3Key: "carousels/rendered/user/edit/slide-4.webp",
        renderedUrl: "https://storage.example/edited-4.webp",
        slideNumber: 4,
      },
    ],
  });
});
