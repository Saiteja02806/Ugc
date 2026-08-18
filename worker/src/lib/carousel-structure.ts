export const CAROUSEL_STRUCTURE_IDS = [
  "structure_1",
  "structure_2",
] as const;

export const CAROUSEL_STRUCTURE_MODES = [
  "rotate",
  "structure_1_only",
  "structure_2_only",
] as const;

export const CAROUSEL_STRUCTURE_SELECTION_MODES = [
  "legacy_default",
  "rotation",
  "global_override",
] as const;

export type CarouselStructureId =
  (typeof CAROUSEL_STRUCTURE_IDS)[number];
export type CarouselStructureMode =
  (typeof CAROUSEL_STRUCTURE_MODES)[number];
export type CarouselStructureSelectionMode =
  (typeof CAROUSEL_STRUCTURE_SELECTION_MODES)[number];

export type CarouselStructureAssignment = {
  structureId: CarouselStructureId;
  structureRotationSequence: number | null;
  structureSelectionMode: CarouselStructureSelectionMode;
};

export const SAFE_CAROUSEL_STRUCTURE_FOUNDATION_DEFAULT =
  "structure_1" satisfies CarouselStructureId;
export const SAFE_CAROUSEL_STRUCTURE_MODE_FOUNDATION_DEFAULT =
  "structure_1_only" satisfies CarouselStructureMode;

// Each ready structure has an isolated batch selector, planner, renderer, and
// persistence path. Single-carousel entry points still reject Structure 2 so
// it cannot fall through to the Structure 1 planner.
export const CAROUSEL_RUNTIME_READY_STRUCTURE_IDS = [
  "structure_1",
  "structure_2",
] as const;
export const CAROUSEL_STRUCTURE_RUNTIME_NOT_READY_ERROR =
  "carousel_structure_runtime_not_ready";

export function isCarouselStructureId(
  value: unknown,
): value is CarouselStructureId {
  return CAROUSEL_STRUCTURE_IDS.some((candidate) => candidate === value);
}

export function isCarouselStructureMode(
  value: unknown,
): value is CarouselStructureMode {
  return CAROUSEL_STRUCTURE_MODES.some((candidate) => candidate === value);
}

export function isCarouselStructureSelectionMode(
  value: unknown,
): value is CarouselStructureSelectionMode {
  return CAROUSEL_STRUCTURE_SELECTION_MODES.some(
    (candidate) => candidate === value,
  );
}

export function isCarouselStructureRuntimeReady(
  structureId: CarouselStructureId,
) {
  return CAROUSEL_RUNTIME_READY_STRUCTURE_IDS.some(
    (candidate) => candidate === structureId,
  );
}

export function assertCarouselStructureRuntimeReady(
  structureId: CarouselStructureId,
) {
  if (!isCarouselStructureRuntimeReady(structureId)) {
    throw new Error(`${CAROUSEL_STRUCTURE_RUNTIME_NOT_READY_ERROR}:${structureId}`);
  }
}

export function selectCarouselStructureAssignment(params: {
  structureMode: CarouselStructureMode;
  structureRotationSequence: number;
}): CarouselStructureAssignment {
  if (
    !Number.isSafeInteger(params.structureRotationSequence) ||
    params.structureRotationSequence < 0
  ) {
    throw new Error("carousel_structure_rotation_sequence_invalid");
  }

  if (params.structureMode === "structure_1_only") {
    return {
      structureId: "structure_1",
      structureRotationSequence: null,
      structureSelectionMode: "global_override",
    };
  }

  if (params.structureMode === "structure_2_only") {
    return {
      structureId: "structure_2",
      structureRotationSequence: null,
      structureSelectionMode: "global_override",
    };
  }

  return {
    structureId:
      params.structureRotationSequence % 2 === 0
        ? "structure_1"
        : "structure_2",
    structureRotationSequence: params.structureRotationSequence,
    structureSelectionMode: "rotation",
  };
}
