import { fetchAIStudioMediaAsset, fetchAIStudioMediaAssets } from "../ai-studio/media-client";
import { getAIStudioImageResults, type AIStudioImageResult } from "../ai-studio/media-results";

/** Never treat a generation or job UUID as an owned publishable image UUID. */
export async function resolveSlideshowImage(image: AIStudioImageResult, token: string): Promise<AIStudioImageResult> {
  const assets = image.mediaAssetId === null
    ? (await fetchAIStudioMediaAssets({ collection: "image", sourceType: "generated_image", token })).filter(asset => Boolean(image.sourceJobId) && asset.sourceRecordId === image.sourceJobId)
    : [await fetchAIStudioMediaAsset(image.mediaAssetId ?? image.id, token)];
  const owned = getAIStudioImageResults(assets, 1)[0];
  if (!owned) throw new Error("This image is still being saved. Try Use this image again in a moment.");
  return owned;
}
