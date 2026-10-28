import { formatTextLayout, parseExploreFormatEdit, type ExploreFormatEdit, type ExploreFormatText } from "./explore-format-edit.ts";

/** A reviewed layout is frozen with a new request. Nothing here edits a saved draft. */
export type WallTimedLayout = {
  version: 1;
  referenceId: string;
  sourceSha256: string;
  sourceDurationMs: number;
  blocks: { startMs: number; endMs: number; y: number; width: number; fontSize: number; lineHeight: number; outlineWidth: number }[];
};

/** Builds an initial, editable suggestion; proportional timing does not prove shot alignment. */
export function buildTimedWallEdit(layout: WallTimedLayout, source: { referenceId: string; sourceSha256: string; blocks: { startMs: number | null; endMs: number | null }[] }, values: string[], durationMs: number): ExploreFormatEdit {
  if (layout.version !== 1 || layout.referenceId !== source.referenceId || layout.sourceSha256 !== source.sourceSha256 ||
      !Number.isSafeInteger(layout.sourceDurationMs) || layout.sourceDurationMs < 1000 ||
      !Number.isSafeInteger(durationMs) || durationMs < 1000 || durationMs > 120000 ||
      layout.blocks.length < 1 || layout.blocks.length > 20 || layout.blocks.length !== source.blocks.length || values.length !== source.blocks.length) {
    throw new Error("Review the timed Wall layout and source.");
  }
  let previousEnd = 0;
  const overlays = layout.blocks.map((block, index): ExploreFormatText => {
    const original = source.blocks[index];
    if (!Number.isSafeInteger(block.startMs) || !Number.isSafeInteger(block.endMs) || block.startMs < previousEnd ||
        block.endMs <= block.startMs || block.endMs > layout.sourceDurationMs ||
        original.startMs !== block.startMs || original.endMs !== block.endMs || typeof values[index] !== "string" || !values[index].trim()) {
      throw new Error("Review the timed Wall caption order and timing.");
    }
    previousEnd = block.endMs;
    const startMs = Math.round(block.startMs / layout.sourceDurationMs * durationMs);
    const endMs = Math.round(block.endMs / layout.sourceDurationMs * durationMs);
    if (endMs <= startMs) throw new Error("Review the timed Wall caption duration.");
    const text: ExploreFormatText = { value: values[index], width: block.width, y: block.y, fontSize: block.fontSize,
      lineHeight: block.lineHeight, outlineWidth: block.outlineWidth, color: "#ffffff", font: "proximanovaa", fontWeight: 600, startMs, endMs };
    const measured = formatTextLayout(text, 1080, 1920);
    if (!measured.fits || measured.y + measured.lines.length * measured.lineHeight > 1920 * .94) throw new Error("Review the timed Wall caption fit.");
    return text;
  });
  return parseExploreFormatEdit({ version: 1, format: "wall_text", trimStartMs: 0, trimEndMs: durationMs, originalVolume: 1, musicVolume: .2, text: null, textOverlays: overlays });
}
