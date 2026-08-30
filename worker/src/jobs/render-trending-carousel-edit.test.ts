import assert from "node:assert/strict";
import test from "node:test";

import type { SupabaseJobStore } from "../lib/supabase.js";
import type { BackgroundJobRow } from "../types.js";
import { runRenderTrendingCarouselEditJob } from "./render-trending-carousel-edit.js";

test("renders and persists a normalized immutable Carousel edit", async () => {
  let receivedPosition: { x: number; y: number } | undefined;
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
        receivedTextStyle = input.textStyle;
        return {
          buffer: Buffer.from("rendered"),
          diagnostics: {
            bubbleShapeStrategy: "plain-white-text-with-shadow",
            fontFamily: "Geist",
            maxTextWidth: 700,
            whiteBackgroundGroupCount: 0,
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
  assert.equal(receivedTextStyle, "plain");
  assert.deepEqual(readyOutput, {
    rendererVersion:
      "social-plain-text-renderer-v16-followup-copy-50-normalized-edit-v1",
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
            bubbleShapeStrategy: "plain-white-text-with-shadow",
            fontFamily: "Geist",
            maxTextWidth: 700,
            whiteBackgroundGroupCount: 0,
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
    rendererVersion:
      "social-plain-text-renderer-v16-followup-copy-50-normalized-edit-v1",
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
            bubbleShapeStrategy: "plain-white-text-with-shadow",
            ctaBounds: null,
            ctaFontSize: null,
            ctaLineCount: 0,
            layoutVariant: input.spec.layoutVariant,
            rendererVersion: "story-native-renderer-v5-plain-white-story-text",
            safeAreaContained: true,
            storyBounds: { height: 100, width: 700, x: 100, y: 100 },
            storyFontSize: 44,
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
  assert.equal(receivedSpec.layoutVariant, "story_product_reveal");
  assert.equal(receivedSpec.textTreatment, "overlay");
  assert.equal(receivedSpec.textPosition, "upper");
  assert.equal(receivedSpec.visualRole, "product_asset");
  assert.deepEqual(readyOutput, {
    rendererVersion:
      "story-native-renderer-v5-plain-white-story-text-normalized-edit-v1",
    slides: [
      {
        renderedS3Key: "carousels/rendered/user/edit/slide-4.webp",
        renderedUrl: "https://storage.example/edited-4.webp",
        slideNumber: 4,
      },
    ],
  });
});
