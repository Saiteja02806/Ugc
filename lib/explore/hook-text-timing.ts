import { formatTextOverlays, type ExploreFormatEdit } from "../../worker/src/lib/explore-format-edit.ts";

/** Opt-in for the Hook Video opening only. Other hook-shaped editors share the
 * same render contract but retain independent text timing. */
export function fullDurationSingleHookText(edit: ExploreFormatEdit): ExploreFormatEdit {
  const blocks = formatTextOverlays(edit);
  if (edit.format !== "hook" || blocks.length !== 1) return edit;
  const text = blocks[0], duration = edit.trimEndMs - edit.trimStartMs;
  if (text.startMs === 0 && text.endMs === duration) return edit;
  const next = { ...text, startMs: 0, endMs: duration };
  return { ...edit, ...(edit.textOverlays !== undefined ? { textOverlays: [next] } : { text: next }) };
}
