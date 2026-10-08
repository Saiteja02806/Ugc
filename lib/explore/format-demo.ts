import { demoFramingPosition, isExploreUuid, parseDemoFraming, type DemoFraming } from "../../worker/src/lib/explore-finishing-contract.ts";
import { parseExploreFormatEdit, type ExploreFormatEdit } from "../../worker/src/lib/explore-format-edit.ts";

export type FormatDemoDraft = { version: 1; demoId: string | null; audioId: string | null; editing: ExploreFormatEdit; framing: DemoFraming | null; playback: "once" | "repeat"; backgroundMusic?: boolean };
export function defaultDemoEdit(duration: number): ExploreFormatEdit {
  return { version: 1, format: "hook", trimStartMs: 0, trimEndMs: Math.round(duration * 1000), originalVolume: 1, musicVolume: .2, text: null };
}
export function readFormatDemoDraft(raw: string | null): FormatDemoDraft | null {
  if (!raw || raw.length > 32768) return null;
  try {
    const value = JSON.parse(raw) as FormatDemoDraft;
    const editing = parseExploreFormatEdit(value.editing);
    if (value.version !== 1 || editing.format !== "hook" || value.demoId !== null && !isExploreUuid(value.demoId) || value.audioId !== null && !isExploreUuid(value.audioId) || !["once", "repeat"].includes(value.playback) || value.backgroundMusic !== undefined && typeof value.backgroundMusic !== "boolean") return null;
    return { version: 1, demoId: value.demoId, audioId: value.audioId, editing, framing: value.framing ? parseDemoFraming(value.framing) : null, playback: value.playback, ...(value.backgroundMusic !== undefined ? { backgroundMusic: value.backgroundMusic } : {}) };
  } catch { return null; }
}
/** Framing was recorded against the original demo. Rebase it after trimming,
 * interpolating both ends so recorded holds/pans match the selected segment. */
export function trimmedDemoFraming(framing: DemoFraming | null, editing: ExploreFormatEdit): DemoFraming | null {
  if (!framing) return null;
  const { trimStartMs: start, trimEndMs: end } = parseExploreFormatEdit(editing);
  const first = demoFramingPosition(framing, start), last = demoFramingPosition(framing, end);
  return parseDemoFraming({ version: 1, width: framing.width, height: framing.height, points: [[0, first.x, first.y], ...framing.points.filter(point => point[0] > start && point[0] < end).map(([time, x, y]) => [time - start, x, y]), [end - start, last.x, last.y]] });
}
