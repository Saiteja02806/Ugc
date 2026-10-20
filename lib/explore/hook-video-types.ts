export type ExploreVideoReference = {
  id: string;
  posterUrl: string;
  videoUrl: string;
  durationSeconds?: number;
  instagramUrl?: string;
  sourceUrl?: string;
  sourcePlatform?: "instagram" | "tiktok";
  previewVideoUrl?: string;
  pairedAudio?: { title: string; url: string; durationSeconds: number };
};

export type ExploreHookVideo = ExploreVideoReference;

export type ExploreWallTextVideo = ExploreVideoReference;

export function getExploreVideoPosterStorageKey(videoStorageKey: string) {
  if (!videoStorageKey.endsWith(".mp4")) {
    throw new Error(`Explore video key must end in .mp4: ${videoStorageKey}`);
  }

  return `${videoStorageKey.slice(0, -".mp4".length)}.webp`;
}
