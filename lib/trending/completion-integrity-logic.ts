export const trendingAssignmentStates = [
  "completed_saved",
  "completed_scheduled",
  "completed_skipped",
  "failed",
  "in_progress",
  "pending",
] as const;

export const acceptableCreatedScheduleStatuses = [
  "scheduling",
  "scheduled",
  "publishing",
  "published",
  "partially_failed",
] as const;

export type TrendingAssignmentState =
  (typeof trendingAssignmentStates)[number];
export type TrendingCompletionAction = "saved" | "scheduled" | "skipped";
export type CreatedScheduleStatus =
  (typeof acceptableCreatedScheduleStatuses)[number];

export type TrendingCompletionTransition =
  | { kind: "complete" }
  | { kind: "conflict"; completedAction: TrendingCompletionAction }
  | { kind: "idempotent" }
  | { kind: "invalid" }
  | { kind: "not_active" };

export function decideTrendingCompletionTransition(params: {
  action: TrendingCompletionAction;
  assignment: {
    completionAction: TrendingCompletionAction | null;
    state: TrendingAssignmentState;
  };
}): TrendingCompletionTransition {
  const expectedState = getCompletedAssignmentState(params.action);

  if (
    params.assignment.state === expectedState &&
    params.assignment.completionAction === params.action
  ) {
    return { kind: "idempotent" };
  }

  const completedAction = getCompletionActionForState(params.assignment.state);

  if (completedAction) {
    if (params.assignment.completionAction !== completedAction) {
      return { kind: "invalid" };
    }

    return {
      completedAction,
      kind: "conflict",
    };
  }

  if (
    (params.assignment.state === "pending" ||
      params.assignment.state === "in_progress") &&
    params.assignment.completionAction === null
  ) {
    return { kind: "complete" };
  }

  if (params.assignment.state === "failed") {
    return { kind: "not_active" };
  }

  return { kind: "invalid" };
}

export function isAcceptableCreatedScheduleStatus(
  status: string,
): status is CreatedScheduleStatus {
  return (acceptableCreatedScheduleStatuses as readonly string[]).includes(
    status,
  );
}

export function isCompletionResultForAction(params: {
  action: TrendingCompletionAction;
  completionAction: string | null;
  state: string;
}) {
  return (
    params.completionAction === params.action &&
    params.state === getCompletedAssignmentState(params.action)
  );
}

export function getCompletedAssignmentState(
  action: TrendingCompletionAction,
): TrendingAssignmentState {
  switch (action) {
    case "saved":
      return "completed_saved";
    case "scheduled":
      return "completed_scheduled";
    case "skipped":
      return "completed_skipped";
  }
}

function getCompletionActionForState(
  state: TrendingAssignmentState,
): TrendingCompletionAction | null {
  switch (state) {
    case "completed_saved":
      return "saved";
    case "completed_scheduled":
      return "scheduled";
    case "completed_skipped":
      return "skipped";
    case "failed":
    case "in_progress":
    case "pending":
      return null;
  }
}
