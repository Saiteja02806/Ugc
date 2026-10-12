import { prepareFormatEditForExport } from "./format-edit-draft.ts";
import { formatTextOverlays, parseExploreFormatEdit, type ExploreFormatEdit } from "../../worker/src/lib/explore-format-edit.ts";
import { demoFramingPosition, parseDemoFraming, type DemoFraming } from "../../worker/src/lib/explore-finishing-contract.ts";
import { planExploreBackgroundAudio } from "../../worker/src/lib/explore-background-audio.ts";
import type { ReferenceAudioPreview } from "./reference-audio-preview.ts";

export type SequencePreviewAudio = {
  url: string; volume: number; playback: "once" | "repeat";
  /** Custom opening music is mixed before source trim; its clock includes that trim offset. */
  timelineOffsetMs?: number; mixDurationMs?: number;
};
/** Edits and framing refer to the supplied original source; omit them for an already prepared clip. */
export type SequencePreviewSegment = {
  id: string; label: string; url: string; durationSeconds: number; width: number; height: number;
  editing?: ExploreFormatEdit; framing?: DemoFraming | null; addedAudio?: SequencePreviewAudio | null;
  /** A Demo's own paired soundtrack, independent of user-added audio and global opening music. */
  referenceAudio?: SequencePreviewAudio | null;
};
export type SequencePreviewEntry = SequencePreviewSegment & {
  startMs: number; durationMs: number; sourceStartMs: number; sourceEndMs: number;
};
export type SequencePreviewTimeline = { entries: SequencePreviewEntry[]; durationMs: number };
const finite = (value: number) => Number.isFinite(value);
export function validateSequencePreviewAudio(audio: SequencePreviewAudio) {
  if (!audio.url || !finite(audio.volume) || audio.volume < 0 || audio.volume > 1 || !["once", "repeat"].includes(audio.playback)) {
    throw new Error("Choose playable preview audio and a valid volume.");
  }
  if (audio.timelineOffsetMs !== undefined && (!finite(audio.timelineOffsetMs) || audio.timelineOffsetMs < 0 || audio.timelineOffsetMs > 240000) ||
      audio.mixDurationMs !== undefined && (!finite(audio.mixDurationMs) || audio.mixDurationMs <= 0 || audio.mixDurationMs > 240000) ||
      audio.mixDurationMs !== undefined && (audio.timelineOffsetMs ?? 0) >= audio.mixDurationMs) {
    throw new Error("Choose a valid preview audio timing range.");
  }
  return audio;
}
export function createSequencePreviewTimeline(segments: readonly SequencePreviewSegment[]): SequencePreviewTimeline {
  if (!segments.length || segments.length > 2) throw new Error("Choose an opening clip and, optionally, a demo to preview.");
  let startMs = 0;
  const ids = new Set<string>();
  const entries = segments.map(segment => {
    if (!segment.id || ids.has(segment.id) || !segment.url || !segment.label || !finite(segment.durationSeconds) ||
        segment.durationSeconds <= 0 || segment.durationSeconds > 120 || !finite(segment.width) || !finite(segment.height) ||
        segment.width < 64 || segment.height < 64 || segment.width > 4096 || segment.height > 4096) {
      throw new Error("This preview needs valid clips, durations, and video dimensions.");
    }
    ids.add(segment.id);
    const editing = segment.editing ? parseExploreFormatEdit(prepareFormatEditForExport(segment.editing)) : undefined;
    const sourceStartMs = editing?.trimStartMs ?? 0, sourceEndMs = editing?.trimEndMs ?? Math.round(segment.durationSeconds * 1000);
    if (sourceEndMs > segment.durationSeconds * 1000 + 50) throw new Error(`Review the trim for ${segment.label.toLowerCase()} before previewing.`);
    const framing = segment.framing ? parseDemoFraming(segment.framing) : undefined;
    const durationMs = sourceEndMs - sourceStartMs;
    if (durationMs <= 0) throw new Error("Choose a nonempty clip to preview.");
    const entry = { ...segment, editing, framing, addedAudio: segment.addedAudio ? validateSequencePreviewAudio(segment.addedAudio) : null,
      referenceAudio: segment.referenceAudio ? validateSequencePreviewAudio(segment.referenceAudio) : null,
      startMs, durationMs, sourceStartMs, sourceEndMs };
    startMs += durationMs;
    return entry;
  });
  return { entries, durationMs: startMs };
}
/** Reflect the actual preparation/join path without burning anything into the raw preview.
 * An unchanged paired Demo retains its baked track. Prepared paired Demos restart
 * their own track after trim, unless the opening's continuous reference replaces it. */
export function mapSequencePreviewDemoReference(segment: SequencePreviewSegment, reference: ReferenceAudioPreview | null, options: {
  openingHasReference: boolean; requiresPreparation: boolean; referenceVolume?: number;
}): SequencePreviewSegment {
  if (!reference) return segment;
  if (!options.openingHasReference && !options.requiresPreparation && !segment.addedAudio) return segment;
  const clean = reference.cleanVideoUrl;
  const editing = segment.editing ? { ...segment.editing, originalVolume: clean ? segment.editing.originalVolume : 0 } : {
    version: 1 as const, format: "hook" as const, trimStartMs: 0, trimEndMs: Math.round(segment.durationSeconds * 1000),
    originalVolume: clean ? 1 : 0, musicVolume: .2, text: null,
  };
  const referenceAudio = options.openingHasReference ? null : validateSequencePreviewAudio({
    url: reference.audioUrl, volume: options.referenceVolume ?? reference.volume, playback: "repeat",
  });
  return { ...segment, url: clean ?? segment.url, editing, referenceAudio };
}
/** Half-open clip intervals: the exact Hook endpoint belongs to the Demo. */
export function sequencePreviewPosition(timeline: SequencePreviewTimeline, timeMs: number) {
  const clamped = Math.min(timeline.durationMs, Math.max(0, finite(timeMs) ? timeMs : 0));
  let index = timeline.entries.findIndex(entry => clamped < entry.startMs + entry.durationMs);
  if (index < 0) index = timeline.entries.length - 1;
  const entry = timeline.entries[index], localMs = clamped - entry.startMs;
  return { index, entry, localMs, sourceMs: entry.sourceStartMs + localMs, timeMs: clamped, ended: clamped >= timeline.durationMs };
}
export function sequencePreviewOverlays(entry: SequencePreviewEntry, localMs: number) {
  if (!entry.editing || localMs < 0 || localMs >= entry.durationMs) return [];
  return formatTextOverlays(entry.editing).filter(text => localMs >= text.startMs && localMs < text.endMs);
}
/** Source and SVG travel together: export applies text before the recorded crop. */
export function sequencePreviewProjection(entry: SequencePreviewEntry, sourceMs: number, outputWidth: number, outputHeight: number) {
  const framing = entry.framing;
  const cropWidth = framing ? Math.floor(entry.width * framing.width / 2) * 2 : entry.width;
  const cropHeight = framing ? Math.floor(entry.height * framing.height / 2) * 2 : entry.height;
  if (![outputWidth, outputHeight].every(value => finite(value) && value > 0) || cropWidth < 64 || cropHeight < 64 ||
      framing && Math.abs((entry.width * framing.width) / (entry.height * framing.height) / (outputWidth / outputHeight) - 1) > .015) {
    throw new Error("Review the recorded crop so it matches the opening video.");
  }
  const point = framing ? demoFramingPosition(framing, sourceMs) : { x: 0, y: 0 };
  const scale = Math.min(outputWidth / cropWidth, outputHeight / cropHeight);
  return {
    width: entry.width * scale / outputWidth * 100, height: entry.height * scale / outputHeight * 100,
    left: ((outputWidth - cropWidth * scale) / 2 - point.x * entry.width * scale) / outputWidth * 100,
    top: ((outputHeight - cropHeight * scale) / 2 - point.y * entry.height * scale) / outputHeight * 100,
  };
}
/** The same once/repeat and 200ms edge fades as the worker's final mix. */
export function sequencePreviewAudioPosition(sourceDurationMs: number, targetDurationMs: number, elapsedMs: number, playback: "once" | "repeat") {
  const timing = planExploreBackgroundAudio(sourceDurationMs, targetDurationMs, playback);
  const elapsed = Math.max(0, elapsedMs), audible = elapsed < timing.audibleDurationMs;
  const fade = timing.fadeDurationMs;
  const gain = audible ? Math.max(0, Math.min(1, elapsed / fade, (timing.audibleDurationMs - elapsed) / fade)) : 0;
  return { audible, positionMs: timing.repeat ? elapsed % sourceDurationMs : Math.min(elapsed, sourceDurationMs), gain };
}
