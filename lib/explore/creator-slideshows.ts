import "server-only";
import { createHash } from "node:crypto";
import { readCreatorPrivateFile, readCreatorPrivateJson, type CreatorSlideshows } from "./creator-private-files.ts";
import { canAccessCreatorAccounts } from "./creator-account-access.ts";
import { creatorSlideUrl, parseCreatorSlideUrl } from "../../worker/src/lib/creator-slide-delivery.ts";
import type { RecreateReference } from "./recreate-types.ts";
type Actor = Parameters<typeof canAccessCreatorAccounts>[0];
const catalog = readCreatorPrivateJson<CreatorSlideshows>("creator-slideshows.json", {version: 1, id: "creator-slideshow-account-1", label: "TikTok Creator Account", items: []});

export function isCreatorSlideshowReference(value: unknown): value is string { return typeof value === "string" && value.startsWith("creator-slideshow-"); }
export function findCreatorSlide(referenceId: string, slideId: string) {
  return catalog.items.find(item => item.id === referenceId)?.slides.find(slide => slide.id === slideId);
}
export function creatorSlideFromUrl(value: unknown) {
  const parsed = parseCreatorSlideUrl(value);
  const slide = parsed && findCreatorSlide(parsed.referenceId, parsed.slideId);
  return slide && slide.sha256 === parsed!.sha256 && slide.extension === parsed!.extension ? { ...parsed!, slide } : null;
}
export function getCreatorSlideshowReference(referenceId: string, actor: Actor): RecreateReference | undefined {
  const item = canAccessCreatorAccounts(actor) ? catalog.items.find(item => item.id === referenceId) : undefined;
  if (!item) return undefined;
  const slides = item.slides.map(slide => ({ id: slide.id, width: slide.width, height: slide.height, url: creatorSlideUrl(item.id,slide) }));
  return { id: item.id, format: "slideshow", title: item.title, creatorAccountId: catalog.id, category: "marketing", categoryLabel: "Marketing", sourcePlatform: "tiktok",
    ...(item.sourceUrl ? { sourceUrl: item.sourceUrl, sourceKind: "post" as const } : {}), posterUrl: slides[0].url, slides };
}
export function getCreatorSlideshowAccounts(actor: Actor) {
  if (!canAccessCreatorAccounts(actor)) return [];
  return catalog.items.length ? [{ id: catalog.id, label: catalog.label, items: catalog.items.map(item => {
    const reference = getCreatorSlideshowReference(item.id,actor)!;
    return { ...reference, posterUrl: `/api/explore/creator-slide-media/${item.id}/${item.slides[0].id}`,
      slides: reference.slides.map(slide => ({ ...slide, generationUrl: slide.url, url: `/api/explore/creator-slide-media/${item.id}/${slide.id}` })) };
  }) }] : [];
}
export async function readCreatorSlide(referenceId: string, slideId: string) {
  const slide = findCreatorSlide(referenceId,slideId); if (!slide) return null;
  const bytes = readCreatorPrivateFile(`creator-slideshow-media/${slide.sha256}.${slide.extension}`);
  if (bytes.length !== slide.bytes || createHash("sha256").update(bytes).digest("hex") !== slide.sha256) throw new Error("Private slide bytes changed.");
  return { bytes, slide, contentType: slide.contentType };
}
