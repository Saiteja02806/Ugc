import type { MediaAsset } from "../media/types.ts";
import { formatTextOverlays, parseExploreFormatEdit, type ExploreFormatEdit } from "../../worker/src/lib/explore-format-edit.ts";

/** Caller supplies the authenticated owned-media response, never preview data. */
export function canReuseUnchangedHookSource(source: MediaAsset | null, editing: ExploreFormatEdit, backgroundId: string | null): boolean {
  if (!source || source.status !== "ready" || source.collection !== "video" || source.mimeType !== "video/mp4" || !source.url ||
      source.durationSeconds === null || !Number.isFinite(source.durationSeconds) || backgroundId) return false;
  try {
    const edit = parseExploreFormatEdit(editing);
    return edit.format === "hook" && edit.trimStartMs === 0 && edit.trimEndMs === Math.round(source.durationSeconds * 1000) &&
      edit.originalVolume === 1 && formatTextOverlays(edit).length === 0;
  } catch { return false; }
}
