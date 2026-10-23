import release from "./explore-hook-reference-release.json" with { type: "json" };
import additions from "./explore-hook-reference-addition-release.json" with { type: "json" };
import newBatch from "./explore-hook-reference-new-batch-release.json" with { type: "json" };
import octoberBatch from "./explore-hook-reference-oct23-release.json" with { type: "json" };
import octoberRefresh from "./explore-hook-reference-oct23-refresh-release.json" with { type: "json" };
import type { HookSourcePlatform } from "./explore-instagram-source.ts";

export type HookReferenceReleaseItem = {
  id: string;
  format: "hook";
  title: string;
  /** Present for the original, Instagram-only release. */
  instagramUrl?: string;
  /** Optional verified source post for later mixed-platform releases. */
  sourceUrl?: string;
  sourcePlatform?: HookSourcePlatform;
  videoStorageKey: string;
  audioStorageKey: string;
  posterStorageKey: string;
  previewStorageKey: string;
  videoSha256: string;
  audioSha256: string;
  posterSha256: string;
  previewSha256: string;
  durationSeconds: number;
  audioDurationSeconds: number;
  width: number;
  height: number;
  audioTitle: string;
  /** Explicit review decision; retain the immutable original audio mapping for history. */
  audioPolicy?: "silent";
  sourceFolder: string;
};

type HookReferenceRelease = {
  mediaStatus: "staged" | "published";
  activation: "pending" | "active";
  excludedReferenceIds: string[];
  items: HookReferenceReleaseItem[];
};

function publishedItems(value: HookReferenceRelease, normalizeInstagram = false) {
  if (value.mediaStatus !== "published") return [];
  return value.items.map(item => normalizeInstagram
    ? { ...item, sourceUrl: item.instagramUrl, sourcePlatform: "instagram" as const }
    : item);
}

export function getHookReferenceReleaseItems(): HookReferenceReleaseItem[] {
  return [
    ...publishedItems(release as HookReferenceRelease, true),
    ...publishedItems(additions as HookReferenceRelease),
    ...publishedItems(newBatch as HookReferenceRelease),
    ...publishedItems(octoberBatch as HookReferenceRelease),
    ...publishedItems(octoberRefresh as HookReferenceRelease),
  ];
}

export function isHookReferenceReleaseActive() {
  return getHookReferenceGalleryItems().length > 0;
}

export function getHookReferenceGalleryItems() {
  const active = [
    ...(release.mediaStatus === "published" && release.activation === "active" ? publishedItems(release as HookReferenceRelease, true) : []),
    ...(additions.mediaStatus === "published" && additions.activation === "active" ? publishedItems(additions as HookReferenceRelease) : []),
    ...(newBatch.mediaStatus === "published" && newBatch.activation === "active" ? publishedItems(newBatch as HookReferenceRelease) : []),
    ...(octoberBatch.mediaStatus === "published" && octoberBatch.activation === "active" ? publishedItems(octoberBatch as HookReferenceRelease) : []),
    ...(octoberRefresh.mediaStatus === "published" && octoberRefresh.activation === "active" ? publishedItems(octoberRefresh as HookReferenceRelease) : []),
  ];
  const excluded = new Set([
    ...(release.activation === "active" ? release.excludedReferenceIds : []),
    ...(additions.activation === "active" ? additions.excludedReferenceIds : []),
    ...(newBatch.activation === "active" ? newBatch.excludedReferenceIds : []),
    ...(octoberBatch.activation === "active" ? octoberBatch.excludedReferenceIds : []),
    ...(octoberRefresh.activation === "active" ? octoberRefresh.excludedReferenceIds : []),
  ]);
  return active.filter(item => !excluded.has(item.id));
}
