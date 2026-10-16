import type { ReferenceText, RemixOutput } from "./reference-text.ts";
import { formatTextOverlays, type ExploreFormatEdit } from "../../worker/src/lib/explore-format-edit.ts";

// Reviewed screen-cut captions, each occupying just the final source frame.
// Keep the original transcription intact; this policy applies only to Hook remix.
const screenCutTails: Record<string, { startMs: number; endMs: number }> = {
  "explore-paired-hook-4585ee949081c4e5cd835cd3": { startMs: 3067, endMs: 3100 },
  "explore-paired-hook-7c53cba88343579e7e15c8b0": { startMs: 3067, endMs: 3100 },
};

export function hookRemixSource(source: ReferenceText): ReferenceText {
  const tail = source.format === "hook" ? screenCutTails[source.referenceId] : null;
  const [opening, ending] = source.blocks;
  if (!tail || source.blocks.length !== 2 || opening.startMs !== 0 || opening.endMs !== tail.startMs ||
    ending.startMs !== tail.startMs || ending.endMs !== tail.endMs) return source;
  return { ...source, blocks: [{ ...opening, endMs: tail.endMs }] };
}

/** Existing paid receipts remain immutable and are reused without regeneration. */
export function hookRemixResult(output: RemixOutput, source: ReferenceText) {
  const next = hookRemixSource(source);
  return next === source || output.blocks.length !== source.blocks.length
    ? { output, source }
    : { output: { ...output, blocks: output.blocks.slice(0, 1) }, source: next };
}

/** Repair only the exact inherited timing signature, keeping custom copy/style. */
export function repairHookRemixEdit(edit: ExploreFormatEdit, referenceId: string | null | undefined): ExploreFormatEdit {
  const tail = referenceId && edit.format === "hook" ? screenCutTails[referenceId] : null;
  const blocks = formatTextOverlays(edit), duration = edit.trimEndMs - edit.trimStartMs;
  const boundary = tail ? Math.round(tail.startMs / tail.endMs * duration) : 0;
  if (!tail || blocks.length !== 2 || blocks[0].startMs !== 0 || blocks[0].endMs !== boundary ||
    blocks[1].startMs !== boundary || blocks[1].endMs !== duration) return edit;
  return { ...edit, text: null, textOverlays: [{ ...blocks[0], endMs: duration }] };
}
