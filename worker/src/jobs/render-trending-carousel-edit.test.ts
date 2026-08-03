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
            bubbleShapeStrategy: "hybrid-soft-union-connected-path",
            escapedTextPixels: 0,
            fontFamily: "Geist",
            lines: [],
            maxBubbleWidth: 700,
            repaired: false,
            textPixelContainmentPassed: true,
            textPixels: 10,
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
      "social-bubble-renderer-v11-hybrid-soft-union-normalized-edit-v1",
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
