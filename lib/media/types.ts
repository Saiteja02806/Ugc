export const mediaCollections = ["influencer", "video", "image"] as const;
export const mediaSourceTypes = [
  "upload",
  "influencer_upload",
  "demo_upload",
  "catalog_influencer",
  "generated_image",
  "generated_video",
  "edit_export",
  "combined_render",
] as const;
export const mediaAssetStatuses = [
  "uploading",
  "processing",
  "ready",
  "failed",
] as const;
export const mediaRatios = ["9:16", "1:1", "4:5", "16:9", "other"] as const;

export type MediaCollection = (typeof mediaCollections)[number];
export type MediaSourceType = (typeof mediaSourceTypes)[number];
export type MediaAssetStatus = (typeof mediaAssetStatuses)[number];
export type MediaRatio = (typeof mediaRatios)[number];

export type MediaAsset = {
  collection: MediaCollection;
  createdAt: string;
  durationSeconds: number | null;
  fileName: string | null;
  fileSizeBytes: number | null;
  height: number | null;
  id: string;
  metadata: Record<string, unknown>;
  mimeType: string;
  parentAssetId: string | null;
  projectId: string | null;
  ratio: MediaRatio;
  sourceRecordId: string | null;
  sourceType: MediaSourceType;
  status: MediaAssetStatus;
  thumbnailUrl: string | null;
  title: string;
  updatedAt: string;
  url: string;
  width: number | null;
};

export function isMediaCollection(value: unknown): value is MediaCollection {
  return (
    typeof value === "string" &&
    mediaCollections.includes(value as MediaCollection)
  );
}

export function isMediaSourceType(value: unknown): value is MediaSourceType {
  return (
    typeof value === "string" &&
    mediaSourceTypes.includes(value as MediaSourceType)
  );
}

export function isMediaRatio(value: unknown): value is MediaRatio {
  return typeof value === "string" && mediaRatios.includes(value as MediaRatio);
}
