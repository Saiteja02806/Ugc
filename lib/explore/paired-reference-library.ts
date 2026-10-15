import "server-only";
import { buildPublicStorageUrl } from "@/lib/storage/storage";
import { getExplorePairedReferences } from "@/worker/src/lib/explore-reference-soundtrack";
import type { ExploreVideoReference } from "./hook-video-types";

export function getPairedExploreVideos(format: "hook" | "wall_text"): ExploreVideoReference[] {
  return getExplorePairedReferences(format).map(item => ({ id: item.id, videoUrl: buildPublicStorageUrl(item.videoStorageKey), posterUrl: buildPublicStorageUrl(item.posterStorageKey),
    durationSeconds: item.durationSeconds, ...("instagramUrl" in item && typeof item.instagramUrl === "string" ? { instagramUrl: item.instagramUrl } : {}),
    ...("sourceUrl" in item && typeof item.sourceUrl === "string" ? { sourceUrl: item.sourceUrl } : {}),
    ...("sourcePlatform" in item && (item.sourcePlatform === "instagram" || item.sourcePlatform === "tiktok") ? { sourcePlatform: item.sourcePlatform } : {}),
    ...("previewStorageKey" in item && typeof item.previewStorageKey === "string" ? { previewVideoUrl: buildPublicStorageUrl(item.previewStorageKey) } : {}),
    pairedAudio: { title: item.audioTitle, url: buildPublicStorageUrl(item.audioStorageKey), durationSeconds: item.audioDurationSeconds } }));
}
