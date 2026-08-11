import type { ScheduleCreateTargetInput } from "./types";

export const SCHEDULE_TARGET_REQUIRED_CODE = "schedule_target_required";
export const SCHEDULE_TARGET_REQUIRED_MESSAGE =
  "Connect and select a publishing account before scheduling.";

export function hasScheduleTargetSelection(input: {
  plannedTargets?: ScheduleCreateTargetInput[];
  targets?: ScheduleCreateTargetInput[];
}) {
  return Boolean(
    (input.targets?.length ?? 0) > 0 ||
      (input.plannedTargets?.length ?? 0) > 0,
  );
}
