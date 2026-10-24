/** Browser-safe model contract for the still-image preparation step. */
export const HOOK_KEYFRAME_IMAGE_MODELS = ["gemini_3_pro", "nano_banana_2", "gpt_image", "gpt_image_2_5", "seedream_5_pro"] as const;
export const HOOK_KEYFRAME_IMAGE_MODEL_OPTIONS = [
  { value: "gemini_3_pro", label: "Gemini 3 Pro" }, { value: "nano_banana_2", label: "Gemini 3.1 Flash" },
  { value: "gpt_image", label: "GPT Image" }, { value: "gpt_image_2_5", label: "GPT Image 2.5 Sunburst" },
  { value: "seedream_5_pro", label: "Seedream 5.0 Pro" },
] as const;
export type HookKeyframeImageModel = (typeof HOOK_KEYFRAME_IMAGE_MODELS)[number];
export const DEFAULT_HOOK_KEYFRAME_IMAGE_MODEL: HookKeyframeImageModel = "gemini_3_pro";
export function isHookKeyframeImageModel(value: unknown): value is HookKeyframeImageModel {
  return typeof value === "string" && (HOOK_KEYFRAME_IMAGE_MODELS as readonly string[]).includes(value);
}
/** Workflow identity-photo cap follows the selected model's character-image
 * guidance; the separate base scene is not an additional identity reference. */
export function hookKeyframeMaxPersonImages(model: HookKeyframeImageModel): number {
  return model === "nano_banana_2" ? 4 : 5;
}
export function hookKeyframePromptLimit(model: HookKeyframeImageModel) { return model === "seedream_5_pro" ? 4_000 : 8_000; }
export function hookKeyframeReceiptImageModel(receipt: { version: 1 | 2 | 3; imageModel?: HookKeyframeImageModel }): HookKeyframeImageModel {
  return receipt.version !== 1 ? receipt.imageModel! : "nano_banana_2";
}
