import type { SupabaseJobStore } from "../lib/supabase.js";
import {
  generateCarousel,
  generateCarouselBatch,
} from "../lib/carousel-generate.js";
import { getCarouselRenderStyle } from "../lib/carousel-render-style.js";
import type { BackgroundJobRow, Json } from "../types.js";
import type { WorkerJobOutput } from "./index.js";

type GenerateCarouselInput = {
  candidateIndex?: number;
  carouselId?: string;
  carouselIds?: string[];
  experimentBatchId?: string;
  textStyle: Json | undefined;
};

function getInput(job: BackgroundJobRow): GenerateCarouselInput {
  if (!job.input_json || typeof job.input_json !== "object" || Array.isArray(job.input_json)) {
    throw new Error("generate_carousel input_json must be an object.");
  }

  const input = job.input_json;
  const carouselId = input.carouselId;
  const carouselIds = input.carouselIds;
  const experimentBatchId = input.experimentBatchId;
  const candidateIndex = input.candidateIndex;

  if (Array.isArray(carouselIds) || experimentBatchId !== undefined) {
    if (
      !Array.isArray(carouselIds) ||
      carouselIds.length !== 5 ||
      carouselIds.some((id) => typeof id !== "string" || !id.trim()) ||
      new Set(carouselIds).size !== 5 ||
      typeof experimentBatchId !== "string" ||
      !experimentBatchId.trim()
    ) {
      throw new Error(
        "generate_carousel batch input requires five unique carouselIds and experimentBatchId.",
      );
    }

    return {
      carouselIds: carouselIds as string[],
      experimentBatchId,
      textStyle: input.textStyle,
    };
  }

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
  if (input.carouselIds && input.experimentBatchId) {
    try {
      return await generateCarouselBatch({
        carouselIds: input.carouselIds,
        experimentBatchId: input.experimentBatchId,
        store: context.store,
        textStyle: getCarouselRenderStyle(input.textStyle),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Carousel batch generation failed.";
      const generations = await Promise.all(
        input.carouselIds.map((carouselId) =>
          context.store.getCarouselGeneration(carouselId),
        ),
      );
      await Promise.all(
        generations.flatMap((generation) =>
          generation?.status === "processing"
            ? [
                context.store.updateCarouselGeneration(generation.id, {
                  error_message: message.slice(0, 900),
                  status: "failed",
                }),
              ]
            : [],
        ),
      );
      const completedCount = generations.filter(
        (generation) => generation?.status === "completed",
      ).length;
      await context.store.updateCarouselExperimentBatch(
        input.experimentBatchId,
        { status: completedCount > 0 ? "partial" : "failed" },
      );
      throw error;
    }
  }

  const result = await generateCarousel({
    candidateIndex: input.candidateIndex!,
    carouselId: input.carouselId!,
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
