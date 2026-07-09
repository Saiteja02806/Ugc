import type { SupabaseJobStore } from "../lib/supabase.js";
import { generateCarousel } from "../lib/carousel-generate.js";
import { getCarouselRenderStyle } from "../lib/carousel-render-style.js";
import type { BackgroundJobRow, Json } from "../types.js";
import type { WorkerJobOutput } from "./index.js";

type GenerateCarouselInput = {
  candidateIndex: number;
  carouselId: string;
  textStyle: Json | undefined;
};

function getInput(job: BackgroundJobRow): GenerateCarouselInput {
  if (!job.input_json || typeof job.input_json !== "object" || Array.isArray(job.input_json)) {
    throw new Error("generate_carousel input_json must be an object.");
  }

  const input = job.input_json;
  const carouselId = input.carouselId;
  const candidateIndex = input.candidateIndex;

  if (typeof carouselId !== "string" || !carouselId.trim()) {
    throw new Error("generate_carousel requires input.carouselId.");
  }

  if (
    typeof candidateIndex !== "number" ||
    !Number.isInteger(candidateIndex) ||
    candidateIndex < 0
  ) {
    throw new Error("generate_carousel requires a non-negative integer candidateIndex.");
  }

  return {
    candidateIndex,
    carouselId,
    textStyle: input.textStyle,
  };
}

export async function runGenerateCarouselJob(
  job: BackgroundJobRow,
  context: {
    store: SupabaseJobStore;
  },
): Promise<WorkerJobOutput> {
  const input = getInput(job);
  const result = await generateCarousel({
    candidateIndex: input.candidateIndex,
    carouselId: input.carouselId,
    store: context.store,
    textStyle: getCarouselRenderStyle(input.textStyle),
  });

  return {
    carouselId: result.carouselId,
    ok: result.ok,
    renderedSlideCount: result.renderedSlideCount,
    slideUrls: result.slideUrls,
  };
}
