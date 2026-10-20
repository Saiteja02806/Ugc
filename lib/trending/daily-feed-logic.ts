export type TrendingDailyFeedState =
  | "caught_up"
  | "exhausted"
  | "preparing"
  | "ready";

export async function getOrCreatePersistedDailyFeed<Row>(params: {
  create: () => Promise<Row>;
  findExisting: () => Promise<Row | null>;
}) {
  const existing = await params.findExisting();

  if (existing) {
    return existing;
  }

  return params.create();
}

export function getDailyFeedTopUpPlan(params: {
  dailyLimit: number;
  existingPositions: readonly number[];
}) {
  const dailyLimit = Math.max(Math.trunc(params.dailyLimit), 0);
  const occupiedPositions = new Set(
    params.existingPositions.filter(
      (position) =>
        Number.isInteger(position) && position >= 1 && position <= dailyLimit,
    ),
  );
  const availablePositions = Array.from(
    { length: dailyLimit },
    (_, index) => index + 1,
  ).filter((position) => !occupiedPositions.has(position));

  return {
    availablePositions,
    remainingSlotCount: availablePositions.length,
  };
}

export function partitionRuntimeSafeAssignments<Assignment>(params: {
  assignments: readonly Assignment[];
  getCarouselId: (assignment: Assignment) => string;
  runtimeSafeCarouselIds: ReadonlySet<string>;
}) {
  const valid: Assignment[] = [];
  const invalid: Assignment[] = [];

  for (const assignment of params.assignments) {
    if (params.runtimeSafeCarouselIds.has(params.getCarouselId(assignment))) {
      valid.push(assignment);
    } else {
      invalid.push(assignment);
    }
  }

  return { invalid, valid };
}

export type StructuredDailyFeedAssignment<Value> = {
  structureId: "structure_1" | "structure_2";
  value: Value;
};

/**
 * Keeps a mixed slideshow feed pinned to the structure selected for each
 * position. A successful product-story card must never consume a helpful-tip
 * position simply because its sibling generation failed.
 */
export function bindDailyFeedAssignmentsToStructures<Value>(params: {
  availablePositions: readonly number[];
  fresh: readonly StructuredDailyFeedAssignment<Value>[];
  recovered: readonly (StructuredDailyFeedAssignment<Value> | null)[];
  requestedStructureIds: readonly ("structure_1" | "structure_2")[];
}) {
  if (
    params.availablePositions.length !== params.requestedStructureIds.length ||
    params.recovered.length !== params.requestedStructureIds.length
  ) {
    throw new Error("Daily feed structure binding must cover every open position.");
  }

  const freshByStructure = new Map<
    "structure_1" | "structure_2",
    StructuredDailyFeedAssignment<Value>[]
  >([
    ["structure_1", []],
    ["structure_2", []],
  ]);

  for (const assignment of params.fresh) {
    freshByStructure.get(assignment.structureId)?.push(assignment);
  }

  return params.requestedStructureIds.flatMap((structureId, index) => {
    const recovered = params.recovered[index];
    const selected = recovered?.structureId === structureId
      ? recovered
      : freshByStructure.get(structureId)?.shift() ?? null;
    const position = params.availablePositions[index];

    return selected && position !== undefined
      ? [{ position, value: selected.value }]
      : [];
  });
}

export function getTrendingDailyFeedState(params: {
  activeCarouselCount: number;
  completedAssignmentCount: number;
  hasProcessingCandidates: boolean;
  pendingSlotCount: number;
}): TrendingDailyFeedState {
  if (params.pendingSlotCount > 0 && params.hasProcessingCandidates) {
    return "preparing";
  }

  if (params.activeCarouselCount > 0) {
    return "ready";
  }

  if (params.completedAssignmentCount > 0) {
    return "caught_up";
  }

  return "exhausted";
}
