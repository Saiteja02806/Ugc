import "server-only";
import { getBackgroundJobForUser, type BackgroundJobRecord } from "../jobs/background-jobs";
import { getMediaAssetForOwner } from "../media/media-storage";
import { canonicalMediaReference, isTrustedMediaReferenceUrl } from "../media/media-reference";
import { getHookReferenceGalleryItems } from "../../worker/src/lib/explore-hook-reference-release.ts";
import { parseHookKeyframeGenerationReceipt, isHookKeyframeImageInput, hookKeyframeSourceRatio } from "../../worker/src/lib/hook-keyframe-generation-contract.ts";
import { hookKeyframeReceiptImageModel } from "../../worker/src/lib/hook-keyframe-image-model.ts";

export class HookKeyframeGenerationError extends Error {
  constructor(message: string, public status = 503) { super(message); this.name = "HookKeyframeGenerationError"; }
}
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function hookKeyframeReceiptFromJob(job: BackgroundJobRecord, ownerId: string) {
  const input = record(job.input) ? job.input : null;
  const receipt = parseHookKeyframeGenerationReceipt(input?.hookKeyframe);
  if (job.userId !== ownerId || job.jobType !== "generate_image" || !input || !receipt ||
    !isHookKeyframeImageInput({ receipt, ownerId, model: String(input.model), aspectRatio: String(input.aspectRatio),
      prompt: typeof input.prompt === "string" ? input.prompt : "", referenceImageUrl: typeof input.referenceImageUrl === "string" ? input.referenceImageUrl : undefined,
      referenceImageUrls: Array.isArray(input.referenceImageUrls) && input.referenceImageUrls.every(url => typeof url === "string") ? input.referenceImageUrls as string[] : undefined }) ||
    typeof input.generationId !== "string" || !uuid.test(input.generationId)) {
    throw new HookKeyframeGenerationError("This starting-image job could not be verified.", 409);
  }
  return { input, receipt, generationId: input.generationId };
}
/** Deliberate client approval selects an asset/job pair; it is not proof of
 * provenance. Verify the completed owned job and its recorded media output. */
export async function resolveOwnedHookKeyframeResult(params: { assetId: string; imageJobId: string; ownerId: string }) {
  const job = await getBackgroundJobForUser({ jobId: params.imageJobId, userId: params.ownerId });
  if (!job || job.id !== params.imageJobId) throw new HookKeyframeGenerationError("This starting image was not found.", 404);
  const { receipt, generationId } = hookKeyframeReceiptFromJob(job, params.ownerId);
  if (job.status !== "completed") throw new HookKeyframeGenerationError("Wait for the starting image to finish before using it.", 409);
  const output = record(job.output) ? job.output : null;
  const outputReceipt = parseHookKeyframeGenerationReceipt(output?.hookKeyframe);
  if (!output || output.mediaAssetId !== params.assetId || output.generationId !== generationId || output.model !== hookKeyframeReceiptImageModel(receipt) ||
    !outputReceipt || outputReceipt.inputKey !== receipt.inputKey || outputReceipt.promptSha256 !== receipt.promptSha256 ||
    typeof output.key !== "string" || typeof output.url !== "string") throw new HookKeyframeGenerationError("The starting-image output could not be verified.", 409);
  const asset = await getMediaAssetForOwner({ assetId: params.assetId, userId: params.ownerId });
  if (!asset || asset.id !== params.assetId || asset.user_id !== params.ownerId || asset.deleted_at !== null || asset.status !== "ready" || asset.collection !== "image" ||
    asset.source_type !== "generated_image" || asset.source_record_id !== job.id || asset.mime_type !== "image/png" ||
    asset.storage_key !== output.key || asset.url !== output.url || receipt.personImageAssetIds.includes(asset.id) ||
    !Number.isSafeInteger(asset.width) || !Number.isSafeInteger(asset.height) || !asset.width || !asset.height || asset.width < 1 || asset.height < 1 ||
    asset.width > 8192 || asset.height > 8192 || asset.width !== output.width || asset.height !== output.height ||
    asset.ratio !== output.ratio || hookKeyframeSourceRatio(asset.width, asset.height) !== hookKeyframeSourceRatio(receipt.sourceFrame.width, receipt.sourceFrame.height)) {
    throw new HookKeyframeGenerationError("Choose the completed starting image from this Hook preparation.", 409);
  }
  const imageUrl = await canonicalMediaReference(asset.url, params.ownerId);
  if (typeof imageUrl !== "string" || !isTrustedMediaReferenceUrl(imageUrl)) throw new HookKeyframeGenerationError("This starting image is unavailable.", 409);
  return { imageUrl, assetId: asset.id, imageJobId: job.id, referenceId: receipt.referenceId, sourceSha256: receipt.sourceSha256,
    startingFrameIndex: 0 as const, receipt, output: { mediaAssetId: asset.id, url: imageUrl, width: asset.width, height: asset.height,
      ratio: asset.ratio, generationId } };
}
export async function resolveApprovedHookStartingFrame(params: { assetId: string; imageJobId: string; ownerId: string }) {
  const result = await resolveOwnedHookKeyframeResult(params);
  const hook = getHookReferenceGalleryItems().find(item => item.id === result.referenceId);
  const source = hook ?? (await import("./starting-frame-reference-source.ts")).getAdditionalStartingFrameSources().find(item => item.id === result.referenceId);
  if (!source || source.videoSha256 !== result.sourceSha256) throw new HookKeyframeGenerationError("The Hook source changed. Prepare a new starting image.", 409);
  const workflow = "workflow" in source && source.workflow === "wall_text" ? "wall_text" as const
    : "workflow" in source && source.workflow === "talking_head" ? "talking_head" as const : "hook" as const;
  return { ...result, workflow, exploreFormat: workflow === "wall_text" ? "wall_text" as const : "hook" as const };
}
