import { logger, task } from "@trigger.dev/sdk";
import { z } from "zod";

import { generateCarousel } from "@/lib/carousel/generate-carousel";
import { DEFAULT_CAROUSEL_RENDER_STYLE } from "@/lib/carousel/render-style";

const GenerateCarouselPayloadSchema = z.object({
  carouselId: z.string().min(1),
  candidateCount: z.number().int().min(1).max(50).optional().default(10),
  candidateIndex: z.number().int().min(0).optional().default(0),
  textStyle: z
    .enum(["plain", "highlight", "soft-gradient"])
    .optional()
    .default(DEFAULT_CAROUSEL_RENDER_STYLE),
});

export const generateCarouselTask = task({
  id: "generate-carousel",
  machine: { preset: "medium-1x" },
  maxDuration: 900,
  retry: {
    maxAttempts: 2,
    factor: 1.8,
    minTimeoutInMs: 1_000,
    maxTimeoutInMs: 30_000,
    randomize: true,
  },
  run: async (rawPayload: unknown) => {
    const payload = GenerateCarouselPayloadSchema.parse(rawPayload);

    logger.info("Carousel generation task started", {
      carouselId: payload.carouselId,
      candidateCount: payload.candidateCount,
      candidateIndex: payload.candidateIndex,
      textStyle: payload.textStyle,
    });

    const result = await generateCarousel({
      carouselId: payload.carouselId,
      candidateCount: payload.candidateCount,
      candidateIndex: payload.candidateIndex,
      textStyle: payload.textStyle,
    });

    logger.info("Carousel generation task finished", {
      carouselId: result.carouselId,
      renderedSlideCount: result.renderedSlideCount,
    });

    return result;
  },
});
