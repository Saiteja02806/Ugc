import "server-only";
import { z } from "zod";
import { getRecreateReference } from "./recreate-catalog";
import { canonicalMediaReference, isTrustedMediaReferenceUrl } from "@/lib/media/media-reference";
import { getMediaAssetForOwner } from "@/lib/media/media-storage";
import type { SlideshowPlanningInput, SlideshowNamedImage } from "./slideshow-request-plan";
import { getCreatorSlideshowReference } from "./creator-slideshows.ts";
import { canAccessCreatorAccounts } from "./creator-account-access.ts";
import { resolveOwnedPrivateMediaUrl } from "@/worker/src/lib/private-media.ts";
import { downloadReferenceImageContext } from "@/worker/src/lib/reference-image-download.ts";

const ContextSchema = z.strictObject({ version: z.literal(1),
  sources: z.array(z.strictObject({ referenceId: z.string().min(1).max(100), slideId: z.string().min(1).max(100), slideNumber: z.number().int().min(1).max(100) })).max(14),
  uploads: z.array(z.strictObject({ assetId: z.string().uuid(), name: z.string().regex(/^Upload [A-Z]{1,3}$/) })).max(14),
});
const FaceSelectionSchema = z.object({
  influencer: z.object({ id: z.string().uuid(), referencePhotos: z.array(z.object({ id: z.string().uuid() })).max(3).optional() }),
  slideIds: z.array(z.string().min(1).max(100)).min(1).max(10),
});
export class SlideshowFaceSelectionError extends Error {}

/** Resolve original numbers against the catalogue or the owned uploaded source. */
export async function resolveSlideshowNamedContext(value: unknown, owner: string, prompt: string, sourceUrls: string[], uploads: { id: string; url: string }[], current?: { id: string; url: string }, actor?: Parameters<typeof canAccessCreatorAccounts>[0], faceSelection?: unknown): Promise<SlideshowPlanningInput> {
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
  let faceSwap: SlideshowPlanningInput["faceSwap"];
  if (faceSelection !== undefined) {
    const parsed = FaceSelectionSchema.safeParse(faceSelection);
    if (!parsed.success) throw new SlideshowFaceSelectionError("Choose face photos and at least one face-swap slide before generating.");
    const selection = parsed.data;
    if (current || new Set(selection.slideIds).size !== selection.slideIds.length || selection.slideIds.some(id => !context.sources.some(source => source.slideId === id))) {
      throw new SlideshowFaceSelectionError("Choose face-swap slides from the current source selection.");
    }
    const identityAssetIds = [selection.influencer.id, ...(selection.influencer.referencePhotos?.map(photo => photo.id) ?? [])];
    if (new Set(identityAssetIds).size !== identityAssetIds.length) throw new SlideshowFaceSelectionError("Choose distinct photos of the same person for face swap.");
    const photos = await Promise.all(identityAssetIds.map(assetId => getMediaAssetForOwner({ assetId, userId: owner })));
    if (photos.some(photo => !photo || photo.user_id !== owner || photo.deleted_at != null || photo.status !== "ready" || !["image", "influencer"].includes(photo.collection) || !["image/jpeg", "image/png", "image/webp"].includes(photo.mime_type ?? "") || photo.file_size_bytes != null && (!Number.isSafeInteger(photo.file_size_bytes) || photo.file_size_bytes <= 0 || photo.file_size_bytes > 25 * 1024 * 1024))) {
      throw new SlideshowFaceSelectionError("A selected face photo is unavailable. Choose ready photos from your account again.");
    }
    const knownBytes = photos.reduce((total, photo) => total + (photo!.file_size_bytes ?? 0), 0);
    if (knownBytes > 50 * 1024 * 1024) throw new SlideshowFaceSelectionError("Use face photos up to 50 MB combined.");
    const selectedTargets = context.sources.filter(source => selection.slideIds.includes(source.slideId)).map(source => `source:${source.referenceId}:${source.slideId}`);
    const identityImageUrls = await Promise.all(photos.map(photo => canonicalMediaReference(photo!.url, owner)));
    if (identityImageUrls.some(url => typeof url !== "string" || !isTrustedMediaReferenceUrl(url)) || new Set(identityImageUrls).size !== identityImageUrls.length) throw new SlideshowFaceSelectionError("Choose distinct face photos available to your account.");
    // Older generated images have no size metadata. Verify their actual bytes
    // before planning/billing rather than rejecting a valid saved influencer.
    const unknownSizeUrls = identityImageUrls.filter((_, index) => photos[index]!.file_size_bytes == null) as string[];
    if (unknownSizeUrls.length) {
      try {
        const readable = await Promise.all(unknownSizeUrls.map(url => resolveOwnedPrivateMediaUrl(url, owner)));
        await downloadReferenceImageContext(readable, 50 * 1024 * 1024 - knownBytes);
      } catch { throw new SlideshowFaceSelectionError("A selected face photo could not be read within the size limits. Choose another photo or upload it again."); }
    }
    faceSwap = { targetIds: selectedTargets, identityAssetIds, identityImageUrls: identityImageUrls as string[] };
  }
  return { version: 1, prompt, images, targetIds, ...(faceSwap ? { faceSwap } : {}) };
}
