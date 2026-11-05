/** Planning can stop before a job exists. Keep its explanation across remounts. */
export type SlideshowClarification = { version: 1; owner: string; scope: string; prompt: string; items: string[]; imageIds?: string[] };
export const slideshowClarificationKey = (owner: string) => `ugc-explore:slideshow-clarification:v1:${encodeURIComponent(owner)}`;
export function slideshowClarificationScope(references: readonly (string | null)[], regeneration: string | null,
  face?: { influencer: { id: string; referencePhotos?: { id: string }[] }; slideIds: string[] } | null) {
  return JSON.stringify({ references, regeneration, ...(face?.influencer && face.slideIds.length ? {
    faceSwap: { identityAssetIds: [face.influencer.id, ...(face.influencer.referencePhotos?.map(photo => photo.id) ?? [])], slideIds: face.slideIds },
  } : {}) });
}

export const SLIDESHOW_CLARIFICATION_FALLBACK = "Please specify which source slides and uploaded images to use, and what should change on each slide.";

/** UI guidance is English; never alter the user's prompt or requested slide copy. */
export function slideshowClarificationMessages(items: readonly string[]): string[] {
  return [...new Set(items.map(item => {
    const text = item.trim();
    const hasOtherScript = [...text.matchAll(/\p{L}/gu)].some(([letter]) => !/\p{Script_Extensions=Latin}/u.test(letter));
    return !text || hasOtherScript ? SLIDESHOW_CLARIFICATION_FALLBACK : text;
  }))];
}

export function slideshowClarificationMatches(feedback: SlideshowClarification, scope: string, imageIds: readonly string[]) {
  if (feedback.scope !== scope) return false;
  // Older feedback did not freeze uploads. Do not claim it checks current photos.
  if (!feedback.imageIds) return imageIds.length === 0;
  return feedback.imageIds.length === imageIds.length && feedback.imageIds.every((id, index) => id === imageIds[index]);
}

export function readSlideshowClarification(raw: string | null, owner: string): SlideshowClarification | null {
  if (!raw || raw.length > 100_000) return null;
  try {
    const value = JSON.parse(raw) as SlideshowClarification;
    if (value?.version !== 1 || value.owner !== owner || typeof value.scope !== "string" || value.scope.length > 32_768 ||
        typeof value.prompt !== "string" || value.prompt.length > 32_000 || !Array.isArray(value.items) || !value.items.length || value.items.length > 5 ||
        value.items.some(item => typeof item !== "string" || !item.trim() || item.length > 500) ||
        value.imageIds !== undefined && (!Array.isArray(value.imageIds) || value.imageIds.length > 14 || value.imageIds.some(id => typeof id !== "string" || !/^[a-f0-9-]{36}$/i.test(id)) || new Set(value.imageIds).size !== value.imageIds.length)) return null;
    return value;
  } catch { return null; }
}
