import { createHash } from "node:crypto";
import { matchesCuratedHookFrame } from "./hook-curated-frames.ts";
import { hookKeyframeMaxPersonImages, hookKeyframeReceiptImageModel, isHookKeyframeImageModel, type HookKeyframeImageModel } from "./hook-keyframe-image-model.ts";
import { isHookFullRecreationPilotOpeningFrame, matchesHookFullRecreationPilotAnchor } from "./hook-full-recreation-pilot.ts";
import { isCreatorSceneCanonicalUrl } from "./creator-scene-delivery.ts";

export const HOOK_KEYFRAME_GENERATION_PURPOSE = "hook_starting_frame" as const;
export const HOOK_KEYFRAME_MAX_CONTEXT_BYTES = 50 * 1024 ** 2;
export const HOOK_KEYFRAME_MAX_PERSON_IMAGE_BYTES = 25 * 1024 ** 2;
export function hookKeyframeSnapshotKey(receipt: Pick<HookKeyframeGenerationReceipt, "sourceSha256" | "sourceFrame">) {
  return `explore/hook-starting-frames/v1/${receipt.sourceSha256}/${receipt.sourceFrame.sha256}.png`;
}
export type HookKeyframeGenerationReceipt = {
  version: 1 | 2 | 3 | 4 | 5; purpose: typeof HOOK_KEYFRAME_GENERATION_PURPOSE;
  imageModel?: HookKeyframeImageModel;
  ownerId: string; draftId: string; referenceId: string; sourceSha256: string;
  sourceFrame: { index: number; timeSeconds: number; width: number; height: number; sha256: string };
  /** v4 only: literal source t=0 blueprint. sourceFrame remains the UI-selected
   * identity_clarity_anchor so existing draft/checkpoint recovery stays stable. */
  animationOpeningFrame?: { index: number; timeSeconds: number; width: number; height: number; sha256: string };
  preparationInputKey?: string;
  personImageAssetIds: string[]; instructions: string; promptVersion: 1 | 2 | 3 | 4 | 5 | 7;
  inputKey: string; promptSha256: string;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hash = /^[a-f0-9]{64}$/;
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const fields = (value: Record<string, unknown>, allowed: string[]) => Object.keys(value).every(key => allowed.includes(key));
// JSONB preserves values, not object insertion order. Frozen string keys use
// this exact frame field order both before persistence and during verification.
const canonicalFrame = (frame: HookKeyframeGenerationReceipt["sourceFrame"]) => ({
  index: frame.index, timeSeconds: frame.timeSeconds, width: frame.width, height: frame.height, sha256: frame.sha256,
});
export function hookKeyframeGenerationInputKey(receipt: Omit<HookKeyframeGenerationReceipt, "inputKey" | "promptSha256" | "version" | "purpose" | "promptVersion"> & { version?: 1 | 2 | 3 | 4 | 5 }) {
  const { ownerId, draftId, referenceId, sourceSha256, sourceFrame, animationOpeningFrame, preparationInputKey, personImageAssetIds, instructions } = receipt;
  return JSON.stringify({ version: receipt.version === 5 ? 5 : receipt.version === 4 ? 4 : receipt.version === 3 ? 3 : receipt.version === 2 ? 2 : 1, ownerId, draftId, referenceId, sourceSha256,
    sourceFrame: canonicalFrame(sourceFrame),
    ...(receipt.version === 5 ? { preparationInputKey } : {}),
    ...(receipt.version === 4 ? { animationOpeningFrame: animationOpeningFrame ? canonicalFrame(animationOpeningFrame) : undefined, preparationInputKey } : {}),
    imageAssetIds: personImageAssetIds, instructions, ...(receipt.version !== 1 && receipt.version !== undefined ? { imageModel: receipt.imageModel } : {}) });
}
export function hookKeyframePreparationInputKey(receipt: HookKeyframeGenerationReceipt) {
  return receipt.version === 4 || receipt.version === 5 ? receipt.preparationInputKey! : receipt.inputKey;
}
export function hookKeyframeReferenceImageCount(receipt: Pick<HookKeyframeGenerationReceipt, "version" | "personImageAssetIds">) {
  return receipt.personImageAssetIds.length + (receipt.version === 4 ? 2 : 1);
}
export function hookKeyframeSourceRatio(width: number, height: number): "9:16" | "16:9" | "1:1" | "4:5" | null {
  if (width * 16 === height * 9) return "9:16";
  if (width * 9 === height * 16) return "16:9";
  if (width === height) return "1:1";
  if (width * 5 === height * 4) return "4:5";
  return null;
}
export function parseHookKeyframeGenerationReceipt(value: unknown): HookKeyframeGenerationReceipt | null {
  if (!record(value) || !fields(value, ["version", "imageModel", "purpose", "ownerId", "draftId", "referenceId", "sourceSha256", "sourceFrame", "animationOpeningFrame", "preparationInputKey", "personImageAssetIds", "instructions", "promptVersion", "inputKey", "promptSha256"]) ||
    value.version !== 1 && value.version !== 2 && value.version !== 3 && value.version !== 4 && value.version !== 5 || value.version === 1 && value.imageModel !== undefined ||
    (value.version === 2 || value.version === 3 || value.version === 4 || value.version === 5) && (!isHookKeyframeImageModel(value.imageModel) || ![2, 3, 4, 5, 7].includes(value.promptVersion as number)) ||
    value.version === 2 && ![2, 3, 4, 5].includes(value.promptVersion as number) ||
    value.version === 3 && value.promptVersion !== 4 ||
    value.version === 4 && value.promptVersion !== 5 ||
    value.version === 5 && value.promptVersion !== 7 ||
    value.version === 1 && ![1, 2].includes(value.promptVersion as number) ||
    value.purpose !== HOOK_KEYFRAME_GENERATION_PURPOSE || ![1, 2, 3, 4, 5, 7].includes(value.promptVersion as number) ||
    typeof value.ownerId !== "string" || !value.ownerId || value.ownerId.length > 128 || /[\u0000-\u001f]/u.test(value.ownerId) ||
    typeof value.draftId !== "string" || !uuid.test(value.draftId) ||
    typeof value.referenceId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value.referenceId) ||
    typeof value.sourceSha256 !== "string" || !hash.test(value.sourceSha256) ||
    !record(value.sourceFrame) || !fields(value.sourceFrame, ["index", "timeSeconds", "width", "height", "sha256"]) ||
    value.version !== 3 && value.version !== 4 && (value.sourceFrame.index !== 0 || value.sourceFrame.timeSeconds !== 0) ||
    value.version === 3 && !matchesCuratedHookFrame(String(value.referenceId), String(value.sourceSha256), value.sourceFrame as HookKeyframeGenerationReceipt["sourceFrame"]) ||
    value.version === 4 && !matchesHookFullRecreationPilotAnchor(String(value.referenceId), String(value.sourceSha256), value.sourceFrame as HookKeyframeGenerationReceipt["sourceFrame"]) ||
    typeof value.sourceFrame.sha256 !== "string" || !hash.test(value.sourceFrame.sha256) ||
    ![value.sourceFrame.width, value.sourceFrame.height].every(dimension => typeof dimension === "number" && Number.isSafeInteger(dimension) && dimension >= 1 && dimension <= 8192) ||
    !hookKeyframeSourceRatio(value.sourceFrame.width as number, value.sourceFrame.height as number) ||
    value.version === 4 && (!record(value.animationOpeningFrame) || !fields(value.animationOpeningFrame, ["index", "timeSeconds", "width", "height", "sha256"]) ||
      !isHookFullRecreationPilotOpeningFrame(String(value.referenceId), String(value.sourceSha256), value.animationOpeningFrame as HookKeyframeGenerationReceipt["sourceFrame"]) ||
      typeof value.preparationInputKey !== "string" || !value.preparationInputKey || value.preparationInputKey.length > 7000) ||
    value.version !== 4 && value.animationOpeningFrame !== undefined ||
    value.version !== 4 && value.version !== 5 && value.preparationInputKey !== undefined ||
    value.version === 5 && (typeof value.preparationInputKey !== "string" || !value.preparationInputKey || value.preparationInputKey.length > 7000) ||
    !Array.isArray(value.personImageAssetIds) || value.personImageAssetIds.length < 1 || value.personImageAssetIds.length > 5 ||
    (value.version === 2 || value.version === 3 || value.version === 4 || value.version === 5) && value.personImageAssetIds.length > hookKeyframeMaxPersonImages(value.imageModel as HookKeyframeImageModel) ||
    value.personImageAssetIds.some(id => typeof id !== "string" || !uuid.test(id)) ||
    new Set(value.personImageAssetIds.map(id => String(id).toLowerCase())).size !== value.personImageAssetIds.length ||
    typeof value.instructions !== "string" || value.instructions.length > 2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value.instructions) ||
    typeof value.inputKey !== "string" || value.inputKey.length > 7000 ||
    typeof value.promptSha256 !== "string" || !hash.test(value.promptSha256)) return null;
  const receipt = value as unknown as HookKeyframeGenerationReceipt;
  if (receipt.inputKey !== hookKeyframeGenerationInputKey(receipt)) return null;
  if ((receipt.version === 4 || receipt.version === 5) && receipt.preparationInputKey !== JSON.stringify({ version: receipt.version === 5 ? 4 : 3, ownerId: receipt.ownerId, draftId: receipt.draftId,
    referenceId: receipt.referenceId, sourceSha256: receipt.sourceSha256, sourceFrame: canonicalFrame(receipt.sourceFrame),
    imageAssetIds: receipt.personImageAssetIds, instructions: receipt.instructions, imageModel: receipt.imageModel })) return null;
  return { ...receipt, sourceFrame: { ...receipt.sourceFrame },
    ...(receipt.animationOpeningFrame ? { animationOpeningFrame: { ...receipt.animationOpeningFrame } } : {}),
    personImageAssetIds: [...receipt.personImageAssetIds] };
}
export function hookKeyframePromptSha256(prompt: string) { return createHash("sha256").update(prompt).digest("hex"); }

/** Bind labels to the next image block using the accepted prompt version.
 * The default preserves V2 callers. These are prompt instructions, not structural
 * identity/mask roles offered by Gemini. */
export function hookKeyframeProviderImageLabels(personImageCount: number, promptVersion: 2 | 3 | 4 | 5 | 7 = 2): string[] {
  if (!Number.isInteger(personImageCount) || personImageCount < 1 || personImageCount > 5) throw new Error("Choose one main face photo and up to four supporting views.");
  if (promptVersion === 7) return [
    "IMAGE 1 — ORIGINAL_OPENING_SCENE. Source frame0 is the sole authority for lighting direction and color, exposure, shadows, outfit, camera, pose, hands, props and occlusion. Remove all captions, physical logos and readable text while restoring those surfaces; do not use the source person's identity.",
    "IMAGE 2 — INFLUENCER_IDENTITY. Depict this person's facial proportions and natural identity in Image1's scene, outfit and lighting. Do not import this photo's room, clothing, light, pose or expression.",
    ...Array.from({ length: personImageCount - 1 }, (_, index) => `IMAGE ${index + 3} — SUPPORTING_INFLUENCER_IDENTITY_${index + 1}. Another view of the same person as Image2; facial identity only, never background, clothing, lighting or pose.`),
  ];
  if (promptVersion === 5) return [
    "IMAGE 1 — ANIMATION_OPENING_FRAME_BLUEPRINT. Recreate this original source t=0 shot with the selected influencer. This image alone defines the output pose, camera, composition, hands, glasses, clothing, lighting and background; it does not define facial identity.",
    "IMAGE 2 — IDENTITY_CLARITY_ANCHOR. A later clear moment from the same source performance. Use only to understand stable scene, wardrobe, hair, earbuds and facial-area geometry obscured in Image 1. Do not use its later pose as the output pose and do not copy this source performer's identity.",
    "IMAGE 3 — MAIN_INFLUENCER_IDENTITY. This is the only person who must appear in the recreated opening frame. Preserve this person's recognizable facial structure and natural appearance while following Image 1's original opening pose and occlusions.",
    ...Array.from({ length: personImageCount - 1 }, (_, index) => `IMAGE ${index + 4} — SUPPORTING_INFLUENCER_IDENTITY_${index + 1}. Another view of the same person as Image 3. Use facial identity only; do not copy its pose, clothing, lighting or background.`),
  ];
  if (promptVersion === 4) return [
    "IMAGE 1 — VISUAL_REFERENCE. A reference for the setting, composition, lighting, clothing, pose, expression and gesture of a new photograph of my influencer. Use it as visual guidance for how my influencer should be photographed.",
    "IMAGE 2 — MY_INFLUENCER. The person to photograph. Generate this influencer with their recognizable facial features and natural appearance in the situation illustrated by Image 1.",
    ...Array.from({ length: personImageCount - 1 }, (_, index) => `IMAGE ${index + 3} — MY_INFLUENCER_SUPPORT_${index + 1}. Another view of my influencer from Image 2, to help depict their recognizable appearance from the requested angle.`),
  ];
  if (promptVersion === 3) return [
    "IMAGE 1 — PRIMARY_FRAME_BLUEPRINT. Recreate this complete shot with the selected influencer as the performer. This image defines camera framing, background, lighting, pose, expression, hands, occlusions, clothing and hairstyle. It does not define the output person's facial identity. Remove creator-added captions.",
    "IMAGE 2 — MAIN_INFLUENCER_IDENTITY. This is the person who must appear in the recreated primary frame. Use this person's facial structure and proportions, adapted to Image 1's head angle, expression and light. Do not copy this photo's background, clothing or pose, or retain Image 1's original facial identity.",
    ...Array.from({ length: personImageCount - 1 }, (_, index) => `IMAGE ${index + 3} — SUPPORTING_INFLUENCER_IDENTITY_${index + 1}. Another view of the same person as Image 2. Use it to understand their facial structure. Image 1 remains the blueprint for the shot; this photo supplies identity only.`),
  ];
  return [
    "IMAGE 1 — BASE_SCENE_TO_EDIT. Edit this image. It is the sole source for the composition, background, lighting, body pose, hands, expression, clothing and hairstyle. The final image must remain this scene, with only the face replaced and creator-added captions removed.",
    "IMAGE 2 — MAIN_FACE_IDENTITY. Use only this person's facial identity and proportions for the face in BASE_SCENE_TO_EDIT. This photo is not the output scene: do not copy its background, body pose, expression, clothing or lighting.",
    ...Array.from({ length: personImageCount - 1 }, (_, index) => `IMAGE ${index + 3} — SUPPORTING_FACE_IDENTITY_${index + 1}. An additional view of the same person as MAIN_FACE_IDENTITY. Use facial structure only; do not copy this photo's background, body pose, expression, clothing or lighting.`),
  ];
}

/** Validate the actual bytes that will go to Google, rather than just trusting a
 * content-addressed URL. Legacy accepted jobs keep their original wire contract. */
export function hookKeyframeSceneBytesMatch(receipt: HookKeyframeGenerationReceipt, image: { buffer: Buffer; contentType: string }): boolean {
  const expected = receipt.version === 4 ? receipt.animationOpeningFrame! : receipt.sourceFrame;
  const png = image.buffer;
  return image.contentType === "image/png" && png.length >= 33 &&
    png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    png.toString("ascii", 12, 16) === "IHDR" &&
    png.readUInt32BE(16) === expected.width && png.readUInt32BE(20) === expected.height &&
    createHash("sha256").update(png).digest("hex") === expected.sha256;
}
export function hookKeyframeAnchorBytesMatch(receipt: HookKeyframeGenerationReceipt, image: { buffer: Buffer; contentType: string }): boolean {
  if (receipt.version !== 4) return false;
  const png = image.buffer;
  return image.contentType === "image/png" && png.length >= 33 &&
    png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    png.toString("ascii", 12, 16) === "IHDR" && png.readUInt32BE(16) === receipt.sourceFrame.width &&
    png.readUInt32BE(20) === receipt.sourceFrame.height && createHash("sha256").update(png).digest("hex") === receipt.sourceFrame.sha256;
}
export function isHookKeyframeImageInput(input: {
  receipt: HookKeyframeGenerationReceipt; ownerId: string | null; model: string;
  aspectRatio: string; prompt: string; referenceImageUrl?: string; referenceImageUrls?: string[];
}) {
  const receipt = parseHookKeyframeGenerationReceipt(input.receipt);
  const urls = input.referenceImageUrls;
  const validUrls = urls?.every(value => {
    try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password && !url.hash; }
    catch { return false; }
  });
  let sceneMatches = false;
  if (receipt && urls?.[0] && validUrls) {
    const scene = new URL(urls[0]);
    const opening = receipt.version === 4 ? { ...receipt, sourceFrame: receipt.animationOpeningFrame! } : receipt;
    sceneMatches = scene.pathname.endsWith(`/${hookKeyframeSnapshotKey(opening)}`) && !scene.search;
    if (receipt.version === 5 && receipt.referenceId.startsWith("creator-account-")) sceneMatches = sceneMatches && isCreatorSceneCanonicalUrl(urls[0], receipt);
    if (receipt.version === 4) {
      const anchor = urls[1] ? new URL(urls[1]) : null;
      sceneMatches = sceneMatches && Boolean(anchor?.pathname.endsWith(`/${hookKeyframeSnapshotKey(receipt)}`) && !anchor.search);
      if (receipt.referenceId.startsWith("creator-account-")) {
        sceneMatches = sceneMatches && isCreatorSceneCanonicalUrl(urls[0], receipt, "opening")
          && isCreatorSceneCanonicalUrl(urls[1], receipt, "source");
      }
    }
  }
  return Boolean(receipt && input.ownerId === receipt.ownerId && input.model === hookKeyframeReceiptImageModel(receipt) &&
    input.aspectRatio === hookKeyframeSourceRatio((receipt.version === 4 ? receipt.animationOpeningFrame! : receipt.sourceFrame).width, (receipt.version === 4 ? receipt.animationOpeningFrame! : receipt.sourceFrame).height) &&
    input.prompt.length <= 8000 && hookKeyframePromptSha256(input.prompt) === receipt.promptSha256 &&
    input.referenceImageUrls?.length === hookKeyframeReferenceImageCount(receipt) &&
    input.referenceImageUrl === urls?.[0] && new Set(urls).size === urls?.length && validUrls && sceneMatches);
}
