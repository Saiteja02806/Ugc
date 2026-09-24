import { isMediaAssetVisibleInCreativeLibrary } from "../media/media-library-visibility.ts";
import type { MediaAsset, MediaSourceType } from "../media/types.ts";

// This is deliberately broader than the Secondary clip picker. It is used to
// recognise media referenced by an existing schedule, including a Reaction
// Reel scheduled from its own flow.
export const scheduledVideoSourceTypes: MediaSourceType[] = [
  "demo_upload",
  "upload",
  "generated_video",
  "edit_export",
  "wall_text_render",
  "reaction_render",
];

export function isScheduledVideoMediaAsset(asset: MediaAsset) {
  return (
    asset.collection === "video" &&
    scheduledVideoSourceTypes.includes(asset.sourceType)
  );
}

// Secondary clips are a Content-screen picker. A Reaction Reel is schedulable
// from the Reaction Reel flow, but is not Content media and must not appear
// here. Keeping this rule separate protects existing direct Reaction schedules.
export function isContentSecondaryClipMediaAsset(asset: MediaAsset) {
  return (
    isScheduledVideoMediaAsset(asset) &&
    isMediaAssetVisibleInCreativeLibrary({
      metadata: asset.metadata,
      sourceType: asset.sourceType,
    })
  );
}
