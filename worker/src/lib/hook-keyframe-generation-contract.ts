import { createHash } from "node:crypto";

export const HOOK_KEYFRAME_GENERATION_PURPOSE = "hook_starting_frame" as const;
export const HOOK_KEYFRAME_MAX_CONTEXT_BYTES = 50 * 1024 ** 2;
export const HOOK_KEYFRAME_MAX_PERSON_IMAGE_BYTES = 25 * 1024 ** 2;
export function hookKeyframeSnapshotKey(receipt: Pick<HookKeyframeGenerationReceipt, "sourceSha256" | "sourceFrame">) {
  return `explore/hook-starting-frames/v1/${receipt.sourceSha256}/${receipt.sourceFrame.sha256}.png`;
}
export type HookKeyframeGenerationReceipt = {
  version: 1; purpose: typeof HOOK_KEYFRAME_GENERATION_PURPOSE;
  ownerId: string; draftId: string; referenceId: string; sourceSha256: string;
  sourceFrame: { index: 0; timeSeconds: 0; width: number; height: number; sha256: string };
  personImageAssetIds: string[]; instructions: string; promptVersion: 1;
  inputKey: string; promptSha256: string;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hash = /^[a-f0-9]{64}$/;
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const fields = (value: Record<string, unknown>, allowed: string[]) => Object.keys(value).every(key => allowed.includes(key));
export function hookKeyframeGenerationInputKey(receipt: Omit<HookKeyframeGenerationReceipt, "inputKey" | "promptSha256" | "version" | "purpose" | "promptVersion">) {
  const { ownerId, draftId, referenceId, sourceSha256, sourceFrame, personImageAssetIds, instructions } = receipt;
  return JSON.stringify({ version: 1, ownerId, draftId, referenceId, sourceSha256,
    sourceFrame: { index: sourceFrame.index, timeSeconds: sourceFrame.timeSeconds, width: sourceFrame.width, height: sourceFrame.height, sha256: sourceFrame.sha256 },
    imageAssetIds: personImageAssetIds, instructions });
}
export function hookKeyframeSourceRatio(width: number, height: number): "9:16" | "16:9" | "1:1" | "4:5" | null {
  if (width * 16 === height * 9) return "9:16";
  if (width * 9 === height * 16) return "16:9";
  if (width === height) return "1:1";
  if (width * 5 === height * 4) return "4:5";
  return null;
}
export function parseHookKeyframeGenerationReceipt(value: unknown): HookKeyframeGenerationReceipt | null {
  if (!record(value) || !fields(value, ["version", "purpose", "ownerId", "draftId", "referenceId", "sourceSha256", "sourceFrame", "personImageAssetIds", "instructions", "promptVersion", "inputKey", "promptSha256"]) ||
    value.version !== 1 || value.purpose !== HOOK_KEYFRAME_GENERATION_PURPOSE || value.promptVersion !== 1 ||
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
  return Boolean(receipt && input.ownerId === receipt.ownerId && input.model === "nano_banana_2" &&
    input.aspectRatio === hookKeyframeSourceRatio(receipt.sourceFrame.width, receipt.sourceFrame.height) &&
    input.prompt.length <= 8000 && hookKeyframePromptSha256(input.prompt) === receipt.promptSha256 &&
    input.referenceImageUrls?.length === receipt.personImageAssetIds.length + 1 &&
    input.referenceImageUrl === urls?.[0] && new Set(urls).size === urls?.length && validUrls && sceneMatches);
}
