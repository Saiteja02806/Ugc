import type { BackgroundJobRow } from "../types.js";
import {
  CAROUSEL_CONTENT_PLAN_CHUNK_SIZE,
  createCarouselContentPlanSeedFingerprint,
  generateCarouselContentPlanChunk,
  getCarouselContentPlanDayPosition,
} from "../lib/carousel-content-plan.js";
import type { WorkerJobContext, WorkerJobOutput } from "./index.js";

type ContentPlanJobInput = {
  operation: "carousel_content_plan_generation";
  planId: string;
  userId: string;
};

export async function runGenerateCarouselContentPlanJob(
  job: BackgroundJobRow,
  context: WorkerJobContext,
): Promise<WorkerJobOutput> {
  const input = parseInput(job);
  const plan = await context.store.getCarouselContentPlan({
    jobId: job.id,
    planId: input.planId,
    userId: input.userId,
  });

  if (!plan) {
    throw new Error("Carousel content plan was not found for this job.");
  }

  if (plan.status === "active") {
    const existingItems = await context.store.listCarouselContentPlanItems({
      planId: plan.id,
      userId: plan.user_id,
    });
    return { itemCount: existingItems.length, ok: true, planId: plan.id };
  }

  if (plan.status !== "generating") {
    throw new Error(`Carousel content plan cannot run from status ${plan.status}.`);
  }

  try {
    let items = await context.store.listCarouselContentPlanItems({
      planId: plan.id,
      userId: plan.user_id,
    });

    assertContiguousItems(items.map((item) => item.sequence_index));

    while (items.length < plan.target_item_count) {
      const count = Math.min(
        CAROUSEL_CONTENT_PLAN_CHUNK_SIZE,
        plan.target_item_count - items.length,
      );
      const generated = await generateCarouselContentPlanChunk({
        businessDescription: plan.business_description,
        count,
        existingItems: items,
      });
      const sequenceStart = items.length + 1;
      const inserted = await context.store.insertCarouselContentPlanItems(
        generated.map((item) => {
          const sequenceIndex = sequenceStart + item.slotIndex;
          const position = getCarouselContentPlanDayPosition(sequenceIndex);

          return {
            creative_seed: item.creativeSeed,
            day_number: position.dayNumber,
            day_slot_index: position.daySlotIndex,
            emotion: item.emotion,
            plan_id: plan.id,
            seed_fingerprint: createCarouselContentPlanSeedFingerprint(
              item.creativeSeed,
            ),
            sequence_index: sequenceIndex,
            status: "planned" as const,
            user_id: plan.user_id,
          };
        }),
      );

      if (inserted.length !== count) {
        throw new Error("Carousel content-plan chunk persistence was incomplete.");
      }

      items = [...items, ...inserted].sort(
        (left, right) => left.sequence_index - right.sequence_index,
      );

      await context.checkpoint({
        progress: Math.min(
          95,
          Math.round((items.length / plan.target_item_count) * 90),
        ),
        stage: "generating_content_plan",
        status: "waiting_external_service",
      });
    }

    const activated = await context.store.completeCarouselContentPlanGeneration({
      jobId: job.id,
      planId: plan.id,
      userId: plan.user_id,
    });

    return {
      itemCount: items.length,
      ok: true,
      planId: activated.id,
      status: activated.status,
    };
  } catch (error) {
    if (job.attempt_count >= job.max_attempts) {
      await context.store.failCarouselContentPlanGeneration({
        errorMessage: getErrorMessage(error),
        jobId: job.id,
        planId: plan.id,
        userId: plan.user_id,
      });
    }

    throw error;
  }
}

function parseInput(job: BackgroundJobRow): ContentPlanJobInput {
  const value = job.input_json;

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Carousel content-plan job input must be an object.");
  }

  if (
    value.operation !== "carousel_content_plan_generation" ||
    typeof value.planId !== "string" ||
    !value.planId.trim() ||
    typeof value.userId !== "string" ||
    !value.userId.trim() ||
    value.userId !== job.user_id
  ) {
    throw new Error("Carousel content-plan job input is invalid.");
  }

  return {
    operation: value.operation,
    planId: value.planId,
    userId: value.userId,
  };
}

function assertContiguousItems(sequenceIndexes: number[]) {
  for (const [index, sequenceIndex] of sequenceIndexes.entries()) {
    if (sequenceIndex !== index + 1) {
      throw new Error("Carousel content-plan items are not contiguous.");
    }
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message.slice(0, 1_000)
    : "Carousel content-plan generation failed.";
}
