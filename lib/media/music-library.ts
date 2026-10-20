import type { MediaAsset } from "./types.ts";

export const MUSIC_LIBRARY_MAX_BYTES = 25 * 1024 * 1024;
export const MUSIC_LIBRARY_TYPES = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/mp4", "audio/x-m4a", "audio/ogg", "audio/webm"];
export function isLibraryMusic(asset: MediaAsset) {
  return asset.collection === "audio" && asset.sourceType === "upload" && asset.status === "ready" &&
    MUSIC_LIBRARY_TYPES.includes(asset.mimeType) && asset.url.startsWith("https://") &&
    Number.isFinite(asset.durationSeconds) && (asset.durationSeconds ?? 0) > 0 && (asset.durationSeconds ?? Infinity) <= 600;
}
