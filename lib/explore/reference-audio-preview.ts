import type { MediaAsset } from "../media/types";

export type ReferenceAudioPreview = { referenceId: string; title: string; audioUrl: string; cleanVideoUrl: string | null; volume: number };

export function getReferenceAudioPreview(asset: MediaAsset | null | undefined): ReferenceAudioPreview | null {
  const raw = asset?.metadata?.referenceAudioPreview;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.referenceId !== "string" || typeof value.title !== "string" || typeof value.audioUrl !== "string" ||
    !(value.cleanVideoUrl === null || typeof value.cleanVideoUrl === "string") || typeof value.volume !== "number" || !Number.isFinite(value.volume) || value.volume < 0 || value.volume > 1) return null;
  return value as ReferenceAudioPreview;
}
