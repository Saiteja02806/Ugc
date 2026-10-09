import { isExploreUuid } from "../../worker/src/lib/explore-finishing-contract.ts";

export const MIN_SLIDESHOW_SLIDES = 2;
export const MAX_SLIDESHOW_SLIDES = 10;
export type SlideshowSlideChoice = { referenceSlideId: string; mediaAssetId: string };
export type SlideshowDraft = { version: 2; owner: string; slides: SlideshowSlideChoice[] };
export type SlideshowOutput = { id: string; kind: "library_item"; url: string; title: string; slides: string[] };
export type SlideshowSaveRequest = {
  version: 1 | 2; owner: string; requestKey: string; referenceId: string | null;
  slides: { referenceSlideId: string; mediaAssetId: string | null }[]; output?: SlideshowOutput;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function readChoices(value: unknown, allowOriginals: boolean) {
  if (!Array.isArray(value) || value.length > MAX_SLIDESHOW_SLIDES) return null;
  const ids = new Set<string>();
  const choices: SlideshowSaveRequest["slides"] = [];
  for (const slide of value) {
    if (!isRecord(slide) || typeof slide.referenceSlideId !== "string" || !slide.referenceSlideId || slide.referenceSlideId.length > 160 || ids.has(slide.referenceSlideId) ||
      !(isExploreUuid(slide.mediaAssetId) || allowOriginals && slide.mediaAssetId === null)) return null;
    ids.add(slide.referenceSlideId);
    choices.push({ referenceSlideId: slide.referenceSlideId, mediaAssetId: slide.mediaAssetId as string | null });
  }
  return choices;
}

/** Browser storage holds owned asset identities, never trusted image URLs. */
export function readSlideshowDraft(raw: string | null, owner: string): SlideshowDraft | null {
  if (!raw || raw.length > 16384) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || value.version !== 2 || value.owner !== owner) return null;
    const slides = readChoices(value.slides, false);
    return slides ? { version: 2, owner, slides: slides as SlideshowSlideChoice[] } : null;
  } catch { return null; }
}

export function readSlideshowSaveRequest(raw: string | null, owner: string): SlideshowSaveRequest | null {
  if (!raw || raw.length > 16384) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || (value.version !== 1 && value.version !== 2) || value.owner !== owner || !isExploreUuid(value.requestKey) ||
      !(value.referenceId === null && value.version === 2 || typeof value.referenceId === "string" && value.referenceId.length > 0 && value.referenceId.length <= 160)) return null;
    const slides = readChoices(value.slides, value.version === 1);
    if (!slides || slides.length < MIN_SLIDESHOW_SLIDES) return null;
    const output = value.output === undefined ? undefined : readSlideshowOutput(value.output, slides.length);
    if (value.output !== undefined && !output) return null;
    return { version: value.version, owner, requestKey: value.requestKey, referenceId: value.referenceId as string | null, slides, ...(output ? { output } : {}) };
  } catch { return null; }
}

/** Responses and restored previews must agree with the complete saved sequence. */
export function readSlideshowOutput(value: unknown, slideCount: number): SlideshowOutput | null {
  if (!isRecord(value) || !isExploreUuid(value.id) || value.kind !== "library_item" || typeof value.title !== "string" || value.title.length > 160 ||
    !Array.isArray(value.slides) || value.slides.length !== slideCount || value.slides.some(url => typeof url !== "string" || !url.startsWith("https://")) || value.url !== value.slides[0]) return null;
  return { id: value.id, kind: "library_item", title: value.title, url: value.url as string, slides: value.slides as string[] };
}

export function sameSlideshowChoices(first: SlideshowSaveRequest["slides"], second: SlideshowSaveRequest["slides"]) {
  return first.length === second.length && first.every((slide, index) => slide.referenceSlideId === second[index].referenceSlideId && slide.mediaAssetId === second[index].mediaAssetId);
}

export function moveSlideshowSlide<T>(slides: readonly T[], from: number, to: number): T[] {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from >= slides.length || to < 0 || to >= slides.length) return [...slides];
  const next = [...slides];
  const [slide] = next.splice(from, 1);
  next.splice(to, 0, slide);
  return next;
}
