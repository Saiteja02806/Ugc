/** Planning can stop before a job exists. Keep its explanation across remounts. */
export type SlideshowClarification = { version: 1; owner: string; scope: string; prompt: string; items: string[] };
export const slideshowClarificationKey = (owner: string) => `ugc-explore:slideshow-clarification:v1:${encodeURIComponent(owner)}`;

export function readSlideshowClarification(raw: string | null, owner: string): SlideshowClarification | null {
  if (!raw || raw.length > 100_000) return null;
  try {
    const value = JSON.parse(raw) as SlideshowClarification;
    if (value?.version !== 1 || value.owner !== owner || typeof value.scope !== "string" || value.scope.length > 32_768 ||
        typeof value.prompt !== "string" || value.prompt.length > 32_000 || !Array.isArray(value.items) || !value.items.length || value.items.length > 5 ||
        value.items.some(item => typeof item !== "string" || !item.trim() || item.length > 500)) return null;
    return value;
  } catch { return null; }
}
