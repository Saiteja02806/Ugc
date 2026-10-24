import { DEFAULT_FORMAT_TEXT_STYLE, formatTextOverlays, parseExploreFormatEdit, type ExploreFormatEdit } from "../../worker/src/lib/explore-format-edit.ts";
import { validateRemixDraft, type ReferenceText, type RemixOutput } from "./reference-text.ts";
import { hookRemixResult, repairHookRemixEdit } from "./hook-remix-source.ts";

/** Applying copy retains existing style; reference timing scales to the trimmed clip. */
export function applyVideoTextRemix(edit: ExploreFormatEdit, output: RemixOutput, source: ReferenceText): ExploreFormatEdit {
  validateRemixDraft(output, source);
  if (source.format !== edit.format) throw new Error("Choose a reference from this workflow.");
  edit = repairHookRemixEdit(edit, source.referenceId);
  ({ output, source } = hookRemixResult(output, source));
  const duration = edit.trimEndMs - edit.trimStartMs;
  const sourceDuration = Math.max(1, ...source.blocks.map(b => b.endMs ?? 1));
  const previous = formatTextOverlays(edit);
  return parseExploreFormatEdit({ ...edit, text: null, textOverlays: output.blocks.map((value, i) => {
    const block = source.blocks[i];
    const startMs = Math.min(duration - 1, Math.round((block.startMs ?? 0) / sourceDuration * duration));
    const endMs = Math.min(duration, Math.max(startMs + 1, Math.round((block.endMs ?? sourceDuration) / sourceDuration * duration)));
    const style = previous[i] ?? { ...(previous[0] ?? { width: .84, y: .18, fontSize: edit.format === "wall_text" ? 36 : 48, ...DEFAULT_FORMAT_TEXT_STYLE }), startMs, endMs };
    return { ...style, value };
  }) });
}
