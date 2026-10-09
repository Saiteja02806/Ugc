"use client";

import { FormatTextOverlaysEditor } from "@/components/explore/format-text-overlays-editor";
import { formatTextOverlays, type ExploreFormatEdit } from "@/worker/src/lib/explore-format-edit";

/** Shared clip controls always show a first blank box; only authored text exports. */
export function FormatVideoTextFields({ editing, onChange, timeMs = 0, onSeek }: {
  editing: ExploreFormatEdit; onChange: (next: ExploreFormatEdit) => void; timeMs?: number; onSeek?: (timeMs: number) => void;
}) {
  return <FormatTextOverlaysEditor overlays={formatTextOverlays(editing)} durationMs={editing.trimEndMs - editing.trimStartMs}
    wallText={editing.format === "wall_text"} timeMs={timeMs} onSeek={onSeek ?? (() => {})}
    onChange={textOverlays => onChange({ ...editing, text: null, textOverlays })} />;
}

export function trimFormatVideoEdit(editing: ExploreFormatEdit, startMs: number, endMs: number): ExploreFormatEdit {
  const length = endMs - startMs;
  const trimText = (text: NonNullable<ExploreFormatEdit["text"]>) => ({ ...text, startMs: Math.min(text.startMs, Math.max(0, length - 1)), endMs: Math.min(text.endMs, length) });
  return { ...editing, trimStartMs: startMs, trimEndMs: endMs,
    ...(editing.textOverlays !== undefined ? { text: null, textOverlays: editing.textOverlays.map(trimText) } : { text: editing.text ? trimText(editing.text) : null }) };
}
