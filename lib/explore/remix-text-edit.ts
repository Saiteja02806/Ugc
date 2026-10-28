import { DEFAULT_FORMAT_TEXT_STYLE, formatTextOverlays, parseExploreFormatEdit, type ExploreFormatEdit } from "../../worker/src/lib/explore-format-edit.ts";
import { validateRemixDraft, type ReferenceText, type RemixOutput } from "./reference-text.ts";
import { hookRemixResult, repairHookRemixEdit } from "./hook-remix-source.ts";
import { fitInitialHookText } from "../../worker/src/lib/hook-initial-text-layout.ts";
import { initialWallText, wallTextProfile } from "../../worker/src/lib/wall-initial-text-layout.ts";

/** Applying copy retains existing style; reference timing scales to the trimmed clip. */
export function applyVideoTextRemix(edit: ExploreFormatEdit, output: RemixOutput, source: ReferenceText, dimensions = { width: 1080, height: 1920 }): ExploreFormatEdit {
  validateRemixDraft(output, source);
  if (source.format !== edit.format) throw new Error("Choose a reference from this workflow.");
  edit = repairHookRemixEdit(edit, source.referenceId);
  ({ output, source } = hookRemixResult(output, source));
  const duration = edit.trimEndMs - edit.trimStartMs;
  const sourceDuration = Math.max(1, ...source.blocks.map(b => b.endMs ?? 1));
  const previous = formatTextOverlays(edit);
  // The measured layout is an initial suggestion only. Existing styles and
  // multi-region sources continue to follow their established editor path.
  const wallProfile = !previous.length && edit.format === "wall_text" && output.blocks.length === 1
    ? wallTextProfile(source.referenceId, source.sourceSha256) : null;
  if (wallProfile && !wallProfile.structure) {
    const text = initialWallText(output.blocks[0], wallProfile, duration, dimensions.width, dimensions.height);
    // A source caption may begin after the first frame. Preserve the existing
    // proportional timing rule instead of making it visible from time zero.
    text.startMs = Math.min(duration - 1, Math.round((source.blocks[0].startMs ?? 0) / sourceDuration * duration));
    return parseExploreFormatEdit({ ...edit, text: null, textOverlays: [text] });
  }
  return parseExploreFormatEdit({ ...edit, text: null, textOverlays: output.blocks.map((value, i) => {
    const block = source.blocks[i];
    const startMs = Math.min(duration - 1, Math.round((block.startMs ?? 0) / sourceDuration * duration));
    const endMs = Math.min(duration, Math.max(startMs + 1, Math.round((block.endMs ?? sourceDuration) / sourceDuration * duration)));
    const style = previous[i] ?? { ...(previous[0] ?? { width: .84, y: .18, fontSize: edit.format === "wall_text" ? 36 : 48, ...DEFAULT_FORMAT_TEXT_STYLE }), startMs, endMs };
    const next = { ...style, value };
    return !previous.length && edit.format === "hook" ? fitInitialHookText(next, dimensions.width, dimensions.height) : next;
  }) });
}
