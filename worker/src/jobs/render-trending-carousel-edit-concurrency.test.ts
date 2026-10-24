import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseJobStore } from "../lib/supabase.js";
import type { BackgroundJobRow } from "../types.js";
import { defaultCarouselManualTextStyle } from "../lib/carousel-manual-text.js";
import { runRenderTrendingCarouselEditJob } from "./render-trending-carousel-edit.js";

function fixture() {
  const slides = [1, 2, 3, 4].map(n => ({ slideId: `slide-${n}`, slideNumber: n, headline: `Useful habit ${n}`,
    subtext: "", ctaText: "", backgroundAssetId: `image-${n}`, backgroundUrl: `https://owned.test/${n}.png`,
    textPosition: { x: .5, y: .5 }, textStyle: defaultCarouselManualTextStyle() }));
  let output: { slides: { slideNumber: number }[] } | undefined;
  let failed = false;
  const store = {
    getTrendingCarouselEdit: async () => ({ creative_id: "carousel", render_job_id: "job", render_status: "queued", content_json: { format: "carousel", slides } }),
    getCarouselGeneration: async () => ({ user_id: "owner", status: "completed", structure_id: "structure_1", slide_count: 4, format: "4:5" }),
    listCarouselSlides: async () => slides.map(s => ({ id: s.slideId, slide_number: s.slideNumber, category_image_asset_id: s.backgroundAssetId, headline: s.headline })),
    markTrendingCarouselEditRendering: async () => undefined,
    markTrendingCarouselEditReady: async (p: { output: typeof output }) => { output = p.output; },
    markTrendingCarouselEditFailed: async () => { failed = true; },
  } as unknown as SupabaseJobStore;
  return { store, output: () => output, failed: () => failed,
    job: { id: "job", job_type: "render_trending_carousel_edit", input_json: { carouselId: "carousel", editId: "edit", revision: 2, userId: "owner" } } as unknown as BackgroundJobRow };
}

test("two slides run concurrently, out-of-order completion retains slide order and monotonic progress", async () => {
  const f = fixture(); let running = 0, maximum = 0;
  const progress: number[] = [], completion: number[] = [];
  await runRenderTrendingCarouselEditJob(f.job, { store: f.store, checkpoint: async p => { if (typeof p.progress === "number") progress.push(p.progress); }, dependencies: {
    renderCarouselManualSlide: async ({ slide }) => {
      maximum = Math.max(maximum, ++running);
      await new Promise(resolve => setTimeout(resolve, slide.slideNumber % 2 ? 40 : 1));
      return { buffer: Buffer.from(String(slide.slideNumber)), diagnostics: {} } as never;
    },
    uploadRenderedCarouselSlide: async ({ slideNumber }) => {
      completion.push(slideNumber); running--;
      return { key: `${slideNumber}.webp`, url: `https://owned.test/${slideNumber}.webp` };
    },
  } });
  assert.equal(maximum, 2); assert.equal(running, 0);
  assert.deepEqual(completion, [2, 1, 4, 3]);
  assert.deepEqual(f.output()?.slides.map(s => s.slideNumber), [1, 2, 3, 4]);
  assert.deepEqual(progress, [...progress].sort((a, b) => a - b));
});

test("a failed pair drains the other slide before reporting failure, without publishing partial output", async () => {
  const f = fixture(); let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const started: number[] = []; let settled = false;
  const run = runRenderTrendingCarouselEditJob(f.job, { store: f.store, checkpoint: async () => undefined, dependencies: {
    renderCarouselManualSlide: async ({ slide }) => {
      started.push(slide.slideNumber);
      if (slide.slideNumber === 1) throw new Error("Missing source image");
      await gate;
      return { buffer: Buffer.from("image"), diagnostics: {} } as never;
    },
    uploadRenderedCarouselSlide: async () => ({ key: "second.webp", url: "https://owned.test/second.webp" }),
  } });
  const rejection = assert.rejects(run, /Missing source image/).then(() => { settled = true; });
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.deepEqual(started, [1, 2]); assert.equal(settled, false); assert.equal(f.failed(), false);
  release(); await rejection;
  assert.equal(f.failed(), true); assert.equal(f.output(), undefined); assert.deepEqual(started, [1, 2]);
});
