/** Browser-safe model contract for the still-image preparation step. */
export const HOOK_KEYFRAME_IMAGE_MODELS = ["gemini_3_pro", "nano_banana_2"] as const;
export type HookKeyframeImageModel = (typeof HOOK_KEYFRAME_IMAGE_MODELS)[number];
export const DEFAULT_HOOK_KEYFRAME_IMAGE_MODEL: HookKeyframeImageModel = "gemini_3_pro";
export function isHookKeyframeImageModel(value: unknown): value is HookKeyframeImageModel {
  return value === "gemini_3_pro" || value === "nano_banana_2";
}
/** Workflow identity-photo cap follows the selected model's character-image
 * guidance; the separate base scene is not an additional identity reference. */
export function hookKeyframeMaxPersonImages(model: HookKeyframeImageModel): number {
  return model === "gemini_3_pro" ? 5 : 4;
}
export function hookKeyframeReceiptImageModel(receipt: { version: 1 | 2; imageModel?: HookKeyframeImageModel }): HookKeyframeImageModel {
  return receipt.version === 2 ? receipt.imageModel! : "nano_banana_2";
}
