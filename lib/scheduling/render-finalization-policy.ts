import type { ScheduledPost } from "./types.ts";

export type RenderFinalizationDecision =
  | {
      action: "already_finalized";
    }
  | {
      action: "finalize";
    }
  | {
      action: "reject";
      code:
        | "combined_render_not_ready"
        | "schedule_not_editable"
        | "schedule_targets_already_exist"
        | "stale_combined_render";
      message: string;
    }
  | {
      action: "skip";
    };

export function getRenderFinalizationDecision(params: {
  hasPlannedTime: boolean;
  renderId: string;
  schedule: ScheduledPost;
}): RenderFinalizationDecision {
  const { schedule } = params;
  const currentRenderId = getMetadataString(
    schedule.metadata.combinedRenderId,
  );

  if (currentRenderId !== params.renderId) {
    return {
      action: "reject",
      code: "stale_combined_render",
      message: "This render is no longer the current version for the schedule.",
    };
  }

  if (
    getMetadataString(schedule.metadata.combinedRenderStatus) !== "ready" ||
    !getMetadataString(schedule.metadata.combinedMediaAssetId)
  ) {
    return {
      action: "reject",
      code: "combined_render_not_ready",
      message: "The combined render is not ready for final scheduling.",
    };
  }

  if (canRetrySchedulerCreateFailure(schedule)) {
    return { action: "finalize" };
  }

  if (
    schedule.targets.length > 0 &&
    ["scheduled", "scheduling", "publishing", "published"].includes(
      schedule.status,
    )
  ) {
    return { action: "already_finalized" };
  }

  if (schedule.targets.length > 0) {
    return {
      action: "reject",
      code: "schedule_targets_already_exist",
      message:
        "This schedule already has publishing targets. Create a new draft to retry.",
    };
  }

  if (
    schedule.status === "cancelled" ||
    schedule.status === "publishing" ||
    schedule.status === "published"
  ) {
    return {
      action: "reject",
      code: "schedule_not_editable",
      message: "This schedule cannot be changed now.",
    };
  }

  const hasPlannedConnections = Boolean(
    getMetadataString(schedule.metadata.plannedConnectionIds),
  );

  if (!hasPlannedConnections || !params.hasPlannedTime) {
    return { action: "skip" };
  }

  return { action: "finalize" };
}

export function canRetrySchedulerCreateFailure(schedule: ScheduledPost) {
  return (
    schedule.status === "failed" &&
    schedule.targets.length > 0 &&
    schedule.targets.every(
      (target) =>
        target.status === "failed" &&
        target.lastErrorCode === "scheduler_create_failed",
    )
  );
}

function getMetadataString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
