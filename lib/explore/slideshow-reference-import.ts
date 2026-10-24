import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";
import { requireAIStudioProUser } from "@/lib/ai-studio/server-access";
import { FirebaseAuthRequestError } from "@/lib/firebase/server-auth";
import { getRecreateReferences } from "@/lib/explore/recreate-catalog";
import {
  getMediaAssetForOwnerByStorageKey,
  serializeMediaAsset,
  upsertReadyMediaAsset,
  type MediaAssetRow,
} from "@/lib/media/media-storage";
import { MAX_IMAGE_UPLOAD_BYTES } from "@/lib/media/media-upload";
import { buildPublicStorageUrl, headStorageObject, isTrustedStorageUrl } from "@/lib/storage/storage";
import { MAX_SLIDESHOW_SLIDES } from "./slideshow-draft";
import { creatorSlideFromUrl, getCreatorSlideshowReference, readCreatorSlide } from "./creator-slideshows.ts";
import { canAccessCreatorAccounts } from "./creator-account-access.ts";
import type { ReferenceSlide } from "./recreate-types.ts";

const PROJECT = "explore-catalog-reference";
const requestSchema = z.strictObject({
  referenceId: z.string().min(1).max(160),
  slideIds: z.array(z.string().min(1).max(160)).min(1).max(MAX_SLIDESHOW_SLIDES)
    .refine(ids => new Set(ids).size === ids.length, "Choose each original slide once."),
});
const extensions: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

class ImportError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store", Vary: "Authorization" } });
}

/** Catalogue IDs only: never fetch, register or copy a URL supplied by a client. */
export async function handleSlideshowReferenceImport(request: Request) {
  try {
    const user = await requireAIStudioProUser(request);
    const raw = await request.text();
    if (raw.length > 8192) throw new ImportError("The slide selection is too large.", 413);
    let body: unknown;
    try { body = JSON.parse(raw); } catch { throw new ImportError("Choose original reference slides to add."); }
    const assets = await importSlideshowReferenceForOwner(user.uid, body,user);
    return json({ ok: true, assets });
  } catch (error) {
    const known = error instanceof FirebaseAuthRequestError || error instanceof ImportError;
    return json({ ok: false, error: known ? error.message : "Could not add these original slides. Try again; your slideshow has not changed." }, known ? error.status : 503);
  }
}

/** Register immutable approved catalogue bytes as owned ready media; no AI or billing. */
export async function importSlideshowReferenceForOwner(userId: string, value: unknown, actor?: Parameters<typeof canAccessCreatorAccounts>[0] & { uid?: string }) {
  const parsed = requestSchema.safeParse(value);
  if (!parsed.success) throw new ImportError("Choose 1–10 different original reference slides.");
  const { referenceId, slideIds } = parsed.data;
  const reference = getRecreateReferences().find(item => item.id === referenceId && item.format === "slideshow" && !item.archived)
    ?? (actor?.uid === userId ? getCreatorSlideshowReference(referenceId,actor) : undefined);
  if (!reference || slideIds.some(id => !reference.slides.some(slide => slide.id === id))) {
    throw new ImportError("Choose slides belonging to an available slideshow reference.");
  }
  const selected = new Set(slideIds);
  // Validate the entire selection before any storage/database writes. Catalogue
  // order is authoritative even when checkbox clicks arrive in another order.
  const sources = reference.slides.flatMap<{ slide: ReferenceSlide; number: number; key: string; sha256: string; mimeType: string; privateSlide: ReturnType<typeof creatorSlideFromUrl> }>((slide, index) => {
    if (!selected.has(slide.id)) return [];
    const privateSlide = creatorSlideFromUrl(slide.url);
    if (privateSlide) return [{ slide, number: index + 1, key: `explore/creator-slideshows/${referenceId}/${privateSlide.slide.sha256}.${privateSlide.slide.extension}`, sha256: privateSlide.slide.sha256, mimeType: privateSlide.slide.contentType, privateSlide }];
    const parsedUrl = new URL(slide.url);
    const match = parsedUrl.pathname.match(/\/(explore\/recreate\/v1\/([a-f0-9]{64})\.(jpe?g|png|webp))$/i);
    if (!match || parsedUrl.protocol !== "https:" || parsedUrl.search || parsedUrl.hash ||
      !isTrustedStorageUrl(slide.url) || buildPublicStorageUrl(match[1]) !== slide.url ||
      !Number.isSafeInteger(slide.width) || slide.width <= 0 || !Number.isSafeInteger(slide.height) || slide.height <= 0) {
      throw new ImportError("This original slide is unavailable. Choose another reference.", 409);
    }
    return [{ slide, number: index + 1, key: match[1], sha256: match[2].toLowerCase(), mimeType: extensions[match[3].toLowerCase()], privateSlide: null }];
  });
  const prepared = await Promise.all(sources.map(async source => {
    const lookup = { userId, storageKey: source.key };
    const existing = await getMediaAssetForOwnerByStorageKey(lookup);
    const sourceRecordId = `explore-original:${createHash("sha256").update(source.key).digest("hex")}`;
    const reusable = (row: MediaAssetRow | null) => row?.user_id === userId && row.deleted_at === null && row.status === "ready" &&
      row.collection === "image" && row.source_type === "upload" && row.project_id === PROJECT &&
      row.source_record_id === sourceRecordId && row.storage_key === source.key && row.url === source.slide.url && row.mime_type === source.mimeType;
    if (existing) {
      if (!reusable(existing)) throw new ImportError("This original slide is unavailable. Refresh your images and try again.", 409);
      return { source, existing, lookup, sourceRecordId, reusable, size: existing.file_size_bytes };
    }
    const local = source.privateSlide ? await readCreatorSlide(referenceId,source.slide.id) : null;
    const stored = local ? { ContentType:local.contentType, ContentLength:local.bytes.length } : await headStorageObject({ key: source.key });
    if (stored.ContentType?.split(";")[0].trim().toLowerCase() !== source.mimeType ||
      !Number.isSafeInteger(stored.ContentLength) || !stored.ContentLength || stored.ContentLength > MAX_IMAGE_UPLOAD_BYTES) {
      throw new ImportError("This original slide could not be loaded. Choose another reference.", 409);
    }
    return { source, existing: null, lookup, sourceRecordId, reusable, size: stored.ContentLength };
  }));
  const assets = [];
  for (const item of prepared) {
    if (item.existing) { assets.push(serializeMediaAsset(item.existing)); continue; }
    const { source } = item;
    let row: MediaAssetRow;
    try {
      // Reuse the catalogue's content-addressed storage object. Never overwrite
      // its bytes; deletion of this owned media entry only soft-deletes the row.
      row = await upsertReadyMediaAsset({
        collection: "image", sourceType: "upload", sourceRecordId: item.sourceRecordId,
        userId, projectId: PROJECT, storageKey: source.key, url: source.slide.url,
        title: `${reference.title} · Original slide ${source.number}`,
        fileName: `${source.sha256}.${source.key.split(".").pop()}`,
        fileSizeBytes: item.size, mimeType: source.mimeType,
        width: source.slide.width, height: source.slide.height,
        ratio: imageRatio(source.slide.width, source.slide.height),
        metadata: {
          exploreOriginalReference: { referenceId, slideId: source.slide.id, slideNumber: source.number, sourceSha256: source.sha256 },
          remixTextSource: { format: "slideshow", referenceId, sourceUrl: source.slide.url },
        },
      });
    } catch (error) {
      // Existing partial unique indexes on owner/source and owner/storage key
      // arbitrate concurrent imports. Recover the winner; never create duplicates.
      const winner = await getMediaAssetForOwnerByStorageKey(item.lookup);
      if (!winner || !item.reusable(winner)) throw error;
      row = winner;
    }
    if (!item.reusable(row)) throw new Error("The original slide import could not be confirmed.");
    assets.push(serializeMediaAsset(row));
  }
  return assets;
}

function imageRatio(width: number, height: number): MediaAssetRow["ratio"] {
  if (width === height) return "1:1";
  if (width * 16 === height * 9) return "9:16";
  if (width * 5 === height * 4) return "4:5";
  if (width * 9 === height * 16) return "16:9";
  return "other";
}
