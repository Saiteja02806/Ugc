import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { requireAIStudioProUser } from "@/lib/ai-studio/server-access";
import { FirebaseAuthRequestError } from "@/lib/firebase/server-auth";
import { getRecreateReferences } from "@/lib/explore/recreate-catalog";
import { getMediaAssetForOwner } from "@/lib/media/media-storage";
import { isTrustedStorageUrl } from "@/lib/storage/storage";
import { isExploreUuid } from "@/worker/src/lib/explore-finishing-contract";

export async function POST(request: Request) {
  try {
    const user = await requireAIStudioProUser(request);
    if (process.env.EXPLORE_SLIDESHOW_SAVING_ENABLED !== "true") return Response.json({ error: "Slideshow saving is not enabled yet." }, { status: 503 });
    const raw = await request.text();
    if (raw.length > 16_384) return Response.json({ error: "The slideshow request is too large." }, { status: 413 });
    let body: { requestKey?: unknown; referenceId?: unknown; slides?: unknown };
    try { body = JSON.parse(raw); } catch { return Response.json({ error: "Choose a valid slideshow." }, { status: 400 }); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "Choose a valid slideshow." }, { status: 400 });
    if (!isExploreUuid(body.requestKey) || request.headers.get("Idempotency-Key") !== body.requestKey || typeof body.referenceId !== "string" || !Array.isArray(body.slides)) return Response.json({ error: "Choose a valid slideshow." }, { status: 400 });
    const reference = getRecreateReferences().find(item => item.id === body.referenceId && item.format === "slideshow");
    const uploaded = body.referenceId.startsWith("uploaded:") && isExploreUuid(body.referenceId.slice(9));
    if ((!reference && !uploaded) || body.slides.length < 2 || body.slides.length > 10) return Response.json({ error: "Choose a slideshow with 2–10 slides." }, { status: 400 });
    const referenceId = body.referenceId;
    const title = reference?.title ?? "Your uploaded slideshow";
    const slides = [];
    const seen = new Set<string>();
    for (const [index, value] of body.slides.entries()) {
      const chosen = value as { referenceSlideId?: unknown; mediaAssetId?: unknown } | null;
      if (!chosen || typeof chosen.referenceSlideId !== "string" || seen.has(chosen.referenceSlideId) || (chosen.mediaAssetId !== null && !isExploreUuid(chosen.mediaAssetId))) return Response.json({ error: "Choose each slide only once." }, { status: 400 });
      const original = reference?.slides.find(slide => slide.id === chosen.referenceSlideId);
      if (!original && (!uploaded || !isExploreUuid(chosen.referenceSlideId) || !isExploreUuid(chosen.mediaAssetId))) return Response.json({ error: "Choose slides from this reference or upload your own slideshow." }, { status: 400 });
      seen.add(chosen.referenceSlideId);
      const asset = chosen.mediaAssetId ? await getMediaAssetForOwner({ userId: user.uid, assetId: chosen.mediaAssetId as string }) : null;
      if (chosen.mediaAssetId && (!asset || asset.user_id !== user.uid || asset.deleted_at != null || asset.collection !== "image" || asset.status !== "ready" || !["image/jpeg", "image/png", "image/webp"].includes(asset.mime_type ?? ""))) return Response.json({ error: "Choose a ready image from your account." }, { status: 400 });
      const url = asset?.url ?? original?.url;
      if (!url || !url.startsWith("https://") || !isTrustedStorageUrl(url)) return Response.json({ error: "This slide is unavailable for publishing." }, { status: 400 });
      slides.push({ slideNumber: index + 1, referenceSlideId: chosen.referenceSlideId, mediaAssetId: asset?.id ?? null, renderedUrl: url, renderedS3Key: asset?.storage_key ?? null });
    }
    const fingerprint = createHash("sha256").update(JSON.stringify({ referenceId, slides })).digest("hex");
    const databaseUrl = process.env.SUPABASE_URL?.trim() ?? process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const databaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!databaseUrl || !databaseKey) throw new Error("Slideshow saving is unavailable.");
    const client = createClient(databaseUrl, databaseKey, { auth: { persistSession: false } });
    const { data, error } = await client.rpc("explore_save_slideshow", { p_user_id: user.uid, p_request_key: body.requestKey, p_fingerprint: fingerprint, p_title: title, p_slides: slides, p_metadata: { referenceId } });
    if (error || !isExploreUuid(data)) throw new Error("Could not confirm the saved slideshow. Retry the same save.");
    return Response.json({ ok: true, id: data, kind: "library_item", title, url: slides[0].renderedUrl, slides: slides.map(slide => slide.renderedUrl) });
  } catch (error) {
    return Response.json({ error: error instanceof FirebaseAuthRequestError ? error.message : error instanceof Error ? error.message : "Could not save the slideshow." }, { status: error instanceof FirebaseAuthRequestError ? error.status : 503 });
  }
}
