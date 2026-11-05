import { parseImageReferenceContext } from "./image-reference-context.ts";

export type SlideshowFaceSwap = { version: 1; targetId: string; identityAssetIds: string[]; referenceImageUrls: string[] };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Identity inputs belong to the later face stage, never the base image model. */
export function parseSlideshowFaceSwap(value: unknown): SlideshowFaceSwap {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid slideshow face photo roles.");
  const result = value as Record<string, unknown>;
  if (Object.keys(result).some(key => !["version", "targetId", "identityAssetIds", "referenceImageUrls"].includes(key)) ||
      result.version !== 1 || typeof result.targetId !== "string" || !result.targetId.trim() || result.targetId.length > 200 ||
      !Array.isArray(result.identityAssetIds) || result.identityAssetIds.length < 1 || result.identityAssetIds.length > 4 ||
      result.identityAssetIds.some(id => typeof id !== "string" || !uuid.test(id)) || new Set(result.identityAssetIds).size !== result.identityAssetIds.length) throw new Error("Invalid slideshow face photo roles.");
  const referenceImageUrls = parseImageReferenceContext(result.referenceImageUrls);
  if (result.identityAssetIds.length !== referenceImageUrls.length) throw new Error("Invalid slideshow face photo roles.");
  return { version: 1, targetId: result.targetId, identityAssetIds: [...result.identityAssetIds], referenceImageUrls };
}
