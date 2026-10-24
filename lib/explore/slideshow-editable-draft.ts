import { isExploreUuid } from "../../worker/src/lib/explore-finishing-contract.ts";
import { parseSlideText, type SlideTextDesign } from "./slideshow-text.ts";

export type SlideshowEditableDraft = { version: 1; slides: { referenceSlideId: string; mediaAssetId: string; design: SlideTextDesign }[] };

/** Only media identities and validated editable text, never browser-provided URLs. */
export function readSlideshowEditableDraft(value: unknown): SlideshowEditableDraft | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const draft = value as Partial<SlideshowEditableDraft>;
  if (draft.version !== 1 || !Array.isArray(draft.slides) || draft.slides.length < 2 || draft.slides.length > 10) return null;
  try {
    const ids = new Set<string>();
    const slides = draft.slides.map(slide => {
      if (!slide || typeof slide.referenceSlideId !== "string" || !slide.referenceSlideId || slide.referenceSlideId.length > 160 || ids.has(slide.referenceSlideId) || !isExploreUuid(slide.mediaAssetId)) throw new Error("Invalid slide identity");
      ids.add(slide.referenceSlideId);
      return { referenceSlideId: slide.referenceSlideId, mediaAssetId: slide.mediaAssetId, design: parseSlideText(slide.design) };
    });
    return { version: 1, slides };
  } catch { return null; }
}
