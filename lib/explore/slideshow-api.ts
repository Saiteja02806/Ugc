import "server-only";

import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { requireAIStudioProUser } from "@/lib/ai-studio/server-access";
import { FirebaseAuthRequestError } from "@/lib/firebase/server-auth";
import { getRecreateReferences } from "@/lib/explore/recreate-catalog";
import { getMediaAssetForOwner } from "@/lib/media/media-storage";
import { isTrustedStorageUrl } from "@/lib/storage/storage";
import { isExploreUuid } from "@/worker/src/lib/explore-finishing-contract";
import { MAX_SLIDESHOW_SLIDES, MIN_SLIDESHOW_SLIDES } from "./slideshow-draft";
import { readSlideshowEditableDraft } from "./slideshow-editable-draft";
import { getCreatorSlideshowReference } from "./creator-slideshows.ts";
import { canAccessCreatorAccounts } from "./creator-account-access.ts";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", Vary: "Authorization" } });
}
function reject(error: string, status = 400) {
  // This response is issued only before the transactional Library write.
  return json({ ok: false, outcome: "rejected", error }, status);
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export async function handleSlideshowSave(request: Request) {
  try {
    const user = await requireAIStudioProUser(request);
    if (process.env.EXPLORE_SLIDESHOW_SAVING_ENABLED !== "true") return reject("Slideshow saving is not enabled yet.", 503);
    const raw = await request.text();
    if (raw.length > 65_536) return reject("The slideshow request is too large.", 413);
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return reject("Choose a valid slideshow."); }
    if (!record(body) || request.headers.get("Idempotency-Key") !== body.requestKey) return reject("Choose a valid slideshow request.");
    return await saveSlideshowForOwner(user.uid, body,user);
  } catch (error) {
    return json({ ok:false, error:error instanceof FirebaseAuthRequestError ? error.message : "Could not confirm the saved slideshow. Resume the same save." }, error instanceof FirebaseAuthRequestError ? error.status : 503);
  }
}
/** Caller authenticates/checks access; website and MCP retain the same validation/fingerprint/RPC. */
export async function prepareSlideshowSaveForOwner(userId: string, body: unknown, actor?: Parameters<typeof canAccessCreatorAccounts>[0] & { uid?: string }) {
  try {
    if (process.env.EXPLORE_SLIDESHOW_SAVING_ENABLED !== "true") return reject("Slideshow saving is not enabled yet.",503);
    if (!record(body) || !isExploreUuid(body.requestKey) ||
      !Array.isArray(body.slides) || body.slides.length < MIN_SLIDESHOW_SLIDES || body.slides.length > MAX_SLIDESHOW_SLIDES ||
      (body.version !== undefined && body.version !== 1 && body.version !== 2)) return reject("Choose 2–10 valid slideshow images.");
    const ownedSequence = body.version === 2;
    if (!(ownedSequence && body.referenceId === null || typeof body.referenceId === "string" && body.referenceId.length > 0 && body.referenceId.length <= 160)) return reject("Choose a valid slideshow reference.");
    const reference = typeof body.referenceId === "string" ? getRecreateReferences().find(item => item.id === body.referenceId && item.format === "slideshow")
      ?? (actor?.uid === userId ? getCreatorSlideshowReference(body.referenceId,actor) : undefined) : undefined;
    const uploaded = typeof body.referenceId === "string" && body.referenceId.startsWith("uploaded:") && isExploreUuid(body.referenceId.slice(9));
    if (body.referenceId !== null && !reference && !uploaded || !ownedSequence && !reference && !uploaded) return reject("This slideshow reference is unavailable.");

    const choices: { referenceSlideId: string; mediaAssetId: string | null }[] = [];
    const positions = new Set<string>();
    for (const value of body.slides) {
      if (!record(value) || typeof value.referenceSlideId !== "string" || !value.referenceSlideId || value.referenceSlideId.length > 160 || positions.has(value.referenceSlideId) ||
        !(isExploreUuid(value.mediaAssetId) || !ownedSequence && value.mediaAssetId === null)) return reject("Choose an owned ready image for every slide.");
      const original = reference?.slides.find(slide => slide.id === value.referenceSlideId);
      if (!ownedSequence && !original && (!uploaded || !isExploreUuid(value.referenceSlideId) || !isExploreUuid(value.mediaAssetId))) return reject("Choose slides from this reference or upload your own slideshow.");
      positions.add(value.referenceSlideId);
      choices.push({ referenceSlideId: value.referenceSlideId, mediaAssetId: value.mediaAssetId as string | null });
    }
    const editorDraft = body.editorDraft === undefined ? undefined : readSlideshowEditableDraft(body.editorDraft);
    if (body.editorDraft !== undefined && (!ownedSequence || !editorDraft || editorDraft.slides.length !== choices.length || editorDraft.slides.some((slide, index) => slide.referenceSlideId !== choices[index].referenceSlideId))) return reject("Choose a valid editable slideshow draft.");
    // Check both rendered output and editable source images for this owner.
    const ids = [...new Set([...choices.flatMap(slide => slide.mediaAssetId ? [slide.mediaAssetId] : []), ...(editorDraft?.slides.map(slide => slide.mediaAssetId) ?? [])])];
    const assets = await Promise.all(ids.map(async assetId => [assetId, await getMediaAssetForOwner({ userId: userId, assetId })] as const));
    const byId = new Map(assets);
    if (editorDraft?.slides.some(slide => { const asset = byId.get(slide.mediaAssetId); return !asset || asset.user_id !== userId || asset.deleted_at != null || asset.collection !== "image" || asset.status !== "ready" || !["image/jpeg", "image/png", "image/webp"].includes(asset.mime_type ?? "") || !isTrustedStorageUrl(asset.url); })) return reject("Choose ready source images from your account before saving the editable draft.");
    const slides = [];
    for (const [index, chosen] of choices.entries()) {
      const asset = chosen.mediaAssetId ? byId.get(chosen.mediaAssetId) : null;
      if (chosen.mediaAssetId && (!asset || asset.user_id !== userId || asset.deleted_at != null || asset.collection !== "image" || asset.status !== "ready" || !["image/jpeg", "image/png", "image/webp"].includes(asset.mime_type ?? ""))) return reject("Choose a ready image from your account.");
      const url = asset?.url ?? reference?.slides.find(slide => slide.id === chosen.referenceSlideId)?.url;
      if (typeof url !== "string" || !url.startsWith("https://") || !isTrustedStorageUrl(url)) return reject("This slide is unavailable for publishing.");
      slides.push({ slideNumber: index + 1, referenceSlideId: chosen.referenceSlideId, mediaAssetId: asset?.id ?? null, renderedUrl: url, renderedS3Key: asset?.storage_key ?? null });
    }
    // Keep v1 fingerprints intact so an interrupted legacy save is recoverable.
    const fingerprint = createHash("sha256").update(JSON.stringify(ownedSequence
      ? { version: 2, referenceId: body.referenceId, slides, ...(editorDraft ? { editorDraft } : {}) }
      : { referenceId: body.referenceId, slides })).digest("hex");
    const title = reference?.title ?? (uploaded ? "Your uploaded slideshow" : "My slideshow");
    return { p_user_id: userId, p_request_key: body.requestKey as string, p_fingerprint: fingerprint,
      p_title: title, p_slides: slides, p_metadata: { referenceId: body.referenceId as string | null,
        ...(ownedSequence ? { slideshowDraftVersion: 2 } : {}), ...(editorDraft ? { editorDraft } : {}) } };

  } catch (error) {
    return json({ ok: false, error: error instanceof FirebaseAuthRequestError ? error.message : "Could not confirm the saved slideshow. Resume the same save." }, error instanceof FirebaseAuthRequestError ? error.status : 503);
  }
}

/** The website retains its original RPC, response and immutable v1/v2 fingerprints. */
export async function saveSlideshowForOwner(userId: string, body: unknown, actor?: Parameters<typeof canAccessCreatorAccounts>[0] & { uid?: string }) {
  const prepared = await prepareSlideshowSaveForOwner(userId, body,actor);
  if (prepared instanceof Response) return prepared;
  try {
    const databaseUrl = process.env.SUPABASE_URL?.trim() ?? process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const databaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!databaseUrl || !databaseKey) return reject("Slideshow saving is unavailable.", 503);
    const client = createClient(databaseUrl, databaseKey, { auth: { persistSession: false } });
    const { data, error } = await client.rpc("explore_save_slideshow", prepared);
    if (error || !isExploreUuid(data)) return json({ ok: false, error: "Could not confirm the saved slideshow. Resume the same save." }, 503);
    return json({ ok: true, id: data, kind: "library_item", title: prepared.p_title,
      url: prepared.p_slides[0].renderedUrl, slides: prepared.p_slides.map(slide => slide.renderedUrl) });
  } catch {
    return json({ ok: false, error: "Could not confirm the saved slideshow. Resume the same save." }, 503);
  }
}
