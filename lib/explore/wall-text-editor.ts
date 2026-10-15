import type { ExploreFormatEdit } from "../../worker/src/lib/explore-format-edit";

/** Wall text is visible for the complete selected clip, including after a trim. */
export function fullDurationWallText(editing: ExploreFormatEdit): ExploreFormatEdit {
  if (editing.format !== "wall_text") return editing;
  const durationMs = editing.trimEndMs - editing.trimStartMs;
  const coverClip = <T extends { startMs: number; endMs: number }>(text: T): T =>
    text.startMs === 0 && text.endMs === durationMs ? text : { ...text, startMs: 0, endMs: durationMs };
  return { ...editing, text: editing.text ? coverClip(editing.text) : null,
    ...(editing.textOverlays !== undefined ? { textOverlays: editing.textOverlays.map(coverClip) } : {}) };
}
