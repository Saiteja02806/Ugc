import "server-only";

import { ExploreFinishingRequestStore } from "@/lib/explore/workflow-finishing-store";
import type { MediaAssetRow } from "@/lib/media/media-storage";
import { SchedulingRequestError } from "@/lib/scheduling/errors";
import {
  ExploreFinishError,
  exploreFinishOutputKey,
  isExploreUuid,
  parseExploreFinishDraft,
  parseExploreFinishReceipt,
} from "@/worker/src/lib/explore-finishing-contract";

function metadataRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isHttpsMediaUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function isFinishedExploreCandidate(
  asset: MediaAssetRow | null,
  userId: string,
): asset is MediaAssetRow {
  if (
    !asset ||
    asset.user_id !== userId ||
    asset.status !== "ready" ||
    asset.deleted_at !== null ||
    asset.collection !== "video" ||
    asset.source_type !== "combined_render" ||
    asset.project_id !== "explore" ||
    asset.mime_type !== "video/mp4" ||
    !isExploreUuid(asset.id) ||
    !isExploreUuid(asset.source_record_id) ||
    !isExploreUuid(asset.parent_asset_id) ||
    asset.storage_key !== exploreFinishOutputKey(asset.id) ||
    !isHttpsMediaUrl(asset.url) ||
    !["9:16", "16:9", "4:5", "1:1", "other"].includes(asset.ratio)
  ) {
    return false;
  }

  // Match the persisted output contract rather than admitting every combined render.
  return (
    typeof asset.duration_seconds === "number" &&
    Number.isFinite(asset.duration_seconds) &&
    asset.duration_seconds >= 0.001 &&
    asset.duration_seconds <= 240 &&
    typeof asset.file_size_bytes === "number" &&
    Number.isInteger(asset.file_size_bytes) &&
    asset.file_size_bytes >= 1 &&
    asset.file_size_bytes <= 262144000 &&
    typeof asset.width === "number" &&
    Number.isInteger(asset.width) &&
    asset.width >= 64 &&
    asset.width <= 4096 &&
    typeof asset.height === "number" &&
    Number.isInteger(asset.height) &&
    asset.height >= 64 &&
    asset.height <= 4096
  );
}

/** A ready media row alone cannot prove that Explore finishing completed. */
export function isCompletedExploreFinishedVideo(
  asset: MediaAssetRow | null,
  rawReceipt: unknown,
  userId: string,
): boolean {
  if (!isFinishedExploreCandidate(asset, userId)) return false;
  const metadata = metadataRecord(asset.metadata);
  if (metadata?.exploreFinish !== true || !isExploreUuid(metadata.requestKey)) {
    return false;
  }

  try {
    const receipt = parseExploreFinishReceipt(rawReceipt, userId, metadata.requestKey);
    return (
      receipt.status === "completed" &&
      receipt.output_asset_id === asset.id &&
      receipt.job_id === asset.source_record_id &&
      receipt.draft.sourceAssetId === asset.parent_asset_id &&
      receipt.fingerprint === metadata.fingerprint &&
      JSON.stringify(parseExploreFinishDraft(metadata.draft)) === JSON.stringify(receipt.draft)
    );
  } catch (error) {
    if (error instanceof ExploreFinishError) return false;
    throw error;
  }
}

export async function isVerifiedExploreFinishedVideo(
  asset: MediaAssetRow | null,
  userId: string,
): Promise<boolean> {
  if (!isFinishedExploreCandidate(asset, userId)) return false;
  const metadata = metadataRecord(asset.metadata);
  if (metadata?.exploreFinish !== true || !isExploreUuid(metadata.requestKey)) {
    return false;
  }

  try {
    const receipt = await new ExploreFinishingRequestStore().read(userId, metadata.requestKey);
    return isCompletedExploreFinishedVideo(asset, receipt, userId);
  } catch (error) {
    if (error instanceof ExploreFinishError) {
      if (error.status < 500) return false;
      throw new SchedulingRequestError(
        "Could not verify the finished video. Try again.",
        503,
        "explore_finish_verification_unavailable",
      );
    }
    throw error;
  }
}
