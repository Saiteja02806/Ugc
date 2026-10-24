import "server-only";
import { z } from "zod";
import { getRecreateReference } from "./recreate-catalog";
import { canonicalMediaReference } from "@/lib/media/media-reference";
import { getMediaAssetForOwner } from "@/lib/media/media-storage";
import type { SlideshowPlanningInput, SlideshowNamedImage } from "./slideshow-request-plan";
import { getCreatorSlideshowReference } from "./creator-slideshows.ts";
import { canAccessCreatorAccounts } from "./creator-account-access.ts";

const ContextSchema = z.strictObject({ version: z.literal(1),
  sources: z.array(z.strictObject({ referenceId: z.string().min(1).max(100), slideId: z.string().min(1).max(100), slideNumber: z.number().int().min(1).max(100) })).max(14),
  uploads: z.array(z.strictObject({ assetId: z.string().uuid(), name: z.string().regex(/^Upload [A-Z]{1,3}$/) })).max(14),
});

/** Resolve original numbers against the catalogue or the owned uploaded source. */
export async function resolveSlideshowNamedContext(value: unknown, owner: string, prompt: string, sourceUrls: string[], uploads: { id: string; url: string }[], current?: { id: string; url: string }, actor?: Parameters<typeof canAccessCreatorAccounts>[0]): Promise<SlideshowPlanningInput> {
  const context = ContextSchema.parse(value);
  if (context.sources.length !== sourceUrls.length || context.uploads.length !== uploads.length ||
    new Set(context.sources.map(source => source.slideId)).size !== context.sources.length || new Set(context.sources.map(source => source.slideNumber)).size !== context.sources.length ||
    new Set(context.sources.map(source => source.referenceId)).size > 1 || new Set(context.uploads.map(upload => upload.name)).size !== context.uploads.length ||
    context.uploads.some((upload, index) => upload.assetId !== uploads[index].id)) throw new Error("The image names no longer match this selection.");
  const images: SlideshowNamedImage[] = [];
  for (const [index, source] of context.sources.entries()) {
    const catalog = getRecreateReference(source.referenceId) ?? getCreatorSlideshowReference(source.referenceId,actor);
    if (catalog) {
      const slide = catalog.slides[source.slideNumber - 1];
      const expectedUrl = catalog.creatorAccountId ? slide?.url : slide && await canonicalMediaReference(slide.url,owner);
      if (catalog.format !== "slideshow" || slide?.id !== source.slideId || expectedUrl !== sourceUrls[index]) throw new Error("The original source slide changed.");
    } else {
      if (!/^uploaded:[0-9a-f-]{36}$/i.test(source.referenceId)) throw new Error("The source slideshow is unavailable.");
      const asset = await getMediaAssetForOwner({ assetId: source.slideId, userId: owner });
      if (!asset || asset.status !== "ready" || asset.collection !== "image" || await canonicalMediaReference(asset.url, owner) !== sourceUrls[index]) throw new Error("The uploaded source slide is unavailable.");
    }
    images.push({ id: `source:${source.referenceId}:${source.slideId}`, label: `Source slide ${source.slideNumber}`, url: sourceUrls[index], kind: "source", sourceSlideNumber: source.slideNumber });
  }
  images.push(...uploads.map((upload, index): SlideshowNamedImage => ({ id: `upload:${upload.id}`, label: context.uploads[index].name, url: upload.url, kind: "upload", sourceSlideNumber: null })));
  if (current) images.push({ id: `current:${current.id}`, label: "Current slide", url: current.url, kind: "current", sourceSlideNumber: null });
  const targetIds = !sourceUrls.length && !current && uploads.length ? ["new:slide"]
    : images.filter(image => image.kind === "current" || !images.some(candidate => candidate.kind === "current") && image.kind === "source").map(image => image.id);
  if (!targetIds.length || targetIds.length > 10) throw new Error("Select up to ten target slides.");
  return { version: 1, prompt, images, targetIds };
}
