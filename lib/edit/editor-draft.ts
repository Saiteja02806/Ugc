import type { EditableVideoDraftInput } from "./video-library";

const FULL_DURATION_TRIM_EPSILON_SECONDS = 0.05;

export function normalizeEditableVideoDraftForDuration(
  draft: EditableVideoDraftInput,
  durationSeconds: number | null | undefined,
): EditableVideoDraftInput {
  const duration =
    typeof durationSeconds === "number" && Number.isFinite(durationSeconds)
      ? durationSeconds
      : null;
  const trimEnd = draft.trimEndSeconds;
  const reachesFullDuration =
    trimEnd !== null &&
    duration !== null &&
    duration > 0 &&
    Math.abs(trimEnd - duration) <= FULL_DURATION_TRIM_EPSILON_SECONDS;

  return {
    ...draft,
    trimEndSeconds: reachesFullDuration ? null : trimEnd,
  };
}
