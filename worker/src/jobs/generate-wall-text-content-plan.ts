import type { BackgroundJobRow } from "../types.js";
import {
  WALL_TEXT_CONTENT_PLAN_CHUNK_SIZE,
  createWallTextContentIdeaFingerprint,
  createWallTextCreativeBriefFingerprint,
  generateWallTextContentPlanChunk,
} from "../lib/wall-text-content-plan.js";
import type { WorkerJobContext, WorkerJobOutput } from "./index.js";

type ContentPlanJobInput = {
  operation: "wall_text_content_plan_generation";
  planId: string;
  userId: string;
};

export async function runGenerateWallTextContentPlanJob(
  job: BackgroundJobRow,
  context: WorkerJobContext,
): Promise<WorkerJobOutput> {
  const input = parseInput(job);
  const plan = await context.store.getWallTextContentPlan({
    jobId: job.id,
    planId: input.planId,
    userId: input.userId,
  });

  if (!plan) throw new Error("Wall-of-Text content plan was not found for this job.");

  if (plan.status === "active") {
    const existingItems = await context.store.listWallTextContentPlanItems({
      planId: plan.id,
      userId: plan.user_id,
    });
    return { itemCount: existingItems.length, ok: true, planId: plan.id };
  }
  if (plan.status !== "generating") {
    throw new Error(`Wall-of-Text content plan cannot run from status ${plan.status}.`);
  }

  try {
    let items = await context.store.listWallTextContentPlanItems({
      planId: plan.id,
      userId: plan.user_id,
    });
    const priorCycleItems = await context.store.listPriorWallTextContentPlanItems({
      businessProfileId: plan.business_profile_id,
      businessProfileVersion: plan.business_profile_version,
      periodStartDate: plan.period_start_date,
      userId: plan.user_id,
    });
    assertContiguousItems(items.map((item) => item.sequence_index));
    if (items.length % 5 !== 0) {
      throw new Error("Wall-of-Text plan items are not grouped into complete creative briefs.");
    }

    while (items.length < plan.target_item_count) {
      const count = Math.min(
        WALL_TEXT_CONTENT_PLAN_CHUNK_SIZE,
        plan.target_item_count - items.length,
      );
      const generated = await generateWallTextContentPlanChunk({
        businessDescription: plan.business_description,
        briefIndexStart: items.length / 5 + 1,
        count,
        existingItems: [...priorCycleItems, ...items],
        planningContext: plan.planning_context,
      });
      const sequenceStart = items.length + 1;
      const briefIndexStart = items.length / 5 + 1;
      const inserted = await context.store.persistWallTextContentPlanBriefChunk({
        briefs: generated.briefs.map((brief) => ({
          audience_context: brief.audienceContext,
          brief_fingerprint: createWallTextCreativeBriefFingerprint(brief),
          brief_index: briefIndexStart + brief.briefSlotIndex,
          creative_seed: brief.creativeSeed,
          emotional_tension: brief.emotionalTension,
          human_moment: brief.humanMoment,
          // The existing database column is retained for legacy plans only.
          // New freeform plans do not send this value to the Wall writer.
          preferred_format_family: "freeform",
          supported_angle: brief.supportedAngle,
        })),
        items: generated.items.map((item) => ({
          brief_index: briefIndexStart + item.briefSlotIndex,
          content_idea: item.contentIdea,
          feeling: item.feeling,
          idea_fingerprint: createWallTextContentIdeaFingerprint(item.contentIdea),
          private_context: item.planningBrief,
          sequence_index:
            sequenceStart +
            item.briefSlotIndex * 5 +
            item.itemSlotIndex,
        })),
        planId: plan.id,
        userId: plan.user_id,
      });

      if (inserted.length !== count) {
        throw new Error("Wall-of-Text content-plan chunk persistence was incomplete.");
      }
      items = [...items, ...inserted].sort(
        (left, right) => left.sequence_index - right.sequence_index,
      );

      await context.checkpoint({
        progress: Math.min(
          95,
          Math.round((items.length / plan.target_item_count) * 90),
        ),
        stage: "generating_wall_text_content_plan",
        status: "waiting_external_service",
      });
    }

    const activated = await context.store.completeWallTextContentPlanGeneration({
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
    throw error;
  }
}

function parseInput(job: BackgroundJobRow): ContentPlanJobInput {
  const value = job.input_json;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Wall-of-Text content-plan job input must be an object.");
  }
  if (
    value.operation !== "wall_text_content_plan_generation" ||
    typeof value.planId !== "string" ||
    !value.planId.trim() ||
    typeof value.userId !== "string" ||
    !value.userId.trim() ||
    value.userId !== job.user_id
  ) {
    throw new Error("Wall-of-Text content-plan job input is invalid.");
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
      throw new Error("Wall-of-Text content-plan items are not contiguous.");
    }
  }
}
