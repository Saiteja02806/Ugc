import { createHash } from "node:crypto";
import { hookKeyframeMaxPersonImages, hookKeyframeReceiptImageModel, isHookKeyframeImageModel, type HookKeyframeImageModel } from "./hook-keyframe-image-model.ts";

export const HOOK_KEYFRAME_GENERATION_PURPOSE = "hook_starting_frame" as const;
export const HOOK_KEYFRAME_MAX_CONTEXT_BYTES = 50 * 1024 ** 2;
export const HOOK_KEYFRAME_MAX_PERSON_IMAGE_BYTES = 25 * 1024 ** 2;
export function hookKeyframeSnapshotKey(receipt: Pick<HookKeyframeGenerationReceipt, "sourceSha256" | "sourceFrame">) {
  return `explore/hook-starting-frames/v1/${receipt.sourceSha256}/${receipt.sourceFrame.sha256}.png`;
}
export type HookKeyframeGenerationReceipt = {
  version: 1 | 2; purpose: typeof HOOK_KEYFRAME_GENERATION_PURPOSE;
  imageModel?: HookKeyframeImageModel;
  ownerId: string; draftId: string; referenceId: string; sourceSha256: string;
  sourceFrame: { index: 0; timeSeconds: 0; width: number; height: number; sha256: string };
  personImageAssetIds: string[]; instructions: string; promptVersion: 1 | 2 | 3 | 4;
  inputKey: string; promptSha256: string;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hash = /^[a-f0-9]{64}$/;
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const fields = (value: Record<string, unknown>, allowed: string[]) => Object.keys(value).every(key => allowed.includes(key));
export function hookKeyframeGenerationInputKey(receipt: Omit<HookKeyframeGenerationReceipt, "inputKey" | "promptSha256" | "version" | "purpose" | "promptVersion"> & { version?: 1 | 2 }) {
  const { ownerId, draftId, referenceId, sourceSha256, sourceFrame, personImageAssetIds, instructions } = receipt;
  return JSON.stringify({ version: receipt.version === 2 ? 2 : 1, ownerId, draftId, referenceId, sourceSha256,
    sourceFrame: { index: sourceFrame.index, timeSeconds: sourceFrame.timeSeconds, width: sourceFrame.width, height: sourceFrame.height, sha256: sourceFrame.sha256 },
    imageAssetIds: personImageAssetIds, instructions, ...(receipt.version === 2 ? { imageModel: receipt.imageModel } : {}) });
}
export function hookKeyframeSourceRatio(width: number, height: number): "9:16" | "16:9" | "1:1" | "4:5" | null {
  if (width * 16 === height * 9) return "9:16";
  if (width * 9 === height * 16) return "16:9";
  if (width === height) return "1:1";
  if (width * 5 === height * 4) return "4:5";
  return null;
}
export function parseHookKeyframeGenerationReceipt(value: unknown): HookKeyframeGenerationReceipt | null {
  if (!record(value) || !fields(value, ["version", "imageModel", "purpose", "ownerId", "draftId", "referenceId", "sourceSha256", "sourceFrame", "personImageAssetIds", "instructions", "promptVersion", "inputKey", "promptSha256"]) ||
    value.version !== 1 && value.version !== 2 || value.version === 1 && value.imageModel !== undefined ||
    value.version === 2 && (!isHookKeyframeImageModel(value.imageModel) || ![2, 3, 4].includes(value.promptVersion as number)) ||
    value.version === 1 && ![1, 2].includes(value.promptVersion as number) ||
    value.purpose !== HOOK_KEYFRAME_GENERATION_PURPOSE || ![1, 2, 3, 4].includes(value.promptVersion as number) ||
    typeof value.ownerId !== "string" || !value.ownerId || value.ownerId.length > 128 || /[\u0000-\u001f]/u.test(value.ownerId) ||
    typeof value.draftId !== "string" || !uuid.test(value.draftId) ||
    typeof value.referenceId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value.referenceId) ||
    typeof value.sourceSha256 !== "string" || !hash.test(value.sourceSha256) ||
    !record(value.sourceFrame) || !fields(value.sourceFrame, ["index", "timeSeconds", "width", "height", "sha256"]) ||
    value.sourceFrame.index !== 0 || value.sourceFrame.timeSeconds !== 0 ||
    typeof value.sourceFrame.sha256 !== "string" || !hash.test(value.sourceFrame.sha256) ||
    ![value.sourceFrame.width, value.sourceFrame.height].every(dimension => typeof dimension === "number" && Number.isSafeInteger(dimension) && dimension >= 1 && dimension <= 8192) ||
    !hookKeyframeSourceRatio(value.sourceFrame.width as number, value.sourceFrame.height as number) ||
    !Array.isArray(value.personImageAssetIds) || value.personImageAssetIds.length < 1 || value.personImageAssetIds.length > 5 ||
    value.version === 2 && value.personImageAssetIds.length > hookKeyframeMaxPersonImages(value.imageModel as HookKeyframeImageModel) ||
    value.personImageAssetIds.some(id => typeof id !== "string" || !uuid.test(id)) ||
    new Set(value.personImageAssetIds.map(id => String(id).toLowerCase())).size !== value.personImageAssetIds.length ||
    typeof value.instructions !== "string" || value.instructions.length > 2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value.instructions) ||
    typeof value.inputKey !== "string" || value.inputKey.length > 7000 ||
    typeof value.promptSha256 !== "string" || !hash.test(value.promptSha256)) return null;
  const receipt = value as unknown as HookKeyframeGenerationReceipt;
  if (receipt.inputKey !== hookKeyframeGenerationInputKey(receipt)) return null;
  return { ...receipt, sourceFrame: { ...receipt.sourceFrame }, personImageAssetIds: [...receipt.personImageAssetIds] };
}
export function hookKeyframePromptSha256(prompt: string) { return createHash("sha256").update(prompt).digest("hex"); }

/** Bind labels to the next image block using the accepted prompt version.
 * The default preserves V2 callers. These are prompt instructions, not structural
 * identity/mask roles offered by Gemini. */
export function hookKeyframeProviderImageLabels(personImageCount: number, promptVersion: 2 | 3 | 4 = 2): string[] {
  if (!Number.isInteger(personImageCount) || personImageCount < 1 || personImageCount > 5) throw new Error("Choose one main face photo and up to four supporting views.");
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
  const png = image.buffer;
  return image.contentType === "image/png" && png.length >= 33 &&
    png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    png.toString("ascii", 12, 16) === "IHDR" &&
    png.readUInt32BE(16) === receipt.sourceFrame.width && png.readUInt32BE(20) === receipt.sourceFrame.height &&
    createHash("sha256").update(png).digest("hex") === receipt.sourceFrame.sha256;
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
    sceneMatches = scene.pathname.endsWith(`/${hookKeyframeSnapshotKey(receipt)}`) && !scene.search;
  }
  return Boolean(receipt && input.ownerId === receipt.ownerId && input.model === hookKeyframeReceiptImageModel(receipt) &&
    input.aspectRatio === hookKeyframeSourceRatio(receipt.sourceFrame.width, receipt.sourceFrame.height) &&
    input.prompt.length <= 8000 && hookKeyframePromptSha256(input.prompt) === receipt.promptSha256 &&
    input.referenceImageUrls?.length === receipt.personImageAssetIds.length + 1 &&
    input.referenceImageUrl === urls?.[0] && new Set(urls).size === urls?.length && validUrls && sceneMatches);
}
